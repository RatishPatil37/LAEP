/**
 * Explorer.jsx — Main mission-planning page.
 * Hosts the moon map, sidebar controls, and pathfinding interaction.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import MoonMap, { LAYER_IDS } from '../components/MoonMap';
import { findPath, getLandingSites, getHazardMapUrl, getIceHeatmapUrl, getCH2Footprints } from '../api/laepApi';
import '../styles/map.css';

// ── Layer definitions ──────────────────────────────────────────────────────
const LAYER_DEFS = [
  { id: LAYER_IDS.WAC,    label: 'LRO WAC Optical',  color: '#e8eaf6', defaultOn: true  },
  { id: LAYER_IDS.LOLA,   label: 'LOLA Elevation',    color: '#ffd740', defaultOn: false },
  { id: LAYER_IDS.ICE,    label: 'Ice Confidence',    color: '#29b6f6', defaultOn: true  },
  { id: LAYER_IDS.HAZARD, label: 'Hazard / Cost Map', color: '#ff6b00', defaultOn: false },
  { id: LAYER_IDS.CH2,    label: 'CH-2 SAR Footprints', color: '#ff6b00', defaultOn: false },
  { id: LAYER_IDS.PATH,   label: 'Rover Path',        color: '#69ff47', defaultOn: true  },
];

const DEFAULT_LAYERS = Object.fromEntries(LAYER_DEFS.map(l => [l.id, l.defaultOn]));

// ── Modes ──────────────────────────────────────────────────────────────────
const MODE = { NONE: 'none', START: 'start', GOAL: 'goal' };

export default function Explorer() {
  const mapRef = useRef(null);

  // Map interaction state
  const [mode,   setMode]   = useState(MODE.NONE);
  const [start,  setStart]  = useState(null);  // [lon, lat]
  const [goal,   setGoal]   = useState(null);
  const [coords, setCoords] = useState({ lon: '—', lat: '—' });
  const [layers, setLayers] = useState(DEFAULT_LAYERS);

  // Algorithm parameters
  const [wSlope,   setWSlope]   = useState(1.0);
  const [wShadow,  setWShadow]  = useState(2.0);
  const [maxSlope, setMaxSlope] = useState(15.0);

  // Results state
  const [pathResult, setPathResult] = useState(null);   // null | {stats}
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  const [candidateSites, setCandidateSites] = useState([]);

  // ── On mount: load CH2 footprints & candidate landing sites ──────────
  useEffect(() => {
    getCH2Footprints()
      .then(fc => mapRef.current?.addCH2Footprints(fc))
      .catch(() => {});          // Silent — data may not be available

    getLandingSites()
      .then(res => setCandidateSites(res.sites ?? []))
      .catch(() => {});
  }, []);

  // ── Map click handler (smart auto-advance) ─────────────────────────────
  const handleMapClick = useCallback(([lon, lat]) => {
    const pt = [lon, lat];
    if (mode === MODE.START || (!start && mode === MODE.NONE)) {
      setStart(pt);
      setMode(MODE.GOAL);
      mapRef.current?.setMarkers(pt, goal);
    } else if (mode === MODE.GOAL || (start && !goal)) {
      setGoal(pt);
      setMode(MODE.NONE);
      mapRef.current?.setMarkers(start, pt);
    } else {
      // Both already set — start fresh with new start point
      setStart(pt);
      setGoal(null);
      setMode(MODE.GOAL);
      setPathResult(null);
      setError(null);
      mapRef.current?.setMarkers(pt, null);
      mapRef.current?.addPathLayer(null);
    }
  }, [mode, start, goal]);

  // ── Run pathfinding ────────────────────────────────────────────────────
  const handlePathfind = useCallback(async () => {
    if (!start || !goal) return;
    setLoading(true);
    setError(null);
    setPathResult(null);

    try {
      const result = await findPath({
        startLon: start[0], startLat: start[1],
        goalLon:  goal[0],  goalLat:  goal[1],
        wSlope, wShadow, maxSlope,
      });
      mapRef.current?.addPathLayer(result.path);
      setPathResult(result.stats);

      // Refresh overlays with current params
      mapRef.current?.updateOverlays(
        getHazardMapUrl(wSlope, wShadow, maxSlope),
        getIceHeatmapUrl(),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [start, goal, wSlope, wShadow, maxSlope]);

  // ── Layer toggle ───────────────────────────────────────────────────────
  const toggleLayer = useCallback((id) => {
    setLayers(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Reset mission ──────────────────────────────────────────────────────
  const handleReset = () => {
    setStart(null); setGoal(null);
    setMode(MODE.NONE);
    setPathResult(null); setError(null);
    mapRef.current?.setMarkers(null, null);
    mapRef.current?.addPathLayer(null);
  };

  const modeLabel =
    mode === MODE.START ? '🟢 Click on the map to set START point' :
    mode === MODE.GOAL  ? '🔵 Click on the map to set GOAL point'  :
    '🖱️ Use controls to set up your mission';

  return (
    <div className="explorer-layout">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">Mission Planner</div>
          <div className="sidebar-subtitle">Chandrayaan-2 · South Pole Navigator</div>
        </div>

        <div className="sidebar-body">
          {/* ── Mission points ──────────────────────────────────────── */}
          <div className="ctrl-group">
            <div className="ctrl-group-title">Waypoints</div>
            <div className="point-selector">
              <button
                className={`point-btn ${mode === MODE.START ? 'active-start' : ''} ${start ? 'has-point' : ''}`}
                onClick={() => setMode(m => m === MODE.START ? MODE.NONE : MODE.START)}
              >
                <span className="point-btn-label start">▶ Start</span>
                <span className="point-btn-coords">
                  {start ? `${start[0].toFixed(3)}° ${start[1].toFixed(3)}°` : 'Click to set'}
                </span>
              </button>
              <button
                className={`point-btn ${mode === MODE.GOAL ? 'active-goal' : ''} ${goal ? 'has-point' : ''}`}
                onClick={() => setMode(m => m === MODE.GOAL ? MODE.NONE : MODE.GOAL)}
              >
                <span className="point-btn-label goal">★ Goal</span>
                <span className="point-btn-coords">
                  {goal ? `${goal[0].toFixed(3)}° ${goal[1].toFixed(3)}°` : 'Click to set'}
                </span>
              </button>
            </div>

            {candidateSites.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--c-text-muted)', marginBottom: 4, fontWeight: 500 }}>
                  Quick Preset Landing Sites:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {candidateSites.slice(0, 3).map((site, i) => (
                    <button
                      key={i}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--c-border)' }}
                      onClick={() => {
                        const startPt = [site.lon, site.lat];
                        const goalPt  = [0.5, -85.0]; // Shackleton crater floor ice target
                        setStart(startPt);
                        setGoal(goalPt);
                        setMode(MODE.NONE);
                        mapRef.current?.setMarkers(startPt, goalPt);
                      }}
                    >
                      📍 Site {i + 1} ({site.lon.toFixed(1)}°, {site.lat.toFixed(1)}°)
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={!start || !goal || loading}
                onClick={handlePathfind}
              >
                {loading ? <><span className="spinner" style={{width:14,height:14}} /> Computing…</> : '⚡ Compute Path'}
              </button>
              <button className="btn btn-ghost" onClick={handleReset} title="Reset">✕</button>
            </div>
          </div>

          {/* ── Algorithm parameters ─────────────────────────────────── */}
          <div className="ctrl-group">
            <div className="ctrl-group-title">Navigation Constraints</div>

            <div className="slider-ctrl">
              <div className="slider-row">
                <span className="slider-label">Slope Penalty</span>
                <span className="slider-val">{wSlope.toFixed(1)}×</span>
              </div>
              <input type="range" min={0} max={5} step={0.1} value={wSlope}
                onChange={e => setWSlope(+e.target.value)} />
            </div>

            <div className="slider-ctrl">
              <div className="slider-row">
                <span className="slider-label">Shadow Penalty (Battery)</span>
                <span className="slider-val">{wShadow.toFixed(1)}×</span>
              </div>
              <input type="range" min={0} max={5} step={0.1} value={wShadow}
                onChange={e => setWShadow(+e.target.value)} />
            </div>

            <div className="slider-ctrl">
              <div className="slider-row">
                <span className="slider-label">Max Navigable Slope</span>
                <span className="slider-val">{maxSlope.toFixed(0)}°</span>
              </div>
              <input type="range" min={5} max={30} step={1} value={maxSlope}
                onChange={e => setMaxSlope(+e.target.value)} />
            </div>
          </div>

          {/* ── Layer toggles ─────────────────────────────────────────── */}
          <div className="ctrl-group">
            <div className="ctrl-group-title">Map Layers</div>
            <div className="layer-list">
              {LAYER_DEFS.map(l => (
                <div
                  key={l.id}
                  className={`layer-row ${layers[l.id] ? 'active' : ''}`}
                  onClick={() => toggleLayer(l.id)}
                >
                  <span className="layer-dot" style={{ background: l.color }} />
                  <span className="layer-name">{l.label}</span>
                  <span className="layer-toggle" />
                </div>
              ))}
            </div>
          </div>

          {/* ── Path results ──────────────────────────────────────────── */}
          {(pathResult || error) && (
            <div className="ctrl-group">
              <div className="ctrl-group-title">Mission Result</div>
              {error ? (
                <div className="result-panel">
                  <div className="result-header error">⚠ Path Error</div>
                  <div style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--c-text-dim)' }}>
                    {error}
                  </div>
                </div>
              ) : pathResult && (
                <div className="result-panel">
                  <div className="result-header success">✓ Safe Path Found</div>
                  <div className="result-stats">
                    {[
                      { label: 'Distance',   value: `${pathResult.distance_km} km` },
                      { label: 'Waypoints',  value: pathResult.waypoints },
                      { label: 'Max Slope',  value: `${pathResult.max_slope_deg}°` },
                      { label: 'Avg Slope',  value: `${pathResult.mean_slope_deg}°` },
                      { label: 'Energy Cost', value: pathResult.energy_cost.toFixed(0) },
                      { label: 'Peak ICS',   value: pathResult.max_ics_along_path },
                    ].map(s => (
                      <div key={s.label} className="result-stat">
                        <div className="result-stat-label">{s.label}</div>
                        <div className="result-stat-value">{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Map ──────────────────────────────────────────────────────── */}
      <div className="map-container">
        <MoonMap
          ref={mapRef}
          layers={layers}
          onCoordMove={setCoords}
          onMapClick={handleMapClick}
        />

        {/* Coordinates overlay */}
        <div className="coords-overlay">
          {coords.lon}° lon · {coords.lat}° lat
        </div>

        {/* Mode pill */}
        <div className={`map-mode-pill ${mode === MODE.START ? 'start-mode' : mode === MODE.GOAL ? 'goal-mode' : ''}`}>
          {modeLabel}
        </div>
      </div>
    </div>
  );
}
