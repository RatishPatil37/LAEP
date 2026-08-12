from fastapi import APIRouter
from fastapi.responses import Response
from algorithms.data_loader import generate_synthetic_scene, load_ch2_shapefile_geojson
from algorithms.ice_confidence import ics_to_rgba_png

router = APIRouter()


@router.get("/ice-detection", response_class=Response)
def get_ice_heatmap():
    """Returns the Ice Confidence Score as a transparent RGBA PNG heatmap."""
    scene = generate_synthetic_scene()
    png_bytes = ics_to_rgba_png(scene["ice_score"])
    return Response(content=png_bytes, media_type="image/png")


@router.get("/ice-stats")
def get_ice_stats():
    """Returns summary statistics about the ice detection results."""
    import numpy as np
    scene = generate_synthetic_scene()
    ics = scene["ice_score"]
    cpr = scene["cpr_map"]
    dop = scene["dop_map"]

    ice_pixels = int(np.sum(ics > 0.5))
    total_pixels = ics.size
    pixel_area_km2 = (25.0 / 1000.0) ** 2  # 25m pixels → km²

    return {
        "ice_coverage_pixels": ice_pixels,
        "ice_coverage_km2": round(ice_pixels * pixel_area_km2, 3),
        "total_area_km2": round(total_pixels * pixel_area_km2, 1),
        "coverage_pct": round(100 * ice_pixels / total_pixels, 2),
        "mean_ics": round(float(ics[ics > 0.5].mean()) if ice_pixels > 0 else 0, 3),
        "mean_cpr_ice_zone": round(float(cpr[ics > 0.5].mean()) if ice_pixels > 0 else 0, 3),
        "mean_dop_ice_zone": round(float(dop[ics > 0.5].mean()) if ice_pixels > 0 else 4, 3),
        "detection_method": "CPR > 1.0 AND DOP < 0.13 (Physical Research Laboratory, ISRO 2024)",
    }


@router.get("/ch2-footprints")
def get_ch2_footprints():
    """
    Returns the real Chandrayaan-2 SAR mosaic tile footprints as GeoJSON.
    Falls back to empty FeatureCollection if shapefile unavailable.
    """
    geojson = load_ch2_shapefile_geojson()
    if geojson is None:
        return {"type": "FeatureCollection", "features": [], "note": "Real shapefile not loaded"}
    return geojson
