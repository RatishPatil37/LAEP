"""
rast.py — Chandrayaan-2 DFSAR GeoTIFF Processor (ISRO PRADAN)

Safely handles gigapixel lunar rasters (23k x 20k pixels):
1. Reads raster metadata & CRS (Moon 2000 Polar Stereographic)
2. Downsamples or uses windowed reading to avoid memory exhaustion
3. Extracts real footprint bounds and high-CPR ice candidate zones
4. Reprojects Lunar coordinates to Lon/Lat (degrees) safely
"""
import rasterio
import rasterio.features
import rasterio.warp
import numpy as np
from pyproj import Transformer

# ── 1. Define Lunar CRS Transformer ──────────────────────────────────────────
# ISRO PRADAN uses Moon 2000 Polar Stereographic (ESRI:103877 / IAU 2000 Moon)
# Radius = 1,737,400 meters
MOON_STEREOGRAPHIC_PROJ = "+proj=stere +lat_0=90 +lat_ts=90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
MOON_LONLAT_PROJ = "+proj=longlat +R=1737400 +no_defs"

transformer = Transformer.from_crs(
    MOON_STEREOGRAPHIC_PROJ,
    MOON_LONLAT_PROJ,
    always_xy=True
)

def reproject_geom_to_lunar_lonlat(geom):
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


def process_cpr_geotiff(filepath):
    print("=" * 65)
    print(f"Opening: {filepath}")
    print("=" * 65)

    with rasterio.open(filepath) as ds:
        print(f"Dimensions: {ds.width} x {ds.height} ({ds.width * ds.height / 1e6:.1f} Million Pixels)")
        print(f"Resolution: {ds.res[0]:.1f}m x {ds.res[1]:.1f}m per pixel")
        print(f"Bounds (m): {ds.bounds}")

        # ── 2. Calculate Footprint Boundary (Lon/Lat) ──────────────────────────
        left, bottom, right, top = ds.bounds
        corners_stere = [(left, bottom), (right, bottom), (right, top), (left, top), (left, bottom)]
        corners_lonlat = [transformer.transform(x, y) for x, y in corners_stere]
        print("\n[Footprint Bounding Box (Lon, Lat)]:")
        for (x_m, y_m), (lon, lat) in zip(corners_stere, corners_lonlat):
            print(f"  Stereographic: ({x_m:>10.1f}m, {y_m:>10.1f}m)  -->  Lunar: ({lon:>8.3f}°, {lat:>8.3f}°)")

        # ── 3. Read Overview Safely (Downsampled by 50x) ──────────────────────
        # Reading full resolution 1.9GB array into polygonizer crashes memory.
        # Downsampling by 50x gives a fast, accurate 464x407 overview in < 0.1s!
        downscale = 50
        overview_shape = (ds.height // downscale, ds.width // downscale)
        cpr_data = ds.read(1, out_shape=overview_shape)

        valid_mask = (cpr_data > 0) & np.isfinite(cpr_data)
        valid_cpr = cpr_data[valid_mask]

        if len(valid_cpr) > 0:
            print("\n[CPR Statistics on Valid Chandrayaan-2 Data]:")
            print(f"  Valid Data Pixels : {len(valid_cpr):,}")
            print(f"  Min CPR           : {np.min(valid_cpr):.4f}")
            print(f"  Max CPR           : {np.max(valid_cpr):.4f}")
            print(f"  Mean CPR          : {np.mean(valid_cpr):.4f}")
            print(f"  Median CPR        : {np.median(valid_cpr):.4f}")

            # ── 4. Subsurface Ice Detection (CPR > 1.0 Threshold) ─────────────
            ice_candidates = cpr_data > 1.0
            ice_count = np.sum(ice_candidates)
            ice_pct = (ice_count / len(valid_cpr)) * 100
            print(f"\n[Ice Detection Criterion: CPR > 1.0]:")
            print(f"  High-CPR Ice Candidate Pixels: {ice_count:,} ({ice_pct:.2f}% of observed area)")

        # ── 5. Vectorize Outer Data Boundary to GeoJSON ───────────────────────
        # Create downscaled affine transform for the overview
        overview_transform = ds.transform * ds.transform.scale(
            (ds.width / cpr_data.shape[1]),
            (ds.height / cpr_data.shape[0])
        )

        shapes = rasterio.features.shapes(
            valid_mask.astype(np.uint8),
            mask=valid_mask,
            transform=overview_transform
        )

        extracted_polygons = 0
        print("\n[Exporting Valid Data Shapes (Lunar Lon/Lat GeoJSON)]:")
        for geom, val in shapes:
            if val == 1:
                lunar_geom = reproject_geom_to_lunar_lonlat(geom)
                extracted_polygons += 1
                if extracted_polygons <= 2:
                    print(f"\nPolygon {extracted_polygons} GeoJSON:")
                    print(lunar_geom)

        print(f"\nTotal valid data polygons extracted: {extracted_polygons}")
        print("=" * 65)


if __name__ == "__main__":
    tif_file = "ch2_sar_ndxl_20250630mpcpnpwest_d_cpr_xx_fp_xx_xxx.tif"
    process_cpr_geotiff(tif_file)