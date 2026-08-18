# KNOWLEDGE.md — Comprehensive Scientific & Technical Master Reference
## Lunar Autonomous Exploration Pipeline (LAEP)
### Chandrayaan-2 Multi-Instrument Data Fusion, Subsurface Ice Detection & Autonomous Traversal

---

## 1. Executive Scientific Context & Ground Truth Benchmark

### 1.1 The 2026 Breakthrough Ground Truth (Sinha et al., PRL / ISRO)
In May 2026, the Physical Research Laboratory (PRL, ISRO Ahmedabad) published the definitive empirical study on lunar polar subsurface water ice:
> **Sinha, R. K., Bharti, R. R., Acharyya, K., Mishra, S. K., Srivastava, N., & Bhardwaj, A. (2026).** *"Subsurface ice in doubly shadowed craters as revealed by Chandrayaan-2 dual frequency synthetic aperture radar."* **npj Space Exploration**, 2(22). DOI: `10.1038/s44453-026-00038-9`.

#### Key Findings:
1. **Doubly-Shadowed Sub-Craters as Super-Cold Traps:**
   Small craters ($700\text{ m} - 3000\text{ m}$) situated inside major host Permanently Shadowed Regions (PSRs: Faustini, Haworth, Shoemaker) have raised rims that block secondary reflected sunlight and thermal infrared re-radiation from sunlit crater walls. Internal equilibrium temperatures drop to **$\approx 25\text{ K}$** (compared to $50 - 110\text{ K}$ in regular PSRs), creating long-term stability for volatile ice preservation over billions of years.
2. **The Refined Polarimetric Diagnostic Rule:**
   $$\text{Ice-Bearing Regolith} \iff \text{CPR} > 1.0 \quad \text{AND} \quad \text{DOP} < 0.13$$
   *(Tightens older pre-2024 criteria of $\text{DOP} < 0.35$).*
3. **Debunking Standalone $d/D$ Ratio:**
   Depth-to-diameter ratio ($d/D$) was historically cited as $0.16 - 0.21$ for ice-resistant excavation. Sinha et al. proved that **all** small sub-craters in their sample had $d/D < 0.16$ regardless of ice presence, and Tooley crater ($d/D = 0.039 - 0.048$, the shallowest) showed zero ice signal. Hence, $d/D$ is only a supporting structural feature, never a standalone classifier.
4. **Morphological Lobate Rim Ground Truth:**
   Crater **F2** in Faustini displays a prominent **lobate-rim morphology** caused by impact excavation penetrating into a subsurface ice layer followed by outward ice-slump refreezing.

#### Official Peer-Reviewed Validation Benchmark Table:
| Crater ID | Host PSR | Diameter ($m$) | Depth ($m$) | Peak CPR | DOP (Ice Zone) | Wall Slope ($^\circ$) | $d/D$ Ratio | Lobate Rim? | True Ice Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **F2** | Faustini | 1,100 | 137–151 | **1.95** | **0.10** | 20–27° | 0.124–0.137 | **Yes** | **Strong Evidence (47% interior CPR > 1)** |
| **F3** | Faustini | 700 | 88–103 | **1.73** | **0.10–0.13** | 18–20° | 0.125–0.147 | Partial | **Likely (42% interior CPR > 1)** |
| **H3** | Haworth | 800 | 140–201 | **1.57** | **0.10–0.13** | 24–29° | 0.175–0.251 | No (Melt flows) | **Partially Likely** |
| **S1** | Shoemaker| 2,980 | 337–353 | **1.94** | **0.10–0.13** | 13–16° | 0.113–0.118 | No | **Partially Likely (Localized patch)** |
| **F1** | Faustini | 950 | 119–122 | $\le 1.0$ | High (>0.4) | 16–17° | 0.125–0.128 | No | **No Evidence (Negative Control)** |
| **H1** | Haworth | 1,060 | 90–140 | 0.68 | 0.55 | 18–20° | 0.084–0.132 | No | **No Evidence (Negative Control)** |
| **H2** | Haworth | 1,170 | 140–150 | 1.29 | 0.58 | 17–18° | 0.119–0.128 | No | **No Evidence (High DOP boulder wall)** |
| **S2** | Shoemaker| 1,060 | 93–101 | 1.34 | 0.49 | 15–18° | 0.087–0.095 | No | **No Evidence (High DOP wall effect)** |
| **S3** | Shoemaker| 2,580 | 254–287 | 1.63 | 0.52 | 14–15.5° | 0.098–0.111 | No | **No Evidence (High DOP wall effect)** |
| **Tooley** | Standalone| 7,050 | 280–340 | $\le 1.0$ | 0.66 (walls) | 7.7–9.3° | 0.039–0.048 | Partial | **No Evidence (Negative Control)** |

---

## 2. Multi-Instrument Sensor Suite & ISSDC PRADAN Architecture

### 2.1 Compulsory Data Product Matrix
To eliminate ambiguity, the required datasets from the Indian Space Science Data Centre (ISSDC) PRADAN portal and NASA PDS are structured as follows:

```
ISSDC PRADAN Repository
├── SAR (DFSAR: Dual Frequency SAR) ────────── Level-2 SLC / Level-3 SRI GeoTIFFs (L & S band)
├── TMC-2 (Terrain Mapping Camera-2) ───────── Level-3 DEM & Ortho-images (5m - 25m DEM)
├── OHRC (Orbiter High Resolution Camera) ──── Level-2/3 GeoTIFF (0.25m/pixel optical)
├── IIRS (Imaging Infrared Spectrometer) ───── Level-2 Calibrated Hyperspectral Cubes (0.8 - 5.0 µm)
├── SPICE Kernels (NAIF / ISRO) ────────────── Binary SPK, CK, PCK, FK, IK, LSK ephemerides
└── USGS / Robbins Database ────────────────── Global Lunar Crater Polygon Shapefile (1.3M craters)
```

> **CRITICAL PORTAL WARNING:** On the ISSDC PRADAN portal, download from the **`SAR`** (Synthetic Aperture Radar) directory. Do NOT download from `DFRS` (Dual Frequency Radio Science), which measures ionospheric electron density via occultation and contains zero surface radar backscatter.

| Instrument | Band / Mode | Spatial Resolution | Physical Quantity Measured | Primary Function in Pipeline |
| :--- | :--- | :--- | :--- | :--- |
| **DFSAR (L-Band)** | $1.25\text{ GHz}$ ($\lambda = 24\text{ cm}$) | $2.0 - 25.0\text{ m}$ | Full-polarimetric Stokes ($I, Q, U, V$), CPR, DOP | Deep subsurface volume scattering ($\le 5\text{ m}$ penetration) |
| **DFSAR (S-Band)** | $3.20\text{ GHz}$ ($\lambda = 9.4\text{ cm}$) | $2.0 - 25.0\text{ m}$ | Full-polarimetric Stokes ($I, Q, U, V$), CPR, DOP | Shallow subsurface volume scattering ($\le 2\text{ m}$ penetration) |
| **TMC-2 / LOLA** | Optical Stereo / Laser Altimetry | $5.0 - 25.0\text{ m}$ | Surface elevation $Z(x, y)$ | Slope $\theta$, surface roughness $W_z$, fractal dimension $D$ |
| **OHRC** | Panchromatic ($500 - 800\text{ nm}$) | **$0.25\text{ m}$** ($25\text{ cm}$) | Micro-texture & visual reflectance | Sub-meter boulder / crater detection via YOLOv11; lobate rim validation |
| **IIRS / $M^3$** | SWIR ($0.8 - 5.0\text{ µm}$) | $20 - 80\text{ m}$ | Spectral reflectance & absorption depth | $2.8 - 3.0\text{ µm}$ $\text{H}_2\text{O}/\text{OH}^-$ overtone band cross-check |
| **SPICE Kernels** | Ephemerides & solar angles | Time-series | Solar azimuth, elevation, spacecraft vectors | Ray-traced illumination & TSI scattering flux |

---

## 3. Deep Mathematical Formulations & Remote Sensing Physics

```
                                  =======================================
                                  MATHEMATICAL & RADAR POLARIMETRY ENGINE
                                  =======================================
```

### 3.1 Radar Polarimetry & Scattering Physics

#### Stokes Parameter Vector
For an elliptically polarized electromagnetic wave, the backscattered electric field vector $\mathbf{E} = [E_H, E_V]^T$ is parameterized by the 4-element Stokes vector $\mathbf{S} = [S_0, S_1, S_2, S_3]^T$:
```text
S_0 = <|E_H|²> + <|E_V|²>                   (Total Backscatter Power, TRT)
S_1 = <|E_H|²> - <|E_V|²>                   (Linear Horizontal vs Vertical Power)
S_2 = 2 * Real( <E_H * E_V*> )              (Linear Power at 45° / 135°)
S_3 = 2 * Imag( <E_H * E_V*> )              (Circular Power: Right vs Left Handed)
```

#### Circular Polarisation Ratio (CPR, $\mu_c$)
In full polarimetric mode, CPR represents the ratio of Same-Sense Circular ($\sigma_{\text{SC}}$) to Opposite-Sense Circular ($\sigma_{\text{OC}}$) backscatter:
```text
CPR = σ_SC / σ_OC

In terms of linear backscatter cross-sections (HH, VV, HV):
σ_SC = [ σ_HH + σ_VV - 2 * Imag(σ_HV) ] / 2
σ_OC = [ σ_HH + σ_VV + 2 * Imag(σ_HV) ] / 2

CPR = ( σ_HH + σ_VV + 2 * √(σ_HH * σ_VV) ) / ( σ_HH + σ_VV - 2 * √(σ_HH * σ_VV) )
```

#### Physical Meaning of CPR:
* **Specular / Single Surface Reflection (Dry Regolith):** Flips circular polarization handedness $\implies \sigma_{\text{OC}} \gg \sigma_{\text{SC}} \implies \text{CPR} \approx 0.1 - 0.4$.
* **Double-Bounce Reflection (Dihedral Crater Walls / Large Boulders):** Returns wave with preserved or altered polarization, elevating $\text{CPR} > 1.0$, **BUT** preserves high coherence ($\text{DOP} > 0.45$).
* **Coherent Backscatter Opposition Effect (CBOE in Subsurface Water Ice):** Multiple internal refractive volume scatterings inside low-loss dielectric ice matrices randomize polarization while constructively interfering in the backward direction, producing **$\text{CPR} > 1.0$** while simultaneously collapsing **$\text{DOP} < 0.13$**.

#### Degree of Polarisation (DOP, $m$)
```text
DOP = √( S_1² + S_2² + S_3² ) / S_0
```
* **$m \to 1.0$:** Fully polarized wave (surface scattering from smooth/rough rock faces).
* **$m \to 0.0$:** Completely depolarized wave (multiple internal volume scattering in ice).

#### Continuous Ice Confidence Score (ICS $\in [0, 1]$)
To provide a smooth, continuous optimization metric for rover navigation:
```text
C_CPR = clip( (CPR - 1.0) / 1.0,  min = 0.0, max = 1.0 )
C_DOP = clip( (0.13 - DOP) / 0.13, min = 0.0, max = 1.0 )

ICS = √( C_CPR * C_DOP )
```

---

### 3.2 Polarimetric $m-\chi$ and $m-\alpha$ Target Decomposition
As established in Erlanger crater studies, the Stokes parameters are decomposed into 3 physical scattering mechanisms (surface, double-bounce, volume):
```text
Degree of Circularity:   sin(2 * χ) = -S_3 / ( m * S_0 )
Poincare Rotation Angle: 2 * χ = arcsin( -S_3 / ( m * S_0 ) )

Scattering Powers:
P_Volume = S_0 * (1 - m)                              (Diffuse / Ice Volume Scattering)
P_Double = S_0 * m * ( (1 - sin(2 * χ)) / 2 )         (Dihedral / Double-Bounce)
P_Surface = S_0 * m * ( (1 + sin(2 * χ)) / 2 )        (Bragg / Single Surface Reflection)
```

---

### 3.3 Micro-Terrain Morphometry & Geometric-Mean Roughness

#### 1. Terrain Slope Angle ($\theta$) via Central Differences
For a DEM matrix $Z$ with grid resolution $\Delta x = \Delta y = 25.0\text{ m}$:
```text
∂Z/∂x ≈ [ Z(x+1, y) - Z(x-1, y) ] / (2 * Δx)
∂Z/∂y ≈ [ Z(x, y+1) - Z(x, y-1) ] / (2 * Δy)

Slope Angle θ(x, y) = arctan( √( (∂Z/∂x)² + (∂Z/∂y)² ) ) * (180° / π)
```

#### 2. Dual-Axis SAR Geometric-Mean Ruggedness ($W_z$)
SAR images have anisotropic resolution and speckle characteristics along range ($p$) and azimuth ($q$) axes. The regularized roughness formulation is:
```text
Similarity Metric along axis p:
Sim_p = 1.0 - [ |x_{c1} - x_{c2}| / (x_{c1} + x_{c2} + ε) ]

Regularized Roughness W_p:
W_p = ln( Var_p + ε ) / [ ln( Sim_p + ε ) ]

Geometric Mean Ruggedness:
W_z = √( |W_p * W_q| )
```
*Where $\epsilon = 10^{-6}$ prevents numerical explosion on flat terrain (resolving denominator singularities via Newton-Raphson regularization).*

#### 3. Compactness / Circularity Index
```text
Circularity = (4 * π * Area) / (Perimeter)²
```
* *Circular pristine impact craters:* $\text{Circularity} \approx 0.95 - 1.00$.
* *Degraded / Slumped / Lobate ice-ejecta craters:* $\text{Circularity} < 0.85$.

#### 4. Fractal Dimension ($D$) via 2D Box Counting
```text
Cover the crater rim profile with boxes of side length ε.
Count non-empty boxes N(ε).
Repeat across dyadic scales ε ∈ {2, 4, 8, 16, 32, 64}.

Fractal Dimension D = - lim (ε → 0) [ log( N(ε) ) / log( ε ) ]
(Computed via least-squares linear regression slope of log N vs log 1/ε).
```

---

### 3.4 3D Volumetric Ice Estimation via Simpson's Rule Integration
Given a detected ice region with footprint area $\Omega$, penetration depth $H(x, y)$, estimated regolith volume fraction $V_f(x, y) \approx 0.056$ (5.6 wt% water equivalent hydrogen), and bulk ice density $\rho_{\text{ice}} = 0.917\text{ g/cm}^3$:

```text
Continuous Volume Integral:
Total Ice Volume V_ice = ∬_Ω [ ICS(x, y) * H(x, y) * V_f(x, y) ] dx dy

Composite 2D Simpson's Numerical Rule (over grid nx, ny with spacing hx, hy):
V_ice ≈ (hx * hy / 9) * ∑_{i=0}^{nx} ∑_{j=0}^{ny} [ w_i * w_j * f(x_i, y_j) ]

where weights w_k ∈ {1, 4, 2, 4, ..., 1} along each axis.
Total Mass M_ice = V_ice * ρ_ice (in Metric Tons)
```

---

## 4. Modern Deep Learning Architectures for Chandrayaan-2

```
                       ===============================================
                       DEEP LEARNING MODEL SUITE (OHRC + DFSAR FUSION)
                       ===============================================
```

### 4.1 YOLOv11 for Joint Crater & Boulder Detection (OHRC 25cm Imagery)
Recent 2024/2025 research proves that **YOLOv11** outperforms RE-DETR, YOLOv8, and Mask R-CNN in detecting both micro-craters ($<10\text{ m}$) and hazard boulders ($0.5\text{ m} - 5\text{ m}$) on Chandrayaan-2 OHRC panchromatic datasets.

```text
OHRC Input Tile (0.25m, 640x640)
               │
               ▼
┌───────────────────────────────┐
│     YOLOv11 Backbone (C3k2)   │ ─── Multi-Scale Feature Extraction
└───────────────────────────────┘
               │
               ▼
┌───────────────────────────────┐
│     SPPF + C2PSA Attention    │ ─── Polar Shadow & Low-Contrast Enhancement
└───────────────────────────────┘
               │
               ▼
┌───────────────────────────────┐
│    Decoupled Detection Head   │ ─── Anchor-Free Task-Aligned Assigner
└───────────────────────────────┘
       │                 │
       ▼                 ▼
[ Class 0: Crater ]  [ Class 1: Boulder ]
(Bounding Box + IoU) (Bounding Box + IoU)
```

#### Evaluation Metrics:
```text
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
mAP_50    = (1/N) * ∑ AP_50
mAP_50-95 = (1/N) * (1/10) * ∑_{IoU=0.5}^{0.95} AP_IoU
```

### 4.2 CenterNet Keypoint Detection in Low-Light / PSR Shadowed Regions
In permanently shadowed regions (PSRs) where extreme low contrast causes bounding-box anchor detectors to fail, **CenterNet Keypoint Detection** represents craters as center points with estimated radius/axes:
```text
Heatmap Prediction Ŷ_{x, y, c} ∈ [0, 1]
Gaussian Focal Loss:
L_k = - (1/N) * ∑_{x,y,c} [
    (1 - Ŷ)^α * log(Ŷ)              if Y = 1
    (1 - Y)^β * (Ŷ)^α * log(1 - Ŷ)  otherwise
]
```

### 4.3 Multi-Modal Fusion Layer (Isolation Forest + XGBoost)
```text
Input Feature Vector per pixel x_i:
x_i = [ CPR_L, DOP_L, CPR_S, DOP_S, Slope, Roughness_Wz, Circularity, Fractal_D, Hydration_IIRS, Boulder_Dist ]
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Unsupervised Anomaly Scoring: Isolation Forest           │
│ Supervised Agreement Scoring: XGBoost (Trained on PRL)   │
└──────────────────────────────────────────────────────────┘
       │
       ▼
Validated Fused Ice Confidence Score (FICS ∈ [0, 1])
```

---

## 5. Architectural Comparison: Legacy Heuristic vs. Modern 2026 Engine

| Component | Previous Baseline Implementation | Upgraded 2026 Master Implementation |
| :--- | :--- | :--- |
| **SAR Input** | Mock synthetic array or unprojected vector | **Real PRADAN Level-3 DFSAR GeoTIFFs (L & S band)** with `pyproj` Moon 2000 Stereographic engine |
| **Ice Criterion** | Simple $CPR > 1.0$ rule | **Sinha et al. 2026 Refined Criterion**: $CPR > 1.0 \land DOP < 0.13 \land P_{\text{vol}} > P_{\text{dbl}}$ |
| **Hazard Analysis** | Simple 2D Central Difference Slope | **Multi-Modal Hazard Index (MHI)**: Slope + $W_z$ SAR roughness + YOLOv11 boulder density |
| **Pathfinding** | Standard 8-connected grid A* | **Kinematically-Constrained Hybrid A\*** with auto-snapping nearest safe cell |
| **Volume Model** | Flat multiplication | **2D Composite Simpson's Rule Numerical Integration** with bulk density scaling |
| **Validation** | Synthetic visual check | **Peer-reviewed benchmark validation** against Faustini F2/F3/H3/S1/Tooley |

---

## 6. End-to-End Execution Plan for Final Year Project (7-Month Roadmap)

```
Gantt Roadmap:
Month 1-2: Data Pipeline & GeoTIFF Ingestion (DFSAR + TMC-2 + OHRC + IIRS)
Month 3-4: DL Object Detection (YOLOv11 Craters/Boulders) & Polarimetric Decompositions
Month 5:   Multi-Modal Fusion Scoring & Validation against Sinha et al. (F2/F3/Tooley)
Month 6:   Hybrid A* Traversal Engine & Simpson's Volume Integration
Month 7:   Web Dashboard Deployment, Telemetry Export & Thesis Finalization
```

### Phase 1: Ingestion & Geometric Co-Registration (Months 1–2)
* Automate PRADAN PDS4 reader using `rasterio` and `gdal` with downscaled pyramid overviews.
* Ingest Robbins Crater Shapefile via `geopandas` to automatically clip SAR/DEM rasters to named craters.
* Synchronize SPICE kernels (`spiceypy`) for precise solar incidence angles.

### Phase 2: Radar Polarimetry & Hyperspectral Feature Extraction (Months 3–4)
* Compute $CPR$, $DOP$, and $m-\chi$ decompositions from L-band and S-band DFSAR products.
* Train YOLOv11 detector on 0.25m OHRC tiles for automated crater and boulder hazard masking.
* Extract 2.8–3.0 µm hydration absorption band depths from IIRS hyperspectral cubes.

### Phase 3: Machine Learning Fusion & Benchmark Validation (Month 5)
* Implement Isolation Forest and XGBoost scoring layers on extracted multi-modal feature vectors.
* Execute formal validation against the 9-crater ground truth benchmark:
  * Verify **F2** reaches highest ice probability ($>45\%$ interior coverage, lobate rim agreement).
  * Verify **Tooley**, **F1**, and **H1** score strictly negative ($0\%$ ice false positives).

### Phase 4: Autonomous Navigation & Volumetric Estimation (Month 6)
* Run 8-connected / Hybrid A* on the Multi-Objective Cost Grid ($C = 1 + W_1\theta + W_2 S + W_3 \text{Boulder}$).
* Integrate 3D ice volume and tonnage calculations using composite 2D Simpson's Rule.

### Phase 5: Production Web Dashboard & GIS Export (Month 7)
* Host React + Vite + OpenLayers interface with NASA Moon Trek WAC/LOLA base layers.
* Provide dual export: GeoJSON (for interactive web apps) and GeoTIFF (for scientific QGIS/ArcGIS analysis).
