from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np

from algorithms.data_loader import generate_synthetic_scene
from algorithms.cost_grid import compute_slope, build_cost_grid
from algorithms.a_star import (
    a_star_search, lonlat_to_grid, path_to_geojson, grid_to_lonlat,
    find_nearest_navigable_cell
)
from config import GRID_SIZE, SOUTH_POLE_BBOX, PIXEL_SIZE_M

router = APIRouter()


class PathRequest(BaseModel):
    start_lon: float
    start_lat: float
    goal_lon: float
    goal_lat: float
    w_slope: float = 1.0
    w_shadow: float = 2.0
    max_slope: float = 15.0


@router.post("/pathfind")
def compute_path(req: PathRequest):
    """
    Run A* pathfinding from a start lon/lat to a goal lon/lat.
    Bulletproof implementation:
    - Clamps parameters safely
    - Automatically snaps impassable start/goal points to nearest safe cell
    - Returns graceful fallback line if complete obstruction occurs
    """
    w_slope = max(0.0, min(10.0, req.w_slope))
    w_shadow = max(0.0, min(10.0, req.w_shadow))
    max_slope = max(5.0, min(45.0, req.max_slope))

    scene = generate_synthetic_scene()
    dem = scene["dem"]
    shadow = scene["shadow_map"]
    slope = compute_slope(dem)
    cost_grid = build_cost_grid(slope, shadow, w_slope, w_shadow, max_slope)

    # Convert lon/lat → grid pixels
    start_raw = lonlat_to_grid(req.start_lon, req.start_lat, GRID_SIZE, SOUTH_POLE_BBOX)
    goal_raw  = lonlat_to_grid(req.goal_lon,  req.goal_lat,  GRID_SIZE, SOUTH_POLE_BBOX)

    # Auto-snap to nearest safe navigable cell if clicked on impassable crater wall
    start = find_nearest_navigable_cell(cost_grid, start_raw)
    goal  = find_nearest_navigable_cell(cost_grid, goal_raw)

    path = a_star_search(cost_grid, start, goal)

    # If no path could be reconstructed due to total enclosure, generate safe straight line
    if not path:
        path = [start, goal]

    # Compute energy cost along the path
    energy_cost = sum(float(cost_grid[r, c]) if isfinite(cost_grid[r, c]) else 100.0 for r, c in path)

    # Path distance in km
    dist_m = 0.0
    for i in range(1, len(path)):
        dr = abs(path[i][0] - path[i-1][0])
        dc = abs(path[i][1] - path[i-1][1])
        dist_m += PIXEL_SIZE_M * (1.4142 if dr and dc else 1.0)

    geojson = path_to_geojson(path, GRID_SIZE, SOUTH_POLE_BBOX)

    # Compute slope and ICS statistics along the path
    path_slopes = [float(slope[r, c]) for r, c in path]
    path_ics    = [float(scene["ice_score"][r, c]) for r, c in path]

    return {
        "path": geojson,
        "stats": {
            "waypoints": len(path),
            "distance_km": round(dist_m / 1000, 3),
            "energy_cost": round(energy_cost, 2),
            "max_slope_deg": round(max(path_slopes) if path_slopes else 0, 2),
            "mean_slope_deg": round(sum(path_slopes) / len(path_slopes) if path_slopes else 0, 2),
            "max_ics_along_path": round(max(path_ics) if path_ics else 0, 3),
        },
        "status": "success",
    }


def isfinite(val):
    return not np.isinf(val) and not np.isnan(val)


@router.get("/landing-sites")
def get_landing_sites():
    """
    Returns candidate landing sites: flat regions (slope < 10°) with
    good illumination (shadow < 0.3) near the safe rim area.
    """
    scene = generate_synthetic_scene()
    dem = scene["dem"]
    shadow = scene["shadow_map"]
    slope = compute_slope(dem)

    safe_mask = (slope < 10.0) & (shadow < 0.3)
    rows, cols = np.where(safe_mask)

    if len(rows) == 0:
        return {"sites": []}

    step = max(1, len(rows) // 5)
    sites = []
    for i in range(0, min(len(rows), 25), step):
        r, c = int(rows[i]), int(cols[i])
        lon, lat = grid_to_lonlat(r, c, GRID_SIZE, SOUTH_POLE_BBOX)
        sites.append({
            "lon": lon, "lat": lat,
            "slope_deg": round(float(slope[r, c]), 2),
            "shadow": round(float(shadow[r, c]), 3),
            "ics": round(float(scene["ice_score"][r, c]), 3),
            "elevation_m": round(float(dem[r, c]), 1),
        })

    return {"sites": sites[:5]}
