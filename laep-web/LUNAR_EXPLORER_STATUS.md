# Lunar Explorer — first implementation increment

## Scope

New lazy route `/moon` and navbar/command-palette entries. The existing `/simulator`, rover code, backend, ML models, and ice demo are unchanged. The Moon route hides the legacy boot overlay, assistant, and mission utility badges only while the atlas is open.

## Implemented

- Direct CesiumJS viewer isolated from existing R3F scenes; explicit Moon ellipsoid throughout, request-render mode, bounded zoom, reduced-motion flights, cleanup on unmount and React StrictMode.
- Global/South Pole presets, cancellable feature flights, marker selection, hover metadata, label toggle, zoom buttons, URL-based feature selection and copy link.
- Official USGS / IAU lunar catalog: 9,087 named features in the downloaded snapshot. Validated coordinates/IDs and recorded upstream SHA256. Full names, coordinates, types, naming origins, diameters and source links; no invented science.
- DOM search and inspector remain usable independently of successful surface loading. Responsive stacked mobile composition and explicit field-notes link.
- Explicit Text view pauses WebGL but retains search, URL selection and source cards; a 3D view control resumes the scene. Renderer errors fall back to this catalog view.
- Mobile opens with labels off and keeps the search/catalog as the primary target picker; labels remain opt-in. Controls sit above the Moon at 375px.
- Configurable Cesium Moon ion asset or custom Moon-fixed 3D Tiles URL. Credits retained.
- Without credentials, a deliberately zoom-limited NASA SVS global texture overview. This is NOT the promised deep terrain experience and does not make its validation complete.

## Manual connection required

1. Add [Cesium Moon](https://cesium.com/platform/cesium-ion/content/cesium-moon/) to your own ion account.
2. In your local `.env.local`, set `VITE_CESIUM_ION_TOKEN` to a URL-restricted, asset-read-only browser token and `VITE_CESIUM_MOON_ASSET_ID` to the asset ID from your account. Vite values are browser-public, never put server secrets here.
3. Restart `npm run dev`, open `/moon`. Confirm terrain, polar coverage, credits, tile failures and minimum safe camera clearance using the actual asset.
4. Alternative: `VITE_LUNAR_TILESET_URL` for your CORS-enabled lunar 3D Tiles endpoint; verify Moon-fixed frame, metre units, lunar radius and vertical datum BEFORE using it. An Earth-centered tileset is not interchangeable.

The application does not copy another project's ion token, create an account, accept subscription terms, or assume asset access.

## Data provenance

- Catalog: https://planetarynames.wr.usgs.gov/GIS_Downloads
- Snapshot: https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz
- Import: `python scripts/import-lunar-catalog.py <downloaded-kmz>`; writes `public/data/lunar/catalog.json` with retrieval time/hash. Coordinates retain source precision; UI rounds for readability. Coordinates are planetocentric, east-positive, normalized to [-180,180); LOLA2011 control network. Catalog centers are not footprints.
- Overview: NASA Scientific Visualization Studio, CGI Moon Kit, https://svs.gsfc.nasa.gov/4720/ ; `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg`. The 2025 color-map preview is 2048×1024. LROC color coverage is supplemented with lower-resolution LOLA polar albedo and inpainting. It is optimized for visualization, not scientific analysis. No elevation is implied by its shading.

## Verification

- Production build passed; `npm run test:lunar`: catalog integrity, search/diacritics/polar filtering, lunar coordinate round-trip tests pass.
- In-app browser: desktop overview, selected crater inspector, marker click, South Pole navigation, 375px mobile catalog search/selection, text-only catalog and return to 3D verified. No runtime errors observed in these interactions. Existing React Router future-version warning remains.
- Real streamed terrain, GPU context-loss injection, offline network failure, physical mobile performance, and reduced-motion OS emulation are NOT yet verified. Loading/error/reduced-motion handling is implemented but not equivalent to those tests.
- Cesium is route-lazy; initial Moon JS chunk is approximately 1.14 MB gzip. Catalog search/marker index is about 0.95 MB uncompressed; provenance details load by ID-prefix shard on selection. Up to 26 decluttered markers are created at global scale, fewer at closer zoom/mobile. No post-processing or always-moving Moon. Formal device FPS/memory budgets remain to be measured.
- npm audit reports existing ecosystem advisories; no `audit fix --force` or broad major-version upgrade was attempted. Removed the newly tested static-copy dependency because of its advisories; Cesium static assets are copied by Node built-ins from the pinned package into ignored `public/cesiumStatic` during Vite config loading.

## Next implementation slices / three weakest aspects

1. **Terrain is unconnected:** validate the ion asset or self-hosted endpoint, surface collision, resolution/coverage, and polar rendering. The fallback is intentionally not a terrain substitute.
2. **Delivery performance:** index/details are separated; next implement viewport-specific retrieval, add cache/version strategy, and benchmark real low-end/mobile devices. Run a separately scoped Vite/router dependency modernization.
3. **Scientific surface interaction:** register actual DEMs and evidence layers with CRS, nodata, resolution, footprints, model version and uncertainty. Only then enable elevation profiles, calibrated ice overlays and slope/hazard measurements. No new rover planning or ML inference has been fabricated here.

Still pending from the full plan: renderer comparison with actual terrain, deeper camera/LOD QA, local DEM profile tools, validated overlay manifests, broader accessibility/performance/error tests, deployment cache/CSP/CORS checks. This document is an incremental status, not a production-readiness claim.
