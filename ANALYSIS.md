# Comprehensive Technical Analysis: Payloads, Custom Dataset Pipeline & Research Paper Breakdown

## 1. Payload Parameters, Tools & Data Levels (From User Manuals)

### A. TMC-2 (Terrain Mapping Camera-2)

1. **Scientific Role:** Panchromatic stereoscopic imaging (image) from three angles: Fore (image), Nadir (image), and Aft (image) for 3D elevation modeling.
2. **PDS4 Data Processing Levels:**

- **Level-0 (Raw):** Generic binary (.img, UInt16 / UnsignedLSB2) + detached label (.xml) + browse PNG (.png).
- **Level-1 (Calibrated):** Radiometrically corrected binary (.img) with updated geometric coordinate grids (.csv storing lon, lat, scan, pix).
- **Level-2 (Derived):** Digital Elevation Models (.tif, SignedLSB2 / Float32) and Orthorectified images (.tif, UInt16).

3. **Crucial XML Label Parameters to Extract:**

- spacecraft\_altitude, pixel\_resolution (m/pixel), focal\_length, line\_exposure\_duration.
- orbit\_limb\_direction (Ascending vs. Descending) and spacecraft\_yaw\_direction (True/Reverse vs. False/Forward) to handle correct line/sample pixel flipping.
- System-level and refined corner coordinates (upper\_left\_latitude, lower\_right\_longitude, etc.).

4. **Recommended Software & Libraries:**

- **ESA SNAP:** *File image Import image SAR/Generic Binary* (Enter lines image samples from XML).
- **PDS4 Viewer / ImageJ / QGIS / Python (rasterio, gdal, xml.etree.ElementTree).*

### B. OHRC (Orbiter High Resolution Camera)

- **Scientific Role:** Sub-meter (image) optical imaging for hazard detection, boulder counting, and lobate rim geomorphology.
- **PDS4 Data Processing Levels:**

* **Level-0 (Raw):** 8-bit generic binary (.img, UnsignedByte) + .xml.
* **Level-1 (Calibrated):** Radiometrically corrected 8-bit binary (.img) + detached XML label + Gridded Geometry file (.csv containing pixel-to-coordinate mapping).

- **Ancillary Data (miscellaneous/ directory):**

* .oat & .oath: Spacecraft Orbit and Attitude time series.
* .lbr: Lunar Libration angles.
* .spm: Sun Parameter file (solar azimuth, incidence angle, and sub-solar points).

- **Recommended Software & Libraries:**

* **Python Stack:** OpenCV, PIL, YOLOv8 (for boulder hazard classification), GeoPandas.

### C. DFSAR (Dual-Frequency Synthetic Aperture Radar)

- **Scientific Role:** L-band (image) and S-band (image) polarimetry to penetrate regolith (image) and detect volumetric ice backscatter.
- **PDS4 Data Processing Levels:**

* **Level-0 (Raw / RDR):** Generic binary telemetry frames (.dat) + OAT CSV (.csv).
* **Level-1A (SLC - Single Look Complex / SLI):** Slant range complex TIFF files (.tif, ComplexLSB8 — 4-byte real + 4-byte imaginary per pixel). Generated for all polarization channels (image or Circular image).
* **Level-1B (GRI - Ground Range Image):** Ground-projected amplitude images (.tif, UInt16).
* **Level-2 (SRI - Seleno Referenced Image):** Fully map-projected, georeferenced amplitude GeoTIFF (.tif).

- **Recommended Software & Tools:**

* **ISRO MIDAS (Microwave Data Analysis Software):** Dedicated SAC software for polarimetric decomposition, multilooking, and coherency matrix generation.
* **ESA SNAP / PolSARpro:** For speckle filtering, SAR calibration, and terrain correction.
* **Python:** rasterio, scipy.ndimage, numpy.

## 2. Architecture of the Ideal Custom Dataset

Building independent single-payload feature stacks first and subsequently fusing them into a unified raster/tabular data structure prevents spatial distortions, accommodates varying native resolutions, and allows modular model training.
Lunar\_Subsurface\_Ice\_Dataset\_and\_Research\_Deepdive.md

Open
```text
[ PRADAN PORTAL / PDS4 ARCHIVE ]
│
┌───────────────────┬───────────────┴───────────────┬───────────────────┐
▼ ▼ ▼ ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Dataset A: │ │ Dataset B: │ │ Dataset C: │ │ Dataset D: │
│ DFSAR Radar │ │ TMC-2/LOLA │ │ OHRC Optics │ │ IIRS Spectra │
│ Polarimetry │ │ Topography │ │ High-Res Vis │ │ Hydration │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
│ │ │ │
└─────────────────┼───────────────────────────────┴───────────────────┘
▼
┌─────────────────────────────────────────────────┐
│ SPATIAL CO-REGISTRATION & RESAMPLING │
│ (Common Polar Stereographic Grid @ 25m/pixel) │
└────────────────────────┬────────────────────────┘
▼
┌─────────────────────────────────────────────────┐
│ UNIFIED MULTI-MODAL DATASET │
│ • Multichannel GeoTIFF (Spatial Rasters) │
│ • Tabular Parquet/GeoPackage (ML Feature DB) │
└─────────────────────────────────────────────────┘
```

### Step 1: Design of Individual Payload Feature Sets

#### **Dataset A: DFSAR Polarimetric Radar Stack (Native \~20m/pixel)**
* cpr: Circular Polarization Ratio ($>1.0$ indicates volume scattering).
* dop: Degree of Polarization ($<0.13$ indicates pure depolarized ice backscatter).
* span: Total radar backscattering power ($P = \vert{}S\_{HH}\vert{}^2 + \vert{}S\_{VV}\vert{}^2 + 2\vert{}S\_{HV}\vert{}^2$).
* fd_radar: Fractal Dimension from $T\_3$ matrix span (TPSAM algorithm).
* serd: Single-bounce Eigenvalue Relative Difference (surface roughness at wavelength scale).
* m_chi: $m\text{–}\chi$ decomposition parameters (volume vs. double bounce fraction).

#### **Dataset B: Topographic & Geomorphological Stack (TMC-2 DEM / LOLA, \~25–60m)**
* elevation: Absolute height relative to lunar datum ($1737.4\\,\text{km}$).
* slope: Local gradient in degrees (critical for landing safety and illumination).
* aspect: Slope azimuth direction.
* roughness_wz: Geometric mean roughness tensor ($W\_z = \sqrt{W\_p W\_q}$).
* circularity_index: Crater boundary circularity ($\frac{4\pi \cdot \text{Area}}{\text{Perimeter}^2}$).
* depth_to_diameter: $d/D$ ratio from regional crater profiles.

#### **Dataset C: High-Resolution Visual & Hazard Stack (OHRC, \~0.25–0.5m)**
* boulder_density: Count of boulders $/ 100\\,\text{m}^2$ derived from YOLOv8 object detection.
* hazard_flag: Binary mask ($1$ if boulder $>0.5\\,\text{m}$ or slope $>10^\circ$, else $0$).
* lobate_rim_flag: Visual indicator of fluidized impact ejecta (presence of past ice-rich impacts).

#### **Dataset D: Hyperspectral Hydration Stack (IIRS, \~80m/pixel)**
* band_depth_2900: Diagnostic absorption band depth at $2.8\text{–}3.0\\,\mu\text{m}$ ($\text{OH}/\text{H}\_2\text{O}$ signature).
* surface_temperature_k: Derived thermal emission level in Kelvin.

---
### Step 2: Unified Merged Dataset Format

For machine learning (e.g., GMM clustering, Isolation Forest anomaly scoring) and GIS spatial mapping, merge the datasets into two standard formats:

1. **Multiband GeoTIFF (.tif):**
   \* Shared spatial coordinate reference system (CRS): Lunar Polar Stereographic (e.g., IAU_2015:30118 or Moon 2000 Polar Stereographic, Central Meridian $0^\circ$, Std Latitude $\pm 90^\circ$).
   \* Unified spatial resolution: Interpolated/resampled to **$25.0\\,\text{m/pixel}$** using bilinear/cubic interpolation.
   \* Channels: [Band 1: CPR, Band 2: DOP, Band 3: FD, Band 4: SERD, Band 5: Slope, Band 6: Wz, Band 7: YOLO_Hazard, Band 8: IIRS_BandDepth].

2. **Tabular Feature Matrix (.parquet / .gpkg):**
   \* Each row represents an aligned $25\times25\\,\text{m}$ surface pixel with columns:
     [pixel_id, latitude, longitude, cpr, dop, fd, serd, slope, wz_roughness, boulder_density, hydration_index, is_psr_flag, physics_ice_candidate, ground_truth_label].

---
## 3. Step-by-Step Guide: Building the Dataset from ISSDC PRADAN

### Step 1: Target Identification & Spatial Selection
1. Select target South/North Pole craters containing Permanently Shadowed Regions (PSRs), e.g., **Hermite-A** ($87.66^\circ\text{N}$), **Faustini F2/F3** ($87.3^\circ\text{S}$), **Haworth H3**, **Shoemaker S1**, and a negative control crater (**Tooley**).
2. Download the **USGS Robbins Lunar Crater Database** shapefile (.shp) to obtain official crater rim polygon boundaries automatically.

### Step 2: Querying and Downloading Data from PRADAN Portal
1. Navigate to the **ISRO ISSDC PRADAN Portal** (pradan.issdc.gov.in).
2. Search and download the following payload collections for the bounding box of your selected crater:
   \* **SAR Folder (NOT DFRS):** Search for **Level-1A SLC (Single Look Complex)** or **Level-2 SRI (Seleno Referenced Image)** in Full Polarimetric (FP: HH+HV+VH+VV) or Circular Polarimetric (CP: LH+LV+RH+RV) mode.
   \* **TMC-2 Folder:** Search for **Level-2 Derived DTM/DEM** products (.tif) or Level-1 Calibrated images.
   \* **OHRC Folder:** Search for **Level-1 Calibrated** optical images covering the crater rims and interior.
   \* **IIRS Folder:** Search for Level-2 Calibrated reflectance datacubes covering the coordinates.

---
### Step 3: Automated Ingestion & Preprocessing Pipeline (Python)

```python
import numpy as np
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
import xml.etree.ElementTree as ET

def parse_pds4_metadata(xml_path):
    """Extracts essential mission parameters from PDS4 XML labels."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    # Define PDS4 namespace
    ns = {'pds': '[http\://pds.nasa.gov/pds4/pds/v1]\(http\://pds.nasa.gov/pds4/pds/v1)'}
    
    # Extract line, sample, and data type
    lines = int(root.find('.//pds\:Axis_Array[pds\:axis_name="Line"]/pds\:elements', ns).text)
    samples = int(root.find('.//pds\:Axis_Array[pds\:axis_name="Sample"]/pds\:elements', ns).text)
    data_type = root.find('.//pds\:Element_Array/pds\:data_type', ns).text
    return {"lines": lines, "samples": samples, "data_type": data_type}

def reproject_to_lunar_polar(src_path, dst_path, dst_crs="EPSG:3031", resolution=25.0):
    """Reprojects and aligns any payload raster into a standard Polar grid at 25m resolution."""
    with rasterio.open(src_path) as src:
        transform, width, height = calculate_default_transform(
            src.crs, dst_crs, src.width, src.height, *src.bounds, resolution=resolution
        )
        kwargs = src.meta.copy()
        kwargs.update({
            'crs': dst_crs,
            'transform': transform,
            'width': width,
            'height': height
        })
        with rasterio.open(dst_path, 'w', **kwargs) as dst:
            for i in range(1, src.count + 1):
                reproject(
                    source=rasterio.band(src, i),
                    destination=rasterio.band(dst, i),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=dst_crs,
                    resampling=Resampling.bilinear
                )
```

### Step 4: Polarimetric Decomposition & Roughness Generation

5. **Radar Ingestion:** Open DFSAR Level-1A complex bands ($S_{HH}, S_{HV}, S_{VV}$) or Level-2 calibrated intensities.
6. **Compute Coherency Matrix ($T_3$):**
   $$T_3 = \frac{1}{2} \begin{bmatrix} \langle |S_{HH} + S_{VV}|^2 \rangle & \langle (S_{HH} + S_{VV})(S_{HH} - S_{VV})^* \rangle & 2\langle (S_{HH} + S_{VV})S_{HV}^* \rangle \\\ \langle (S_{HH} - S_{VV})(S_{HH} + S_{VV})^* \rangle & \langle |S_{HH} - S_{VV}|^2 \rangle & 2\langle (S_{HH} - S_{VV})S_{HV}^* \rangle \\\ 2\langle S_{HV}(S_{HH} + S_{VV})^* \rangle & 2\langle S_{HV}(S_{HH} - S_{VV})^* \rangle & 4\langle |S_{HV}|^2 \rangle \end{bmatrix}$$
7. **Compute CPR & SERD:**
   $$\text{CPR} = \frac{\langle |S_{HH} - S_{VV}|^2 \rangle + 4\langle |S_{HV}|^2 \rangle}{\langle |S_{HH} + S_{VV}|^2 \rangle + 2\text{Re}(\langle S_{HH}S_{VV}^* \rangle)}$$
8. **Compute Fractal Dimension (FD):** Apply the Triangular Prism Surface Area Method (TPSAM) over a $5\times5$ sliding window on the span ($P = \text{Trace}(T_3)$).
9. **Clip & Stack:** Use the Robbins crater polygon to clip all rasters to the crater interior and export the aligned multiband GeoTIFF.

## 4. Deep Analysis: The IEEE InGARSS 2025 Single-Strip Research Paper

### A. The "Single Strip" Reality: Did they really use only 1 strip?

> **YES.** The paper (*"Unsupervised Approach for Classifying Volume Scattering for Surface Roughness and Potential Water-Ice Deposits"*, Muduli et al., InGARSS 2025) was conducted using **one single Chandrayaan-2 DFSAR full-polarimetric L-band SLC strip**:

> ch2_sar_ncxl_20191019t130445516_d_fp_d18 (Product ID: 2056311, acquired 19 September 2019).

#### Why is a single strip scientifically valid and publishable?

- **Enormous Spatial & Statistical Scope:** A single DFSAR radar swath is over $100\\,\text{km}$ long and $20\\,\text{km}$ wide. In this single strip, there were **$346,651$ individual resolution cells** with $\text{CPR} > 1$ alone. This provides a statistically large sample size for machine learning algorithms.
- **Geological Feature Scale:** In planetary remote sensing, discoveries are framed around specific physiographic features (e.g., Hermite-A crater, Faustini F2). A strip completely dissecting an entire polar crater provides the full cross-section (sunlit rim, shadow wall, flat crater floor, ejecta blanket).
- **Validation Precedent:** Peer-reviewed planetary science papers routinely focus on single swaths across benchmark craters to validate a novel technique before scaling planetary-wide (e.g., Sinha et al., May 2026, *npj Space Exploration*; Bhiravarasu et al., 2021).

### B. Technique, Mathematical Models & Algorithms Used in the Paper

```text
[ DFSAR L-Band SLC Strip ('d_fp_d18') ]
                 │
                 ▼
[ Preprocessing in ISRO MIDAS ]
\- Multilooking (Averaging independent looks)
\- Speckle Filtering
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
 [ CPR Matrix ]    [ Coherency Matrix (T3) ]
       │                   │
       │                   ├──► Span of T3 ──────────────────► Fractal Dimension (FD) [TPSAM]
       │                   └──► Reflection-Symmetric Rot. ───► SERD Parameter
       │                                                              │
       │                                     ┌────────────────────────┘
       ▼                                     ▼
[ Mask: CPR > 1.0 ] ─────────────► [ Unsupervised Clustering (GMM / K-Means / AHC) ]
                                             │
                                             ▼
                               [ Class 0: Smooth ] vs [ Class 1: Rough ]
                                             │
                                             ▼
                     [ Dual Intersection: (Smooth FD) ∩ (Smooth SERD) ]
                                             │
                                             ▼
                         [ \~23% Potential Subsurface Ice Candidates ]
                         (77% Rough Boulder False Positives Eliminated)
```

#### 1. Polarimetric Feature Extraction

- **CPR Calculation:** Calculated from the scattering matrix $S_2$ elements to identify all volume scattering candidates.
- **Fractal Dimension (FD):** Extracted using the **Triangular Prism Surface Area Method (TPSAM)** applied on the Span image ($|S_{HH}|^2 + |S_{VV}|^2 + 2|S_{HV}|^2$).

* FD values range from $2.0$ (perfectly flat, smooth floor) to $3.0$ (extreme macroscopic roughness/rocky terrain).

- **SERD (Single-Bounce Eigenvalue Relative Difference):**

* Derived from the eigenvalues ($\lambda_1, \lambda_2, \lambda_3$) of the reflection-symmetric $T_3$ matrix.
* Because raw lunar radar data does not strictly satisfy reflection symmetry, the authors applied an **adaptive double unitary transformation** to rotate $T_3$ into reflection symmetry before computing SERD.
* SERD values range from $0.0$ (smooth) to $1.0$ (wavelength-scale rough surface).

#### 2. Machine Learning Clustering & Comparison

The authors tested three unsupervised algorithms on the $\text{CPR} > 1$ masked pixels:

2. **K-Means Clustering:** Centroid-based hard partitioning minimizing intra-cluster variance.
3. **Gaussian Mixture Models (GMM):** Expectation-Maximization (EM) parametric density estimation modeling overlapping Gaussian distributions.
4. **Agglomerative Hierarchical Clustering (AHC):** Bottom-up recursive tree-merging of proximate clusters.

- **Metric Used to Determine the Winner — Separability Index (SI):**
  $$\text{SI} = \frac{|\mu_{\text{rough}} - \mu_{\text{smooth}}|}{\sigma_{\text{rough}} + \sigma_{\text{smooth}}}$$
- **Results:** **GMM outperformed all other models** by a substantial margin:

* For Fractal Dimension: $\text{SI}_{\text{GMM}} = \mathbf{33.718}$ (vs. K-Means: $11.32$, AHC: $7.33$).
* For SERD: $\text{SI}_{\text{GMM}} = \mathbf{9.885}$ (vs. K-Means: $7.819$, AHC: $5.828$).

#### 3. The Key Finding: Dual-Roughness Intersection

- **The Problem:** $346,651$ pixels inside the Hermite-A strip exhibited elevated $\text{CPR} > 1$. Naive legacy methods would falsely identify all $346\text{k}$ pixels as water-ice.
- **The Solution:** The authors intersected the GMM-derived **Smooth Class from FD** with the **Smooth Class from SERD**.
- **Outcome:** Only **$80,145$ pixels ($\approx 23\\%$)** remained in the smooth intersection class!
- **Conclusion:** $77\\%$ of the high-CPR pixels were rough rock/boulder clutter on crater slopes. The remaining $23\\%$ true candidates were strongly concentrated along cold crater walls inside the Permanently Shadowed Region (PSR), indicating genuine buried or exposed water-ice deposits.

### C. Strengths, Limitations & Enhancements for Your Project

| **Feature / Aspect**        | **Muduli et al. (InGARSS 2025 Paper)**      | **How Your Project (LAEP-IceSight) Upgrades This**                                                                           |
| --------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Radar Dataset**           | Single DFSAR L-band Strip (d_fp_d18)      | Multi-crater DFSAR L & S-band dataset (Faustini F2/F3, Haworth, Shoemaker, Tooley).                                          |
| **Polarimetric Thresholds** | CPR $>1.0$ with FD/SERD classification      | Enforces tightened dual-physics criterion: $(\text{CPR} > 1.0) \land (\text{DOP} < 0.13)$.                                   |
| **Topography & Slope**      | External LOLA DEM used solely for geocoding | TMC-2 Derived DTM for slope stability ($<10^\circ$), directional roughness tensor ($W_z$), and circularity index.           |
| **Multi-Sensor Fusion**     | Radar only (DFSAR)                          | **Tri-sensor fusion:** DFSAR + TMC-2 DEM + IIRS ($2.8\text{–}3.0\\,\mu\text{m}$ hydration) + OHRC (YOLOv8 boulder counting). |
| **Downstream Application**  | Binary classification map of ice            | **Autonomous Landing Site Optimization (S.C.S.):** Simpson's Rule volume integration and safe rover path routing.            |

## 5. Summary & Action Items for Implementation

2. **Download Target Radar Strips:** Use ISSDC Pradan to download the L-band SLC/SRI data for Hermite-A (Product ID 2056311) to reproduce this paper, plus Faustini (F2/F3) as your primary benchmark.
3. **Run GMM Clustering:** Implement GMM on the extracted CPR, FD, and SERD arrays in Python using sklearn.mixture.GaussianMixture.
4. **Fuse with TMC-2 & IIRS:** Overlay the resulting smooth candidate mask onto the TMC-2 slope map ($<10^\circ$) to eliminate steep wall artifacts and identify flat, ice-rich floors for safe landing site extraction.

## Code snippet

I will summarize the key takeaways from the analysis:

1. **Payload Extraction:** The exact XML parameters (yaw direction, line exposure, limb direction), PDS4 data levels (L0 binary, L1 calibrated, L2 derived GeoTIFF/DTM), and geometry grids (`.csv`) have been cataloged for TMC-2, OHRC, and DFSAR.
2. **Modular Architecture:** The recommended workflow creates separate raster/tabular datasets for DFSAR, TMC-2, OHRC, and IIRS first, then reprojects and resamples them onto a common $25\\,\text{m/pixel}$ lunar polar stereographic grid.
3. **PRADAN Retrieval:** The guide provides the search steps, file extensions, and Python code to ingest PDS4 XML metadata and reproject geospatial rasters.
4. **Research Paper Deep-Dive:** The InGARSS 2025 paper confirmed the use of a **single L-band DFSAR strip** (`ch2_sar_ncxl_20191019t130445516_d_fp_d18`) over Hermite-A crater. Using GMM clustering on Fractal Dimension and SERD features, they isolated smooth, high-CPR ice signatures ($\sim 23\\%$) from rough boulder clutter ($77\\%$), validating the feasibility of a single-swath pipeline for your project.
