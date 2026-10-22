import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Ellipsoid } from 'cesium';
import MoonScene from './MoonScene';
import { findFeatures, locationText, nearbyFeatures } from './catalog';
import './lunar.css';

export default function LunarExplorer() {
  const [params, setParams] = useSearchParams();
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(false);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const detailCache = useRef(new Map());
  const [query, setQuery] = useState('');
  const [labels, setLabels] = useState(() => window.matchMedia('(min-width: 600px)').matches);
  const [visual, setVisual] = useState(true);
  const [hover, setHover] = useState(null);
  const [state, setState] = useState({ kind: 'loading', message: 'Initializing the Moon…' });
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const sceneApi = useRef(null);
  const inspector = useRef(null);
  const features = catalog?.features || [];
  const selected = features.find(f => f.id === params.get('feature')) || null;
  const record = detail?.id === selected?.id ? detail : null;
  const nearby = useMemo(() => nearbyFeatures(features, selected, Ellipsoid.MOON.maximumRadius), [catalog, selected]);
  const view = params.get('view') === 'south' ? 'south' : 'global';
  const destination = useMemo(() => ({ view }), [view]);

  useEffect(() => {
    if (!selected) { setDetail(null); setDetailError(false); return; }
    const id = selected.id;
    const group = id.slice(0, 2);
    setDetailError(false);
    if (detailCache.current.has(group)) {
      const cached = detailCache.current.get(group).find(item => item.id === id);
      setDetail(cached || null);
      setDetailError(!cached);
      return;
    }
    setDetail(null);
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/lunar/details/${group}.json`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Source detail unavailable'); return r.json(); })
      .then(records => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(records)) throw new Error('Invalid source detail');
        detailCache.current.set(group, records);
        const record = records.find(item => item.id === id);
        if (!record) throw new Error('Feature detail missing');
        setDetail(record);
      })
      .catch(error => { if (error.name !== 'AbortError') setDetailError(true); });
    return () => controller.abort();
  }, [selected?.id, detailAttempt]);

  useEffect(() => { inspector.current?.scrollTo({ top: 0 }); }, [selected?.id]);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError(false);
    fetch(`${import.meta.env.BASE_URL}data/lunar/catalog.json`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Catalog unavailable'); return r.json(); })
      .then(data => { if (!Array.isArray(data.features)) throw new Error('Invalid catalog'); setCatalog(data); })
      .catch(error => { if (error.name !== 'AbortError') setCatalogError(true); });
    return () => controller.abort();
  }, [retry]);

  const results = useMemo(() => findFeatures(features, query, !query && view === 'south'), [catalog, query, view]);
  const select = feature => { setParams({ view, feature: feature.id }); setHover(null); setCopied(false); setCopyError(false); };
  const go = next => { setParams({ view: next }); setQuery(''); setCopied(false); };
  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setCopyError(false); }
    catch { setCopied(false); setCopyError(true); }
  };
  const downloadRecord = () => {
    if (!selected || !record) return;
    const data = { feature: { ...selected, ...record }, provenance: { source: catalog.source, sourceUrl: catalog.sourceUrl,
      retrievedAt: catalog.retrievedAt, sourceSha256: catalog.sha256, coordinateSystem: catalog.coordinateSystem },
      limitations: 'Nomenclature record; no ice prediction, terrain measurement, or surveyed crater boundary.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `lunar-feature-${selected.id}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <section className="lunar-explorer" aria-labelledby="lunar-title">
    <header className="lunar-heading">
      <div><span className="lunar-eyebrow">LAEP / PLANETARY ATLAS</span><h1 id="lunar-title">A world worth exploring<span>.</span></h1></div>
      <div className="lunar-view-tabs" aria-label="Camera presets">
        <button type="button" aria-pressed={view === 'global' && !selected} onClick={() => go('global')}>Global view</button>
        <button type="button" aria-pressed={view === 'south' && !selected} onClick={() => go('south')}>South Pole <span>↗</span></button>
      </div>
    </header>

    <div className="lunar-workspace">
      <div className="lunar-stage">
        {visual ? <MoonScene key={retry} features={features} selected={selected} destination={destination} labels={labels}
          onSelect={select} onHover={setHover} onState={next => { setState(next); if (next.kind === 'error') setVisual(false); }} sceneApi={sceneApi} /> :
          <div className="lunar-text-surface" role="img" aria-label="Text catalog mode. Search named lunar features in the adjacent panel."><span>☾</span><p>Explore the Moon through its named places.</p><small>3D visualization is paused. The source catalog and feature inspector remain available.</small></div>}
        <div className="lunar-stage-caption" aria-hidden="true"><span>{selected ? selected.name : view === 'south' ? 'The lunar south' : 'One Moon. Thousands of places.'}</span>
          <small>{selected ? 'IAU NOMENCLATURE TARGET' : 'DRAG TO EXPLORE · SCROLL TO APPROACH'}</small></div>
        {hover && <div className="lunar-hover" role="status"><strong>{hover.name}</strong><span>{locationText(hover)}</span><small>Select to inspect source record</small></div>}
        {selected && <a className="lunar-mobile-inspect" href="#lunar-field-notes">{selected.name} · Read field notes ↓</a>}
        <div className="lunar-scene-controls" aria-label="Moon controls">
          {visual && <><button type="button" aria-label="Zoom in" onClick={() => sceneApi.current?.zoom(0.7)}>＋</button>
          <button type="button" aria-label="Zoom out" onClick={() => sceneApi.current?.zoom(1.4)}>−</button>
          <button type="button" aria-pressed={labels} onClick={() => setLabels(!labels)}>Names</button></>}
          <button type="button" className="lunar-mode-toggle" onClick={() => { setVisual(!visual); setState({ kind: visual ? 'text' : 'loading', message: visual ? 'Text catalog view · 3D paused' : 'Starting lunar visualization…' }); }}> {visual ? 'Text view' : '3D view'} </button>
        </div>
        <div className={`lunar-status lunar-status-${state.kind}`} role="status">
          <span className="lunar-status-dot" />{state.message}
          {state.kind === 'error' ? <button type="button" onClick={() => { setVisual(true); setRetry(x => x + 1); }}>Retry 3D</button> :
            state.kind === 'overview' && <button type="button" onClick={() => setShowSetup(!showSetup)}>Connect terrain</button>}
        </div>
      </div>

      <aside className="lunar-discovery" aria-label="Find a lunar feature">
        <div className="lunar-panel-title"><span className="lunar-eyebrow">01 / DISCOVER</span><span className="lunar-catalog-badge">IAU / USGS</span></div>
        <label htmlFor="lunar-search">Where will you go?</label>
        <div className="lunar-search-wrap"><span aria-hidden="true">⌕</span><input id="lunar-search" type="search" value={query}
          onChange={e => setQuery(e.target.value)} placeholder="Crater, mountain, mare…" autoComplete="off" /></div>
        <p className="lunar-count">{catalog ? `${catalog.count.toLocaleString()} named features · ${query ? 'search results' : view === 'south' ? 'south polar selection' : 'largest features'}` : catalogError ? 'Catalog unavailable' : 'Loading verified catalog…'}</p>
        {catalogError && <button type="button" onClick={() => setRetry(x => x + 1)}>Retry catalog</button>}
        {!query && <div className="lunar-quick-picks">{['Tycho', 'Copernicus', 'Faustini', 'Shackleton'].map(name => {
          const feature = features.find(f => f.name === name);
          return feature && <button type="button" key={name} onClick={() => select(feature)}>{name} ↗</button>;
        })}</div>}
        <ul className="lunar-results" aria-label="Matching features">{results.map(f => <li key={f.id}>
          <button type="button" aria-pressed={selected?.id === f.id} onClick={() => select(f)}><span><strong>{f.name}</strong><small>{locationText(f)}</small></span><span aria-hidden="true">↗</span></button>
        </li>)}</ul>
        {catalog && results.length === 0 && <p className="lunar-empty">No matching named feature. Try a shorter name.</p>}
        <a className="lunar-source-link" href="https://planetarynames.wr.usgs.gov/GIS_Downloads" target="_blank" rel="noreferrer">Open the source catalog ↗</a>
      </aside>

      <aside ref={inspector} id="lunar-field-notes" className="lunar-inspector" aria-label="Scientific feature inspector">
        <span className="lunar-eyebrow">02 / FIELD NOTES</span>
        {selected ? <>
          <div className="lunar-inspector-title"><h2>{selected.name}</h2><button type="button" aria-label="Clear selected feature" onClick={() => setParams({ view })}>×</button></div>
          <p className="lunar-feature-type">{record?.type || 'Named lunar feature'} <span>· {record?.approval || (detailError ? 'Detail unavailable' : 'Loading source record…')}</span></p>
          <div className="lunar-location"><span>LOCATION / CATALOG CENTER</span><strong>{locationText(selected)}</strong></div>
          <dl className="lunar-facts"><div><dt>Catalog diameter</dt><dd>{selected.diameterKm ? `≈ ${selected.diameterKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km` : 'Not recorded'}</dd></div>
            <div><dt>Feature ID</dt><dd>{selected.id}</dd></div>
            {record?.approvalDate && <div><dt>Name approval year</dt><dd>{record.approvalDate.slice(0, 4)}</dd></div>}
            <div><dt>Data state</dt><dd className="lunar-verified">Published nomenclature</dd></div></dl>
          <details className="lunar-coordinate-details"><summary>Source coordinates & reference frame</summary><dl className="lunar-facts">
            <div><dt>Latitude</dt><dd>{selected.latitude}°</dd></div><div><dt>Longitude (east-positive)</dt><dd>{selected.longitude}°</dd></div>
          </dl><p>Planetocentric coordinates; LOLA2011 control network. Stored digits are source precision, not a stated accuracy bound. The main card rounds coordinates for readability.</p></details>
          <h3>Behind the name</h3><p>{detailError ? 'The detailed source record could not be loaded.' : record ? record.origin || 'No origin recorded in this source.' : 'Loading the source record…'}</p>
          {detailError && <button type="button" className="lunar-share" onClick={() => { detailCache.current.delete(selected.id.slice(0, 2)); setDetailAttempt(n => n + 1); }}>Retry source record</button>}
          <h3>Evidence & uncertainty</h3><p>This record identifies a named landform. Its center and diameter are catalog values, not a surveyed crater boundary or a measurement at the cursor.</p>
          <div className="lunar-not-available"><span>ICE EVIDENCE</span><strong>Not evaluated for this target</strong><p>No validated model output, IIRS, radar, or thermal layer is registered to this crater.</p><Link to="/ice-deposits">Open the separate ice model demo ↗</Link><p>Its sample locations are not yet spatially matched to this feature.</p></div>
          <h3>Nearby named features</h3><p className="lunar-nearby-note">Approximate center-to-center distance on the lunar reference sphere. This is not a rover route or a distance to a crater rim.</p>
          <ul className="lunar-nearby">{nearby.map(f => <li key={f.id}><button type="button" onClick={() => select(f)}><span>{f.name}</span><small>≈ {f.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 1 })} km ↗</small></button></li>)}</ul>
          <h3>Provenance</h3><p>USGS / IAU Gazetteer · LOLA2011 control network. Planetocentric latitude, east-positive longitude.</p>
          <a className="lunar-primary-link" href={record?.sourceUrl || `https://planetarynames.wr.usgs.gov/Feature/${selected.id}`} target="_blank" rel="noreferrer">Read official feature record ↗</a>
          <button type="button" className="lunar-share" disabled={!record} onClick={downloadRecord}>Download source record (JSON)</button>
          <button type="button" className="lunar-share" onClick={share}>{copied ? 'Link copied' : 'Copy this view’s link'}</button>
          {copyError && <p role="status">Clipboard access is unavailable. Copy the address from your browser to share this feature.</p>}
        </> : <>
          {catalog && params.get('feature') && <p role="status">This feature ID is not present in the current catalog. Search for its name below.</p>}
          <h2>{view === 'south' ? 'At the edge of sunlight.' : 'Every place has a story.'}</h2>
          <p>{view === 'south' ? 'Explore named features near the South Pole. Select a crater to inspect its published location and provenance.' : 'Travel from the whole Moon to a named landform. Select a marker or search the official catalog to open its field notes.'}</p>
          <div className="lunar-line-art" aria-hidden="true"><span>+</span><i /><span>+</span></div>
          <h3>What this view knows</h3><p>Names, locations, feature types, naming origins, and catalog diameters.</p>
          <h3>What it does not infer</h3><p>Ice presence, illumination history, PSR membership, rover safety, or local slope. These need registered scientific products—not a visual guess.</p>
        </>}
        <details className="lunar-limitations"><summary>Surface & source limitations</summary><p>{state.kind === 'terrain' ? 'Terrain detail varies by source and location. Rendered mesh geometry is not a validated DEM measurement.' : 'This overview has no elevation. NASA’s CGI Moon Kit is a visualization product, not scientific imagery: the polar regions use lower-resolution LOLA albedo fill and some gaps are inpainted. Deep zoom is intentionally limited. Do not infer ice, terrain, or precise image registration from it.'}</p>
          <a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noreferrer">NASA texture provenance ↗</a>
          <p>Catalog retrieved: {catalog?.retrievedAt?.slice(0, 10) || 'pending'}. Small unnamed craters are not included.</p></details>
      </aside>
    </div>

    {showSetup && <section className="lunar-setup" aria-label="Terrain connection instructions"><button type="button" aria-label="Close terrain instructions" onClick={() => setShowSetup(false)}>×</button>
      <h2>Connect the actual lunar surface</h2><p>Add Cesium Moon to your Cesium ion account. Configure <code>VITE_CESIUM_ION_TOKEN</code> with a URL-scoped, read-only browser token and <code>VITE_CESIUM_MOON_ASSET_ID</code> with your asset ID, then restart the app. Alternatively configure <code>VITE_LUNAR_TILESET_URL</code> for a compatible, Moon-fixed tileset you host.</p>
      <a href="https://cesium.com/platform/cesium-ion/content/cesium-moon/" target="_blank" rel="noreferrer">Cesium Moon setup ↗</a><p>Sharing fallback: copy the address from your browser if clipboard permission is unavailable.</p></section>}
  </section>;
}
