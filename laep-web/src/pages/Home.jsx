import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getIceStats, getLandingSites } from '../api/laepApi';
import '../styles/components.css';

const PHASES = [
  { num: '01', icon: '📡', title: 'Ice Detection',     desc: 'CPR > 1.0 & DOP < 0.13 physics filter applied to DFSAR polarimetric data produces a per-pixel Ice Confidence Score.' },
  { num: '02', icon: '🗺️', title: 'Terrain Intelligence', desc: 'Slope, roughness, and boulder density fused into a 3-class hazard map: Safe · Moderate · Dangerous.' },
  { num: '03', icon: '🎯', title: 'Landing Site',      desc: 'Multi-objective Landing Suitability Index scores candidate zones by slope, illumination and ice proximity.' },
  { num: '04', icon: '🤖', title: 'Rover Pathfinding',  desc: 'Reachability-aware A* on the cost-weighted terrain grid finds the minimum-energy safe route to the ice target.' },
  { num: '05', icon: '💧', title: 'Volume Estimation',  desc: 'Per-pixel volumetric integration weighted by ICS estimates the total accessible ice deposit volume.' },
];

export default function Home() {
  const [stats, setStats]   = useState(null);
  const [sites, setSites]   = useState([]);

  useEffect(() => {
    getIceStats().then(setStats).catch(() => {});
    getLandingSites().then(d => setSites(d.sites ?? [])).catch(() => {});
  }, []);

  return (
    <div className="home-page">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg" />
        <p className="hero-eyebrow">Chandrayaan-2 · Lunar South Pole</p>
        <h1 className="hero-title">
          Lunar <span className="hero-title-highlight">Autonomous</span><br/>
          Exploration Pipeline
        </h1>
        <p className="hero-subtitle">
          An end-to-end mission intelligence system that detects subsurface water ice,
          identifies safe landing zones, and computes energy-optimal rover traversal
          paths — without GPS.
        </p>
        <div className="hero-cta">
          <Link to="/explorer" className="btn btn-primary">
            🚀 Launch Mission Planner
          </Link>
          <Link to="/methodology" className="btn btn-ghost">
            📖 Read the Science
          </Link>
        </div>
      </section>

      {/* ── Live stats from backend ───────────────────────────────────── */}
      <div className="stats-strip">
        {[
          { label: 'Ice Coverage', value: stats ? `${stats.ice_coverage_km2}` : '—', unit: 'km²' },
          { label: 'Coverage %',   value: stats ? `${stats.coverage_pct}` : '—', unit: '%' },
          { label: 'Mean ICS',     value: stats ? `${stats.mean_ics}` : '—', unit: '/1.0' },
          { label: 'Landing Sites', value: sites.length || '—', unit: 'found' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}<span className="stat-unit">{s.unit}</span></div>
          </div>
        ))}
      </div>

      {/* ── Pipeline phases ──────────────────────────────────────────── */}
      <div className="phases-section">
        <h2 className="section-title">The 5-Phase Pipeline</h2>
        <p className="section-subtitle">
          From raw Chandrayaan-2 radar data to a rover-ready mission plan.
        </p>
        <div className="phases-grid">
          {PHASES.map(p => (
            <div className="phase-card" key={p.num}>
              <div className="phase-num">Phase {p.num}</div>
              <span className="phase-icon">{p.icon}</span>
              <div className="phase-title">{p.title}</div>
              <div className="phase-desc">{p.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Data sources ─────────────────────────────────────────── */}
        <div style={{ marginTop: 48 }}>
          <h2 className="section-title">Real Data Sources</h2>
          <p className="section-subtitle">All satellite data is open-access and publicly available.</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Chandrayaan-2 DFSAR', note: 'SAR Mosaic · South Pole', source: 'ISRO PRADAN', color: 'var(--c-accent)' },
              { label: 'LRO WAC Mosaic',      note: 'Optical imagery · Global', source: 'NASA Moon Trek', color: 'var(--c-ice)' },
              { label: 'LOLA Elevation',       note: 'DEM · Hillshade', source: 'NASA Moon Trek', color: 'var(--c-warning)' },
            ].map(d => (
              <div key={d.label} className="stat-card" style={{ flex: '1 1 200px' }}>
                <div className="stat-label">{d.source}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '0.95rem', color: d.color, margin: '4px 0' }}>{d.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)' }}>{d.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
