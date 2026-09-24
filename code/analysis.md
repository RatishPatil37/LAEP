# LAEP / ISRO Multi-Sensor Lunar Polar Data Fusion: Scientific Analysis & Machine Learning Architecture

**Document Type:** Scientific Whitepaper & Technical Architecture  
**Dataset Analyzed:** `F2_combined_dataset_1790091673.csv` (20,000 samples, 21 channels)  
**Location:** `/code/analysis.md`  
**Reference Missions:** Chandrayaan-2 (DFSAR, OHRC, TMC-2, IIRS), LRO (LOLA, Diviner, Mini-RF)

---

## 1. Executive Summary & Remote Sensing Framework

The **Lunar Autonomous Exploration Pipeline (LAEP)** aims to evaluate lunar south-polar crater targets, quantify volatile (water ice) signatures, assess geotechnical terrain hazards, and calculate safe, kinematic rover traverses.

The lunar south pole (specifically latitudes beyond $85^\circ\text{S}$, such as Faustini, Shoemaker, Shackleton, and Haworth) presents an extreme environment:
1. **Low Solar Elevation ($< 2.8^\circ$)**: The sun skims the polar horizon, casting elongated topographic shadows and creating **Permanently Shadowed Regions (PSRs)** inside impact crater bowls.
2. **Cold Traps ($T \le 40\text{ K} - 110\text{ K}$)**: Under ultra-cold vacuum conditions, water molecules remain kinetically trapped in regolith for billions of years.
3. **Decoupled Optical vs. Radar Physics**:
   - **Optical Cameras (OHRC, 0.25 m/px)**: Suffer from zero direct photon flux inside crater bowls; can only observe secondary wall-scattered light.
   - **Stereo Cameras (TMC-2, 5 m/px)**: Yield digital elevation models (DEM) for macro-topography, rim scarps, and surface slope angles.
   - **Dual-Frequency Polarimetric SAR (DFSAR, L & S Band, 2–5 m/px)**: Transmits circularly polarized microwaves that penetrate through pitch-black regolith ($24\text{ cm}$ L-band penetrates up to $2-3\text{ m}$) and measures the **Circular Polarization Ratio (CPR)** to identify Coherent Backscatter Opposition Effect (CBOE) caused by volumetric water ice.
   - **Imaging Infrared Spectrometer (IIRS, 256 bands, 0.8–5.0 µm, 56×85 m/px)**: Detects fundamental surface molecular vibrational absorption bands of $\text{H}_2\text{O}$ ice and $\text{OH}^-$ at $1.5\,\mu\text{m}$, $2.0\,\mu\text{m}$, and $2.8-3.0\,\mu\text{m}$.

---

## 2. Theoretical Analysis of the Updated PDF Methodology

The two reference documents outline a multi-step data processing pipeline (`generate_combined_dataset.py`) for ingesting, co-registering, and classifying multi-sensor lunar records.

```
                              [ Base Spatial Geometry ]
                            DFSAR GRI (Lat, Lon, Inc, GR)
                                          │
                     ┌────────────────────┴────────────────────┐
                     ▼                                         ▼
            [ Proportional Indexing ]                [ cKDTree Spatial Anchor ]
            Slant Range (SLI) & OAT                 Lunar Polar Stereographic
                     │                                         │
        ┌────────────┴────────────┬────────────────────────────┼────────────────────────────┐
        ▼                         ▼                            ▼                            ▼
 [ Orbit Vectors (OAT) ]   [ OHRC Optical ]             [ TMC-2 Terrain ]             [ IIRS Hyperspectral ]
 X, Y, Z State Vectors     Metric KDTree (1.5 km)       DEM & Slope Sampling          IDW Sub-pixel (k=4)
                           Raw PDS4 .img mmap           Radargrammetry Fallback       256-band .qub mmap
        │                         │                            │                            │
        └─────────────────────────┼────────────────────────────┼────────────────────────────┘
                                  ▼
                     [ 20,000-Point Master Table ]
                                  │
                                  ▼
                [ Vectorized Hazard Classification ]
                (Steep Slope | Boulder | Shadow | Rim)
```

### 2.1 Mathematical Formulations & Derivations

#### A. Slant Range Proportional Indexing
The pipeline maps indices from the DFSAR Slant Range Image (SLI) CSV using row ratios:
$$\text{Mapped Index} = \text{clip}\left(\left\lfloor \frac{\text{GRI Index}}{\text{GRI Total Rows}} \times \text{SLI Total Rows}\right\rfloor, 0, \text{SLI Total Rows} - 1\right)$$

*Physical Critique*: Proportional index mapping assumes a strictly uniform spacecraft along-track velocity and constant pulse repetition interval. While computationally $O(1)$, exact physical radar geometry requires matching along-track zero-Doppler azimuth times ($\text{UTC}_{\text{az}}$) between the GRI and SLI products.

#### B. Circular Polarization Ratio (CPR) & Degree of Polarization (DoP)
DFSAR operates in a compact polarimetric mode (transmitting Left-Hand Circular polarization and receiving linear horizontal $H$ and vertical $V$ coherently). From the complex Stokes vector:
$$S_0 = \langle |E_H|^2 + |E_V|^2 \rangle$$
$$S_1 = \langle |E_H|^2 - |E_V|^2 \rangle$$
$$S_2 = 2\,\text{Re}\langle E_H E_V^* \rangle$$
$$S_3 = 2\,\text{Im}\langle E_H E_V^* \rangle$$

The Circular Polarization Ratio (CPR) is defined as:
$$\text{CPR} = \frac{\text{Same-Sense Circular (SC)}}{\text{Opposite-Sense Circular (OC)}} = \frac{S_0 - S_3}{S_0 + S_3}$$

The PDF approximates Degree of Polarization (DoP) from CPR:
$$\text{DoCP} = \frac{|S_3|}{S_0} = \frac{|1 - \text{CPR}|}{1 + \text{CPR}}$$

*Important Distinction*:
$$\text{Total DoP} = \frac{\sqrt{S_1^2 + S_2^2 + S_3^2}}{S_0}$$
Whereas $\frac{|S_3|}{S_0}$ is strictly the **Degree of Circular Polarization (DoCP)**. When depolarizing volume scattering dominates (as in fragmented icy regolith), linear polarization components $S_1, S_2 \approx 0$, making $\text{DoCP} \approx \text{DoP}$ an acceptable physical surrogate.

#### C. IIRS Hyperspectral Metrics
The PDF defines two spectral diagnostic indices:
1. **Band Ratio**:
   $$\text{IIRS\_Band\_Ratio} = \frac{R_{1500\,\text{nm}}}{R_{2000\,\text{nm}}}$$
2. **$\text{H}_2\text{O}$ Absorption Depth**:
   $$\text{IIRS\_H2O\_Absorption\_Depth} = 1 - \frac{2 \times R_{2000\,\text{nm}}}{R_{1500\,\text{nm}} + R_{\text{continuum}}}$$

*Physical Critique*: In planetary reflectance spectroscopy (Clark & Roush 1984), the continuum-normalized band depth is standardly defined as:
$$\text{BD} = 1 - \frac{R_{\lambda_c}}{R_{\text{cont}}(\lambda_c)}$$
Where $R_{\text{cont}}$ is linearly interpolated from continuum shoulder bands ($\lambda_1 \approx 1800\,\text{nm}$ and $\lambda_2 \approx 2250\,\text{nm}$):
$$R_{\text{cont}}(\lambda_c) = R_{\lambda_1} + \frac{\lambda_c - \lambda_1}{\lambda_2 - \lambda_1}(R_{\lambda_2} - R_{\lambda_1})$$
Integrating $R_{1500}$ into the denominator can distort baseline offsets if $R_{1500}$ itself falls inside an absorption shoulder.

#### D. Spatial cKDTree Search Acceleration
The pipeline utilizes `scipy.spatial.cKDTree` for 2D nearest-neighbor lookups.
- **Search Complexity**: $O(\log N)$ average query time vs. $O(N)$ for brute-force Euclidean distance.
- **Experimental Benchmark** (from PDF):
  - 1,000 queries over 100,000 spatial points:
    $$\text{cKDTree Time: } 0.07649\,\text{s} \quad \text{vs.} \quad \text{Brute-force Time: } 6.95391\,\text{s} \quad (\approx 91\times \text{ faster})$$
- **Polar Conformal Mapping**: The pipeline correctly projects geographic $(\text{Lon}, \text{Lat})$ into **Lunar Polar Stereographic projection (EPSG:3032 / IAU2000:30120)** before tree building:
  $$x = 2 R_M \tan\left(\frac{\pi}{4} - \frac{|\phi|}{2}\right) \sin(\lambda)$$
  $$y = -2 R_M \tan\left(\frac{\pi}{4} - \frac{|\phi|}{2}\right) \cos(\lambda)$$
  This eliminates meridian convergence distortion at polar latitudes ($\phi < -85^\circ$).

---

## 3. Empirical Data Analysis of `F2_combined_dataset_1790091673.csv`

The master combined CSV contains **20,000 rows** and **21 columns**.

### 3.1 Global Descriptive Statistics

| Feature Name | Non-Null Count | Missing % | Mean | Std Dev | Min | Median | Max |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `Latitude_deg_SAR` | 20,000 | 0.0% | -88.5347° | 1.0476° | -89.9870° | -88.7092° | -86.5188° |
| `Longitude_deg_SAR` | 20,000 | 0.0% | -95.2980° | 94.0079° | -179.8736° | -143.5240° | +179.9628° |
| `Incidence_Angle_deg_SAR` | 20,000 | 0.0% | 27.2875° | 2.5192° | 21.3800° | 26.7900° | 36.6300° |
| `Ground_Range_m_SAR` | 20,000 | 0.0% | 42,994.99 m | 4,974.90 m | 35,509.58 m | 41,633.31 m | 73,462.31 m |
| `Slant_Range_m_SAR` | 20,000 | 0.0% | 96,571.67 m | 2,338.32 m | 93,334.89 m | 95,982.01 m | 113,729.50 m |
| `Sat_Pos_X_m_SAR_OAT` | 20,000 | 0.0% | -56,777.16 m | 37,932.56 m | -122,098.36 m | -56,799.73 m | 9,277.68 m |
| `Sat_Pos_Y_m_SAR_OAT` | 20,000 | 0.0% | 14,048.54 m | 30,257.19 m | -38,106.53 m | 14,056.49 m | 66,684.95 m |
| `Sat_Pos_Z_m_SAR_OAT` | 20,000 | 0.0% | -1,819,787 m | 850.92 m | -1,820,582 m | -1,820,102 m | -1,817,441 m |
| `Power_LH_DFSAR` | 20,000 | 0.0% | **0.0000** | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| `Power_LV_DFSAR` | 20,000 | 0.0% | **1.0e-06** | 0.0000 | 1.0e-06 | 1.0e-06 | 1.0e-06 |
| `CPR_DFSAR` | 20,000 | 0.0% | **0.0500** | 0.0000 | 0.0500 | 0.0500 | 0.0500 |
| `DOP_DFSAR` | 20,000 | 0.0% | **0.9048** | 0.0000 | 0.9048 | 0.9048 | 0.9048 |
| `Reflectance_OHRC` | 20,000 | 0.0% | 0.1653 | 0.0928 | 0.0000 | 0.1653 | 1.0000 |
| `Elevation_m_TMC2` | 20,000 | 0.0% | -1837.04 m | 22.33 m | -1850.00 m | -1844.10 m | -1749.30 m |
| `Slope_deg_TMC2` | 20,000 | 0.0% | 1.08° | 1.86° | 0.00° | 0.50° | 8.40° |
| `Reflectance_IIRS_1500nm` | 8,156 | **59.22%** | 121.76 | 190.17 | 11.46 | 40.07 | 953.62 |
| `Reflectance_IIRS_2000nm` | 8,156 | **59.22%** | 87.72 | 83.87 | 4.62 | 53.45 | 448.51 |
| `IIRS_Band_Ratio` | 8,156 | **59.22%** | 0.9938 | 0.5022 | 0.1584 | 0.7984 | 7.4648 |
| `IIRS_H2O_Absorption_Depth`| 8,156 | **59.22%** | **-0.4523** | 0.3460 | -3.3518 | -0.4432 | +0.8435 |

---

### 3.2 Modality Overlap & Swath Discrepancy

Due to varying sensor fields of view and orbital swaths:
- **SAR Radar Track (DFSAR)**: $20,000$ points ($100.0\%$)
- **IIRS Hyperspectral Swath**: $8,156$ points ($40.78\%$)
- **OHRC High-Resolution Footprint**: $4,390$ points ($21.95\%$)
- **Triple Coincident Overlap (SAR + OHRC + IIRS)**: $3,568$ points ($17.84\%$)
- **Dual Overlap (SAR + IIRS)**: $4,588$ points ($22.94\%$)
- **Dual Overlap (SAR + OHRC)**: $822$ points ($4.11\%$)
- **Single Modality (SAR Only)**: $11,022$ points ($55.11\%$)

---

### 3.3 Rule-Based Hazard Class Imbalance

The priority-ordered decision rules yielded:
$$\begin{cases}
\text{safe\_flat}: & 17,428 \text{ samples } (87.14\%) \\
\text{shadowing\_obscuration}: & 2,502 \text{ samples } (12.51\%) \\
\text{boulder}: & 70 \text{ samples } (0.35\%) \\
\text{steep\_slope\_hazard}: & 0 \text{ samples } (0.00\%) \\
\text{crater\_rim}: & 0 \text{ samples } (0.00\%)
\end{cases}$$

---

## 4. Key Shortcomings of the Dataset & Concrete Engineering Solutions

### Shortcoming 1: Total Polarimetric Collapse (`CPR` & `DOP` Are Flat Constants)
- **Finding**: Across all $20,000$ rows, `CPR_DFSAR = 0.0500`, `DOP_DFSAR = 0.9048`, `Power_LH = 0.0`, and `Power_LV = 1e-6`.
- **Cause**: The input DFSAR CPR GeoTIFF raster (`*_d_cpr_*.tif`) was absent during pipeline execution, triggering a fallback to a fixed constant.
- **Impact**: Any machine learning model trained on this dataset receives zero radar backscatter variation and cannot learn to separate volume scattering (ice) from surface scattering (regolith/rock).
- **Engineering Solution**:
  1. Ingest real DFSAR Stokes calibrated rasters ($S_1, S_2, S_3, S_4$) from PRADAN PDS4 bundles.
  2. If raw DFSAR rasters are missing for a target crater, query co-registered LRO **Mini-RF** polarimetry ($S_0, S_1, S_2, S_3$ at 128 ppd) as an empirical ground-truth baseline.

### Shortcoming 2: Artificial Albedo Distribution from Global Mean Fill (78.05% of Points)
- **Finding**: $15,610$ rows have `Reflectance_OHRC` set to exactly $0.1653$ (the global mean of in-swath pixels). Only $4,390$ rows contain genuine optical measurements.
- **Cause**: The pipeline imputed missing out-of-swath OHRC pixels with a static scalar.
- **Impact**: A classifier trained on `Reflectance_OHRC` will treat $78\%$ of the terrain as having homogeneous medium-reflectance, masking real cold-trap voids ($< 0.05$) and bright boulders ($> 0.65$).
- **Engineering Solution**:
  1. Add an explicit boolean feature: `OHRC_Is_In_Swath` ($1$ if inside OHRC footprint, $0$ if outside).
  2. For out-of-swath coordinates, query the global LRO WAC 100 m/px basemap to supply true optical reflectance instead of a synthetic scalar.

### Shortcoming 3: Elevation and Slope Are Linearly Coupled ($r = 1.00$)
- **Finding**: Pearson correlation between `Elevation_m_TMC2` and `Slope_deg_TMC2` is identically **$1.00$**.
- **Cause**: Because real TMC-2 DEM GeoTIFFs were absent, the script derived slope from radar incidence angles ($|\theta_{inc} - \theta_{spherical}|$) and calculated elevation as:
  $$\text{Elevation} = -1850.0 + (12.0 \times \text{Slope})$$
- **Impact**: Slopes are capped at $8.40^\circ$ (mean $1.08^\circ$), preventing the detection of real crater rim scarps ($> 15^\circ$) and resulting in zero `steep_slope_hazard` occurrences.
- **Engineering Solution**:
  1. Ingest real Chandrayaan-2 TMC-2 DEM rasters (`*_d_dem_*.tif`).
  2. Alternatively, integrate the **LOLA / SLDEM2015** global elevation model (60 m/pixel), which captures genuine micro-topographic slopes up to $35^\circ$.

### Shortcoming 4: Negative IIRS Water Absorption Depth & Raw Radiance Scaling
- **Finding**: Mean `IIRS_H2O_Absorption_Depth` is **$-0.4523$** (min $-3.3518$). Furthermore, raw reflectance values reach $953.6$.
- **Cause**: The 4.17 GB `.qub` file contains raw spectral radiance ($W/(m^2 \cdot \text{sr} \cdot \mu m)$) or unscaled digital numbers rather than calibrated solar-normalized reflectance ($I/F$). Thermal emission rising beyond $2.0\,\mu\text{m}$ tilts the continuum upward, making $R_{2000} > R_{\text{cont}}$ and causing band depth to turn negative.
- **Engineering Solution**:
  1. Apply photometric $I/F$ conversion:
     $$\frac{I}{F} = \frac{\pi \cdot L_{\lambda}}{F_{\odot} \cdot \cos(i)}$$
  2. Apply thermal emission modeling (subtracting Planck thermal radiation for warm sunlit surfaces).
  3. Compute continuum removal using an upper convex hull across $[1.2\,\mu\text{m}, 1.8\,\mu\text{m}, 2.25\,\mu\text{m}]$ so that $R_{\text{band}} \le R_{\text{cont}}$ and $\text{BD} \in [0.0, 1.0]$.

### Shortcoming 5: Tautological Rule-Based Hazard Targets
- **Finding**: Target labels are generated by a deterministic `np.select` conditional tree.
- **Impact**: Training a supervised model on this label merely approximates 4 hardcoded `if-else` rules rather than discovering real physical phenomena.
- **Engineering Solution**:
  1. Train unsupervised clustering models (HDBSCAN / Self-Organizing Maps) to find natural multimodal clusters.
  2. Anchor labels to the **Robbins Lunar Crater Database** and LROC NAC boulder catalog ground truth.

---

## 5. Machine Learning Architecture Recommendations

The user proposed a two-tier decoupled strategy:
1. **Tier 1 (Optical + DEM)**: OHRC & TMC-2 $\rightarrow$ Deep Learning (DL) model to segment Permanently Shadowed Regions (PSRs) and Doubly Shadowed Regions (DSRs).
2. **Tier 2 (Radar + Hyperspectral)**: DFSAR & IIRS $\rightarrow$ Machine Learning (ML) model to output an Ice Confidence Score (ICS).

### 5.1 Scientific Validation of the Decoupled Strategy
This two-tier separation is well-aligned with planetary exploration principles:
- **Spatial Separation**: OHRC and TMC-2 operate on dense 2D imagery ($0.25\text{ m}$ to $5\text{ m}$) where convolutional or attention-based computer vision models excel at recognizing crater boundaries, wall slopes, and shadow projections.
- **Spectral/Polarimetric Separation**: DFSAR and IIRS operate on point-based physical measurements (microwave penetration vs. surface molecular absorption).
- **Resilience to Missing Data**: Because IIRS is missing for $59.2\%$ of the region, coupling IIRS into Tier 1 would cause spatial image segmentation to fail. Decoupling ensures that terrain hazards and cold traps can always be mapped, while volatile confidence is computed dynamically where spectral or radar channels exist.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TWO-TIER DECOUPLED FUSION ARCHITECTURE                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘

 [ STAGE 1: SPATIAL COLD TRAP & DSR SEGMENTATION ]
 ──────────────────────────────────────────────────
   OHRC High-Res Optical (0.25 m) ───────┐
   TMC-2 / LOLA Elevation & Slope ──────┼──► [ SegFormer / Attention U-Net ] ──► Binary DSR / PSR Mask
   Solar Horizon Ray-Trace Simulation ──┘     (MiT-B3 / ResNet-50)              (Micro-Cold Traps)
                                                                                        │
                                                                                        ▼
 [ STAGE 2: PHYSICAL VOLATILE INFERENCE ENGINE ]                                 [ Spatial Masking ]
 ────────────────────────────────────────────────                                       │
   DFSAR Dual-Pol Radar (CPR, m-chi, DoCP) ──┐                                         │
   IIRS 256-band Hyperspectral Cubes ────────┼──► [ CatBoost / Evidential NN ] ◄────────┘
   Regional Subsurface Temperature Grid ────┘     (Native NaN + Bayesian Uncertainty)
                                                                │
                                                                ▼
                                                [ Probabilistic Ice Confidence ]
                                                  ICS = 0.88 ± 0.06 (PDS4 Traceable)
```

---

### 5.2 Recommended Models for Tier 1: OHRC + TMC-2 $\rightarrow$ DSR / Cold Trap Segmentation

#### Primary Recommendation: SegFormer (Hierarchical Transformer Encoder: MiT-B3)
- **Architecture**: Lightweight Transformer encoder paired with an MLP decoder.
- **Why It Fits**:
  - Shadow projections in craters can span tens of kilometers across images. Standard CNNs (such as vanilla U-Net) have limited receptive fields and struggle with long-range contextual shadow cues.
  - SegFormer processes multi-scale feature maps without positional encodings, supporting arbitrary input dimensions while maintaining sharp boulder boundaries ($0.25\text{ m}$).
- **Input Channels (4-Channel Tensor)**:
  1. `OHRC_Reflectance`: Histogram-equalized / HDR tone-mapped optical imagery.
  2. `TMC2_Elevation`: Normalized DEM values.
  3. `TMC2_Slope`: Micro-topographic slope angles ($0^\circ - 35^\circ$).
  4. `Solar_RayTrace_Mask`: Ray-traced direct solar visibility ($1 = \text{illuminated}$, $0 = \text{shadow}$).
- **Target Classes**:
  - Class 0: Direct Sunlit Highland
  - Class 1: Singly Shadowed Regolith (illumination from secondary crater wall scatter)
  - Class 2: Doubly Shadowed Cold Trap (DSR: zero direct or secondary photon flux, $T < 40\text{ K}$)
  - Class 3: High-Albedo Boulder Hazard
- **Loss Function**: Focal Tversky Loss ($\alpha=0.7, \beta=0.3$) to address severe class imbalance.

#### Secondary Recommendation: Attention U-Net (ResNet-50 Backbone)
- Standard U-Net augmented with spatial Attention Gates (AG) that suppress feature activations in irrelevant background regions while amplifying fine shadow boundary transitions.

---

### 5.3 Recommended Models for Tier 2: DFSAR + IIRS $\rightarrow$ Ice Confidence Score (ICS)

#### Primary Recommendation: CatBoost / LightGBM Classifier (Tabular Gradient Boosting)
- **Why It Fits**:
  - **Native Missing-Value Handling**: Crucial for this project because **$59.22\%$ of points lack IIRS coverage**. Neural networks require artificial imputation (which alters physical reality), whereas CatBoost and LightGBM route missing entries to the optimal split direction determined during training.
  - **Categorical Feature Support**: Handles discrete orbital swaths, crater IDs, and sensor flags natively.
- **Input Features**:
  - Radar: `CPR_DFSAR`, `DOP_DFSAR`, $m\text{-}\chi$ volume component, $m\text{-}\chi$ surface component.
  - Spectrometry: `Reflectance_IIRS_1500nm`, `Reflectance_IIRS_2000nm`, `IIRS_Band_Ratio`, `BD2000`.
  - Quality Flags: `IIRS_Is_Available` ($0$ or $1$).
  - Geometry: `Incidence_Angle_deg_SAR`, `Local_Equilibrium_Temp_K`.
- **Target**: Probabilistic Volatile Confidence $\text{ICS} \in [0.0, 1.0]$.
- **Evaluation Metrics**: PR-AUC, F1-Score (macro), Brier Score (probability calibration).

#### Advanced Research Recommendation: Deep Evidential Regression / Dirichlet Network
- **Why It Fits**:
  - In planetary exploration, autonomous rovers require calibrated uncertainty estimates. If a region has high CPR ($> 1.2$) but IIRS is out-of-swath, the model must output **high epistemic uncertainty**.
  - Evidential networks place higher-order prior distributions over network outputs, predicting:
    $$\text{ICS} = \hat{y} \pm 2\sigma_{\text{epistemic}} \pm 2\sigma_{\text{aleatoric}}$$
  - If uncertainty exceeds a rover safety threshold ($\sigma > 0.15$), the traversal planner treats the ice signal as unconfirmed.

---

## 6. Project Roadmap

```
Phase 1: Pipeline Data Ingestion Fixes
├── Ingest true calibrated DFSAR Stokes GeoTIFFs (replace flat CPR=0.05)
├── Replace radargrammetry slope with LOLA / SLDEM2015 co-registered DEM
└── Apply photometric I/F calibration & thermal emission removal on IIRS .qub

Phase 2: Tier 1 Training (SegFormer)
├── Extract 512x512 multi-band patches (OHRC + DEM + Ray-Trace)
└── Train SegFormer MiT-B3 with Focal Tversky Loss to segment DSRs and boulders

Phase 3: Tier 2 Training (CatBoost + Evidential ML)
├── Train CatBoost on real CPR, DoP, IIRS BD2000 with native NaN routing
└── Calibrate probabilities using Platt scaling / Isotonic regression

Phase 4: Full-Stack Integration
├── Connect model inference to LAEP FastAPI backend (/api/ice-detection, /api/hazard-map)
└── Render outputs dynamically in the OpenLayers Mission Planner & 3D Rover Simulator
```
