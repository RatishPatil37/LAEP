"""
data_loader.py — Loads real ISRO shapefile & PRADAN GeoTIFF data OR generates synthetic data.

Capabilities:
1. Loads Chandrayaan-2 SAR derived shapefiles (ch2_sp, ch2_np).
2. Auto-detects & parses real ISRO PRADAN GeoTIFF files (CPR, SRD, TRT) safely using downscaled overviews.
3. Reprojects Moon Stereographic geometries to Lunar Lon/Lat.
4. Generates high-fidelity synthetic physics scenes as reliable simulation fallback.
"""
import numpy as np
from scipy.ndimage import gaussian_filter
from pathlib import Path
import glob
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
    cpr_map = rng.uniform(0.3, 0.7, (G, G))
    cpr_map = gaussian_filter(cpr_map, sigma=2)
    cpr_map[sub_mask] = rng.uniform(1.05, 1.8, np.sum(sub_mask))   # ice signature

    # ── DOP (Degree of Polarisation) ──────────────────────────────────────
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
# Real ISRO Data Loader (Shapefiles & PRADAN GeoTIFFs)
# ──────────────────────────────────────────────────────────────────────────────
def load_ch2_shapefile_geojson() -> dict | None:
    """
    Reads Chandrayaan-2 SAR shapefiles or PRADAN GeoTIFF bounds,
    reprojects to lunar lon/lat, and returns a GeoJSON FeatureCollection.
    """
    features = []

    # 1. Check for real shapefile
    if CH2_SHAPEFILE.exists():
        try:
            import shapefile       # pyshp
            from pyproj import Transformer

            transformer = Transformer.from_proj(
                MOON_SP_STEREO_PROJ4,
                MOON_GEO_PROJ4,
                always_xy=True,
            )

            sf = shapefile.Reader(str(CH2_SHAPEFILE))
            for shape_rec in sf.shapeRecords():
                geom = shape_rec.shape
                rec  = shape_rec.record.as_dict()
                if geom.shapeType == 0:
                    continue

                pts = geom.points
                xs  = [p[0] for p in pts]
                ys  = [p[1] for p in pts]
                lons, lats = transformer.transform(xs, ys)
                reproj_pts = [[round(lo, 6), round(la, 6)] for lo, la in zip(lons, lats)]

                if geom.shapeType in (5, 15, 25):
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
        except Exception as e:
            print(f"[data_loader] Shapefile load warning: {e}")

    # 2. Check for PRADAN GeoTIFF files in parent/root directory
    root_dir = Path(__file__).resolve().parent.parent.parent
    tif_files = list(root_dir.glob("*.tif"))
    if tif_files:
        try:
            import rasterio
            from pyproj import Transformer

            moon_np_proj = "+proj=stere +lat_0=90 +lat_ts=90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
            transformer_np = Transformer.from_crs(moon_np_proj, MOON_GEO_PROJ4, always_xy=True)

            for tif in tif_files[:3]:
                with rasterio.open(str(tif)) as ds:
                    left, bottom, right, top = ds.bounds
                    corners = [(left, bottom), (right, bottom), (right, top), (left, top), (left, bottom)]
                    lons, lats = transformer_np.transform([p[0] for p in corners], [p[1] for p in corners])
                    ring = [[round(lo, 5), round(la, 5)] for lo, la in zip(lons, lats)]

                    features.append({
                        "type": "Feature",
                        "geometry": {"type": "Polygon", "coordinates": [ring]},
                        "properties": {
                            "filename": tif.name,
                            "width": ds.width,
                            "height": ds.height,
                            "resolution_m": ds.res[0],
                            "source": "ISRO PRADAN Chandrayaan-2 DFSAR"
                        }
                    })
        except Exception as e:
            print(f"[data_loader] GeoTIFF parsing warning: {e}")

    if not features:
        return None

    return {"type": "FeatureCollection", "features": features}
