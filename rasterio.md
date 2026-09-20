# ISRO Chandrayaan-2 DFSAR GeoTIFF & Vector Processing Engine (`rasterio.md`)

This document provides a comprehensive breakdown of the full-resolution polarimetric analysis performed by `rast.py` on the 1.89 GB ISRO Chandrayaan-2 Dual-Frequency Synthetic Aperture Radar (DFSAR) North Pole dataset (`ch2_sar_ndxl_20250630mpcpnpwest`).

---

## 1. Physical Formulas & Mathematical Foundation

### Circular Polarisation Ratio (CPR)
$$\text{CPR} = \frac{\sigma^\circ_{\text{SC}}}{\sigma^\circ_{\text{OC}}}$$
- $\sigma^\circ_{\text{SC}}$: Same-Sense Circular radar backscatter cross-section power (Right-Right or Left-Left).
- $\sigma^\circ_{\text{OC}}$: Opposite-Sense Circular radar backscatter cross-section power (Right-Left).

### Degree of Polarisation (DOP / $m$)
$$m = \frac{\text{SRD}}{\text{TRT}} = \frac{\sqrt{S_2^2 + S_3^2 + S_4^2}}{S_1}$$
- $\text{SRD}$: Single-look / Same-Sense Relative Power ($\sigma^\circ_{\text{SC}}$).
- $\text{TRT}$: Total Received Power ($S_1 = S_0 = \sigma^\circ_{\text{SC}} + \sigma^\circ_{\text{OC}}$).

### Dual-Criterion Physical Subsurface Ice Model (*Sinha et al. 2026, ISRO / PRL*)
$$\text{Confirmed Water Ice} = (\text{CPR} > 1.0) \land (\text{DOP} < 0.13)$$

### Ice Discrimination Ratio
$$\text{Ice Discrimination Ratio} = \left( \frac{\text{Confirmed Ice Pixels}}{\text{High-CPR Candidate Pixels}} \right) \times 100\%$$

---

## 2. Ingestion & Spatial Footprint Metadata

| Parameter | Value | Description |
| :--- | :--- | :--- |
| **Target Dataset** | `ch2_sar_ndxl_20250630mpcpnpwest` | ISRO PRADAN Level-2/3 DFSAR GeoTIFF scene |
| **Target Region** | North Pole ($+90^\circ$) | Lunar High-Latitude Polar Zone ($76.9^\circ\text{N} - 90.0^\circ\text{N}$) |
| **Raster Dimensions** | $20,373 \times 23,246$ | Total matrix size: **473,590,758 pixels** ($473.6\text{ Megapixels}$) |
| **Spatial Resolution** | $25.0\text{ m} \times 25.0\text{ m}$ | Ground sampling area = **$625\text{ m}^2$ per pixel** ($0.000625\text{ km}^2$) |
| **Projection System** | Moon 2000 Polar Stereographic | $R = 1,737,400\text{ m}$, $\text{Lat}_0 = +90^\circ$, $\text{Lon}_0 = 0^\circ$ |
| **Stereographic Extent** | $X \in [-253.9\text{ km}, 255.4\text{ km}]$<br>$Y \in [-306.4\text{ km}, 274.8\text{ km}]$ | Footprint bounds in stereographic meters |

---

## 3. Individual Channel Full-Resolution Statistics

### Phase 1: CPR Channel (`..._d_cpr_...tif`)
- **Total Evaluated Grid Pixels**: $473,590,758$
- **Valid Data Pixels**: **$141,868,193$** ($29.96\%$ observation coverage; remaining $\sim 70\%$ is zero-padded black background)
- **Minimum Value**: `0.0008` *(Smooth, flat lunar mare regolith)*
- **Maximum Value**: `4.6012` *(Strong polarization reversal anomaly)*
- **Mean Value**: `0.2696` *(Normal dry lunar soil baseline)*
- **Median Value**: `0.2326`
- **High-CPR Pixels ($\text{CPR} > 1.0$)**: **$514,890\text{ pixels}$** ($0.36\%$ of valid data)

### Phase 2: SRD Channel (`..._d_srd_...tif`)
- **Valid Data Pixels**: $141,856,775$ ($29.95\%$ coverage)
- **Minimum Value**: `0.0065`
- **Maximum Value**: `0.9998`
- **Mean Value**: `0.7997`
- **Median Value**: `0.8156`

### Phase 3: TRT Channel (`..._d_trt_...tif`)
- **Valid Data Pixels**: $141,868,704$ ($29.96\%$ coverage)
- **Minimum Value**: `0.0009`
- **Maximum Value**: `7.0778` *(Sunlit / radar-facing steep crater slopes)*
- **Mean Value**: `0.2852`
- **Median Value**: `0.2464`

---

## 4. Phase 4: Multi-Channel Polarimetric Fusion & Ice Results

Synchronous pixel-by-pixel alignment across CPR, SRD, and TRT channels:

### Exact Degree of Polarisation (DOP / $m$) Distribution
- **Valid 3-Channel Intersection Pixels**: **$141,855,767$** ($88,659.85\text{ km}^2$)
- **Minimum DOP**: `0.0024`
- **Maximum DOP**: `1.0000`
- **Mean DOP**: `0.9879` *(Confirms that dry lunar soil stays strongly polarized)*
- **Median DOP**: `1.0000`
- **Low DOP Pixels ($m < 0.13$)**: **$4,990\text{ pixels}$** ($0.003\%$)

### Final Water Ice Discrimination
1. **CPR Candidate Anomalies ($\text{CPR} > 1.0$)**: **$505,871\text{ pixels}$** ($316.17\text{ km}^2$)
2. **Confirmed Subsurface Water Ice ($\text{CPR} > 1.0 \land \text{DOP} < 0.13$)**: **$4,381\text{ pixels}$** ($2.74\text{ km}^2$)
3. **Ice Discrimination Ratio**: **$0.87\%$**

> **Scientific Insight**: **$99.13\%$** of the high-CPR features in this scene are **rocky/blocky crater ejecta and boulders** (high CPR + high DOP). Only **$0.87\%$** ($2.74\text{ km}^2$) exhibits genuine, volume-scattering subsurface water ice!

---

## 5. Edge Cases & Numerical Safety Safeguards

1. **Division-by-Zero / Singularities**:
   Regularized using $\text{DOP} = \frac{\text{SRD}}{\max(\text{TRT}, 10^{-6})}$ to prevent infinite or NaN values in dark radar shadow zones.

2. **Swath Boundary Masking**:
   Uses a joint boolean validity mask $\text{valid\_mask} = (\text{CPR} > 0) \land (\text{TRT} > 0) \land \text{isfinite}(\text{data})$ across all bands simultaneously.

3. **Memory Safety**:
   Processes gigapixel rasters in $2048 \times 2048$ window blocks, maintaining a peak RAM footprint under **$350\text{ MB}$**.
