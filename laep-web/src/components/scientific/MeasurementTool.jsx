import { useMissionStore } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

export default function MeasurementTool({ measurement, onClear }) {
  const measurementActive = useMissionStore((s) => s.measurementActive);
  const toggleMeasurement = useMissionStore((s) => s.toggleMeasurement);

  if (!measurementActive) {
    return (
      <button
        type="button"
        className="btn-aerospace"
        onClick={toggleMeasurement}
        title="Activate terrain measurement ruler"
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.68rem',
          padding: '0.4rem 0.75rem',
        }}
      >
        <span>RULER</span>
        <span style={{ color: '#b8f0ff' }}>[MEASURE]</span>
      </button>
    );
  }

  // Gracefully handle both naming styles
  const dist = measurement?.distanceKm ?? measurement?.distKm;
  const elev = measurement?.deltaElevM ?? measurement?.elevDeltaM;
  const slope = measurement?.meanSlopeDeg ?? measurement?.slopeDeg;

  return (
    <div
      className="glass-instrument hud-corner-bracket"
      style={{
        padding: '0.75rem 1rem',
        borderRadius: '3px',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.72rem',
        color: '#f4f4f0',
        display: 'flex',
        alignItems: 'center',
        gap: '1.2rem',
        border: '1px solid rgba(184, 240, 255, 0.4)',
        boxShadow: '0 0 15px rgba(184, 240, 255, 0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#7be495', animation: 'wavefrontPulse 1.5s infinite' }} />
        <span style={{ color: '#7dd3fc', fontWeight: 600 }}>RULER ACTIVE</span>
      </div>

      {dist != null ? (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.62rem' }}>DIST: </span>
            <span style={{ color: '#b8f0ff', fontWeight: 600 }}>{dist} km</span>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.62rem' }}>ΔELEV: </span>
            <span style={{ color: '#ffc857', fontWeight: 600 }}>{Number(elev) > 0 ? `+${elev}` : elev} m</span>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.62rem' }}>SLOPE: </span>
            <span style={{ color: Number(slope) > 15 ? '#ff6b5e' : '#7be495', fontWeight: 600 }}>{slope}°</span>
          </div>
        </div>
      ) : (
        <span style={{ color: '#9aa0a6', fontSize: '0.68rem' }}>CLICK TWO POINTS ON MAP TO MEASURE</span>
      )}

      <button
        type="button"
        onClick={() => {
          soundEngine.playTelemetryClick();
          onClear?.();
          toggleMeasurement();
        }}
        style={{
          padding: '0.2rem 0.5rem',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '2px',
          color: '#ff6b5e',
          fontSize: '0.65rem',
          cursor: 'pointer',
          background: 'rgba(255, 107, 94, 0.08)',
        }}
      >
        EXIT
      </button>
    </div>
  );
}
