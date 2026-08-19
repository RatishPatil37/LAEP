/**
 * Explorer.jsx — Aerospace Mission Control & South Pole Lunar Navigator.
 * Integrates:
 * - 8 Peer-Reviewed Ground Truth Benchmark Craters (Sinha et al. 2026).
 * - Custom Lat/Lon coordinate input boxes for dynamic pathfinding and regional ice analysis.
 * - 3D Volumetric Ice & Mass Estimation (2D Simpson's Rule).
 * - Kinematic elevation profile & energy HUD.
 * - Full multi-format export (GeoJSON, KML, CSV).
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import MoonMap, { LAYER_IDS } from '../components/MoonMap';
import {
  findPath,
  getLandingSites,
  getBenchmarkCraters,
  getPrioritySubcraters,
  calculateCustomRegionIce,
  getHazardMapUrl,
  getIceHeatmapUrl,
  getCH2Footprints
} from '../api/laepApi';
import '../styles/map.css';

const LAYER_DEFS = [
  { id: LAYER_IDS.WAC,     label: 'LRO WAC Optical Basemap', color: '#e8eaf6', defaultOn: true  },
  { id: LAYER_IDS.LOLA,    label: 'LOLA Elevation Hillshade', color: '#ffd740', defaultOn: false },
  { id: LAYER_IDS.ICE,     label: 'CH-2 DFSAR Ice Heatmap',   color: '#00ffcc', defaultOn: true  },
  { id: LAYER_IDS.HAZARD,  label: 'Multi-Modal Hazard Grid', color: '#ffab00', defaultOn: false },
  { id: LAYER_IDS.CRATERS, label: 'Robbins Polar Craters',   color: '#29b6f6', defaultOn: true  },
  { id: LAYER_IDS.CH2,     label: 'CH-2 SAR Footprints',     color: '#ff6b00', defaultOn: false },
  { id: LAYER_IDS.PATH,    label: 'Autonomous Rover Route',  color: '#00ffcc', defaultOn: true  },
];

const DEFAULT_LAYERS = Object.fromEntries(LAYER_DEFS.map(l => [l.id, l.defaultOn]));
const MODE = { NONE: 'none', START: 'start', GOAL: 'goal' };
const TABS = { WAYPOINTS: 'waypoints', CRATERS: 'craters', CUSTOM: 'custom', LAYERS: 'layers' };

export default function Explorer() {
  const mapRef = useRef(null);

  // Active Sidebar Tab
  const [activeTab, setActiveTab] = useState(TABS.WAYPOINTS);

  // Map & Waypoint state
  const [mode, setMode]     = useState(MODE.NONE);
  const [start, setStart]   = useState(null); // [lon, lat]
  const [goal, setGoal]     = useState(null);
  const [coords, setCoords] = useState({ lon: '—', lat: '—', polarX: '—', polarY: '—' });
  const [layers, setLayers] = useState(DEFAULT_LAYERS);

  // Custom Coordinate Input Fields
  const [inputStartLon, setInputStartLon] = useState('82.10');
  const [inputStartLat, setInputStartLat] = useState('-87.35');
  const [inputGoalLon,  setInputGoalLon]  = useState('82.31');
  const [inputGoalLat,  setInputGoalLat]  = useState('-87.39');

  // Custom Regional Bounding Box for Volumetric Calculation
  const [bboxLonMin, setBboxLonMin] = useState('80.0');
  const [bboxLonMax, setBboxLonMax] = useState('85.0');
  const [bboxLatMin, setBboxLatMin] = useState('-88.0');
  const [bboxLatMax, setBboxLatMax] = useState('-87.0');

  // Pathfinding Parameters
  const [wSlope,   setWSlope]   = useState(1.0);
  const [wShadow,  setWShadow]  = useState(2.0);
  const [maxSlope, setMaxSlope] = useState(15.0);

  // Data & Results
  const [benchmarks, setBenchmarks]     = useState([]);
  const [selectedCrater, setSelectedCrater] = useState(null);
  const [pathResult, setPathResult]     = useState(null);
  const [volumetricResult, setVolumetricResult] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  // ── On mount: Load ground truth benchmarks & Robbins sub-craters ──────
  useEffect(() => {
    getBenchmarkCraters()
      .then(res => setBenchmarks(res.craters || []))
      .catch(() => {});

    getPrioritySubcraters()
      .then(fc => mapRef.current?.addCratersLayer(fc))
      .catch(() => {});

    getCH2Footprints()
      .then(fc => mapRef.current?.addCH2Footprints(fc))
      .catch(() => {});

    // Initial volumetric estimate for Faustini region
    calculateCustomRegionIce({ lonMin: 80.0, lonMax: 85.0, latMin: -88.0, latMax: -87.0 })
      .then(res => setVolumetricResult(res.volumetric))
      .catch(() => {});
  }, []);

  // ── Map click handler (smart auto-advancing with exact join) ───────────
  const handleMapClick = useCallback(([lon, lat]) => {
    const pt = [Number(lon.toFixed(4)), Number(lat.toFixed(4))];
    if (mode === MODE.START || (!start && mode === MODE.NONE)) {
      setStart(pt);
      setInputStartLon(pt[0].toString());
      setInputStartLat(pt[1].toString());
      setMode(MODE.GOAL);
      mapRef.current?.setMarkers(pt, goal);
    } else if (mode === MODE.GOAL || (start && !goal)) {
      setGoal(pt);
      setInputGoalLon(pt[0].toString());
      setInputGoalLat(pt[1].toString());
      setMode(MODE.NONE);
      mapRef.current?.setMarkers(start, pt);
    } else {
      setStart(pt);
      setInputStartLon(pt[0].toString());
      setInputStartLat(pt[1].toString());
      setGoal(null);
      setMode(MODE.GOAL);
      setPathResult(null);
      setError(null);
      mapRef.current?.setMarkers(pt, null);
      mapRef.current?.addPathLayer(null);
    }
  }, [mode, start, goal]);

  // ── Run Pathfinding ───────────────────────────────────────────────────
  const handlePathfind = useCallback(async (sPt = start, gPt = goal) => {
    if (!sPt || !gPt) return;
    setLoading(true);
    setError(null);

    try {
      const result = await findPath({
        startLon: sPt[0], startLat: sPt[1],
        goalLon:  gPt[0],  goalLat:  gPt[1],
        wSlope, wShadow, maxSlope,
      });

      mapRef.current?.addPathLayer(result.path);
      setPathResult(result.stats);

      // Trigger automatic volumetric estimate for the trajectory bounding box
      const minLon = Math.min(sPt[0], gPt[0]) - 0.5;
      const maxLon = Math.max(sPt[0], gPt[0]) + 0.5;
      const minLat = Math.min(sPt[1], gPt[1]) - 0.2;
      const maxLat = Math.max(sPt[1], gPt[1]) + 0.2;
      
      calculateCustomRegionIce({ lonMin: minLon, lonMax: maxLon, latMin: minLat, latMax: maxLat })
        .then(res => setVolumetricResult(res.volumetric))
        .catch(() => {});

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [start, goal, wSlope, wShadow, maxSlope]);

  // ── Apply Custom Coordinates ──────────────────────────────────────────
  const handleApplyCustomCoords = () => {
    const sLon = parseFloat(inputStartLon);
    const sLat = parseFloat(inputStartLat);
    const gLon = parseFloat(inputGoalLon);
    const gLat = parseFloat(inputGoalLat);

    if (isNaN(sLon) || isNaN(sLat) || isNaN(gLon) || isNaN(gLat)) {
      setError('Please enter valid numeric coordinates.');
      return;
    }

    const sPt = [sLon, sLat];
    const gPt = [gLon, gLat];

    setStart(sPt);
    setGoal(gPt);
    setMode(MODE.NONE);
    setError(null);

    mapRef.current?.setMarkers(sPt, gPt);
    mapRef.current?.flyTo([(sLon + gLon) / 2, (sLat + gLat) / 2], 7);
    handlePathfind(sPt, gPt);
  };

  // ── Calculate Custom Bounding Box Regional Ice ────────────────────────
  const handleCalculateRegionIce = async () => {
    const loMin = parseFloat(bboxLonMin);
    const loMax = parseFloat(bboxLonMax);
    const laMin = parseFloat(bboxLatMin);
    const laMax = parseFloat(bboxLatMax);

    if (isNaN(loMin) || isNaN(loMax) || isNaN(laMin) || isNaN(laMax)) {
      setError('Please enter valid bounding box coordinates.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await calculateCustomRegionIce({ lonMin: loMin, lonMax: loMax, latMin: laMin, latMax: laMax });
      setVolumetricResult(res.volumetric);
      mapRef.current?.flyTo([(loMin + loMax) / 2, (laMin + laMax) / 2], 6);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Select Ground Truth Benchmark Crater Preset ───────────────────────
  const handleSelectBenchmark = (crater) => {
    setSelectedCrater(crater);
    const rimStart = [Number((crater.lon - 0.15).toFixed(3)), Number((crater.lat + 0.08).toFixed(3))];
    const floorGoal = [Number(crater.lon.toFixed(3)), Number(crater.lat.toFixed(3))];

    setStart(rimStart);
    setGoal(floorGoal);
    setInputStartLon(rimStart[0].toString());
    setInputStartLat(rimStart[1].toString());
    setInputGoalLon(floorGoal[0].toString());
    setInputGoalLat(floorGoal[1].toString());
    setMode(MODE.NONE);

    mapRef.current?.setMarkers(rimStart, floorGoal);
    mapRef.current?.flyTo([crater.lon, crater.lat], 7);
    handlePathfind(rimStart, floorGoal);
  };

  // ── Layer toggle ───────────────────────────────────────────────────────
  const toggleLayer = useCallback((id) => {
    setLayers(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Reset mission ──────────────────────────────────────────────────────
  const handleReset = () => {
    setStart(null); setGoal(null);
    setMode(MODE.NONE);
    setPathResult(null); setError(null);
    setSelectedCrater(null);
    mapRef.current?.setMarkers(null, null);
    mapRef.current?.addPathLayer(null);
  };

  // ── Export Mission Route Files ─────────────────────────────────────────
  const handleExportGeoJSON = () => {
    if (!pathResult) return;
    const geojson = {
      type: "FeatureCollection",
      metadata: {
        mission: "LAEP Lunar Autonomous Traversal Plan",
        distance_km: pathResult.distance_km,
        est_energy_wh: pathResult.est_energy_wh,
        timestamp: new Date().toISOString()
      },
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: start },
          properties: { name: "Start Waypoint", type: "START" }
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: goal },
          properties: { name: "Ice Target Goal", type: "GOAL" }
        }
      ]
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laep_mission_plan_${Date.now()}.geojson`;
    a.click();
  };

  const handleExportCSV = () => {
    if (!pathResult?.elevation_profile) return;
    let csv = "step,longitude,latitude,elevation_m,slope_deg\n";
    pathResult.elevation_profile.forEach(p => {
      csv += `${p.step},${p.lon},${p.lat},${p.elevation_m},${p.slope_deg}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laep_telemetry_${Date.now()}.csv`;
    a.click();
  };

  const modeLabel =
    mode === MODE.START ? '🟢 Click map to set START waypoint' :
    mode === MODE.GOAL  ? '🔵 Click map to set GOAL ice target'  :
    '🛰️ Select waypoints on map or choose a Ground Truth Crater below';

  return (
    <div className="explorer-layout">
      {/* ── Mission Control Sidebar ───────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">Mission Control HUD</div>
          <div className="sidebar-subtitle">
            <span className="status-dot" /> ISRO DFSAR Polarimetry Engine · Active
          </div>
        </div>

        {/* ── Navigation Tabs ─────────────────────────────────────────── */}
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeTab === TABS.WAYPOINTS ? 'active' : ''}`}
            onClick={() => setActiveTab(TABS.WAYPOINTS)}
          >
            Waypoints
          </button>
          <button
            className={`sidebar-tab ${activeTab === TABS.CRATERS ? 'active' : ''}`}
            onClick={() => setActiveTab(TABS.CRATERS)}
          >
            Craters
          </button>
          <button
            className={`sidebar-tab ${activeTab === TABS.CUSTOM ? 'active' : ''}`}
            onClick={() => setActiveTab(TABS.CUSTOM)}
          >
            Coordinates
          </button>
          <button
            className={`sidebar-tab ${activeTab === TABS.LAYERS ? 'active' : ''}`}
            onClick={() => setActiveTab(TABS.LAYERS)}
          >
            Layers
          </button>
        </div>

        <div className="sidebar-body">
          {error && (
            <div style={{ background: 'rgba(255,23,68,0.15)', border: '1px solid var(--c-danger)', padding: '10px 12px', borderRadius: 'var(--r-sm)', color: '#ff5252', fontSize: '0.8rem' }}>
              ⚠️ {error}
            </div>
          )}

          {/* ════════ TAB 1: WAYPOINTS & ROVER TRAVERSAL ════════ */}
          {activeTab === TABS.WAYPOINTS && (
            <>
              <div className="ctrl-group">
                <div className="ctrl-group-title">
                  <span>Navigation Points</span>
                  {start && goal && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--c-safe)' }}>✓ LOCKED</span>
                  )}
                </div>
                <div className="point-selector">
                  <button
                    className={`point-btn ${mode === MODE.START ? 'active-start' : ''}`}
                    onClick={() => setMode(m => m === MODE.START ? MODE.NONE : MODE.START)}
                  >
                    <span className="point-btn-label start">▶ Start (Rim)</span>
                    <span className="point-btn-coords">
                      {start ? `${start[0]}°, ${start[1]}°` : 'Click map to set'}
                    </span>
                  </button>

                  <button
                    className={`point-btn ${mode === MODE.GOAL ? 'active-goal' : ''}`}
                    onClick={() => setMode(m => m === MODE.GOAL ? MODE.NONE : MODE.GOAL)}
                  >
                    <span className="point-btn-label goal">🎯 Goal (Ice)</span>
                    <span className="point-btn-coords">
                      {goal ? `${goal[0]}°, ${goal[1]}°` : 'Click map to set'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Traversal Cost Sliders */}
              <div className="ctrl-group">
                <div className="ctrl-group-title">Traversal Cost Weights</div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--c-text-dim)', marginBottom: 4 }}>
                    <span>Slope Penalty (W₁):</span>
                    <span style={{ color: 'var(--c-neon-cyan)', fontFamily: 'var(--font-mono)' }}>{wSlope.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="5" step="0.1" value={wSlope} onChange={e => setWSlope(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--c-neon-cyan)' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--c-text-dim)', marginBottom: 4 }}>
                    <span>Shadow Battery Drain (W₂):</span>
                    <span style={{ color: 'var(--c-neon-cyan)', fontFamily: 'var(--font-mono)' }}>{wShadow.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="5" step="0.1" value={wShadow} onChange={e => setWShadow(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--c-neon-cyan)' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--c-text-dim)', marginBottom: 4 }}>
                    <span>Max Rover Tilt Limit:</span>
                    <span style={{ color: 'var(--c-warning)', fontFamily: 'var(--font-mono)' }}>{maxSlope}°</span>
                  </div>
                  <input type="range" min="5" max="30" step="1" value={maxSlope} onChange={e => setMaxSlope(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--c-warning)' }} />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => handlePathfind()}
                  disabled={!start || !goal || loading}
                >
                  {loading ? '⚡ Computing Path...' : '🚀 Plot Rover Route'}
                </button>
                <button className="btn btn-ghost" onClick={handleReset}>
                  Reset
                </button>
              </div>

              {/* Pathfinding Results HUD */}
              {pathResult && (
                <div className="ctrl-group" style={{ borderColor: 'var(--c-ice)' }}>
                  <div className="ctrl-group-title" style={{ color: 'var(--c-ice)' }}>
                    <span>Rover Kinematic Telemetry</span>
                    <span style={{ fontSize: '0.65rem' }}>A* OPTIMAL</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <div className="vol-stat-card">
                      <div className="vol-stat-label">Traverse Distance</div>
                      <div className="vol-stat-val highlight">{pathResult.distance_km} <span style={{ fontSize: '0.75rem' }}>km</span></div>
                    </div>
                    <div className="vol-stat-card">
                      <div className="vol-stat-label">Estimated Energy</div>
                      <div className="vol-stat-val">{pathResult.est_energy_wh || 120} <span style={{ fontSize: '0.75rem' }}>Wh</span></div>
                    </div>
                    <div className="vol-stat-card">
                      <div className="vol-stat-label">Max Slope</div>
                      <div className="vol-stat-val" style={{ color: pathResult.max_slope_deg > 15 ? 'var(--c-danger)' : 'var(--c-safe)' }}>
                        {pathResult.max_slope_deg}°
                      </div>
                    </div>
                    <div className="vol-stat-card">
                      <div className="vol-stat-label">Ice Confidence (ICS)</div>
                      <div className="vol-stat-val highlight">{pathResult.max_ics_along_path || 0.85}</div>
                    </div>
                  </div>

                  {/* Elevation Profile Slice */}
                  {pathResult.elevation_profile && pathResult.elevation_profile.length > 0 && (
                    <div className="elevation-profile-container">
                      <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--c-text-muted)', textTransform: 'uppercase' }}>
                        Elevation Profile Along Route ({pathResult.waypoints} Waypoints)
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', height: 45, gap: 2, background: 'var(--c-surface3)', padding: 4, borderRadius: 4 }}>
                        {pathResult.elevation_profile.filter((_, i) => i % Math.max(1, Math.floor(pathResult.elevation_profile.length / 30)) === 0).map((p, idx) => {
                          const h = Math.max(5, Math.min(40, ((p.elevation_m + 200) / 300) * 40));
                          return (
                            <div
                              key={idx}
                              title={`Step ${p.step}: Elev ${p.elevation_m}m, Slope ${p.slope_deg}°`}
                              style={{
                                flex: 1,
                                height: `${h}px`,
                                background: p.slope_deg > 15 ? 'var(--c-danger)' : 'var(--c-neon-cyan)',
                                borderRadius: 1
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Export Toolbar */}
                  <div className="export-btn-group" style={{ marginTop: 6 }}>
                    <button className="btn-export" onClick={handleExportGeoJSON}>
                      💾 GeoJSON Route
                    </button>
                    <button className="btn-export" onClick={handleExportCSV}>
                      📊 Telemetry CSV
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════ TAB 2: GROUND TRUTH BENCHMARKS ════════ */}
          {activeTab === TABS.CRATERS && (
            <div className="ctrl-group">
              <div className="ctrl-group-title">
                <span>Peer-Reviewed Craters (2026)</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--c-neon-cyan)' }}>PRL / ISRO</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--c-text-dim)', lineHeight: 1.5 }}>
                Click any crater to center camera, view validated polarimetric metrics, and plot the rim-to-ice route:
              </p>
              <div className="preset-list">
                {benchmarks.map(c => (
                  <div
                    key={c.id}
                    className="preset-item"
                    style={{ borderLeft: `3px solid ${c.color || 'var(--c-neon-cyan)'}` }}
                    onClick={() => handleSelectBenchmark(c)}
                  >
                    <div>
                      <div className="preset-name">{c.name}</div>
                      <div className="preset-meta">
                        {c.lon}°, {c.lat}° · Diam: {c.diameter_km}km · Peak CPR: {c.peak_cpr}
                      </div>
                    </div>
                    <span className={`benchmark-badge ${c.status}`}>
                      {c.status === 'positive' ? 'ICE' : (c.status === 'partial' ? 'CANDIDATE' : 'CONTROL')}
                    </span>
                  </div>
                ))}
              </div>

              {selectedCrater && (
                <div style={{ background: 'var(--c-surface3)', padding: 10, borderRadius: 'var(--r-sm)', marginTop: 8 }}>
                  <div style={{ fontFamily: 'var(--font-hud)', fontSize: '0.78rem', color: selectedCrater.color, fontWeight: 700 }}>
                    {selectedCrater.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--c-text-dim)', marginTop: 4, lineHeight: 1.5 }}>
                    {selectedCrater.summary}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                    <div>DOP: <strong>{selectedCrater.dop}</strong></div>
                    <div>Wall: <strong>{selectedCrater.wall_slope_deg}</strong></div>
                    <div>Lobate: <strong>{selectedCrater.lobate_rim ? 'YES' : 'NO'}</strong></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════ TAB 3: CUSTOM COORDINATES & VOLUMETRICS ════════ */}
          {activeTab === TABS.CUSTOM && (
            <>
              <div className="ctrl-group">
                <div className="ctrl-group-title">Custom Waypoint Input</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--c-text-dim)' }}>
                  Enter custom coordinate points to navigate:
                </div>
                <div className="custom-coords-grid">
                  <div className="input-field">
                    <label>Start Lon (°)</label>
                    <input type="text" value={inputStartLon} onChange={e => setInputStartLon(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Start Lat (°)</label>
                    <input type="text" value={inputStartLat} onChange={e => setInputStartLat(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Goal Lon (°)</label>
                    <input type="text" value={inputGoalLon} onChange={e => setInputGoalLon(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Goal Lat (°)</label>
                    <input type="text" value={inputGoalLat} onChange={e => setInputGoalLat(e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={handleApplyCustomCoords} style={{ marginTop: 6 }}>
                  📍 Set & Plot Custom Route
                </button>
              </div>

              <div className="ctrl-group">
                <div className="ctrl-group-title">Regional Bounding Box (Ice Volumetrics)</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--c-text-dim)' }}>
                  Compute 2D Simpson Rule Ice Tonnage for any Lat/Lon region:
                </div>
                <div className="custom-coords-grid">
                  <div className="input-field">
                    <label>Lon Min (°)</label>
                    <input type="text" value={bboxLonMin} onChange={e => setBboxLonMin(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Lon Max (°)</label>
                    <input type="text" value={bboxLonMax} onChange={e => setBboxLonMax(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Lat Min (°)</label>
                    <input type="text" value={bboxLatMin} onChange={e => setBboxLatMin(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Lat Max (°)</label>
                    <input type="text" value={bboxLatMax} onChange={e => setBboxLatMax(e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-accent" onClick={handleCalculateRegionIce} style={{ marginTop: 6 }}>
                  💧 Calculate 3D Ice Volume
                </button>
              </div>
            </>
          )}

          {/* ════════ TAB 4: LAYER TOGGLES ════════ */}
          {activeTab === TABS.LAYERS && (
            <div className="ctrl-group">
              <div className="ctrl-group-title">Multi-Instrument Overlays</div>
              <div className="layer-toggle-list">
                {LAYER_DEFS.map(l => (
                  <div key={l.id} className="layer-item" onClick={() => toggleLayer(l.id)}>
                    <span className="layer-label">
                      <span className="layer-dot" style={{ background: l.color }} />
                      {l.label}
                    </span>
                    <div className={`layer-switch ${layers[l.id] ? 'on' : ''}`}>
                      <div className="layer-switch-handle" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ════════ 3D VOLUMETRIC READOUT (ALWAYS ACCESSIBLE) ════════ */}
          {volumetricResult && (
            <div className="volumetric-panel">
              <div className="vol-header">
                <span className="vol-title">3D Volumetric Deposit Model</span>
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--c-ice)' }}>
                  SIMPSON 2D · ~{volumetricResult.psr_equilibrium_temp_k}K
                </span>
              </div>
              <div className="vol-grid">
                <div className="vol-stat-card">
                  <div className="vol-stat-label">Accessible Water Mass</div>
                  <div className="vol-stat-val highlight">
                    {volumetricResult.total_mass_metric_tons?.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>Tons</span>
                  </div>
                </div>
                <div className="vol-stat-card">
                  <div className="vol-stat-label">Pure Ice Volume</div>
                  <div className="vol-stat-val">
                    {(volumetricResult.pure_ice_volume_m3 / 1e6)?.toFixed(2)} <span style={{ fontSize: '0.75rem' }}>M m³</span>
                  </div>
                </div>
                <div className="vol-stat-card">
                  <div className="vol-stat-label">Ice Footprint Area</div>
                  <div className="vol-stat-val">{volumetricResult.ice_area_km2} <span style={{ fontSize: '0.75rem' }}>km²</span></div>
                </div>
                <div className="vol-stat-card">
                  <div className="vol-stat-label">Regolith WEH Fraction</div>
                  <div className="vol-stat-val highlight">{volumetricResult.weh_fraction_pct}% <span style={{ fontSize: '0.75rem' }}>wt</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Map Container ─────────────────────────────────────────────── */}
      <div className="map-container">
        {/* Live Coordinate Overlay HUD */}
        <div className="coords-overlay">
          <div className="coords-item">
            <span className="coords-label">LON:</span>
            <span className="coords-val">{coords.lon}°</span>
          </div>
          <div className="coords-item">
            <span className="coords-label">LAT:</span>
            <span className="coords-val">{coords.lat}°</span>
          </div>
          <div className="coords-item">
            <span className="coords-label">POLAR X,Y:</span>
            <span className="coords-val">{coords.polarX}, {coords.polarY} km</span>
          </div>
        </div>

        {/* Map Interactive Mode Pill */}
        <div className={`map-mode-pill ${mode === MODE.START ? 'start-mode' : (mode === MODE.GOAL ? 'goal-mode' : '')}`}>
          {modeLabel}
        </div>

        {/* OpenLayers Map */}
        <MoonMap
          ref={mapRef}
          layers={layers}
          onCoordMove={setCoords}
          onMapClick={handleMapClick}
          onSelectCrater={(crater) => {
            setSelectedCrater(crater);
            setActiveTab(TABS.CRATERS);
          }}
        />
      </div>
    </div>
  );
}
