
### 1. Hardware Feasibility on Your Predator Helios Neo 16s

Your hardware specs (**Intel Core Ultra 7 255HX, 16 GB DDR5 RAM, RTX 5060 Laptop 8 GB VRAM**) are well-suited for **fine-tuning and multimodal inference**, but have strict boundaries:

* **Pretraining From Scratch: Impossible.** Pretraining a Vision Transformer (ViT) on multimodal planetary rasters requires tens to hundreds of terabytes of data across distributed clusters of enterprise GPUs (A100/H100s).
* **Fine-Tuning Downstream Tasks: Fully Feasible.** With 8 GB VRAM, you can easily fine-tune the [NASA-IBM Lunar Foundation Model](https://huggingface.co/collections/nasa-ibm-ai4science/nasa-ibm-lunar-fm-and-downstream-models?utm_source=gemini) on downstream tasks using:
* **LoRA (Rank $r=8$ or $16$)** or a **Frozen Backbone** where you only train the prediction head.
* **Mixed Precision (`fp16` or `bf16`)** via `torch.cuda.amp.autocast()`.
* **Batch Size:** $2$ to $4$ with gradient accumulation ($4$ steps).
* **Gradient Checkpointing** enabled to keep VRAM usage under 6.5 GB.
* **16 GB System RAM:** Your 20,000-row tabular CSV is tiny (a few megabytes in RAM). However, when loading 240 m/pixel GeoTIFF stacks from SomBench, do not load all images into memory at once. Use a PyTorch `Dataset` that reads `.tif` files on the fly via `rasterio` or `tifffile`.

---

### 2. Understanding the 5 SomBench Datasets

You should **not** train a single model on all 5 datasets simultaneously. In the [Lunar FM ML-Ready Benchmark dataset (SomBench)](https://huggingface.co/collections/nasa-ibm-ai4science/lunar-fm-ml-ready-benchmark-dataset-sombench?utm_source=gemini) collection, each dataset is designed for a completely different task:

* [Sombench-Ice-Prospectivity-Regression](https://huggingface.co/datasets/nasa-ibm-ai4science/Sombench-Ice-Prospectivity-Regression?utm_source=gemini): **Directly relevant.** 162 polar patches with 11 aligned physical layers (Diviner temperature, slope, PSR distance, target prospectivity).
* [Sombench-IMP-Segmentation](https://huggingface.co/datasets/nasa-ibm-ai4science/Sombench-IMP-Segmentation?utm_source=gemini): Semantic segmentation of Irregular Mare Patches (volcanic features, not polar ice).
* [Sombench-NAC-Crater-Detection](https://huggingface.co/datasets/nasa-ibm-ai4science/Sombench-NAC-Crater-Detection?utm_source=gemini) & [Sombench-WAC-Crater-Detection](https://huggingface.co/datasets/nasa-ibm-ai4science/Sombench-WAC-Crater-Detection?utm_source=gemini): Object detection for craters across the equatorial/global Moon.
* [Sombench-pretraining-data](https://huggingface.co/datasets/nasa-ibm-ai4science/Sombench-pretraining-data?utm_source=gemini): A small demo subset of the multi-sensor base tiles.

For an **Ice Detection Project**, your core benchmark from SomBench is **`Sombench-Ice-Prospectivity-Regression`**.

---

### 3. How to Combine SomBench (GeoTIFFs) with Chandrayaan-2 (CSV)

Because SomBench is spatial raster data (2D grids) and your Chandrayaan-2 dataset is tabular (scalars per sampled footprint), you cannot simply concatenate them into a single matrix.

Here are the two best architectural pathways to fuse them:

```
Pathway 1: Late-Fusion Stacking (Fastest, Highly Interpretable)
┌─────────────────────────────────┐
│ SomBench GeoTIFFs (LOLA/Diviner)│ ──> Pretrained NASA-IBM LFM ──> Spatial Score / 768-d Embedding (e_v)
└─────────────────────────────────┘                                                │
                                                                                   ▼
┌─────────────────────────────────┐                                      ┌──────────────────┐
│ Chandrayaan-2 CSV (20k x 18)    │ ───────────────────────────────────> │ XGBoost/LightGBM │ ──> Final Ice
│ (DFSAR CPR + IIRS Absorption)   │                                      │ or Tabular MLP   │     Prediction
└─────────────────────────────────┘                                      └──────────────────┘

Pathway 2: Dual-Branch Multimodal Deep Neural Network
  SomBench Tiles ─────> [Frozen/LoRA LFM ViT] ─────> Vector (768) ──┐
                                                                    ├──> Concat / Cross-Attention ──> Dense ──> Output
  Ch-2 18 Features ───> [Tabular MLP / TabNet] ────> Vector (128) ──┘

```

#### The Recommended Strategy: Late-Fusion Feature Embedding

1. **Spatial Alignment:** Map your 20k Chandrayaan-2 data points (using their latitude/longitude or crater ID) to the bounding boxes of the polar patches in `Sombench-Ice-Prospectivity-Regression`.
2. **Vision Feature Extraction:**

* Pass the aligned SomBench GeoTIFF patch through the pretrained NASA-IBM Lunar Foundation Model encoder.
* Extract either the **predicted prospectivity scalar** or the **768-dimensional latent token embedding** from the ViT backbone.

3. **Tabular Fusion:**

* Append this extracted spatial context vector/score as additional column(s) to your 18 Chandrayaan-2 features.
* Train a tabular model (**LightGBM**, **CatBoost**, or a **PyTorch MLP**) on the combined feature matrix.

---

### 4. Why Your Chandrayaan-2 Data Adds Huge Scientific Value

The NASA-IBM foundation model is trained primarily on NASA's LRO instruments (Diviner surface temperature, LOLA topography, LROC optical albedo). **It lacks active polarimetric radar and deep NIR spectroscopy.**

Your Chandrayaan-2 dataset fills those exact physical gaps:

* **DFSAR (Dual-Frequency SAR):** Provides L-band and S-band Circular Polarization Ratio ($\text{CPR} = \frac{\mu_{LR}}{\mu_{RR}}$) and $m$-$\chi$ decomposition. L-band penetrates several meters into the regolith—detecting subsurface ice that optical sensors cannot see.
* **IIRS (Imaging Infra-Red Spectrometer):** Directly measures diagnostic hydroxyl ($\text{OH}$) and water-ice ($\text{H}_2\text{O}$) absorption band depths between $2.85\,\mu\text{m}$ and $3.0\,\mu\text{m}$.
* **TMC-2 & OHRC:** Provides sub-meter micro-topography, crater shadows, and ultra-high-resolution slope/roughness.

Fusing LRO's thermal/PSR environment (via the NASA-IBM model) with Chandrayaan-2's radar penetration and spectroscopy yields a significantly more robust prospectivity map than either dataset alone.

---

### 5. Step-by-Step Implementation Plan

#### Step 1: Benchmark Your Chandrayaan-2 Tabular Dataset (Day 1)

Run an isolated baseline on your RTX 5060 using LightGBM or XGBoost:

* Target: Ice presence (binary) or ice weight concentration (continuous).
* Validation: **GroupKFold** grouped by crater/region (to avoid spatial autocorrelation leakage).
* Run **SHAP** analysis to determine which of your 18 features (e.g., DFSAR CPR vs. IIRS $3\,\mu\text{m}$ band depth) holds the most predictive power.

#### Step 2: Set Up TerraTorch & the LFM Backbone (Day 2)

In your local environment, install the foundation model tooling:

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
pip install terratorch timm rasterio

```

Load the pretrained Lunar Foundation Model weights locally and verify that a test SomBench tile passes through the encoder with `torch.no_grad()` without exceeding your 8 GB VRAM.

#### Step 3: Train the Multimodal Fusion Model (Days 3–5)

* Extract the spatial context score from SomBench for each coordinate in your 20k dataset.
* Train your final multi-sensor fusion model.
* Evaluate whether adding the foundation model's spatial representations improves the ROC-AUC or $R^2$ score over your standalone Chandrayaan-2 tabular baseline.
