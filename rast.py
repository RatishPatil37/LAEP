"""
rast.py — Chandrayaan-2 DFSAR GeoTIFF & Vector Processor (ISRO PRADAN)

Features:
1. Auto-detects North Pole (+90°) vs South Pole (-90°) Polar Stereographic CRS
2. Windows-safe UTF-8 console output handling (no charmap codec errors)
3. Memory-safe windowed/downsampled overview reading of gigapixel rasters (>470M pixels)
4. Fast CPR, SRD, and TRT radar polarimetry statistics extraction
5. GeoJSON polygon export with reprojected lunar lon/lat coordinates
"""
import os
import sys
import json
import numpy as np

# Ensure Windows terminal handles UTF-8 correctly
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import rasterio
import rasterio.features
import rasterio.warp
from pyproj import Transformer

# ── 1. Dynamic Lunar CRS Transformer Factory ──────────────────────────────────
# Moon 2000 Polar Stereographic (IAU 2000 Moon, R = 1,737,400 m)
def get_lunar_transformer(is_south_pole=False):
    lat_origin = -90 if is_south_pole else 90
    proj_stere = f"+proj=stere +lat_0={lat_origin} +lat_ts={lat_origin} +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
    proj_lonlat = "+proj=longlat +R=1737400 +no_defs"
    return Transformer.from_crs(proj_stere, proj_lonlat, always_xy=True)

def reproject_geom_to_lunar_lonlat(geom, transformer):
    """Transform GeoJSON geometry from Moon Stereographic (meters) to Lon/Lat (degrees)."""
    coords = geom['coordinates']
    def transform_ring(ring):
        new_ring = []
        for x, y in ring:
            lon, lat = transformer.transform(x, y)
            new_ring.append([round(lon, 5), round(lat, 5)])
        return new_ring

    if geom['type'] == 'Polygon':
        new_coords = [transform_ring(r) for r in coords]
    elif geom['type'] == 'MultiPolygon':
        new_coords = [[transform_ring(r) for r in poly] for poly in coords]
    else:
        return geom
    return {'type': geom['type'], 'coordinates': new_coords}

def process_cpr_geotiff(filepath, downscale=50):
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        return None

    filename = os.path.basename(filepath).lower()
    is_south_pole = "sp" in filename or "south" in filename

    transformer = get_lunar_transformer(is_south_pole=is_south_pole)
    pole_str = "South Pole (-90°)" if is_south_pole else "North Pole (+90°)"

    print("=" * 70)
    print(f"ISRO Chandrayaan-2 DFSAR Ingestion Engine")
    print(f"Target File : {os.path.basename(filepath)}")
    print(f"Target Zone : {pole_str}")
    print("=" * 70)

    with rasterio.open(filepath) as ds:
        megapixels = (ds.width * ds.height) / 1e6
        print(f"Raster Dimensions: {ds.width:,} x {ds.height:,} pixels ({megapixels:.1f} Megapixels)")
        print(f"Spatial Resolution: {ds.res[0]:.1f}m x {ds.res[1]:.1f}m per pixel")
        print(f"Stereographic Bounds (m): Left={ds.bounds.left:.1f}, Bottom={ds.bounds.bottom:.1f}, Right={ds.bounds.right:.1f}, Top={ds.bounds.top:.1f}")

        # Footprint Bounding Box in Lon/Lat
        left, bottom, right, top = ds.bounds
        corners_stere = [(left, bottom), (right, bottom), (right, top), (left, top), (left, bottom)]
        corners_lonlat = [transformer.transform(x, y) for x, y in corners_stere]

        print("\n[Footprint Lon/Lat Bounding Coordinates]:")
        for (x_m, y_m), (lon, lat) in zip(corners_stere, corners_lonlat):
            print(f"  Stereo ({x_m:>10.1f}m, {y_m:>10.1f}m)  -->  Lunar ({lon:>8.3f}°, {lat:>8.3f}°)")

        # Fast memory-safe overview reading
        overview_shape = (max(10, ds.height // downscale), max(10, ds.width // downscale))
        print(f"\n[Generating Safe Overview Matrix]: {overview_shape[1]} x {overview_shape[0]} pixels...")
        cpr_data = ds.read(1, out_shape=overview_shape)

        valid_mask = (cpr_data > 0) & np.isfinite(cpr_data)
        valid_cpr = cpr_data[valid_mask]

        if len(valid_cpr) > 0:
            print("\n[Polarimetric Statistics on Valid DFSAR Data]:")
            print(f"  Valid Data Pixels : {len(valid_cpr):,}")
            print(f"  Min Value         : {np.min(valid_cpr):.4f}")
            print(f"  Max Value         : {np.max(valid_cpr):.4f}")
            print(f"  Mean Value        : {np.mean(valid_cpr):.4f}")
            print(f"  Median Value      : {np.median(valid_cpr):.4f}")

            # Subsurface Ice Detection (CPR > 1.0)
            ice_candidates = cpr_data > 1.0
            ice_count = int(np.sum(ice_candidates))
            ice_pct = (ice_count / len(valid_cpr)) * 100
            print(f"\n[Ice Detection Criterion: CPR > 1.0 (Sinha et al. 2026)]:")
            print(f"  High-CPR Anomaly Pixels : {ice_count:,} ({ice_pct:.2f}% of observed footprint)")

        # Vectorize valid data boundaries
        overview_transform = ds.transform * ds.transform.scale(
            (ds.width / cpr_data.shape[1]),
            (ds.height / cpr_data.shape[0])
        )

        shapes = rasterio.features.shapes(
            valid_mask.astype(np.uint8),
            mask=valid_mask,
            transform=overview_transform
        )

        features = []
        for geom, val in shapes:
            if val == 1:
                lunar_geom = reproject_geom_to_lunar_lonlat(geom, transformer)
                features.append({
                    "type": "Feature",
                    "geometry": lunar_geom,
                    "properties": {
                        "filename": os.path.basename(filepath),
                        "pole": "south" if is_south_pole else "north"
                    }
                })

        print(f"\n[Footprint Vectorization]: Extracted {len(features)} valid data polygons.")
        geojson_doc = {
            "type": "FeatureCollection",
            "features": features
        }
        
        out_name = f"footprint_{os.path.splitext(os.path.basename(filepath))[0]}.geojson"
        with open(out_name, "w", encoding="utf-8") as f:
            json.dump(geojson_doc, f, indent=2)
        print(f"Saved footprint GeoJSON to: {out_name}")
        print("=" * 70)
        return geojson_doc

if __name__ == "__main__":
    tif_candidates = [
        "ch2_sar_ndxl_20250630mpcpnpwest_d_cpr_xx_fp_xx_xxx.tif",
        "ch2_sar_ndxl_20250630mpcpnpwest_d_srd_xx_fp_xx_xxx.tif",
        "ch2_sar_ndxl_20250630mpcpnpwest_d_trt_xx_fp_xx_xxx.tif"
    ]
    for tif in tif_candidates:
        if os.path.exists(tif):
            process_cpr_geotiff(tif)
            break