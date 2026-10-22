# Moon Trek diagnostic demo

Open `/ice-demo` in the existing frontend. No API server or GPU is needed for presentation: the bundled JSON contains precomputed outputs from the supplied joblib. NASA basemap tiles still require network access. The original Mission Planner remains a separate prototype; its synthetic layers are not used by this demo.

## What is real and what is unresolved

- The requested joblib was loaded and inspected: binary classes `[0, 1]`, 10 ordered features. Its adjacent 13-feature, three-class JSON/manifest is stale and is not used.
- 8,156 rows receive actual `predict_proba` output for class 1. The 11,844 IIRS-unobserved rows have null scores. No synthetic measurements, interpolation, threshold labels or LFM scores are generated.
- The cleaned spectral-column aliases are explicit in `source_contract.json`. Their exact equivalence to the missing training input is not established, so this is diagnostic inference, not a verified training replay or independent evaluation.
- Geolocation and feature provenance are not established. Locations are off by default; the user must explicitly enable the diagnostic overlay. Points represent CSV coordinates, not validated Faustini coverage.
- The model has no CPR/DOP predictors. The source radar columns are constant. Its rule-derived target cannot establish independent detection accuracy.
- LFM remains gated: no verified georeferenced embedding export and trained prediction head were found in the reviewed checkout. No arbitrary averaging or invented agreement score is applied.
- XGBoost emits a serialized-model compatibility warning when loading this joblib. The manifest records the runtime version. Re-export from its original training environment before an operational release.

## Reproduce predictions

From the ISRO repository root, using an environment with the model-compatible versions of pandas, numpy, joblib, scikit-learn and xgboost:

```powershell
.\.venv\Scripts\python.exe laep-api/demo/export_predictions.py --model DATASET/CUSTOM_DATASET/Module_training/ml_results/models/xgb_oh_detector_model.joblib --csv DATASET/CUSTOM_DATASET/Module_training/F2_combined_dataset_IIRS_processed.csv --config laep-api/demo/source_contract.json --output laep-web/public/demo/predictions.json
```

Only load trusted joblib artifacts. No training or source files are overwritten. The prediction product includes model, input CSV and contract SHA-256 hashes, class mapping, feature names and limitations. Do not silently reuse this contract for another product or model.

## Run

```powershell
cd laep-web
npm run dev -- --host 127.0.0.1
```

Visit `http://127.0.0.1:5173/ice-demo`. Enable **Show unverified source locations (diagnostic)**, then **Fit scored samples**. Hover/click a point or search a sample ID. Inspect a null-score row to demonstrate unavailable data. The score scale is not an ice abundance or calibrated probability scale.

## Tests

```powershell
# From laep-web
node --test src/lib/iceDemo.test.js
npm run build
# From laep-api
..\.venv\Scripts\python.exe -m unittest discover -s demo -p 'test_*.py'
```

`laep-web/qa-ice-demo.mjs` runs desktop/375px interactions, missing-product recovery and screenshots using Playwright and installed Edge. Set `LAEP_PLAYWRIGHT_PACKAGE` to a Playwright package.json if it is provided outside the project, `LAEP_QA_OUTPUT` for screenshots, and optionally `LAEP_BROWSER_CHANNEL`. It expects the local dev server on port 5173.

## Before validated ice mapping

Recover exact training preprocessing and dataset hashes; validate original raster geolocation and radiometry; repair placeholder radar/terrain values; obtain independent target evidence; evaluate buffered spatial holdouts; calibrate only against a defensible target. Verify LFM checkpoint, modality preprocessing, embedding footprints and trained head before fusion. Agreement between branches is not ground truth.

NASA WMTS capabilities are read at runtime. The dedicated `LRO_WAC_Mosaic_SPole60_100m_v02` mosaic is used, not the global equirectangular mosaic. Its unspecified `EPSG:0` identifier is resolved only for this audited product using the [official ImageServer WKT](https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_WAC_Mosaic_SPole60_100m_v02/ImageServer?f=pjson): lunar sphere radius 1,737,400 m, south polar stereographic, central meridian 0°, standard parallel −90°. Tile counts written as `2.0` are normalized to integer XML text without changing their numeric value. Invalid/fractional dimensions fail closed.

The fixed-host `/nasa-tiles` relay is configured in Vite and the root Vercel rewrite. Other hosting platforms must provide the same relay or set `VITE_NASA_TILE_BASE_URL=https://trek.nasa.gov/tiles` at build time. It cannot proxy arbitrary external hosts. No scientific distance is computed in raw degrees. This basemap is visual context, not an additional model feature or evidence of ice.
