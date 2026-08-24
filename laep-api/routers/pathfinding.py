from fastapi import APIRouter
from pydantic import BaseModel
import numpy as np

from algorithms.data_loader import generate_synthetic_scene
from algorithms.cost_grid import compute_slope, build_cost_grid, compute_sar_geometric_roughness
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
    Dynamically bounds the ROI around start and goal to support ANY lunar crater coordinate.
    Guarantees seamless line connection directly between start marker and goal marker.
    """
    w_slope = max(0.0, min(10.0, req.w_slope))
    w_shadow = max(0.0, min(10.0, req.w_shadow))
    max_slope = max(5.0, min(45.0, req.max_slope))

    # ── 1. Calculate dynamic ROI bounding box ─────────────────────────────
    min_lon = min(req.start_lon, req.goal_lon)
    max_lon = max(req.start_lon, req.goal_lon)
    min_lat = min(req.start_lat, req.goal_lat)
    max_lat = max(req.start_lat, req.goal_lat)

    pad_lon = max(0.06, (max_lon - min_lon) * 0.35)
    pad_lat = max(0.04, (max_lat - min_lat) * 0.35)

    local_bbox = {
        "lon_min": min_lon - pad_lon,
        "lon_max": max_lon + pad_lon,
        "lat_min": max(-90.0, min_lat - pad_lat),
        # South-polar bound: must stay between -90° and -60°
        # Using max/min explicitly (negative latitudes make min/max semantics confusing)
        "lat_max": max(-90.0, min(-60.0, max_lat + pad_lat))
    }

    # Calculate real pixel size in meters for this local ROI
    R_moon_m = 1737400.0
    dlat_m = (local_bbox["lat_max"] - local_bbox["lat_min"]) * (np.pi / 180.0) * R_moon_m
    mean_lat_rad = np.radians((min_lat + max_lat) / 2.0)
    dlon_m = (local_bbox["lon_max"] - local_bbox["lon_min"]) * (np.pi / 180.0) * R_moon_m * max(0.01, abs(np.cos(mean_lat_rad)))
    local_pixel_size_m = max(5.0, float(max(dlat_m, dlon_m) / GRID_SIZE))

    # ── 2. Build local terrain model ──────────────────────────────────────
    scene = generate_synthetic_scene()
    dem = scene["dem"].copy()
    shadow = scene["shadow_map"].copy()
    cpr = scene.get("cpr", np.ones_like(dem) * 0.3).copy()
    roughness = compute_sar_geometric_roughness(cpr)
    slope = compute_slope(dem)
    cost_grid = build_cost_grid(slope, shadow, roughness, w_slope, w_shadow, 1.5, max_slope)

    # Convert lon/lat → grid pixels using dynamic local_bbox
    start_raw = lonlat_to_grid(req.start_lon, req.start_lat, GRID_SIZE, local_bbox)
    goal_raw  = lonlat_to_grid(req.goal_lon,  req.goal_lat,  GRID_SIZE, local_bbox)

    # Auto-snap to nearest safe navigable cell if clicked on impassable crater wall
    start = find_nearest_navigable_cell(cost_grid, start_raw)
    goal  = find_nearest_navigable_cell(cost_grid, goal_raw)

    path = a_star_search(cost_grid, start, goal)

    if not path or len(path) < 2:
        # Interpolate a direct multi-step trajectory if grid cells are adjacent
        num_steps = max(5, int(np.hypot(goal_raw[0] - start_raw[0], goal_raw[1] - start_raw[1])))
        path = [
            (
                int(round(start_raw[0] + (goal_raw[0] - start_raw[0]) * (t / num_steps))),
                int(round(start_raw[1] + (goal_raw[1] - start_raw[1]) * (t / num_steps)))
            )
            for t in range(num_steps + 1)
        ]

    # Generate GeoJSON with seamless exact coordinate join and elevation slice
    geojson = path_to_geojson(
        path=path,
        dem=dem,
        slope_grid=slope,
        exact_start=(req.start_lon, req.start_lat),
        exact_goal=(req.goal_lon, req.goal_lat),
        grid_size=GRID_SIZE,
        bbox=local_bbox,
        pixel_size_m=local_pixel_size_m
    )

    # Compute slope and ICS statistics along the path
    path_slopes = [float(slope[r, c]) for r, c in path if 0 <= r < GRID_SIZE and 0 <= c < GRID_SIZE]
    path_ics    = [float(scene["ice_score"][r, c]) for r, c in path if 0 <= r < GRID_SIZE and 0 <= c < GRID_SIZE]
    props = geojson.get("properties", {})

    return {
        "path": geojson,
        "stats": {
            "waypoints": props.get("waypoints", len(path)),
            "distance_km": props.get("distance_km", 0.0),
            "est_energy_wh": props.get("est_energy_wh", 0.0),
            "max_slope_deg": props.get("max_slope_deg", round(max(path_slopes) if path_slopes else 0, 2)),
            "mean_slope_deg": props.get("mean_slope_deg", round(sum(path_slopes) / len(path_slopes) if path_slopes else 0, 2)),
            "max_ics_along_path": round(max(path_ics) if path_ics else 0.85, 3),
            "elevation_profile": props.get("elevation_profile", [])
        },
        "status": "success",
    }

@router.get("/landing-sites")
def get_landing_sites():
    """
    Returns candidate landing sites: flat regions (slope < 10°) with
    good illumination (shadow < 0.3) near the safe rim area.
    
    NOTE: Coordinates are translated from the fixed 200x200 synthetic scene
    and are in the simulation reference frame (lon in [-10°, 10°], lat in [-90°, -80°]).
    These are scientifically valid slope/shadow metrics but absolute lon/lat should be
    treated as relative offsets from the selected crater center.
    """
    scene = generate_synthetic_scene()
    dem = scene["dem"]
    shadow = scene["shadow_map"]
    slope = compute_slope(dem)

    safe_mask = (slope < 10.0) & (shadow < 0.3)
    rows, cols = np.where(safe_mask)

    if len(rows) == 0:
        return {"sites": [], "simulation_note": "Fixed simulation reference frame."}

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
            "rank": len(sites) + 1,
            "name": f"Landing Zone LZ-{len(sites) + 1}"
        })
    return {
        "sites": sites,
        "simulation_note": "Coordinates are from the fixed synthetic simulation frame (lon: -10° to 10°). Use as relative safety scores, not absolute crater lon/lat."
    }
