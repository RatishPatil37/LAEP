---
name: isro-pradan-data-fusion
description: End-to-end workflow for ingesting, calibrating, and fusing Chandrayaan-2 PRADAN multi-sensor datasets (DFSAR, OHRC, TMC-2, IIRS) into unified scientific data cubes and CSVs.
---

# ISRO PRADAN Multi-Sensor Data Fusion

Use this skill when processing ISRO Chandrayaan-2 or planetary observation data from the PRADAN portal involving DFSAR radar, OHRC optical imagery, TMC-2 elevation/slope, or IIRS hyperspectral cubes.

## 1. Zero-Dependency Binary Streaming (`np.memmap`)
For multi-gigabyte `.qub` or `.img` binary files, do not rely on heavyweight external dependencies like `spectral` or `rasterio`. Use native Python and `numpy.memmap`:

1. Parse the companion `.hdr` file to extract:
   - `samples`, `lines`, `bands`
   - `data type` (e.g., 4 = float32, 2 = int16, 12 = uint16)
   - `byte order` (0 = little-endian `<f4`, 1 = big-endian `>f4`)
   - `interleave` (`bil`, `bsq`, or `bip`)
2. Memory-map the binary file with 0 MB initial RAM overhead:
   ```python
   shape = (lines, bands, samples) if interleave == "bil" else (bands, lines, samples)
   dtype = np.dtype("<f4" if byte_order == 0 else ">f4")
   data = np.memmap(qub_filepath, dtype=dtype, mode="r", offset=header_offset, shape=shape)
   ```

## 2. Geometry Grid Tie-Point Sub-Pixel Interpolation
PRADAN provides geometry grids (`_g_grd_*.csv`) sampled at sparse tie points (e.g., every 50 pixels and scans).
- **Anti-Pattern**: Using naive nearest-neighbor creates 4.2 km stepped block artifacts.
- **Standard Workflow**:
  1. Project tie-point coordinates `(lat, lon)` into Lunar Polar Stereographic conformal meters `(X, Y)`.
  2. Index tie points with a `cKDTree`.
  3. For each target master point, find the 4 enclosing tie points.
  4. Perform 2D Inverse Distance Weighting (IDW) interpolation to determine exact continuous fractional `(scan, pixel)` coordinates.
  5. Check swath boundary bounds: `0 <= scan < max_scans` and `0 <= pixel < max_pixels`. If outside, flag as out-of-swath (`NaN`).

## 3. Physical Feature Engineering for IIRS
- **Continuum Reflectance (1500 nm)**: Near-infrared continuum shoulder (Band #48, λ = 1504.4 nm).
- **Core Absorption (2000 nm)**: Water ice / hydroxyl diagnostic absorption band (Band #77, λ = 1993.1 nm).
- **Diagnostic Band Ratio**: `R1500 / R2000` (Values > 1.0 indicate diagnostic absorption dip).
- **Continuum-Removed Band Depth (BD2000)**:
  - Compute linear continuum between shoulder bands (e.g., 1807.7 nm and 2195.3 nm):
    `R_cont = R_left + (λ_core - λ_left) / (λ_right - λ_left) * (R_right - R_left)`
  - `BD2000 = 1.0 - (R_core / R_cont)` with strict guard `R_cont > 0`.

## 4. Quality Audit & Validation Checks
- Ensure radar slant range strictly exceeds ground range: `R_s > R_g`.
- Verify incidence angle: `20° <= θ_inc <= 50°` for DFSAR.
- Verify that non-overlapping points are explicitly marked `NaN` (never filled with 0 or synthetic noise).
