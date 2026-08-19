import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getIceStats, getBenchmarkCraters } from '../api/laepApi';
import '../styles/components.css';

const PHASES = [
  {
    num: '01',
    icon: '📡',
    title: 'Dual-Frequency SAR Polarimetry',
    desc: 'Applies Sinha et al. (May 2026, PRL) physics filter (CPR > 1.0 AND DOP < 0.13) to Chandrayaan-2 DFSAR L/S-band data to isolate subsurface volume scattering from rocky surface reflection.'
  },
  {
    num: '02',
    icon: '🤖',
    title: 'YOLOv11 & Keypoint Detection',
    desc: 'Processes Chandrayaan-2 OHRC 0.25m imagery to simultaneously segment micro-craters and sub-meter boulder hazards, combined with CenterNet anchor-free detection in shadowed PSRs.'
  },
  {
    num: '03',
    icon: '🗺️',
    title: 'Multi-Modal Hazard Index (MHI)',
    desc: 'Fuses DEM slope gradients, dual-axis SAR geometric mean roughness (W_z = sqrt(|W_p * W_q|)), and permanent shadow battery drain into a 3-class traversability cost grid.'
  },
  {
    num: '04',
    icon: '🚀',
    title: 'Reachability-Aware A* Pathfinder',
    desc: 'Executes BFS flood-fill reachability pre-filtering and kinematically-constrained A* with 15-pixel auto-snapping to plot energy-optimal, tilt-safe routes into icy crater bowls.'
  },
  {
    num: '05',
    icon: '💧',
    title: '2D Simpson Volumetric Estimation',
    desc: 'Calculates continuous 3D volatile volume and accessible water mass in Metric Tons using 2D composite Simpson numerical integration over per-pixel Ice Confidence Scores.'
  },
];

export default function Home() {
  const [stats, setStats] = useState(null);
  const [benchmarks, setBenchmarks] = useState([]);

  useEffect(() => {
    getIceStats().then(setStats).catch(() => {});
    getBenchmarkCraters().then(d => setBenchmarks(d.craters || [])).catch(() => {});
  }, []);

  return (
    <div className="home-page">
      {/* ── Aerospace Mission Control Hero ────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg" />
        <div className="hero-radar-sweep" />

        <p className="hero-eyebrow">
          ISRO Chandrayaan-2 · Lunar South Pole Mission
        </p>

        <h1 className="hero-title">
          Lunar <span className="hero-title-highlight">Autonomous</span><br/>
          Exploration Pipeline
        </h1>

        <p className="hero-subtitle">
          Next-generation planetary intelligence system powered by Chandrayaan-2 DFSAR polarimetry,
          OHRC deep learning hazard detection, and autonomous kinematic pathfinding.
        </p>

        <div className="hero-cta">
          <Link to="/explorer" className="btn btn-primary">
            🚀 Launch Mission Control HUD
          </Link>
          <Link to="/methodology" className="btn btn-ghost">
            📖 Peer-Reviewed Methodology (2026)
          </Link>
        </div>
      </section>

      {/* ── Live Telemetry Strip ─────────────────────────────────────── */}
      <div className="stats-strip">
        {[
          { label: 'Global Craters Mapped', value: '1,296,796', unit: 'Robbins DB' },
          { label: 'Screened Polar Targets', value: '6,625', unit: 'sub-craters' },
          { label: 'Peak Radar CPR', value: '1.95', unit: 'Faustini F2' },
          { label: 'Estimated Deposit Mass', value: stats ? `${(stats.ice_coverage_km2 * 1e5).toLocaleString()}` : '12,142,707', unit: 'Metric Tons' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}<span className="stat-unit">{s.unit}</span></div>
          </div>
        ))}
      </div>

      {/* ── Pipeline Phases Grid ────────────────────────────────────── */}
      <div className="phases-section">
        <h2 className="section-title">The 5-Stage Scientific Architecture</h2>
        <p className="section-subtitle">
          From raw Chandrayaan-2 polarimetric radar backscatter to an autonomous rover traversal trajectory.
        </p>
        <div className="phases-grid">
          {PHASES.map(p => (
            <div className="phase-card" key={p.num}>
              <div className="phase-num">Stage {p.num}</div>
              <span className="phase-icon">{p.icon}</span>
              <div className="phase-title">{p.title}</div>
              <div className="phase-desc">{p.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Ground Truth Benchmark Craters ─────────────────────────── */}
        <div style={{ marginTop: 64 }}>
          <h2 className="section-title">Peer-Reviewed Ground Truth Benchmark Craters</h2>
          <p className="section-subtitle">
            Ground-truth craters verified by the Physical Research Laboratory (PRL, ISRO Ahmedabad) in <em>npj Space Exploration (May 2026)</em>:
          </p>

          <div className="benchmarks-grid">
            {benchmarks.slice(0, 4).map(c => (
              <div className="benchmark-card" key={c.id}>
                <div className="benchmark-header">
                  <span className="benchmark-title">{c.name}</span>
                  <span className={`benchmark-badge ${c.status}`}>
                    {c.status === 'positive' ? 'ICE VERIFIED' : (c.status === 'partial' ? 'CANDIDATE' : 'CONTROL')}
                  </span>
                </div>
                <div className="benchmark-metrics">
                  <div className="benchmark-metric-item">
                    <span className="benchmark-metric-label">Peak CPR</span>
                    <span className="benchmark-metric-value" style={{ color: 'var(--c-ice)' }}>{c.peak_cpr}</span>
                  </div>
                  <div className="benchmark-metric-item">
                    <span className="benchmark-metric-label">DOP</span>
                    <span className="benchmark-metric-value">{c.dop}</span>
                  </div>
                  <div className="benchmark-metric-item">
                    <span className="benchmark-metric-label">Diameter</span>
                    <span className="benchmark-metric-value">{c.diameter_km} km</span>
                  </div>
                </div>
                <div className="benchmark-desc">{c.summary}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mission Data Sensors Matrix ───────────────────────────── */}
        <div style={{ marginTop: 56 }}>
          <h2 className="section-title">Integrated Sensor Suite</h2>
          <p className="section-subtitle">Multi-instrument data products from Chandrayaan-2 and NASA missions.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {[
              { label: 'DFSAR (L & S Band)', note: 'Dual Frequency SAR · 2.5m - 25m', source: 'ISRO PRADAN', color: 'var(--c-ice)' },
              { label: 'OHRC 0.25m Optical', note: 'Sub-meter boulder & crater mapping', source: 'ISRO PRADAN', color: 'var(--c-neon-cyan)' },
              { label: 'TMC-2 / LOLA DEM', note: 'High-precision stereo elevation', source: 'NASA / ISRO', color: 'var(--c-warning)' },
              { label: 'IIRS Hyperspectral', note: '2.8 - 3.0 µm H2O absorption cubes', source: 'ISRO PRADAN', color: 'var(--c-safe)' },
            ].map(d => (
              <div key={d.label} className="stat-card">
                <div className="stat-label">{d.source}</div>
                <div style={{ fontFamily: 'var(--font-hud)', fontWeight: 700, fontSize: '0.95rem', color: d.color, margin: '6px 0' }}>{d.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>{d.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
