import { useMissionStore } from '../../stores/useMissionStore';

export default function PolarCompassHUD() {
  const simulation = useMissionStore((s) => s.simulation);
  const solarElevation = useMissionStore((s) => s.solarElevation);

  const heading = simulation.heading || 142.5;

  return (
    <div
      className="glass-instrument hud-corner-bracket"
      style={{
        padding: '0.65rem 0.85rem',
        borderRadius: '3px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        fontFamily: "'IBM Plex Mono', monospace",
        zIndex: 20,
      }}
    >
      {/* 360° Compass Dial */}
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: '1px solid rgba(184, 240, 255, 0.4)',
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(circle at center, rgba(18, 21, 26, 0.9), rgba(5, 6, 8, 0.95))',
        }}
      >
        {/* Cardinal Markers */}
        <span style={{ position: 'absolute', top: '2px', fontSize: '0.48rem', color: '#7dd3fc' }}>N</span>
        <span style={{ position: 'absolute', bottom: '2px', fontSize: '0.48rem', color: '#6b7280' }}>S</span>
        <span style={{ position: 'absolute', left: '3px', fontSize: '0.48rem', color: '#6b7280' }}>W</span>
        <span style={{ position: 'absolute', right: '3px', fontSize: '0.48rem', color: '#6b7280' }}>E</span>

        {/* Heading Needle Indicator */}
        <div
          style={{
            position: 'absolute',
            width: '2px',
            height: '24px',
            backgroundColor: '#2dd4bf',
            boxShadow: '0 0 6px #2dd4bf',
            transformOrigin: 'bottom center',
            transform: `rotate(${heading}deg) translateY(-12px)`,
            borderRadius: '1px',
          }}
        />

        {/* Center Pivot */}
        <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#f4f4f0' }} />
      </div>

      {/* Numerical Heading Readout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        <div style={{ fontSize: '0.58rem', color: '#7dd3fc', letterSpacing: '0.08em' }}>POLAR HEADING</div>
        <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f4f4f0' }}>
          {heading.toFixed(1)}° <span style={{ fontSize: '0.62rem', color: '#2dd4bf' }}>AZM</span>
        </div>
        <div style={{ fontSize: '0.58rem', color: '#ffc857' }}>
          SUN: {solarElevation.toFixed(1)}° ELV
        </div>
      </div>
    </div>
  );
}
