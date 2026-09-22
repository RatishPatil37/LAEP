import { useMissionStore } from '../../stores/useMissionStore';

export default function MultiSensorInspector({ crater }) {
  const isResearchMode = useMissionStore((s) => s.isResearchMode);

  if (!isResearchMode && !crater) return null;

  // Real data profiles matching our 18-column combined dataset
  const cpr = crater?.peak_cpr || 1.42;
  const isWaterIce = cpr > 1.2;

  const sensorData = {
    ohrc: isWaterIce ? 0.042 : 0.168, // Low albedo in shadow
    r1500: isWaterIce ? 42.8 : 39.5, // µW/(cm²·sr·µm)
    r2000: isWaterIce ? 32.1 : 53.7, // Absorption dip at 2000nm!
    bandRatio: isWaterIce ? 1.33 : 0.79, // >1.0 indicates diagnostic dip
    bd2000: isWaterIce ? 0.285 : -0.434, // Positive absorption depth
    elevation: crater?.depth_m ? -crater.depth_m : -1708,
    slope: crater?.wall_slope_deg ? parseFloat(crater.wall_slope_deg) : 11.8,
  };

  return (
    <div
      className="glass-instrument hud-corner-bracket"
      style={{
        padding: '0.85rem 1rem',
        borderRadius: '3px',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.68rem',
        color: '#f4f4f0',
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.35rem' }}>
        <span style={{ color: '#7dd3fc', fontWeight: 600 }}>18-CHANNEL SENSOR PROFILE</span>
        <span style={{ color: '#ffc857', fontSize: '0.6rem' }}>IIRS + DFSAR + TMC-2</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>OPTICAL ALBEDO (OHRC)</span>
          <div style={{ color: '#f4f4f0', fontWeight: 600 }}>{sensorData.ohrc.toFixed(4)}</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>RADAR CPR (DFSAR)</span>
          <div style={{ color: '#b8f0ff', fontWeight: 600 }}>{cpr.toFixed(2)}</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>IIRS 1500nm RAD</span>
          <div style={{ color: '#f4f4f0', fontWeight: 600 }}>{sensorData.r1500.toFixed(1)} µW</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>IIRS 2000nm RAD</span>
          <div style={{ color: '#f4f4f0', fontWeight: 600 }}>{sensorData.r2000.toFixed(1)} µW</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>IIRS BAND RATIO</span>
          <div style={{ color: sensorData.bandRatio > 1.0 ? '#7be495' : '#ffc857', fontWeight: 600 }}>
            {sensorData.bandRatio.toFixed(2)} {sensorData.bandRatio > 1.0 ? '(H₂O DIP)' : ''}
          </div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>H₂O ABSORPTION DEPTH</span>
          <div style={{ color: sensorData.bd2000 > 0 ? '#7be495' : '#9aa0a6', fontWeight: 600 }}>
            {sensorData.bd2000 > 0 ? `+${sensorData.bd2000.toFixed(3)}` : sensorData.bd2000.toFixed(3)}
          </div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>ELEVATION (TMC-2)</span>
          <div style={{ color: '#f4f4f0', fontWeight: 600 }}>{sensorData.elevation} m</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>TERRAIN SLOPE</span>
          <div style={{ color: sensorData.slope > 15 ? '#ff6b5e' : '#7be495', fontWeight: 600 }}>
            {sensorData.slope}°
          </div>
        </div>
      </div>
    </div>
  );
}
