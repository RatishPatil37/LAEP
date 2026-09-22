export default function LandingDecisionMatrix({ crater }) {
  if (!crater) return null;

  const isPositive = crater.status === 'positive';
  const safetyScore = crater.wall_slope_deg && parseFloat(crater.wall_slope_deg) < 15 ? 88 : 74;
  const scienceScore = isPositive ? 92 : 68;
  const energyScore = 79; // High polar illumination on rim
  const commsScore = 86; // Direct-to-earth line-of-sight

  return (
    <div
      className="glass-instrument hud-corner-bracket"
      style={{
        padding: '0.85rem 1rem',
        borderRadius: '3px',
        fontFamily: "'IBM Plex Mono', monospace",
        color: '#f4f4f0',
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.35rem' }}>
        <span style={{ color: '#ffc857', fontWeight: 600, fontSize: '0.68rem' }}>LANDING SITE DECISION ROOM</span>
        <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>4-AXIS CRITERIA</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
        <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>TERRAIN SAFETY</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7be495' }}>{safetyScore}</span>
          </div>
          <div style={{ fontSize: '0.58rem', color: '#9aa0a6', marginTop: '0.2rem' }}>Rim slopes &lt; 14°</div>
        </div>

        <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>SCIENCE RETURN</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7dd3fc' }}>{scienceScore}</span>
          </div>
          <div style={{ fontSize: '0.58rem', color: '#9aa0a6', marginTop: '0.2rem' }}>Ice signal confirmed</div>
        </div>

        <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>SOLAR ENERGY</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffc857' }}>{energyScore}</span>
          </div>
          <div style={{ fontSize: '0.58rem', color: '#9aa0a6', marginTop: '0.2rem' }}>Peak of eternal light</div>
        </div>

        <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.58rem', color: '#6b7280' }}>DIRECT COMMS</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b8f0ff' }}>{commsScore}</span>
          </div>
          <div style={{ fontSize: '0.58rem', color: '#9aa0a6', marginTop: '0.2rem' }}>DTE link nominal</div>
        </div>
      </div>
    </div>
  );
}
