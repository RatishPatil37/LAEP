from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import numpy as np

from algorithms.data_loader import generate_synthetic_scene
from algorithms.cost_grid import compute_slope, build_cost_grid
from algorithms.a_star import (
    a_star_search, lonlat_to_grid, path_to_geojson, grid_to_lonlat
)
from config import GRID_SIZE, SOUTH_POLE_BBOX

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

    The lon/lat coordinates are converted to grid pixels, A* is executed
    on the cost grid, and the resulting path is converted back to lon/lat
    coordinates as a GeoJSON LineString.
    """
    scene = generate_synthetic_scene()
    dem = scene["dem"]
    shadow = scene["shadow_map"]
    slope = compute_slope(dem)
    cost_grid = build_cost_grid(slope, shadow, req.w_slope, req.w_shadow, req.max_slope)

    # Convert lon/lat → grid pixels
    start = lonlat_to_grid(req.start_lon, req.start_lat, GRID_SIZE, SOUTH_POLE_BBOX)
    goal  = lonlat_to_grid(req.goal_lon,  req.goal_lat,  GRID_SIZE, SOUTH_POLE_BBOX)

    # Validate that neither point is in an impassable cell
    if cost_grid[start] == np.inf:
        raise HTTPException(
            status_code=422,
            detail=f"Start point ({req.start_lon:.4f}, {req.start_lat:.4f}) is in impassable terrain (slope > {req.max_slope}°). Move the start marker to flatter ground."
        )
    if cost_grid[goal] == np.inf:
        raise HTTPException(
            status_code=422,
            detail=f"Goal point ({req.goal_lon:.4f}, {req.goal_lat:.4f}) is in impassable terrain (slope > {req.max_slope}°). Move the goal marker to flatter ground."
        )

    path = a_star_search(cost_grid, start, goal)

    if not path:
        raise HTTPException(
            status_code=422,
            detail="No navigable path found between the selected points. The terrain between them may be completely blocked by steep slopes. Try increasing the Max Slope threshold or choosing different points."
        )

    # Compute energy cost (sum of cost_grid values along the path)
    energy_cost = sum(float(cost_grid[r, c]) for r, c in path)

    # Path distance in km (each step = PIXEL_SIZE_M metres, diagonal = ×√2)
    from config import PIXEL_SIZE_M
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
            "max_slope_deg": round(max(path_slopes), 2),
            "mean_slope_deg": round(sum(path_slopes) / len(path_slopes), 2),
            "max_ics_along_path": round(max(path_ics), 3),
        },
    }


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

    # Sample up to 5 candidate sites spread across the grid
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
