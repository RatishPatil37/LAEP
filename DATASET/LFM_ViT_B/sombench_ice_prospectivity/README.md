---
license: cc-by-4.0
pretty_name: "SomBench Benchmark: Polar Ice Prospectivity Regression"
task_categories:
  - tabular-regression
tags:
  - lunar
  - planetary-science
  - remote-sensing
  - regression
  - water-ice
  - polar
  - geotiff
---

# SomBench Benchmark: Polar Ice Prospectivity Regression

**Science theme:** Polar volatiles

**Task:** Regression

## Dataset Summary

A polar, multi-layer benchmark for predicting **near-surface water-ice
prospectivity** within ~10° latitude of each pole at **240 m/pixel**. Following
the ice-prospectivity workflow of Coyan et al. (2025), the dataset includes a
group of physically motivated **evidential layers** (thermophysical,
illumination, and terrain) alongside a continuous **prospectivity target**. Each
polar patch is stored as a set of **individual GeoTIFF layers**, for both the
**north (`80N`)** and **south (`80S`)** poles, with `train`/`val`/`test` split
lists.

Task framing: **regression** of the prospectivity value (0–1) from the evidential
layers.

## Dataset Structure

### Directory layout

```
prospectivity_dataset/
├── README.md                                         # data source overview
├── band_statistics.json                              # per-layer normalization statistics
├── train_filtered.txt                                # train split patch lists
├── val_filtered.txt                                  # val split patch lists
├── test_filtered.txt                                 # test split patch lists
└── patch_{RRRR}_{CCCC}[_S]_{80N|80S}_{LAYER}.tif     # patch files
```

- **Patch naming:** `patch_{row}_{col}_{pole}_{LAYER}.tif`, where the pole tag is
  `80N` for the north pole and `S_…_80S` for the south pole. Each patch index
  therefore has one GeoTIFF **per layer**.
- **`band_statistics.json`**: per-layer statistics for normalization.
- **`train_filtered.txt` / `val_filtered.txt` / `test_filtered.txt`**: patch-id lists defining the splits.

### Layers (one GeoTIFF per layer, per patch)

| Suffix          | Layer                                   | Group           |
|-----------------|-----------------------------------------|-----------------|
| `DICE`          | Diviner ice stability depth             | Thermophysical  |
| `TMAX`          | Maximum surface temperature             | Thermophysical  |
| `LPSR`          | Permanently shadowed regions (PSR) mask | Illumination    |
| `LPSR_DIS`      | Distance to nearest PSR                 | Context         |
| `LPSR_DEN`      | PSR density (local areal density)       | Context         |
| `SLOPE`         | Slope                                   | Terrain         |
| `CUR`           | Curvature                               | Terrain         |
| `ASP_SIN_COS`   | Aspect (sine + cosine)                  | Terrain         |
| `ONLYCOS`       | Aspect (cosine-only variant)            | Terrain         |
| **`PRO`**       | **Ice prospectivity, regression target/label** | **Target** |

These correspond to the nine evidential layers described in the SOMBench paper
(ice stability depth, maximum temperature, PSRs, slope, curvature, aspect,
distance to PSRs, and PSR density) plus the prospectivity target. Aspect is
provided in **two versions** with different input channels (`ASP_SIN_COS`, `ONLYCOS`); choose
the input channels appropriate to your model.

### Contents

| Item | Value |
|------|-------|
| Resolution | 240 m/pixel |
| Extent | within ~10° latitude of each pole (north `80N`, south `80S`) |
| Layer format | single-band GeoTIFF, one file per layer per patch |
| Files | 1,782 GeoTIFFs ≈ 162 patches × 11 layers (both poles) |
| Splits | Train **108** · Val **24** · Test **25** patches (162 total), listed in `train_filtered.txt` / `val_filtered.txt` / `test_filtered.txt` |
| Regression target | `PRO` (continuous prospectivity, 0–1) |

## Known Limitations

- Prospectivity is a **model-derived, tunable product**: weights encode assumed
  relationships between ice concentration and the evidential layers and may
  evolve as in-situ constraints improve.
- Extreme polar illumination and sparse ground truth make evaluation sensitive to
  metric choice and label assumptions.

## Citation

```bibtex
@article{fraccaro2026lfm,
  title  = {Multimodal-Multiresolution Foundation Model for Lunar Remote Sensing},
  author = {Fraccaro, Paolo and Nyirjesy, Gabby and Szwarcman, Daniela and Patil, Himanshu
            and Gaur, Vishal and Lal, Rohit and Slank, Rachel A. and Dawson, Geoffrey
            and Debary, Hiyam and Dionelis, Nikolaos and Barker, Michael K. and Annex, Andrew
            and Viswanathan, Vishnu and Morse, Zachary and Schaefer, Ethan I. and Kumar, Ankur
            and Watson, Campbell D. and Dawson-Rigas, Rebekah I. and Maskey, Manil
            and Roy, Sujit and Ramachandran, Rahul and Bernab\'e-Moreno, Juan},
  year   = {2026}
  howpublished = {\url{https://huggingface.co/collections/nasa-ibm-ai4science/nasa-ibm-lunar-fm-and-downstream-models}}
}

@misc{sombench2026collection,
  author = {Patil, Himanshu and Nyirjesy, Gabby and Slank, Rachel A. and Gaur, Vishal
          and Szwarcman, Daniela and Fraccaro, Paolo and Dionelis, Nikolaos and Barker, Michael K.
          and Annex, Andrew and Viswanathan, Vishnu and Morse, Zachary and Schaefer, Ethan I.
          and Debary, Hiyam and Kumar, Ankur and Lal, Rohit and Dawson, Geoffrey
          and Watson, Campbell and Dawson-Rigas, Rebekah I. and Maskey, Manil
          and Bernab\'e-Moreno, Juan and Ramachandran, Rahul and Roy, Sujit},
  title        = {{SomBench}: Benchmark Dataset for Advancing Machine Learning in Lunar Science},
  year         = {2026},
  howpublished = {\url{https://huggingface.co/collections/nasa-ibm-ai4science/lunar-fm-ml-ready-benchmark-dataset-sombench}}
}
```

## License

Released under the **Creative Commons Attribution 4.0 International (CC BY 4.0)**
license.