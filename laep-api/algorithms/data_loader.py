"""
data_loader.py — Loads real ISRO shapefile data OR generates synthetic data.

The real data (ch2_sar_der_mosaic_sp.shp) is a Chandrayaan-2 SAR derived mosaic
in Moon 2000 South Pole Stereographic projection. This module reads the shapefile,
reprojects footprint centroids to lat/lon, and returns them as GeoJSON features.

For the simulation grid (DEM, ice score, shadow), synthetic data is generated
to be scientifically plausible for the South Pole region.
"""
import numpy as np
from scipy.ndimage import gaussian_filter
from pathlib import Path
import json

from config import (
    GRID_SIZE, PIXEL_SIZE_M, CH2_SHAPEFILE,
    MOON_SP_STEREO_PROJ4, MOON_GEO_PROJ4, SOUTH_POLE_BBOX
)

# ──────────────────────────────────────────────────────────────────────────────
# Synthetic simulation data (always available as fallback)
# ──────────────────────────────────────────────────────────────────────────────
_cache: dict = {}

def generate_synthetic_scene() -> dict:
    """
    Generates a scientifically plausible south-pole crater scene as numpy arrays.
    Called once and cached in memory.
    Returns: {dem, shadow_map, ice_score, cpr_map, dop_map}
    """
    global _cache
    if _cache:
        return _cache

    rng = np.random.default_rng(42)
    G = GRID_SIZE

    # ── DEM: crater bowl with rim and noise ───────────────────────────────
    x, y = np.ogrid[:G, :G]
    cx, cy = G // 2, G // 2
    dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)

    dem = rng.normal(100.0, 2.5, (G, G))                 # flat highland base
    crater_r = G * 0.35
    bowl_mask = dist < crater_r
    dem[bowl_mask] -= 45.0 * (1 - (dist[bowl_mask] / crater_r) ** 2)  # parabolic bowl

    # Secondary smaller sub-crater (doubly shadowed — highest ice probability)
    sub_cx, sub_cy = int(cx * 1.05), int(cy * 0.95)
    sub_dist = np.sqrt((x - sub_cx) ** 2 + (y - sub_cy) ** 2)
    sub_mask = sub_dist < G * 0.08
    dem[sub_mask] -= 20.0 * (1 - (sub_dist[sub_mask] / (G * 0.08)) ** 2)

    dem = gaussian_filter(dem, sigma=4)   # smooth to realistic terrain

    # ── Shadow persistence: deeper = more permanently shadowed ────────────
    depth_from_surface = 100.0 - dem
    shadow_map = np.clip(depth_from_surface / 50.0, 0, 1)

    # ── CPR (Circular Polarisation Ratio) ─────────────────────────────────
    # Normally ~0.3-0.6 for rocky terrain; elevated (>1.0) for subsurface ice
    cpr_map = rng.uniform(0.3, 0.7, (G, G))
    cpr_map = gaussian_filter(cpr_map, sigma=2)
    cpr_map[sub_mask] = rng.uniform(1.05, 1.8, np.sum(sub_mask))   # ice signature

    # ── DOP (Degree of Polarisation) ──────────────────────────────────────
    # Normally ~0.4-0.8 for rough rocky surface; low (<0.13) indicates ice
    dop_map = rng.uniform(0.4, 0.85, (G, G))
    dop_map = gaussian_filter(dop_map, sigma=2)
    dop_map[sub_mask] = rng.uniform(0.02, 0.12, np.sum(sub_mask))  # ice signature

    # ── Ice Confidence Score: physics-based filter ────────────────────────
    from algorithms.ice_confidence import compute_ics
    ice_score = compute_ics(cpr_map, dop_map)

    _cache = {
        "dem": dem,
        "shadow_map": shadow_map,
        "ice_score": ice_score,
        "cpr_map": cpr_map,
        "dop_map": dop_map,
    }
    return _cache


# ──────────────────────────────────────────────────────────────────────────────
# Real ISRO shapefile reader
# ──────────────────────────────────────────────────────────────────────────────
def load_ch2_shapefile_geojson() -> dict | None:
    """
    Reads the real Chandrayaan-2 SAR derived mosaic shapefile,
    reprojects all geometry from Moon South Pole Stereographic → lon/lat,
    and returns a GeoJSON FeatureCollection.

    Returns None if the shapefile is unavailable or pyshp/pyproj not installed.
    """
    if not CH2_SHAPEFILE.exists():
        return None

    try:
        import shapefile       # pyshp
        from pyproj import Transformer

        transformer = Transformer.from_proj(
            MOON_SP_STEREO_PROJ4,
            MOON_GEO_PROJ4,
            always_xy=True,
        )

        sf = shapefile.Reader(str(CH2_SHAPEFILE))
        features = []

        for shape_rec in sf.shapeRecords():
            geom = shape_rec.shape
            rec  = shape_rec.record.as_dict()

            if geom.shapeType == 0:     # Null shape, skip
                continue

            # Reproject all points
            pts = geom.points
            xs  = [p[0] for p in pts]
            ys  = [p[1] for p in pts]
            lons, lats = transformer.transform(xs, ys)
            reproj_pts = [[round(lo, 6), round(la, 6)] for lo, la in zip(lons, lats)]

            # Build GeoJSON geometry (Polygon or MultiPolygon)
            if geom.shapeType in (5, 15, 25):   # Polygon family
                # shapefile parts define ring boundaries
                parts = list(geom.parts) + [len(pts)]
                rings = [reproj_pts[parts[i]: parts[i+1]] for i in range(len(parts) - 1)]
                geo = {"type": "Polygon", "coordinates": rings}
            else:
                geo = {"type": "Point", "coordinates": reproj_pts[0] if reproj_pts else [0, 0]}

            features.append({
                "type": "Feature",
                "geometry": geo,
                "properties": rec,
            })

        return {"type": "FeatureCollection", "features": features}

    except Exception as e:
        print(f"[data_loader] Shapefile load failed: {e}")
        return None
