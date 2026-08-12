"""
LAEP API — Configuration constants & data paths.
Handles both real ISRO shapefile data and synthetic fallback.
"""
import os
from pathlib import Path

# ── Grid dimensions ────────────────────────────────────────────────────────
GRID_SIZE = 200          # Pixels per side of the simulation grid
PIXEL_SIZE_M = 25.0      # Metres per pixel (matches DFSAR ~25-30m resolution)

# ── Safety thresholds ──────────────────────────────────────────────────────
MAX_SLOPE_DEG = 15.0     # Rover cannot climb steeper than this
ICE_CPR_THRESHOLD = 1.0  # Circular Polarisation Ratio threshold for ice detection
ICE_DOP_THRESHOLD = 0.13 # Degree of Polarisation threshold for ice detection

# ── Lunar South Pole region (equirectangular lon/lat) ─────────────────────
# The simulation grid maps to this bounding box on the Moon
SOUTH_POLE_BBOX = {
    "lon_min": -10.0,
    "lon_max":  10.0,
    "lat_min": -90.0,
    "lat_max": -80.0,
}

# ── Real ISRO data paths ───────────────────────────────────────────────────
# The .shp file in ch2_sp is a Chandrayaan-2 SAR derived mosaic shapefile
# (Moon 2000 South Pole Stereographic projection)
BASE_DIR = Path(__file__).resolve().parent.parent  # ISRO root
CH2_SHAPEFILE = BASE_DIR / "ch2_sp" / "ch2_sar_der_mosaic_sp.shp"

# Moon 2000 South Pole Stereographic — PROJ4 string derived from .prj file
MOON_SP_STEREO_PROJ4 = (
    "+proj=stere +lat_0=-90 +lon_0=0 +k=1 "
    "+x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
)
MOON_GEO_PROJ4 = "+proj=longlat +R=1737400 +no_defs"
