# Moon Trek diagnostic demo — implementation and QA

## Delivered

Dedicated `/ice-demo` route in the Desktop ISRO checkout. Existing site design and routes remain intact. The demo uses the actual user-supplied binary XGBoost model, a local precomputed prediction product and NASA's dedicated south-polar WAC mosaic. No API server or GPU is required to present the precomputed results.

| Files | Change |
|---|---|
| `laep-api/demo/export_predictions.py`, `source_contract.json` | Explicit feature adapter, ordered model introspection, observation/nodata masks, genuine inference, hashes and provenance |
| `laep-api/demo/test_export_predictions.py`, `README.md`, `QA_REPORT.md` | Feature-contract tests, reproduction instructions and verification record |
| `laep-web/public/demo/predictions.json` | 20,000 source records; 8,156 scores; 11,844 unobserved rows with null scores |
| `laep-web/src/pages/IceDemo.jsx`, `src/styles/ice-demo.css` | Polar map, consent-gated diagnostic overlay, sequential blue legend, hover/selection, inspector, sample search/pagination, mobile layout and failure recovery |
| `laep-web/src/lib/iceDemo.js`, `iceDemo.test.js`, `nasaWmts.js` | Product validation, score styling, tests and NASA XML compatibility normalization |
| `laep-web/src/main.jsx`, `src/App.jsx` | Demo navigation and lazy routes so the demo does not require the 3D simulator bundle |
| `laep-web/src/components/MoonMap.jsx` | Missing sound import, map cleanup, stale empty vector-source handling and crater-click/waypoint conflict fixes |
| `laep-web/vite.config.js`, `vercel.json` | Fixed-host NASA tile relay for local development and Vercel |
| `laep-web/qa-ice-demo.mjs` | Repeatable desktop/mobile browser verification and deliberate-outage recovery tests |

Original CSV/model artifacts and unrelated changes in the NASA LFM checkout and dataset browse directory were preserved. No commit, push, deployment, retraining or unsupported LFM fusion was performed. Legacy Mission Planner synthetic endpoints remain outside the new demo path; this is not an assertion that the entire repository is production-ready.

## Verification results

- Production build passed. The existing separate 3D chunk still triggers Vite's large-chunk warning; it is lazy-loaded, not required by the demo route.
- Frontend contract tests: 3 passed. Python feature-contract tests: 4 passed, including sentinel/NaN/infinity handling and missing/duplicate feature failures.
- Browser smoke test passed at desktop 1440×1000 and mobile 375×812. Screenshots were inspected, not just generated.
- Verified real NASA south-polar imagery visually beneath model points. The final browser run recorded 10 successful NASA tile responses.
- Tested consent gate, fit-to-samples, hover, point selection, table selection, search/no-match behavior, and mobile page overflow.
- Tested prediction-file HTTP 503 and successful retry; NASA relay HTTP 503 and successful basemap retry. Expected network errors during these deliberately induced failures are distinct from normal-operation errors.
- Normal-operation console errors: 0. JavaScript runtime exceptions across the smoke test: 0.
- Latest local browser run reached the loaded dataset in approximately 1.25 seconds. Prediction product size: 3,311,159 bytes uncompressed. These are local smoke measurements, not a production or low-end-mobile performance benchmark.
- `git diff --check` passed; Git reported only its existing LF/CRLF normalization warnings.

NASA integration required two verified compatibility fixes: decimal-form integer tile counts (e.g. `2.0`) are normalized without rounding; the selected service's unspecified EPSG:0 is resolved using its official lunar south-polar WKT. Unknown arbitrary services are not assigned a guessed projection. The old global WAC mosaic was unsuitable for this polar presentation and was replaced with the catalogued south-polar product.

## Scientific boundaries

The actual joblib has 10 predictors and binary classes `[0, 1]`; its adjacent three-class JSON/manifest is stale. Scores are the actual loaded model's class-1 outputs, using explicit cleaned-column aliases. Exact preprocessing equivalence and training membership remain unresolved. They must not be called independently validated ice probabilities.

The source CSV has constant CPR/DOP, unverified geolocation and rule-derived labels. These defects were not concealed or repaired with invented values. Coordinates are hidden until the user explicitly requests diagnostic display. Unobserved IIRS has no score and is not inferred to be PSR or dry regolith. No ice mass, abundance, area, distance-to-ice or calibrated uncertainty is claimed.

LFM integration remains blocked by unverified georeferenced embedding/checkpoint/head artifacts in the reviewed checkout. No random projection, embedding-similarity confidence or arbitrary branch averaging was introduced.

## Three weakest aspects after QA

1. **Scientific validity:** source geolocation and preprocessing remain unverified, and rule-derived labels cannot establish detection accuracy. The honest result is a diagnostic model demo, not a validated prospectivity product.
2. **Basemap interpretability:** the real 100 m WAC mosaic has dark shadows, visible mosaic seams and limited detail when zoomed. Those features are not model boundaries or inferred PSRs. Network availability remains external.
3. **Mobile evidence workflow:** the inspector is below the map and the detailed table scrolls horizontally. It works at 375px but is less efficient than the desktop side-by-side view; a bottom-sheet inspector is a possible later refinement.

## Presentation

Open `http://127.0.0.1:5173/ice-demo`, select **Show unverified locations**, then **Fit scored samples**. Explain that the blue scale is an experimental model-label score. Use a null-score sample to show how missing data is handled and expand provenance to disclose the limitations. See `README.md` for startup and regeneration commands.
