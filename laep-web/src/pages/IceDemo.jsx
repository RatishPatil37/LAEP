import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Map from 'ol/Map';
import View from 'ol/View';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import WMTS, { optionsFromCapabilities } from 'ol/source/WMTS';
import { Circle, Fill, Stroke, Style } from 'ol/style';
import { get as getProjection, transform } from 'ol/proj';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { loadDemo, scoreColor } from '../lib/iceDemo';
import { parseNasaCapabilities } from '../lib/nasaWmts';
import 'ol/ol.css';
import '../styles/globals.css';
import '../styles/ice-demo.css';

// IAU lunar reference sphere; coordinate-system definition, not a sensor estimate.
proj4.defs('LUNAR:GEO', '+proj=longlat +R=1737400 +no_defs');
proj4.defs('LUNAR:SP', '+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m +no_defs');
register(proj4);
// Reprojection needs finite source/target domains, especially across the pole
// and antimeridian. Without these, OpenLayers can silently produce empty tiles.
for (const code of ['LUNAR:GEO']) {
  getProjection(code).setExtent([-180, -90, 180, 90]);
  getProjection(code).setWorldExtent([-180, -90, 180, 90]);
  getProjection(code).setGlobal(true);
}
const hemisphereRadius = 2 * proj4.defs('LUNAR:SP').a;
getProjection('LUNAR:SP').setExtent([-hemisphereRadius, -hemisphereRadius, hemisphereRadius, hemisphereRadius]);
getProjection('LUNAR:SP').setWorldExtent([-180, -90, 180, 0]);
const PRODUCT_URL = `${import.meta.env.BASE_URL}demo/predictions.json`;
const LAYER = 'LRO_WAC_Mosaic_SPole60_100m_v02';
// Fixed-host relay avoids cross-origin browser/network policy differences.
const NASA_TILES = import.meta.env.VITE_NASA_TILE_BASE_URL || '/nasa-tiles';
const CAPABILITIES = `${NASA_TILES}/Moon/SP/${LAYER}/1.0.0/WMTSCapabilities.xml`;
const project = (s) => transform([s.lon, s.lat], 'LUNAR:GEO', 'LUNAR:SP');
const scoreText = (s) => s === null ? 'No prediction' : s > 0 && s < 0.001 ? '<0.001' : s < 1 && s > 0.999 ? '>0.999' : s.toFixed(3);

export default function IceDemo() {
  const target = useRef(null);
  const mapRef = useRef(null);
  const pointsRef = useRef(null);
  const selectedRef = useRef(null);
  const inspectorRef = useRef(null);
  const initialSampleViewRef = useRef(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [baseState, setBaseState] = useState('Loading NASA basemap…');
  const [baseAttempt, setBaseAttempt] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [opacity, setOpacity] = useState(0.7);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    setError(''); setData(null); setSelected(null);
    loadDemo(PRODUCT_URL, controller.signal).then(result => { if (active) setData(result); }).catch(e => {
      if (!active) return;
      if (!controller.signal.aborted) setError(e.message);
      else setError('Prediction request stopped or timed out. Retry to load the authentic product.');
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setBaseState('Loading NASA basemap…');
    setHover(null);
    const timeout = setTimeout(() => controller.abort(), 20000);
    const base = new TileLayer();
    const points = new VectorLayer({ source: new VectorSource(), visible: false });
    const selection = new VectorLayer({ source: new VectorSource(), visible: false,
      style: new Style({ image: new Circle({ radius: 8, stroke: new Stroke({ color: '#fff', width: 2 }) }) }) });
    const map = new Map({ target: target.current, layers: [base, points, selection],
      view: new View({ projection: 'LUNAR:SP', center: [0, 0], resolution: 1200,
        minResolution: 50, maxResolution: 5000, enableRotation: false }) });
    initialSampleViewRef.current = false;
    mapRef.current = map; pointsRef.current = points; selectedRef.current = selection;
    const hit = e => map.forEachFeatureAtPixel(e.pixel, f => f.get('sample'), {
      layerFilter: l => l === points, hitTolerance: 5,
    });
    map.on('singleclick', e => { const sample = hit(e); if (sample) setSelected(sample); });
    map.on('pointermove', e => {
      if (e.dragging) return;
      const sample = hit(e) || null;
      setHover(previous => previous?.id === sample?.id ? previous : sample);
      map.getTargetElement().style.cursor = sample ? 'pointer' : '';
    });
    fetch(CAPABILITIES, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('NASA capabilities unavailable');
      const capabilities = parseNasaCapabilities(await response.text());
      // This particular service advertises EPSG:0. Its ImageServer WKT verifies
      // Moon sphere R=1737400, south stereographic, lon0=0, lat_ts=-90.
      // Resolve only this audited product, never guess an arbitrary unknown CRS.
      for (const matrix of capabilities.Contents.TileMatrixSet) {
        if (matrix.SupportedCRS === 'urn:ogc:def:crs:EPSG::0') matrix.SupportedCRS = 'LUNAR:SP';
      }
      const options = optionsFromCapabilities(capabilities, { layer: LAYER });
      if (!options) throw new Error('NASA layer configuration unavailable');
      if (!options.tileGrid.getExtent()?.every(Number.isFinite)) throw new Error('Invalid NASA tile bounds');
      options.urls = options.urls.map(url => url.replace('https://trek.nasa.gov/tiles', NASA_TILES));
      if (controller.signal.aborted) return;
      const source = new WMTS({ ...options, crossOrigin: 'anonymous',
        attributions: 'NASA Moon Trek / LRO WAC', wrapX: false });
      source.on('tileloaderror', () => { if (active) setBaseState('Some NASA tiles unavailable. Model samples are independent.'); });
      source.once('tileloadend', () => { if (active) setBaseState('NASA Moon Trek · LRO WAC'); });
      base.setSource(source);
    }).catch(error => {
      if (mapRef.current === map) setBaseState(`NASA basemap unavailable: ${error.message}`);
    }).finally(() => clearTimeout(timeout));
    const resize = new ResizeObserver(() => map.updateSize());
    resize.observe(target.current);
    return () => {
      active = false;
      clearTimeout(timeout); controller.abort(); resize.disconnect();
      map.setTarget(undefined); map.dispose();
      if (mapRef.current === map) mapRef.current = null;
      pointsRef.current = null; selectedRef.current = null;
    };
  }, [baseAttempt]);

  useEffect(() => {
    const source = pointsRef.current?.getSource();
    if (!source) return;
    source.clear();
    const styles = new globalThis.Map();
    const features = (data?.samples || []).filter(s => s.score !== null && s.lat < 0).map(s => {
      const f = new Feature({ geometry: new Point(project(s)), sample: s });
      // Quantize display colors only; exported predictions retain original precision.
      const bucket = Math.round(s.score * 100);
      if (!styles.has(bucket)) styles.set(bucket, new Style({ image: new Circle({ radius: 3,
        fill: new Fill({ color: scoreColor(bucket / 100) }),
        stroke: new Stroke({ color: 'rgba(180,215,255,.45)', width: 0.5 }) }) }));
      f.setStyle(styles.get(bucket)); return f;
    });
    source.addFeatures(features);
    if (features.length && !initialSampleViewRef.current) {
      mapRef.current?.getView().fit(source.getExtent(), {
        padding: [56, 56, 56, 56], minResolution: 130, duration: 0,
      });
      initialSampleViewRef.current = true;
    }
  }, [data, baseAttempt]);

  useEffect(() => {
    pointsRef.current?.setVisible(enabled);
    pointsRef.current?.setOpacity(opacity);
    selectedRef.current?.setVisible(enabled);
    if (!enabled) setHover(null);
  }, [enabled, opacity, baseAttempt]);

  useEffect(() => {
    const source = selectedRef.current?.getSource();
    source?.clear();
    if (selected && selected.score !== null && selected.lat < 0) {
      source?.addFeature(new Feature(new Point(project(selected))));
    }
  }, [selected, baseAttempt]);

  const rows = useMemo(() => (data?.samples || []).filter(s => s.id.toLowerCase().includes(query.toLowerCase())), [data, query]);
  const pageSize = 30;
  const fit = () => {
    const source = pointsRef.current?.getSource();
    if (source?.getFeatures().length) mapRef.current?.getView().fit(source.getExtent(), {
      padding: [40, 40, 40, 40], maxZoom: 12,
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400,
    });
  };
  const inspect = sample => {
    setSelected(sample);
    inspectorRef.current?.scrollIntoView({ block: 'center',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    if (enabled && sample.lat < 0 && sample.score !== null) mapRef.current?.getView().animate({
      center: project(sample), duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
    });
  };

  return <div className="ice-demo">
    <div className="ice-demo-header">
      <span>ICE DEPOSITS / MODEL EVIDENCE</span>
      <Link to="/moon">Explore the 3D Moon ↗</Link>
    </div>
    <div className="ice-demo-title"><div><p className="ice-eyebrow">MOON TREK / EXPERIMENTAL MODEL DEMO</p>
      <h1>Trace the signal.<br /><span>Inspect the evidence.</span></h1></div>
      <p>Actual XGBoost output on supplied samples.<br />Not confirmed ice, abundance, or calibrated probability.</p>
    </div>
    <div className="ice-demo-workspace">
      <section className="ice-map-section" aria-label="Lunar south polar diagnostic map">
        <div className="ice-map" ref={target} tabIndex={0} aria-label="Interactive south-polar map. Use plus and minus to zoom. Samples are also available in the table below." />
        <div className={`ice-map-status ${baseState.includes('unavailable') ? 'is-error' : ''}`} role="status">{baseState}
          {baseState.includes('unavailable') && <button onClick={() => setBaseAttempt(a => a + 1)}>Retry basemap</button>}</div>
        {!enabled && <div className="ice-map-notice">Overlay withheld pending location verification.<br /><small>These are supplied CSV coordinates, not validated ice locations.</small>
          <button disabled={!data} onClick={() => setEnabled(true)}>Show unverified locations</button></div>}
        {enabled && data && <div className="ice-map-warning">MODEL-SCORED SAMPLE POINTS · UNVERIFIED LOCATIONS · NOT CONFIRMED ICE<br />VIEW FRAMED TO SUPPLIED COORDINATES</div>}
        {hover && <div className="ice-map-hover">{hover.id} · model score {scoreText(hover.score)}</div>}
        <div className="ice-map-legend"><strong>Model score · label +1</strong>
          <div className="ice-scale" /><div className="ice-scale-labels"><span>0 · lower</span><span>1 · higher</span></div>
          <small>Points only · gaps are not interpolated · no-data omitted</small>
        </div>
      </section>
      <aside className="ice-evidence" aria-label="Evidence and layer controls">
        <p className="ice-eyebrow">DATA STATE</p><h2>Evidence before inference.</h2>
        {!data && !error && <p role="status">Loading authentic prediction product…</p>}
        {error && <div role="alert"><p>{error}</p><button onClick={() => setAttempt(a => a + 1)}>Retry product</button></div>}
        {data && <>
          <div className="ice-counts"><div><strong>{data.counts.eligible.toLocaleString()}</strong><span>scored samples</span></div>
            <div><strong>{data.counts.unobserved.toLocaleString()}</strong><span>IIRS unobserved</span></div></div>
          <label className="ice-check"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            Show model-scored sample points (unverified locations)</label>
          <label className="ice-opacity">Overlay opacity <input aria-label="Overlay opacity" type="range" min="0" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} disabled={!enabled} /></label>
          <button onClick={fit} disabled={!enabled}>Fit scored samples</button>
          <div className="ice-inspector" ref={inspectorRef} aria-live="polite"><p className="ice-eyebrow">TARGET INSPECTOR</p>
            {selected ? <><h3>{selected.id}</h3><dl>
              <dt>Source location</dt><dd>{selected.lat.toFixed(4)}°, {selected.lon.toFixed(4)}° · unverified</dd>
              <dt>Model score</dt><dd>{scoreText(selected.score)}</dd>
              <dt>Observation</dt><dd>{selected.state}</dd>
              <dt>Uncertainty</dt><dd>Not calibrated or quantified</dd>
              <dt>Quality flags</dt><dd>{selected.qc.join(' · ').replaceAll('_', ' ')}</dd>
            </dl></> : <p>Click a scored point or choose a sample below to inspect its provenance.</p>}
          </div>
          <details><summary>Model, provenance & limitations</summary>
            <p>{data.score_definition}</p><p>{data.validation_status}</p>
            <p>Model: {data.model.file}<br />{data.model.features.length} predictors · classes {data.model.classes.join(', ')}</p>
            <p className="ice-hash">SHA-256: {data.model.sha256}</p>
            <p>Source: {data.source.file}</p><p className="ice-hash">SHA-256: {data.source.sha256}</p>
            <ul>{data.limitations.map(item => <li key={item}>{item}</li>)}</ul>
            <p>LFM: {data.lfm.reason}. No fusion or invented agreement score.</p>
            <a href={PRODUCT_URL} download>Download prediction product ↗</a>
          </details>
        </>}
      </aside>
    </div>
    {data && <section className="ice-samples"><div className="ice-samples-heading"><div><p className="ice-eyebrow">ACCESSIBLE SAMPLE EXPLORER</p><h2>Every score has a source.</h2></div>
      <label>Find sample <input type="search" placeholder="Sample ID" value={query} onChange={e => {setQuery(e.target.value); setPage(0);}} /></label></div>
      <div className="ice-table-scroll"><table><thead><tr><th>Sample</th><th>Source latitude</th><th>Source longitude</th><th>Model score</th><th>Observation</th></tr></thead>
        <tbody>{rows.slice(page * pageSize, (page + 1) * pageSize).map(s => <tr key={s.id} className={selected?.id === s.id ? 'selected' : ''}>
          <td><button onClick={() => inspect(s)} aria-label={`Inspect ${s.id}`}>{s.id}</button></td><td>{s.lat.toFixed(4)}°</td><td>{s.lon.toFixed(4)}°</td>
          <td>{s.score !== null && <i style={{background: scoreColor(s.score)}} />}{scoreText(s.score)}</td><td>{s.state}</td></tr>)}</tbody></table></div>
      {!rows.length && <p>No matching samples.</p>}
      <div className="ice-pagination"><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
        <span>{rows.length.toLocaleString()} samples · page {page + 1} of {Math.max(1, Math.ceil(rows.length / pageSize))}</span>
        <button disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage(p => p + 1)}>Next</button></div>
    </section>}
    <footer className="ice-demo-footer">Basemap: NASA Moon Trek / LRO. Predictions: user-supplied LAEP model, not NASA-validated results.</footer>
  </div>;
}
