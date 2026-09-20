/**
 * Explorer.jsx — Mission Planner & South Pole Lunar Navigator.
 * Integrates:
 * - Curated benchmark crater reference set.
 * - Custom Lat/Lon coordinate input boxes for dynamic pathfinding and regional ice analysis.
 * - 3D Volumetric Ice & Mass Estimation (2D Simpson's Rule).
 * - Kinematic elevation profile & energy readout.
 * - Full multi-format export (GeoJSON, KML, CSV).
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { displayCraterName } from '../lib/crater';
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
import { getApiStatus } from '../api/laepApi';
import DataStateBadge from '../components/scientific/DataStateBadge';
import '../styles/map.css';

const LAYER_DEFS = [
  { id: LAYER_IDS.WAC,     label: 'LRO WAC Optical Basemap', color: '#e8eaf6', defaultOn: true  },
  { id: LAYER_IDS.LOLA,    label: 'LOLA Elevation Hillshade', color: '#ffd740', defaultOn: false },
  { id: LAYER_IDS.ICE,     label: 'CH-2 DFSAR Ice Heatmap',   color: '#2dd4bf', defaultOn: true  },
  { id: LAYER_IDS.HAZARD,  label: 'Multi-Modal Hazard Grid', color: '#f59e0b', defaultOn: false },
  { id: LAYER_IDS.CRATERS, label: 'Robbins Polar Craters',   color: '#38bdf8', defaultOn: true  },
  { id: LAYER_IDS.CH2,     label: 'CH-2 SAR Footprints',     color: '#e86100', defaultOn: false },
  { id: LAYER_IDS.PATH,    label: 'Autonomous Rover Route',  color: '#2dd4bf', defaultOn: true  },
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
  const [apiStatus, setApiStatus]       = useState({ state: 'unavailable', message: 'Checking analysis API…' });
  const [simulationMode, setSimulationMode] = useState(false);
  const [routeMeta, setRouteMeta]       = useState(null);
  const [overlayUrls, setOverlayUrls]   = useState({ ice: null, hazard: null });

  // ── On mount: Load ground truth benchmarks & Robbins sub-craters ──────
  useEffect(() => {
    getApiStatus().then(setApiStatus);
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
  }, []);

  useEffect(() => {
    if (apiStatus.state !== 'real') return;
    const ice = getIceHeatmapUrl();
    const hazard = getHazardMapUrl(wSlope, wShadow, maxSlope);
    setOverlayUrls({ ice, hazard });
    calculateCustomRegionIce({ lonMin: 80.0, lonMax: 85.0, latMin: -88.0, latMax: -87.0 })
      .then(res => setVolumetricResult({ ...res.volumetric, meta: res.meta }))
      .catch(() => {});
  }, [apiStatus.state]); // Load derived initial analysis only when the API is confirmed reachable.

  // ── Map click handler — explicit state machine ───────────────────────
  const handleMapClick = useCallback(([lon, lat]) => {
    const pt = [Number(lon.toFixed(4)), Number(lat.toFixed(4))];
    // Transition table:
    //   START mode             → set start, advance to GOAL mode
    //   GOAL mode              → set goal, return to NONE mode
    //   NONE + no start        → set start, advance to GOAL mode
    //   NONE + start, no goal  → set goal, return to NONE mode
    //   NONE + both set        → reset cycle: set new start, clear goal, go to GOAL mode
    if (mode === MODE.START || (mode === MODE.NONE && !start)) {
      setStart(pt);
      setInputStartLon(pt[0].toString());
      setInputStartLat(pt[1].toString());
      setMode(MODE.GOAL);
      mapRef.current?.setMarkers(pt, goal);
    } else if (mode === MODE.GOAL || (mode === MODE.NONE && start && !goal)) {
      setGoal(pt);
      setInputGoalLon(pt[0].toString());
      setInputGoalLat(pt[1].toString());
      setMode(MODE.NONE);
      mapRef.current?.setMarkers(start, pt);
    } else {
      // Both set, mode=NONE: reset cycle
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
        wSlope, wShadow, maxSlope, simulationMode,
      });

      mapRef.current?.addPathLayer(result.path);
      setPathResult(result.stats);
      setRouteMeta(result.meta);
      // BUG-21 fix: refresh overlays after weights may have changed
      if (apiStatus.state === 'real') {
        const nextOverlays = { hazard: getHazardMapUrl(wSlope, wShadow, maxSlope), ice: getIceHeatmapUrl() };
        setOverlayUrls(nextOverlays);
        mapRef.current?.updateOverlays(nextOverlays.hazard, nextOverlays.ice);
      }

      // Trigger automatic volumetric estimate for the trajectory bounding box
      const minLon = Math.min(sPt[0], gPt[0]) - 0.5;
      const maxLon = Math.max(sPt[0], gPt[0]) + 0.5;
      const minLat = Math.min(sPt[1], gPt[1]) - 0.2;
      const maxLat = Math.max(sPt[1], gPt[1]) + 0.2;

      calculateCustomRegionIce({ lonMin: minLon, lonMax: maxLon, latMin: minLat, latMax: maxLat })
        .then(res => setVolumetricResult({ ...res.volumetric, meta: res.meta }))
        .catch(() => {});

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [start, goal, wSlope, wShadow, maxSlope, simulationMode, apiStatus.state]);

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
    // BUG-17: range validation for south-polar operations
    const validLon = (v) => v >= -180 && v <= 360;
    const validLat = (v) => v >= -90 && v <= -50;
    if (!validLon(sLon) || !validLon(gLon)) {
      setError('Longitude must be between -180° and 360°.');
      return;
    }
    if (!validLat(sLat) || !validLat(gLat)) {
      setError('Latitude must be between -90° and -50° (south polar operations only).');
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
    if (apiStatus?.state !== 'real' && !simulationMode) {
      setError('Regional estimation requires an available analysis API. Enable simulation preview to generate a clearly labelled preview.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await calculateCustomRegionIce({ lonMin: loMin, lonMax: loMax, latMin: laMin, latMax: laMax });
      setVolumetricResult({ ...res.volumetric, meta: res.meta });
      mapRef.current?.flyTo([(loMin + loMax) / 2, (laMin + laMax) / 2], 6);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Select benchmark crater preset ────────────────────────────────────
  const handleSelectBenchmark = (crater) => {
    setSelectedCrater(crater);
    // BUG-16 fix: scale rim offset proportional to crater diameter
    // Small craters (1-3 km): small offset; large craters (20-100 km): larger offset
    const offsetDeg = Math.max(0.02, Math.min(1.5, crater.diameter_km / 111.1));
    const rimStart = [Number((crater.lon - offsetDeg).toFixed(4)), Number((crater.lat + offsetDeg * 0.5).toFixed(4))];
    const floorGoal = [Number(crater.lon.toFixed(4)), Number(crater.lat.toFixed(4))];

    setStart(rimStart);
    setGoal(floorGoal);
    setInputStartLon(rimStart[0].toString());
    setInputStartLat(rimStart[1].toString());
    setInputGoalLon(floorGoal[0].toString());
    setInputGoalLat(floorGoal[1].toString());
    setMode(MODE.NONE);

    mapRef.current?.setMarkers(rimStart, floorGoal);
    mapRef.current?.flyTo([crater.lon, crater.lat], 7);
    if (apiStatus?.state === 'real' || simulationMode) {
      handlePathfind(rimStart, floorGoal);
    } else {
      setError('Waypoints set. Enable simulation preview to generate a labelled route preview, or configure the analysis API.');
    }
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
    setRouteMeta(null);
    setSelectedCrater(null);
    mapRef.current?.setMarkers(null, null);
    mapRef.current?.addPathLayer(null);
  };

  // ── Export Mission Route Files ─────────────────────────────────────────
  const handleExportGeoJSON = () => {
    if (!pathResult) return;
    // BUG-14: warn the user if elevation profile is missing (export degrades to 2-point line)
    const hasFullProfile = pathResult.elevation_profile?.length > 2;
    if (!hasFullProfile) {
      setError('Warning: Route elevation data incomplete. GeoJSON will contain only start/goal coordinates. Re-plot the route to generate full telemetry.');
    }
    const coordsList = pathResult.elevation_profile?.length
      ? pathResult.elevation_profile.map(p => [p.lon, p.lat])
      : [start, goal];


    const geojson = {
      type: "FeatureCollection",
      metadata: {
        mission: "LAEP Lunar Autonomous Traversal Plan",
        distance_km: pathResult.distance_km,
        est_energy_wh: pathResult.est_energy_wh,
        max_slope_deg: pathResult.max_slope_deg,
        mean_slope_deg: pathResult.mean_slope_deg,
        max_ics: pathResult.max_ics_along_path,
        timestamp: new Date().toISOString()
      },
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: coordsList
          },
          properties: {
            name: "Rover Traversal Route",
            type: "TRAJECTORY",
            distance_km: pathResult.distance_km,
            est_energy_wh: pathResult.est_energy_wh,
            max_slope_deg: pathResult.max_slope_deg,
            elevation_profile: pathResult.elevation_profile
          }
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: start },
          properties: { name: "Start Waypoint (Rim)", type: "START" }
        },
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: goal },
          properties: { name: "Ice Target Goal (Floor)", type: "GOAL" }
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
    mode === MODE.START ? 'Click map to set START waypoint' :
    mode === MODE.GOAL  ? 'Click map to set GOAL ice target'  :
    'Select waypoints on map or choose a reference crater below';

  return (
    <div className="explorer-layout">
      {/* ── Mission Control Sidebar ───────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">South Polar Explorer</div>
          <div className="sidebar-subtitle">
            <DataStateBadge state={apiStatus.state} detail={apiStatus.message} />
            <span>{apiStatus.message}</span>
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
            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid var(--c-danger)', padding: '9px 11px', borderRadius: 'var(--r-sm)', color: '#fb7185', fontSize: '0.78rem' }}>
              {error}
            </div>
          )}

          {/* ════════ TAB 1: WAYPOINTS & ROVER TRAVERSAL ════════ */}
          {activeTab === TABS.WAYPOINTS && (
            <>
              <div className="data-disclosure">
                <div><span>Route engine</span><DataStateBadge state={routeMeta?.state ?? apiStatus.state} detail={routeMeta?.provenance || apiStatus.message} /></div>
                <p>{simulationMode ? 'Simulation preview uses synthetic terrain and must not be treated as a mission result.' : 'A route requires the analysis API. Simulation preview is opt-in when that service is unavailable.'}</p>
                <label className="simulation-toggle"><input type="checkbox" checked={simulationMode} onChange={(event) => setSimulationMode(event.target.checked)} /> <span>Enable simulation preview</span></label>
              </div>
              <div className="ctrl-group">
                <div className="ctrl-group-title">
                  <span>Navigation Points</span>
                  {start && goal && (
                    <span style={{ fontSize: '0.62rem', color: 'var(--c-safe)' }}>LOCKED</span>
                  )}
                </div>
                <div className="point-selector">
                  <button
                    className={`point-btn ${mode === MODE.START ? 'active-start' : ''}`}
                    onClick={() => setMode(m => m === MODE.START ? MODE.NONE : MODE.START)}
                  >
                    <span className="point-btn-label start">Start (Rim)</span>
                    <span className="point-btn-coords">
                      {start ? `${start[0]}\u00b0, ${start[1]}\u00b0` : 'Click map to set'}
                    </span>
                  </button>

                  <button
                    className={`point-btn ${mode === MODE.GOAL ? 'active-goal' : ''}`}
                    onClick={() => setMode(m => m === MODE.GOAL ? MODE.NONE : MODE.GOAL)}
                  >
                    <span className="point-btn-label goal">Goal (Ice)</span>
                    <span className="point-btn-coords">
                      {goal ? `${goal[0]}\u00b0, ${goal[1]}\u00b0` : 'Click map to set'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Traversal Cost Sliders */}
              <div className="ctrl-group">
                <div className="ctrl-group-title">Traversal Cost Weights</div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--c-text-dim)', marginBottom: 4 }}>
                    <span>Slope Penalty (W1):</span>
                    <span style={{ color: 'var(--c-cyan)', fontFamily: 'var(--font-mono)' }}>{wSlope.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="5" step="0.1" value={wSlope} onChange={e => setWSlope(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--c-cyan)' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--c-text-dim)', marginBottom: 4 }}>
                    <span>Shadow Battery Drain (W2):</span>
                    <span style={{ color: 'var(--c-cyan)', fontFamily: 'var(--font-mono)' }}>{wShadow.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="5" step="0.1" value={wShadow} onChange={e => setWShadow(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--c-cyan)' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--c-text-dim)', marginBottom: 4 }}>
                    <span>Max Rover Tilt Limit:</span>
                    <span style={{ color: 'var(--c-warning)', fontFamily: 'var(--font-mono)' }}>{maxSlope}&deg;</span>
                  </div>
                  <input type="range" min="5" max="30" step="1" value={maxSlope} onChange={e => setMaxSlope(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--c-warning)' }} />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => handlePathfind()}
                  disabled={!start || !goal || loading}
                >
                    {loading ? 'Computing…' : simulationMode ? 'Generate simulated route' : 'Generate route'}
                </button>
                <button className="btn btn-ghost" onClick={handleReset}>
                  Reset
                </button>
              </div>

              {/* Pathfinding Results */}
              {pathResult && (
                <div className="ctrl-group" style={{ borderColor: 'var(--c-ice)' }}>
                  <div className="ctrl-group-title" style={{ color: 'var(--c-ice)' }}>
                    <span>Rover Kinematic Telemetry</span>
                    <DataStateBadge state={routeMeta?.state ?? 'unavailable'} detail={routeMeta?.provenance} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                    <div className="vol-stat-card">
                      <div className="vol-stat-label">Traverse Distance</div>
                      <div className="vol-stat-val highlight">{pathResult.distance_km} <span style={{ fontSize: '0.72rem' }}>km</span></div>
                    </div>
                    <div className="vol-stat-card">
                      <div className="vol-stat-label">Estimated Energy</div>
                      <div className="vol-stat-val">{pathResult.est_energy_wh != null ? pathResult.est_energy_wh : '—'} <span style={{ fontSize: '0.72rem' }}>Wh</span></div>
                    </div>
                    <div className="vol-stat-card">
                      <div className="vol-stat-label">Max Slope</div>
                      <div className="vol-stat-val" style={{ color: pathResult.max_slope_deg > 15 ? 'var(--c-danger)' : 'var(--c-safe)' }}>
                        {pathResult.max_slope_deg}&deg;
                      </div>
                    </div>
                    <div className="vol-stat-card">
                      <div className="vol-stat-label">Ice Confidence (ICS)</div>
                      <div className="vol-stat-val highlight">{pathResult.max_ics_along_path || 0.85}</div>
                    </div>
                  </div>

                  {/* Elevation Profile */}
                  {pathResult.elevation_profile && pathResult.elevation_profile.length > 0 && (
                    <div className="elevation-profile-container">
                      <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--c-text-muted)', textTransform: 'uppercase' }}>
                        Elevation Profile — {pathResult.waypoints} Waypoints
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', height: 40, gap: 1, background: 'var(--c-surface3)', padding: 3, borderRadius: 3 }}>
                        {pathResult.elevation_profile.filter((_, i) => i % Math.max(1, Math.floor(pathResult.elevation_profile.length / 30)) === 0).map((p, idx) => {
                          const h = Math.max(4, Math.min(36, ((p.elevation_m + 200) / 300) * 36));
                          return (
                            <div
                              key={idx}
                              title={`Step ${p.step}: Elev ${p.elevation_m}m, Slope ${p.slope_deg}\u00b0`}
                              style={{
                                flex: 1,
                                height: `${h}px`,
                                background: p.slope_deg > 15 ? 'var(--c-danger)' : 'var(--c-cyan)',
                                borderRadius: 1
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Export Toolbar */}
                  <div className="export-btn-group" style={{ marginTop: 4 }}>
                    <button className="btn-export" onClick={handleExportGeoJSON}>
                      Export GeoJSON
                    </button>
                    <button className="btn-export" onClick={handleExportCSV}>
                      Export CSV
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
                <span style={{ fontSize: '0.62rem', color: 'var(--c-cyan)' }}>PRL / ISRO</span>
              </div>
              <p style={{ fontSize: '0.73rem', color: 'var(--c-text-dim)', lineHeight: 1.5 }}>
                Click any crater to center camera, view validated polarimetric metrics, and plot the rim-to-ice route:
              </p>
              <div className="preset-list">
                {benchmarks.map(c => (
                  <div
                    key={c.id}
                    className="preset-item"
                    style={{ borderLeft: `3px solid ${c.color || 'var(--c-cyan)'}` }}
                    onClick={() => handleSelectBenchmark(c)}
                  >
                    <div>
                      <div className="preset-name">{displayCraterName(c.name)}</div>
                      <div className="preset-meta">
                        {c.lon}&deg;, {c.lat}&deg; | Diam: {c.diameter_km}km | Peak CPR: {c.peak_cpr}
                      </div>
                    </div>
                    <span className={`benchmark-badge ${c.status}`}>
                      {c.status === 'positive' ? 'ICE' : (c.status === 'partial' ? 'CANDIDATE' : 'CONTROL')}
                    </span>
                  </div>
                ))}
              </div>

              {selectedCrater && (
                <div style={{ background: 'var(--c-surface3)', padding: 9, borderRadius: 'var(--r-sm)', marginTop: 6 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.76rem', color: selectedCrater.color, fontWeight: 600 }}>
                    {displayCraterName(selectedCrater.name)}
                  </div>
                  <div style={{ fontSize: '0.73rem', color: 'var(--c-text-dim)', marginTop: 3, lineHeight: 1.5 }}>
                    {selectedCrater.summary}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
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
                <div style={{ fontSize: '0.72rem', color: 'var(--c-text-dim)' }}>
                  Enter custom coordinate points to navigate:
                </div>
                <div className="custom-coords-grid">
                  <div className="input-field">
                    <label>Start Lon (&deg;)</label>
                    <input type="text" value={inputStartLon} onChange={e => setInputStartLon(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Start Lat (&deg;)</label>
                    <input type="text" value={inputStartLat} onChange={e => setInputStartLat(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Goal Lon (&deg;)</label>
                    <input type="text" value={inputGoalLon} onChange={e => setInputGoalLon(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Goal Lat (&deg;)</label>
                    <input type="text" value={inputGoalLat} onChange={e => setInputGoalLat(e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={handleApplyCustomCoords} style={{ marginTop: 4 }}>
                  Set & Plot Custom Route
                </button>
              </div>

              <div className="ctrl-group">
                <div className="ctrl-group-title">Regional Bounding Box (Ice Volumetrics)</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--c-text-dim)' }}>
                  Compute 2D Simpson Rule Ice Tonnage for any Lat/Lon region:
                </div>
                <div className="custom-coords-grid">
                  <div className="input-field">
                    <label>Lon Min (&deg;)</label>
                    <input type="text" value={bboxLonMin} onChange={e => setBboxLonMin(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Lon Max (&deg;)</label>
                    <input type="text" value={bboxLonMax} onChange={e => setBboxLonMax(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Lat Min (&deg;)</label>
                    <input type="text" value={bboxLatMin} onChange={e => setBboxLatMin(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Lat Max (&deg;)</label>
                    <input type="text" value={bboxLatMax} onChange={e => setBboxLatMax(e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-accent" onClick={handleCalculateRegionIce} style={{ marginTop: 4 }}>
                  Calculate 3D Ice Volume
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

          {/* ════════ 3D VOLUMETRIC READOUT ════════ */}
          {volumetricResult && (
              <div className="volumetric-panel">
                <div className="vol-header">
                  <span className="vol-title">3D Volumetric Deposit Model</span>
                  <DataStateBadge state={volumetricResult.meta?.state ?? apiStatus.state} detail={volumetricResult.meta?.provenance} />
              </div>
              <div className="vol-grid">
                <div className="vol-stat-card">
                  <div className="vol-stat-label">Accessible Water Mass</div>
                  <div className="vol-stat-val highlight">
                    {volumetricResult.total_mass_metric_tons?.toLocaleString()} <span style={{ fontSize: '0.72rem' }}>Tons</span>
                  </div>
                </div>
                <div className="vol-stat-card">
                  <div className="vol-stat-label">Pure Ice Volume</div>
                  <div className="vol-stat-val">
                    {(volumetricResult.pure_ice_volume_m3 / 1e6)?.toFixed(2)} <span style={{ fontSize: '0.72rem' }}>M m&sup3;</span>
                  </div>
                </div>
                <div className="vol-stat-card">
                  <div className="vol-stat-label">Ice Footprint Area</div>
                  <div className="vol-stat-val">{volumetricResult.ice_area_km2} <span style={{ fontSize: '0.72rem' }}>km&sup2;</span></div>
                </div>
                <div className="vol-stat-card">
                  <div className="vol-stat-label">Regolith WEH Fraction</div>
                  <div className="vol-stat-val highlight">{volumetricResult.weh_fraction_pct}% <span style={{ fontSize: '0.72rem' }}>wt</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Map Container ─────────────────────────────────────────────── */}
      <div className="map-container">
        {/* Live Coordinate Overlay */}
        <div className="coords-overlay">
          <div className="coords-item">
            <span className="coords-label">LON:</span>
            <span className="coords-val">{coords.lon}&deg;</span>
          </div>
          <div className="coords-item">
            <span className="coords-label">LAT:</span>
            <span className="coords-val">{coords.lat}&deg;</span>
          </div>
          <div className="coords-item">
            <span className="coords-label">POLAR X,Y:</span>
            <span className="coords-val">{coords.polarX}, {coords.polarY} km</span>
          </div>
        </div>

        {/* Map Mode Pill */}
        <div className={`map-mode-pill ${mode === MODE.START ? 'start-mode' : (mode === MODE.GOAL ? 'goal-mode' : '')}`}>
          {modeLabel}
        </div>

        {/* OpenLayers Map */}
          <MoonMap
            ref={mapRef}
            layers={layers}
            overlayUrls={overlayUrls}
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
