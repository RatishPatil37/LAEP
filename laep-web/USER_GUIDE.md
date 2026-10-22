# LAEP — quick user guide

## Start the project

In `laep-web`, run `npm install` once, then `npm run dev`. Open the local URL printed by Vite. For a production check, use `npm run build` and `npm run preview`.

The frontend can show the Moon catalog and bundled ice prediction demo without running a new ML training job. Features that call `/api` need the existing `laep-api` service on port 8000 and its configured data/model files.

## Choose a section

| Navbar section | Best use |
|---|---|
| Overview | Read the project introduction and workflow. |
| 3D Moon | Explore the globe, South Pole and official named features. |
| Ice Deposits | Inspect the existing experimental model scores on the NASA Moon Trek basemap. |
| Mission Planner | Use the existing planning and data-view workflow. |
| 3D Simulator | Use the original rover route visualization and controls. This implementation has been preserved. |
| Analytics Lab / Methodology | Review the existing analysis screens and method explanations; check the stated data source and validation status. |

## Explore a crater

1. Open **3D Moon**, drag to orbit and scroll or use **+ / −** to zoom. **Global view** resets the camera; **South Pole** opens the polar region.
2. Search a crater, mountain or mare, or click a visible marker. The inspector shows the official name, source coordinates, diameter, naming history and approval year.
3. Use **Nearby named features** to explore neighboring catalog centers. The displayed separation is a spherical center-to-center calculation, not a rover route.
4. Open the official USGS record, download the source record as JSON, or copy the view link to share the selected target.
5. On phones, names start hidden to reduce clutter. Search below the globe, then use **Read field notes**. **Text view** pauses 3D; **3D view** resumes it.

The available overview is a NASA visualization texture with limited zoom. For actual streamed terrain, add Cesium Moon to your ion account and set `VITE_CESIUM_ION_TOKEN` and `VITE_CESIUM_MOON_ASSET_ID` in `.env.local`, then restart Vite. Use a URL-restricted, read-only browser token. A compatible self-hosted lunar tileset can instead use `VITE_LUNAR_TILESET_URL`. Detailed setup and current limitations are in `LUNAR_EXPLORER_STATUS.md`.

## Inspect ice model output

1. Open **Ice Deposits**. Let the prediction product and NASA basemap load. The old `/ice-demo` address redirects here.
2. Read **Data state** and **Model, provenance & limitations** first. The current scores are experimental outputs, not confirmed deposits or calibrated probabilities.
3. To inspect the supplied coordinates, enable **Show unverified source locations**. Adjust opacity or choose **Fit scored samples**.
4. Click a point or select a sample from the searchable table. Check its score, observation state and quality flags. Download the prediction product from the provenance section if needed.

The ice demo is not spatially joined to the 3D crater catalog. Missing IIRS or a missing prediction does not mean dry terrain. Basemap failure also does not invalidate or replace the source sample table.

## Best workflow and troubleshooting

Explore a named region in **3D Moon**, inspect available model evidence in **Ice Deposits**, then use the existing **Mission Planner** and **3D Simulator** for their planning/simulation workflows. Treat route playback as simulation; assess model validation and source coverage before drawing scientific conclusions.

- If terrain will not load, check the ion asset/token, allowed URLs and network; use the text catalog while resolving access.
- If NASA imagery fails, use **Retry basemap**; the sample table and provenance remain useful.
- If a feature record fails, use **Retry source record**. If clipboard access fails, copy the browser address.
- For a lightweight integrity check, run `npm run test:lunar`.

Current gaps: streamed terrain still needs connection/validation; the Moon inspector has no registered ice or DEM layers; model scores are not calibrated; rover-safe routes cannot be inferred from the globe texture.
