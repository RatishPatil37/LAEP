# Geospatial Machine Learning & Windows Development Rules

## 1. Windows Path Encoding Guardrail
- **Always format Windows file paths in Python code, notebooks, and scripts using raw string literals `r"..."` or forward slashes `/`.**
- **Never write unescaped backslashes in paths containing `\Users`** (which Python attempts to decode as 8-character `\U` 32-bit unicode escapes) or filenames beginning with `\f` (form-feed), `\n` (newline), `\t` (tab), or `\r` (carriage return).
- Example:
  ```python
  # Correct
  path = Path(r"C:\Users\patil\OneDrive\ISRO\DATASET\CUSTOM_DATASET\Module_training") / "dataset.csv"
  path = Path("C:/Users/patil/OneDrive/ISRO/DATASET/CUSTOM_DATASET/Module_training/dataset.csv")

  # Prohibited (causes SyntaxError: 'unicodeescape' codec can't decode bytes)
  path = "C:\Users\patil\OneDrive\ISRO\DATASET\CUSTOM_DATASET\Module_training\F2_dataset.csv"
  ```

## 2. Geospatial Train/Test Split Invariant
- **Never use standard random `train_test_split` or random `KFold` on geospatial or remote sensing datasets.**
- Adjacent spatial pixels violate the independent and identically distributed (i.i.d.) assumption due to **spatial autocorrelation** (Tobler's First Law of Geography). Random shuffling leaks adjacent spatial context into validation folds, causing artificially inflated performance metrics.
- **Always use Spatial Block Cross-Validation** (e.g., `GroupKFold` over spatial tile blocks):
  ```python
  grid_size_deg = 0.05  # ~1.5 km blocks
  df['spatial_block'] = (
      (df['Latitude_deg_SAR'] // grid_size_deg).astype(int).astype(str) + "_" +
      (df['Longitude_deg_SAR'] // grid_size_deg).astype(int).astype(str)
  )
  gkf = GroupKFold(n_splits=5)
  for train_idx, val_idx in gkf.split(X, y, groups=df['spatial_block']):
      ...
  ```

## 3. Physical ML Feature Decoupling Invariant
- **Strictly eliminate circular target data leakage.**
- When defining ground-truth labels using physical threshold heuristics (e.g., Band Depth > 0.02, CPR > 1.0), **ALWAYS remove the source metric and all co-linear spectral index ratios from the predictive feature matrix $X$**.
- Require models to predict target states strictly from independent raw reflectance bands, polarimetric Stokes parameters, incidence geometry, and topographic elevation/slope attributes.
