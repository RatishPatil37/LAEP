"""
cost_grid.py — Builds the A* traversal cost grid from multi-sensor terrain data.

Incorporates:
- Slope (gradient central difference in degrees)
- Dual-axis SAR geometric mean roughness W_z = sqrt(|W_p * W_q|)
- Shadow persistence (battery drain)
- Micro-hazard & boulder penalty
"""
import numpy as np
from scipy.ndimage import generic_filter
from config import PIXEL_SIZE_M, MAX_SLOPE_DEG

def compute_slope(dem: np.ndarray, pixel_size_m: float = PIXEL_SIZE_M) -> np.ndarray:
    """
    Compute slope in degrees from a DEM array using central differences.
    """
    dz_dy, dz_dx = np.gradient(dem, pixel_size_m)
    slope_rad = np.arctan(np.sqrt(dz_dx ** 2 + dz_dy ** 2))
    return np.degrees(slope_rad).astype(np.float32)

def compute_sar_geometric_roughness(sar_img: np.ndarray, window: int = 5, eps: float = 1e-6) -> np.ndarray:
    """
    Computes Dual-Axis SAR Geometric Mean Roughness W_z = sqrt(|W_p * W_q|)
    with regularized denominator (eps = 1e-6) to prevent flat terrain singularities.
    """
    diff_p = np.abs(np.diff(sar_img, axis=1, prepend=sar_img[:, :1]))
    sum_p = sar_img + np.roll(sar_img, 1, axis=1) + eps
    sim_p = np.clip(1.0 - (diff_p / sum_p), eps, 1.0 - eps)
    var_p = np.var(sar_img) + eps
    w_p = np.abs(np.log(var_p) / np.log(sim_p))

    diff_q = np.abs(np.diff(sar_img, axis=0, prepend=sar_img[:1, :]))
    sum_q = sar_img + np.roll(sar_img, 1, axis=0) + eps
    sim_q = np.clip(1.0 - (diff_q / sum_q), eps, 1.0 - eps)
    var_q = np.var(sar_img) + eps
    w_q = np.abs(np.log(var_q) / np.log(sim_q))

    w_z = np.sqrt(np.abs(w_p * w_q))
    w_max = np.nanmax(w_z)
    if w_max > 0:
        w_z = np.nan_to_num(w_z / w_max, nan=0.0)
    return w_z.astype(np.float32)

def compute_roughness(dem: np.ndarray, window: int = 3) -> np.ndarray:
    """
    Local roughness = standard deviation of elevation in a sliding window.
    """
    def local_std(arr):
        return arr.std()

    roughness = generic_filter(dem, local_std, size=window)
    r_max = roughness.max()
    if r_max > 0:
        roughness /= r_max
    return roughness.astype(np.float32)

def build_cost_grid(
    slope: np.ndarray,
    shadow_map: np.ndarray,
    roughness: np.ndarray = None,
    w_slope: float = 1.0,
    w_shadow: float = 2.0,
    w_roughness: float = 1.5,
    max_slope: float = MAX_SLOPE_DEG,
) -> np.ndarray:
    """
    Fuse slope, roughness, and shadow persistence into a Multi-Modal Hazard Index (MHI).
    """
    cost = np.ones_like(slope, dtype=np.float32)
    cost += (w_slope * slope).astype(np.float32)
    cost += (w_shadow * shadow_map * 50.0).astype(np.float32)
    
    if roughness is not None:
        cost += (w_roughness * roughness * 20.0).astype(np.float32)
        
    cost[slope > max_slope] = np.inf
    return cost

def cost_grid_to_rgba_png(cost_grid: np.ndarray) -> bytes:
    """
    Render the cost grid as a transparent PNG heatmap.
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
        r = np.clip(v_norm * 2, 0, 1) * 220
        g = np.clip((1 - v_norm) * 2, 0, 1) * 200
        b = np.zeros_like(v_norm)
        rgba[finite_mask, 0] = r.astype(np.uint8)
        rgba[finite_mask, 1] = g.astype(np.uint8)
        rgba[finite_mask, 2] = b.astype(np.uint8)
        rgba[finite_mask, 3] = 160

    rgba[inf_mask] = [160, 0, 0, 200]

    img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()

def slope_to_rgba_png(slope: np.ndarray) -> bytes:
    """
    Render slope gradient: Green (0–7°), Amber/Orange (7–15°), Red (>15° cliff).
    """
    from PIL import Image
    import io

    H, W = slope.shape
    rgba = np.zeros((H, W, 4), dtype=np.uint8)

    # 0 to 25 deg normalization
    norm = np.clip(slope / 22.0, 0.0, 1.0)
    
    # Red channel increases with slope
    r = np.clip(norm * 2.0, 0, 1) * 240
    # Green channel decreases with steep slope
    g = np.clip((1.0 - norm) * 1.8, 0, 1) * 220
    b = np.zeros_like(norm)
    a = np.clip(norm * 140 + 50, 40, 190)

    rgba[:, :, 0] = r.astype(np.uint8)
    rgba[:, :, 1] = g.astype(np.uint8)
    rgba[:, :, 2] = b.astype(np.uint8)
    rgba[:, :, 3] = a.astype(np.uint8)

    img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()

def shadow_to_rgba_png(shadow_map: np.ndarray) -> bytes:
    """
    Render Permanent Shadow Regions (PSR cold traps) in translucent deep navy / cyan border.
    """
    from PIL import Image
    import io

    H, W = shadow_map.shape
    rgba = np.zeros((H, W, 4), dtype=np.uint8)

    mask = shadow_map > 0.3
    rgba[mask, 0] = 12
    rgba[mask, 1] = 28
    rgba[mask, 2] = 88
    rgba[mask, 3] = 165

    img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()

def roughness_to_rgba_png(roughness: np.ndarray) -> bytes:
    """
    Render SAR geometric roughness in high-contrast amber/copper.
    """
    from PIL import Image
    import io

    H, W = roughness.shape
    rgba = np.zeros((H, W, 4), dtype=np.uint8)

    norm = np.clip(roughness, 0.0, 1.0)
    mask = norm > 0.1
    v = norm[mask]

    rgba[mask, 0] = np.clip(220 + v * 35, 200, 255).astype(np.uint8)
    rgba[mask, 1] = (120 + v * 80).astype(np.uint8)
    rgba[mask, 2] = (v * 40).astype(np.uint8)
    rgba[mask, 3] = np.clip(v * 160 + 40, 40, 200).astype(np.uint8)

    img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()
