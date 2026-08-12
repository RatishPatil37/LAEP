"""
cost_grid.py — Builds the A* traversal cost grid from terrain data.

Cost function per cell:
  cost(i,j) = 1 + W_slope * slope(i,j) + W_shadow * shadow(i,j) * 50

Impassable cells (slope > max_slope) are set to np.inf.
"""
import numpy as np
from scipy.ndimage import generic_filter
from config import PIXEL_SIZE_M, MAX_SLOPE_DEG


def compute_slope(dem: np.ndarray, pixel_size_m: float = PIXEL_SIZE_M) -> np.ndarray:
    """
    Compute slope in degrees from a DEM array.
    Uses numpy.gradient (central differences) — matches GIS standard.
    """
    dz_dy, dz_dx = np.gradient(dem, pixel_size_m)
    slope_rad = np.arctan(np.sqrt(dz_dx ** 2 + dz_dy ** 2))
    return np.degrees(slope_rad).astype(np.float32)


def compute_roughness(dem: np.ndarray, window: int = 3) -> np.ndarray:
    """
    Local roughness = standard deviation of elevation in a sliding window.
    Higher roughness → more boulders / less safe for rover.
    """
    def local_std(arr):
        return arr.std()

    roughness = generic_filter(dem, local_std, size=window)
    # Normalise to [0, 1]
    r_max = roughness.max()
    if r_max > 0:
        roughness /= r_max
    return roughness.astype(np.float32)


def build_cost_grid(
    slope: np.ndarray,
    shadow_map: np.ndarray,
    w_slope: float = 1.0,
    w_shadow: float = 2.0,
    max_slope: float = MAX_SLOPE_DEG,
) -> np.ndarray:
    """
    Fuse slope and shadow persistence into a traversal cost grid.

    Args:
        slope:      2D slope array (degrees)
        shadow_map: 2D shadow persistence [0, 1]
        w_slope:    Penalty weight for slope
        w_shadow:   Penalty weight for shadow (battery drain)
        max_slope:  Hard cutoff — cells above this become impassable (inf)

    Returns:
        cost_grid: 2D float32 array (np.inf = impassable)
    """
    cost = np.ones_like(slope, dtype=np.float32)
    cost += (w_slope * slope).astype(np.float32)
    cost += (w_shadow * shadow_map * 50.0).astype(np.float32)
    cost[slope > max_slope] = np.inf
    return cost


def cost_grid_to_rgba_png(cost_grid: np.ndarray) -> bytes:
    """
    Render the cost grid as a transparent PNG heatmap.
    Low cost → green (safe). High cost → red. Impassable → dark red.
    """
    from PIL import Image
    import io

    H, W = cost_grid.shape
    rgba = np.zeros((H, W, 4), dtype=np.uint8)

    finite_mask = np.isfinite(cost_grid)
    inf_mask = ~finite_mask

    if finite_mask.any():
        v = cost_grid[finite_mask]
        v_norm = np.clip((v - v.min()) / (v.max() - v.min() + 1e-9), 0, 1)
        # Green → Yellow → Red
        r = np.clip(v_norm * 2, 0, 1) * 220
        g = np.clip((1 - v_norm) * 2, 0, 1) * 200
        b = np.zeros_like(v_norm)
        rgba[finite_mask, 0] = r.astype(np.uint8)
        rgba[finite_mask, 1] = g.astype(np.uint8)
        rgba[finite_mask, 2] = b.astype(np.uint8)
        rgba[finite_mask, 3] = 160   # semi-transparent

    # Impassable = dark opaque red
    rgba[inf_mask] = [160, 0, 0, 200]

    img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()
