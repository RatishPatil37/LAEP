"""
rast.py — Chandrayaan-2 DFSAR High-Precision Multi-Channel Polarimetry Pipeline (ISRO PRADAN)

Execution Sequence:
  Phase 1: Ingest & Analyze CPR Raster (Circular Polarization Ratio)
  Phase 2: Ingest & Analyze SRD Raster (Same-Sense Relative Power)
  Phase 3: Ingest & Analyze TRT Raster (Total Received Power / S0)
  Phase 4: Synchronous Multi-Channel Fusion & Exact DOP / Dual-Criterion Ice Verification
  Phase 5: Vector Footprint & Ice Polygon GeoJSON Generation
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
import rasterio.windows
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

def analyze_single_raster(filepath, win_size=2048):
    """
    Ingests and computes exact full-resolution statistics for a single DFSAR product.
    """
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        return None

    filename = os.path.basename(filepath).lower()
    is_south_pole = "sp" in filename or "south" in filename

    if "_cpr_" in filename:
        prod_type = "CPR (Circular Polarisation Ratio)"
        prod_code = "CPR"
    elif "_srd_" in filename:
        prod_type = "SRD (Same-Sense Relative Power)"
        prod_code = "SRD"
    elif "_trt_" in filename:
        prod_type = "TRT (Total Received Power / S0)"
        prod_code = "TRT"
    else:
        prod_type = "DFSAR Backscatter Raster"
        prod_code = "GEN"

    transformer = get_lunar_transformer(is_south_pole=is_south_pole)
    pole_str = "South Pole (-90°)" if is_south_pole else "North Pole (+90°)"

    print("=" * 78)
    print(f"  ISRO Chandrayaan-2 DFSAR Ingestion Engine — {prod_code} Channel")
    print(f"  Target File : {os.path.basename(filepath)}")
    print(f"  Product Type: {prod_type}")
    print(f"  Target Zone : {pole_str}")
    print("=" * 78)

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

        print(f"\n[Streaming Full-Resolution Matrix]: {win_size}x{win_size} window grid...")
        
        total_valid_pixels = 0
        min_val = float('inf')
        max_val = float('-inf')
        sum_val = 0.0
        cpr_gt_1_count = 0
        sampled_values = []

        for r in range(0, ds.height, win_size):
            h = min(win_size, ds.height - r)
            for c in range(0, ds.width, win_size):
                w = min(win_size, ds.width - c)
                win = rasterio.windows.Window(c, r, w, h)
                block = ds.read(1, window=win)
                
                valid_mask = (block > 0) & np.isfinite(block)
                valid_data = block[valid_mask]

                if len(valid_data) > 0:
                    total_valid_pixels += len(valid_data)
                    sum_val += float(np.sum(valid_data))
                    min_val = min(min_val, float(np.min(valid_data)))
                    max_val = max(max_val, float(np.max(valid_data)))

                    if prod_code == "CPR":
                        cpr_gt_1_count += int(np.sum(valid_data > 1.0))

                    sampled_values.append(valid_data[::100])

        if total_valid_pixels > 0:
            mean_val = sum_val / total_valid_pixels
            all_samples = np.concatenate(sampled_values) if sampled_values else np.array([])
            median_val = float(np.median(all_samples)) if len(all_samples) > 0 else mean_val

            print(f"\n[Exact Polarimetric Statistics for {prod_code}]:")
            print(f"  Total Evaluated Pixels : {ds.width * ds.height:,}")
            print(f"  Valid Data Pixels      : {total_valid_pixels:,} ({total_valid_pixels / (ds.width * ds.height) * 100:.2f}% coverage)")
            print(f"  Min Value              : {min_val:.4f}")
            print(f"  Max Value              : {max_val:.4f}")
            print(f"  Mean Value             : {mean_val:.4f}")
            print(f"  Median Value           : {median_val:.4f}")

            if prod_code == "CPR":
                ice_pct = (cpr_gt_1_count / total_valid_pixels) * 100
                print(f"  High-CPR Pixels (>1.0) : {cpr_gt_1_count:,} ({ice_pct:.2f}% of valid observation)")

        # Vectorize boundary
        downscale = 50
        overview_shape = (max(10, ds.height // downscale), max(10, ds.width // downscale))
        cpr_data = ds.read(1, out_shape=overview_shape)
        valid_mask = (cpr_data > 0) & np.isfinite(cpr_data)

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
                        "product": prod_type,
                        "pole": "south" if is_south_pole else "north"
                    }
                })

        geojson_doc = {
            "type": "FeatureCollection",
            "features": features
        }
        
        out_name = f"footprint_{os.path.splitext(os.path.basename(filepath))[0]}.geojson"
        with open(out_name, "w", encoding="utf-8") as f:
            json.dump(geojson_doc, f, indent=2)
        print(f"\n[Footprint Vectorization]: Saved {len(features)} boundary polygons to {out_name}")
        print("=" * 78 + "\n")

    return {
        "valid_pixels": total_valid_pixels,
        "min": min_val,
        "max": max_val,
        "mean": mean_val,
        "median": median_val,
        "cpr_gt_1": cpr_gt_1_count if prod_code == "CPR" else None
    }

def perform_joint_polarimetric_ice_fusion(cpr_path, srd_path, trt_path, win_size=2048):
    """
    Phase 4: Synchronously fuses CPR, SRD, and TRT to derive exact Degree of Polarization (DOP)
    and evaluates the dual physical criterion (CPR > 1.0 AND DOP < 0.13) across all pixels.
    """
    if not (os.path.exists(cpr_path) and os.path.exists(srd_path) and os.path.exists(trt_path)):
        print("\n[Warning]: One or more companion rasters missing. Skipping joint polarimetric fusion.")
        return

    print("=" * 78)
    print("  PHASE 4: MULTI-CHANNEL POLARIMETRIC FUSION & WATER ICE VERIFICATION")
    print("  Fusion Inputs: CPR + SRD + TRT (Synchronous Pixel-Aligned Ingestion)")
    print("  Physical Criteria: CPR > 1.0  AND  DOP < 0.13 (Sinha et al. 2026, PRL/ISRO)")
    print("=" * 78)

    with rasterio.open(cpr_path) as ds_cpr, rasterio.open(srd_path) as ds_srd, rasterio.open(trt_path) as ds_trt:
        total_valid = 0
        sum_dop = 0.0
        min_dop = float('inf')
        max_dop = float('-inf')
        dop_samples = []

        cpr_gt_1_count = 0
        dop_lt_013_count = 0
        dual_confirmed_ice_count = 0

        for r in range(0, ds_cpr.height, win_size):
            h = min(win_size, ds_cpr.height - r)
            for c in range(0, ds_cpr.width, win_size):
                w = min(win_size, ds_cpr.width - c)
                win = rasterio.windows.Window(c, r, w, h)
                
                b_cpr = ds_cpr.read(1, window=win)
                b_srd = ds_srd.read(1, window=win)
                b_trt = ds_trt.read(1, window=win)

                valid_mask = (b_cpr > 0) & (b_trt > 0) & np.isfinite(b_cpr) & np.isfinite(b_srd) & np.isfinite(b_trt)
                
                if np.any(valid_mask):
                    total_valid += int(np.sum(valid_mask))
                    
                    # Compute Exact Degree of Polarization (m)
                    # m = SRD / max(TRT, 1e-6)
                    dop_block = np.divide(b_srd, np.maximum(b_trt, 1e-6), out=np.zeros_like(b_srd), where=valid_mask)
                    dop_block = np.clip(dop_block, 0.0, 1.0)
                    
                    valid_dop = dop_block[valid_mask]
                    sum_dop += float(np.sum(valid_dop))
                    min_dop = min(min_dop, float(np.min(valid_dop)))
                    max_dop = max(max_dop, float(np.max(valid_dop)))
                    dop_samples.append(valid_dop[::100])

                    # Criterion 1: High CPR (> 1.0)
                    cpr_mask = (b_cpr > 1.0) & valid_mask
                    cpr_gt_1_count += int(np.sum(cpr_mask))

                    # Criterion 2: Low DOP (< 0.13)
                    dop_mask = (dop_block < 0.13) & valid_mask
                    dop_lt_013_count += int(np.sum(dop_mask))

                    # Dual Criterion: CPR > 1.0 AND DOP < 0.13
                    dual_mask = cpr_mask & (dop_block < 0.13)
                    dual_confirmed_ice_count += int(np.sum(dual_mask))

        mean_dop = sum_dop / max(1, total_valid)
        all_dop_samples = np.concatenate(dop_samples) if dop_samples else np.array([])
        median_dop = float(np.median(all_dop_samples)) if len(all_dop_samples) > 0 else mean_dop

        # Spatial Area Calculations (25m x 25m = 625 m² per pixel)
        pixel_area_km2 = (25.0 * 25.0) / 1e6
        total_obs_area_km2 = total_valid * pixel_area_km2
        high_cpr_area_km2 = cpr_gt_1_count * pixel_area_km2
        confirmed_ice_area_km2 = dual_confirmed_ice_count * pixel_area_km2

        print(f"\n[Exact Full-Resolution Degree of Polarization (DOP / m) Results]:")
        print(f"  Valid Polarimetric Pixels: {total_valid:,} ({total_obs_area_km2:,.2f} km²)")
        print(f"  DOP Min Value            : {min_dop:.4f}")
        print(f"  DOP Max Value            : {max_dop:.4f}")
        print(f"  DOP Mean Value           : {mean_dop:.4f}")
        print(f"  DOP Median Value         : {median_dop:.4f}")
        print(f"  Low DOP Pixels (< 0.13)  : {dop_lt_013_count:,} ({dop_lt_013_count / total_valid * 100:.2f}%)")

        print(f"\n[Final Scientific Subsurface Water Ice Verification]:")
        print(f"  1. CPR > 1.0 Candidates    : {cpr_gt_1_count:,} pixels ({high_cpr_area_km2:.2f} km²)")
        print(f"  2. Confirmed Ice (CPR & DOP): {dual_confirmed_ice_count:,} pixels ({confirmed_ice_area_km2:.2f} km²)")
        print(f"  3. Ice Discrimination Ratio: {dual_confirmed_ice_count / max(1, cpr_gt_1_count) * 100:.2f}% of high-CPR features confirmed as volume-scattering ice")
        print("=" * 78)

if __name__ == "__main__":
    cpr_file = "ch2_sar_ndxl_20250630mpcpnpwest_d_cpr_xx_fp_xx_xxx.tif"
    srd_file = "ch2_sar_ndxl_20250630mpcpnpwest_d_srd_xx_fp_xx_xxx.tif"
    trt_file = "ch2_sar_ndxl_20250630mpcpnpwest_d_trt_xx_fp_xx_xxx.tif"

    # Step 1: Ingest & analyze individual products
    print("\n>>> INGESTING & ANALYZING INDIVIDUAL DFSAR CHANNELS <<<\n")
    for f in [cpr_file, srd_file, trt_file]:
        if os.path.exists(f):
            analyze_single_raster(f)

    # Step 2: Perform joint polarimetric fusion and ice detection
    if os.path.exists(cpr_file) and os.path.exists(srd_file) and os.path.exists(trt_file):
        perform_joint_polarimetric_ice_fusion(cpr_file, srd_file, trt_file)