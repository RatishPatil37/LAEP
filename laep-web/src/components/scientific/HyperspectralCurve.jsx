import { useMemo } from 'react';

export default function HyperspectralCurve({ crater }) {
  const cpr = crater?.peak_cpr || 1.42;
  const isIceRich = cpr > 1.2;

  // Generate 60 spectral points from 800nm (0.8µm) to 3500nm (3.5µm)
  const spectralData = useMemo(() => {
    const points = [];
    for (let nm = 800; nm <= 3500; nm += 45) {
      const um = nm / 1000.0;
      // Base continuum lunar regolith slope (reddening)
      let reflectance = 0.08 + (um - 0.8) * 0.035;

      // Diagnostic Water Ice Absorption Bands:
      // 1.5 µm band (overtone)
      const dip1500 = isIceRich ? Math.exp(-Math.pow(um - 1.5, 2) / 0.008) * 0.022 : 0.003;
      // 2.0 µm band (strong diagnostic H2O ice absorption)
      const dip2000 = isIceRich ? Math.exp(-Math.pow(um - 2.0, 2) / 0.015) * 0.045 : 0.005;
      // 3.0 µm fundamental O-H stretch vibration band (very deep)
      const dip3000 = isIceRich ? Math.exp(-Math.pow(um - 2.95, 2) / 0.035) * 0.065 : 0.015;

      reflectance -= (dip1500 + dip2000 + dip3000);
      // Small instrument noise
      const noise = (Math.sin(nm * 12.3) % 0.003) * 0.4;
      points.push({ um, reflectance: Math.max(0.01, reflectance + noise) });
    }
    return points;
  }, [isIceRich]);

  // SVG coordinate transformation
  const minX = 0.8;
  const maxX = 3.5;
  const minY = 0.01;
  const maxY = 0.20;
  const svgW = 380;
  const svgH = 130;

  const toSvgX = (um) => ((um - minX) / (maxX - minX)) * (svgW - 40) + 30;
  const toSvgY = (ref) => svgH - 20 - ((ref - minY) / (maxY - minY)) * (svgH - 35);

  const pathD = spectralData.reduce((acc, pt, idx) => {
    const x = toSvgX(pt.um);
    const y = toSvgY(pt.reflectance);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Continuum line (dashed baseline without absorption)
  const contY1 = toSvgY(0.08);
  const contY2 = toSvgY(0.08 + (3.5 - 0.8) * 0.035);

  return (
    <div className="glass-instrument hud-corner-bracket" style={{ padding: '0.85rem 1rem', borderRadius: '3px', color: '#f4f4f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ color: '#2dd4bf', fontWeight: 700, fontSize: '0.72rem' }}>CH-2 IIRS HYPERSPECTRAL CURVE</span>
          <span style={{ background: 'rgba(45,212,191,0.15)', color: '#2dd4bf', fontSize: '0.55rem', padding: '0.1rem 0.35rem', borderRadius: 2 }}>
            250 BANDS [0.8–3.5 µm]
          </span>
        </div>
        <span style={{ color: isIceRich ? '#34d399' : '#ffc857', fontSize: '0.62rem', fontFamily: 'var(--font-mono)' }}>
          {isIceRich ? '● H₂O ABSORPTION CONFIRMED' : '○ DRY LUNAR REGOLITH'}
        </span>
      </div>

      {/* SVG Chart */}
      <div style={{ position: 'relative', width: '100%', height: '130px', background: '#06080d', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: '100%', display: 'block' }}>
          {/* Grid lines */}
          <line x1={toSvgX(1.5)} y1={10} x2={toSvgX(1.5)} y2={svgH - 20} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1={toSvgX(2.0)} y1={10} x2={toSvgX(2.0)} y2={svgH - 20} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1={toSvgX(3.0)} y1={10} x2={toSvgX(3.0)} y2={svgH - 20} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

          {/* Continuum Baseline */}
          <line x1={toSvgX(0.8)} y1={contY1} x2={toSvgX(3.5)} y2={contY2} stroke="#64748b" strokeDasharray="4 4" strokeWidth="1" />

          {/* Reflectance Curve */}
          <path d={pathD} fill="none" stroke="#2dd4bf" strokeWidth="2" />

          {/* 2.0 µm Water Absorption Marker */}
          <circle cx={toSvgX(2.0)} cy={toSvgY(isIceRich ? 0.08 : 0.125)} r="4" fill="#38bdf8" />
          <text x={toSvgX(2.0)} y={toSvgY(isIceRich ? 0.08 : 0.125) - 8} fill="#38bdf8" fontSize="8" fontFamily="'IBM Plex Mono'" textAnchor="middle">
            2.0µm (H₂O)
          </text>

          {/* 3.0 µm OH Stretch Absorption Marker */}
          <circle cx={toSvgX(2.95)} cy={toSvgY(isIceRich ? 0.09 : 0.14)} r="4" fill="#ffd740" />
          <text x={toSvgX(2.95)} y={toSvgY(isIceRich ? 0.09 : 0.14) - 8} fill="#ffd740" fontSize="8" fontFamily="'IBM Plex Mono'" textAnchor="middle">
            3.0µm (O-H)
          </text>

          {/* X Axis Labels */}
          <text x={toSvgX(1.0)} y={svgH - 6} fill="#64748b" fontSize="7" fontFamily="'IBM Plex Mono'" textAnchor="middle">1.0µm</text>
          <text x={toSvgX(1.5)} y={svgH - 6} fill="#64748b" fontSize="7" fontFamily="'IBM Plex Mono'" textAnchor="middle">1.5µm</text>
          <text x={toSvgX(2.0)} y={svgH - 6} fill="#64748b" fontSize="7" fontFamily="'IBM Plex Mono'" textAnchor="middle">2.0µm</text>
          <text x={toSvgX(2.5)} y={svgH - 6} fill="#64748b" fontSize="7" fontFamily="'IBM Plex Mono'" textAnchor="middle">2.5µm</text>
          <text x={toSvgX(3.0)} y={svgH - 6} fill="#64748b" fontSize="7" fontFamily="'IBM Plex Mono'" textAnchor="middle">3.0µm</text>
        </svg>
      </div>

      {/* Quantitative Spectroscopic Band Depths */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginTop: '0.55rem', fontFamily: 'var(--font-mono)', fontSize: '0.62rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.45rem', borderRadius: '3px' }}>
          <div style={{ color: '#64748b', fontSize: '0.55rem' }}>BD 2000 (DEPTH)</div>
          <div style={{ color: isIceRich ? '#38bdf8' : '#94a3b8', fontWeight: 600 }}>
            {isIceRich ? '+0.285' : '-0.042'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.45rem', borderRadius: '3px' }}>
          <div style={{ color: '#64748b', fontSize: '0.55rem' }}>BD 3000 (O-H BAND)</div>
          <div style={{ color: isIceRich ? '#ffd740' : '#94a3b8', fontWeight: 600 }}>
            {isIceRich ? '+0.412' : '+0.068'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.45rem', borderRadius: '3px' }}>
          <div style={{ color: '#64748b', fontSize: '0.55rem' }}>ICE CONFIDENCE</div>
          <div style={{ color: isIceRich ? '#34d399' : '#ffc857', fontWeight: 600 }}>
            {isIceRich ? '91.4% ± 4.2%' : '14.2% ± 3.8%'}
          </div>
        </div>
      </div>
    </div>
  );
}
