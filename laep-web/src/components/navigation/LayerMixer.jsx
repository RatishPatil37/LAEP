import { useMissionStore, LAYER_IDS } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

const LAYER_ITEMS = [
  { id: LAYER_IDS.OPTICAL,      label: 'OPTICAL',      glyph: 'OPT', desc: 'LRO WAC Optical Basemap', color: '#e8eaf6' },
  { id: LAYER_IDS.TERRAIN,      label: 'LOLA ELEV',    glyph: 'DEM', desc: 'LOLA Color Hillshade', color: '#ffd740' },
  { id: LAYER_IDS.SLOPE,        label: 'SLOPE HZD',    glyph: 'SLP', desc: 'Radargrammetric Terrain Gradient', color: '#ff6b5e' },
  { id: LAYER_IDS.ROUGHNESS,    label: 'ROUGHNESS',    glyph: 'RGH', desc: 'M-Scale Radar Surface Roughness', color: '#f59e0b' },
  { id: LAYER_IDS.ILLUMINATION, label: 'SHADOW PSR',   glyph: 'PSR', desc: 'Cold Trap Permanent Shadow', color: '#818cf8' },
  { id: LAYER_IDS.CPR,          label: 'CPR RADAR',    glyph: 'CPR', desc: 'DFSAR Circular Polarization Ratio', color: '#38bdf8' },
  { id: LAYER_IDS.DOP,          label: 'DOP MATRIX',   glyph: 'DOP', desc: 'Degree of Depolarization', color: '#c084fc' },
  { id: LAYER_IDS.ICE,          label: 'ICE SIGNAL',   glyph: 'ICE', desc: 'Multi-Sensor Ice-Consistency Signal', color: '#2dd4bf' },
  { id: LAYER_IDS.HAZARD,       label: 'HAZARD MASK',  glyph: 'HZD', desc: 'Multi-Modal Terrain Cost Grid', color: '#fb7185' },
  { id: LAYER_IDS.ROUTE,        label: 'ROVER ROUTE',  glyph: 'NAV', desc: 'Autonomous Kinematic Route', color: '#34d399' },
];

export default function LayerMixer({ onToggleLayer }) {
  const layersVisible = useMissionStore((s) => s.layersVisible);
  const toggleLayerVisibility = useMissionStore((s) => s.toggleLayerVisibility);

  const handleToggle = (id) => {
    toggleLayerVisibility(id);
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
        width: '180px',
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
        const isVisible = Boolean(layersVisible[item.id]);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleToggle(item.id)}
            title={item.desc}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.35rem 0.5rem',
              borderRadius: '2px',
              border: '1px solid',
              borderColor: isVisible ? `${item.color}66` : 'rgba(255,255,255,0.05)',
              backgroundColor: isVisible ? `${item.color}15` : 'transparent',
              color: isVisible ? '#f4f4f0' : '#6b7280',
              fontSize: '0.66rem',
              transition: 'all 120ms ease',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isVisible ? item.color : '#374151',
                  boxShadow: isVisible ? `0 0 6px ${item.color}` : 'none',
                }}
              />
              <span style={{ fontWeight: isVisible ? 600 : 400 }}>{item.label}</span>
            </div>
            <span
              style={{
                fontSize: '0.55rem',
                padding: '0.1rem 0.3rem',
                borderRadius: '2px',
                backgroundColor: isVisible ? item.color : 'rgba(255,255,255,0.05)',
                color: isVisible ? '#050608' : '#6b7280',
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
