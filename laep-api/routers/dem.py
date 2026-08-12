from fastapi import APIRouter
from fastapi.responses import Response
import numpy as np
from algorithms.data_loader import generate_synthetic_scene
from algorithms.cost_grid import compute_slope, build_cost_grid, cost_grid_to_rgba_png
from config import GRID_SIZE, SOUTH_POLE_BBOX

router = APIRouter()


@router.get("/dem")
def get_dem():
    """Returns the DEM as a flat JSON array + grid metadata."""
    scene = generate_synthetic_scene()
    dem: np.ndarray = scene["dem"]
    slope = compute_slope(dem)
    shadow = scene["shadow_map"]

    return {
        "grid_size": GRID_SIZE,
        "bbox": SOUTH_POLE_BBOX,
        "dem": dem.flatten().tolist(),
        "slope": slope.flatten().tolist(),
        "shadow": shadow.flatten().tolist(),
        "dem_min": float(dem.min()),
        "dem_max": float(dem.max()),
        "slope_min": float(slope.min()),
        "slope_max": float(slope.max()),
    }


@router.get("/hazard-map", response_class=Response)
def get_hazard_map(w_slope: float = 1.0, w_shadow: float = 2.0, max_slope: float = 15.0):
    """Returns the cost/hazard grid as a transparent RGBA PNG overlay."""
    scene = generate_synthetic_scene()
    dem = scene["dem"]
    slope = compute_slope(dem)
    shadow = scene["shadow_map"]
    cost_grid = build_cost_grid(slope, shadow, w_slope, w_shadow, max_slope)
    png_bytes = cost_grid_to_rgba_png(cost_grid)
    return Response(content=png_bytes, media_type="image/png")
