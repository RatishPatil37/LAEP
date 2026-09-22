import { useMissionStore, LAYER_IDS } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

const LAYER_ITEMS = [
  { id: LAYER_IDS.OPTICAL,      label: 'OPTICAL',      glyph: 'OPT', desc: 'LRO WAC Optical Basemap' },
  { id: LAYER_IDS.TERRAIN,      label: 'TERRAIN',      glyph: 'DEM', desc: 'TMC-2 Stereo Elevation Model' },
  { id: LAYER_IDS.SLOPE,        label: 'SLOPE',        glyph: 'SLP', desc: 'Radargrammetric Terrain Gradient' },
  { id: LAYER_IDS.ROUGHNESS,    label: 'ROUGHNESS',    glyph: 'RGH', desc: 'M-Scale Radar Surface Roughness' },
  { id: LAYER_IDS.ILLUMINATION, label: 'ILLUMINATION', glyph: 'LUX', desc: 'Persistent Shadow (PSR) Cold Traps' },
  { id: LAYER_IDS.CPR,          label: 'CPR RADAR',    glyph: 'CPR', desc: 'DFSAR Circular Polarization Ratio' },
  { id: LAYER_IDS.DOP,          label: 'DOP MATRIX',   glyph: 'DOP', desc: 'Degree of Depolarization' },
  { id: LAYER_IDS.ICE,          label: 'ICE SIGNAL',   glyph: 'ICE', desc: 'Multi-Sensor Ice-Consistency Signal' },
  { id: LAYER_IDS.HAZARD,       label: 'HAZARDS',      glyph: 'HZD', desc: 'Multi-Modal Terrain Hazard Mask' },
  { id: LAYER_IDS.ROUTE,        label: 'ROVER ROUTE',  glyph: 'NAV', desc: 'Autonomous Kinematic Traverse' },
];

export default function LayerMixer({ activeLayers = {}, onToggleLayer }) {
  const activeLayer = useMissionStore((s) => s.activeLayer);
  const setActiveLayer = useMissionStore((s) => s.setActiveLayer);

  const handleSelect = (id) => {
    soundEngine.playTelemetryClick();
    setActiveLayer(id);
    onToggleLayer?.(id);
  };

  return (
    <div
      className="glass-instrument hud-corner-bracket"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        padding: '0.65rem 0.5rem',
        borderRadius: '3px',
        width: '170px',
        fontFamily: "'IBM Plex Mono', monospace",
        zIndex: 20,
      }}
    >
      <div
        style={{
          fontSize: '0.6rem',
          letterSpacing: '0.1em',
          color: '#7dd3fc',
          padding: '0.2rem 0.4rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '0.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>LAYER MIXER</span>
        <span style={{ fontSize: '0.55rem', color: '#6b7280' }}>10 CH</span>
      </div>

      {LAYER_ITEMS.map((item) => {
        const isActive = activeLayer === item.id || activeLayers[item.id];
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            title={item.desc}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.35rem 0.5rem',
              borderRadius: '2px',
              border: '1px solid',
              borderColor: isActive ? 'rgba(184, 240, 255, 0.4)' : 'transparent',
              backgroundColor: isActive ? 'rgba(184, 240, 255, 0.08)' : 'transparent',
              color: isActive ? '#b8f0ff' : '#9aa0a6',
              fontSize: '0.68rem',
              transition: 'all 120ms ease',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
            <span
              style={{
                fontSize: '0.55rem',
                padding: '0.1rem 0.3rem',
                borderRadius: '2px',
                backgroundColor: isActive ? '#b8f0ff' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#050608' : '#6b7280',
                fontWeight: 600,
              }}
            >
              {item.glyph}
            </span>
          </button>
        );
      })}
    </div>
  );
}
