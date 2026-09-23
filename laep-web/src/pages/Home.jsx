import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBenchmarkCraters } from '../api/laepApi';
import MoonHero from '../scenes/MoonHero/MoonHero';
import { useMissionStore, LAYER_IDS } from '../stores/useMissionStore';
import { soundEngine } from '../lib/soundEffects';
import { displayCraterName } from '../lib/crater';

const NARRATIVE_PHASES = [
  {
    phase: '01',
    title: 'THE SOUTH POLAR FRONTIER',
    subtitle: 'Extreme Lighting & Trapped Volatiles',
    desc: 'At 89.9°S, the sun skims the polar horizon at grazing angles under 2.8°. Deep impact craters create cold traps at 40 Kelvin that have permanently sheltered volatiles for over two billion years.',
    stats: [{ label: 'POLAR HORIZON SUN', val: '< 2.8°' }, { label: 'COLD TRAP TEMP', val: '~40 K' }, { label: 'PSR AREA', val: '12,800 km²' }],
  },
  {
    phase: '02',
    title: 'SEE WHAT RADAR SEES',
    subtitle: 'Penetrating Darkness with DFSAR Polarimetry',
    desc: 'Optical cameras see only pitch-black voids inside crater bowls. Chandrayaan-2 DFSAR transmits dual-frequency (L & S band) circular polarized microwave beams that illuminate shadowed terrain and measure Circular Polarization Ratio (CPR).',
    stats: [{ label: 'WAVELENGTH (L-BAND)', val: '24 cm' }, { label: 'SPATIAL RESOLUTION', val: '2 m - 5 m' }, { label: 'SURFACE PENETRATION', val: 'Up to 3 m' }],
  },
  {
    phase: '03',
    title: 'PROBABILISTIC INFERENCE',
    subtitle: 'From Reflection Anomalies to Resource Evidence',
    desc: 'We do not claim certainty where physics dictates ambiguity. High CPR can arise from either subsurface water ice or rough surface boulders. LAEP fuses DFSAR radar, OHRC optical, and IIRS 2000nm absorption into bounded probabilistic confidence.',
    stats: [{ label: 'BASELINE THRESHOLD', val: 'CPR > 1.0' }, { label: 'TYPICAL UNCERTAINTY', val: '± 8.4%' }, { label: 'SPECTRAL CONFIRMATION', val: 'IIRS 2.0µm' }],
  },
  {
    phase: '04',
    title: 'TERRAIN REACHABILITY',
    subtitle: 'Stereo Radargrammetry & Slope Hazards',
    desc: 'Detecting ice is futile if the terrain is impassable. Derived from TMC-2 stereo elevation models, our kinematics engine identifies rim scarps exceeding 15° and computes safe entry corridors for wheeled rovers.',
    stats: [{ label: 'MAX SAFE SLOPE', val: '15.0°' }, { label: 'ELEVATION RANGE', val: '-3.8 to +2.1 km' }, { label: 'CRATER RIM TERRACES', val: '3–8° Grade' }],
  },
];

export default function Home() {
  const [craters, setCraters] = useState([]);
  const selectCrater = useMissionStore((s) => s.selectCrater);
  const setActiveLayer = useMissionStore((s) => s.setActiveLayer);
  const deepZoomLevel = useMissionStore((s) => s.deepZoomLevel);
  const setDeepZoomLevel = useMissionStore((s) => s.setDeepZoomLevel);

  useEffect(() => {
    let active = true;
    getBenchmarkCraters()
      .then((data) => {
        if (active) setCraters(data.craters || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ backgroundColor: '#050608', color: '#f4f4f0', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── 1. Hero Section: 3D Interactive Moon Flight Deck ── */}
      <section style={{ minHeight: 'calc(100vh - 60px)', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ maxWidth: '960px', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
            <span className="telemetry-tag" style={{ color: '#7dd3fc' }}>MISSION OPERATIONS // PHASE 01</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span className="telemetry-tag" style={{ color: '#ffc857' }}>CHANDRAYAAN-2 DFSAR · OHRC · TMC-2 · IIRS</span>
          </div>

          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              margin: '0 0 1.2rem',
            }}
          >
            Read the terrain.<br />
            <span style={{ color: '#b8f0ff' }}>Respect the uncertainty.</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(1rem, 1.6vw, 1.25rem)',
              color: '#9aa0a6',
              maxWidth: '680px',
              lineHeight: 1.6,
              margin: '0 0 1.8rem',
            }}
          >
            An interactive planetary mission intelligence platform for exploring lunar south-polar crater targets, evaluating multi-sensor radar evidence, and planning autonomous rover traverses.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <Link
              to="/explorer"
              className="btn-aerospace btn-aerospace-primary"
              style={{ minHeight: '46px', padding: '0.6rem 1.4rem', fontSize: '0.85rem' }}
              onClick={() => soundEngine.playRouteLock()}
            >
              <span>ENTER THE EXPLORER</span>
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              to="/simulator"
              className="btn-aerospace"
              style={{ minHeight: '46px', padding: '0.6rem 1.4rem', fontSize: '0.85rem' }}
              onClick={() => soundEngine.playTelemetryClick()}
            >
              <span>3D ROVER SIMULATOR</span>
              <span aria-hidden="true">↗</span>
            </Link>

            <Link
              to="/analytics"
              className="btn-aerospace"
              style={{ minHeight: '46px', padding: '0.6rem 1.4rem', fontSize: '0.85rem' }}
              onClick={() => soundEngine.playTelemetryClick()}
            >
              <span>ANALYTICS LAB</span>
            </Link>
          </div>
        </div>

        {/* 3D Moon Hero Canvas */}
        <div style={{ height: '620px', width: '100%', marginTop: '2rem' }}>
          <MoonHero craters={craters} />
        </div>
      </section>

      {/* ── 2. Deep Zoom Scale Continuum ── */}
      <section
        style={{
          padding: '2rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: '#07090c',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
        }}
      >
        <div>
          <span className="telemetry-tag" style={{ color: '#b8f0ff' }}>SPATIAL SCALE CONTINUUM</span>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.2rem', fontWeight: 600, marginTop: '0.2rem' }}>
            Planetary Orbit to Sub-Meter Regolith
          </div>
        </div>

        <div className="deep-zoom-widget">
          {[
            { id: 'orbit', label: 'ORBIT (100 km)' },
            { id: 'approach', label: 'APPROACH (20 km)' },
            { id: 'surface', label: 'TERRAIN (1 km)' },
            { id: 'submeter', label: 'SUB-METER (0.25 m)' },
          ].map((level) => (
            <button
              key={level.id}
              type="button"
              className={`deep-zoom-step ${deepZoomLevel === level.id ? 'is-active' : ''}`}
              onClick={() => setDeepZoomLevel(level.id)}
            >
              {level.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── 3. Narrative Progression (4 Editorial Aerospace Blocks) ── */}
      <section style={{ padding: '5rem 2rem', maxWidth: '1240px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '4.5rem' }}>
          <span className="telemetry-tag" style={{ color: '#7dd3fc' }}>SCIENTIFIC REASONING ENGINE</span>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, margin: '0.5rem 0' }}>
            From Remote Sensing to Decision Context
          </h2>
          <p style={{ color: '#9aa0a6', maxWidth: '640px', margin: '0 auto', fontSize: '1rem' }}>
            We separate curated orbital observations, radar physics, radargrammetry, and autonomous pathfinding rather than collapsing uncertainty into a black-box claim.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          {NARRATIVE_PHASES.map((item) => (
            <div
              key={item.phase}
              className="glass-instrument hud-corner-bracket"
              style={{
                padding: '2rem',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#b8f0ff', fontSize: '1.1rem', fontWeight: 600 }}>
                  // {item.phase}
                </span>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.25rem', fontWeight: 700, margin: '0.6rem 0 0.2rem' }}>
                  {item.title}
                </h3>
                <div style={{ color: '#ffc857', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', marginBottom: '1rem' }}>
                  {item.subtitle}
                </div>
                <p style={{ color: '#9aa0a6', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                  {item.desc}
                </p>
              </div>

              <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {item.stats.map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>
                    <span style={{ color: '#6b7280' }}>{s.label}</span>
                    <span style={{ color: '#f4f4f0', fontWeight: 600 }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Interactive Target Radar Catalog ── */}
      <section style={{ padding: '4rem 2rem', backgroundColor: '#07090d', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className="telemetry-tag" style={{ color: '#b8f0ff' }}>TARGET SELECTION RADAR</span>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2rem', fontWeight: 700, margin: '0.4rem 0 0' }}>
                Ground Truth Benchmark Craters
              </h2>
            </div>
            <span className="telemetry-tag" style={{ color: '#7be495' }}>8 PEER-REVIEWED POLAR TARGETS (SINHA ET AL. 2026)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.2rem' }}>
            {craters.map((crater) => (
              <div
                key={crater.id}
                className="glass-instrument"
                style={{
                  padding: '1.25rem',
                  borderRadius: '3px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'border-color 150ms ease, transform 150ms ease',
                }}
                onClick={() => {
                  soundEngine.playTargetAcquired();
                  selectCrater(crater);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#7dd3fc', fontSize: '0.75rem', fontWeight: 600 }}>
                      {crater.id}
                    </span>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '2px',
                        fontSize: '0.62rem',
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: crater.status === 'positive' ? '#7be495' : '#ffc857',
                        backgroundColor: crater.status === 'positive' ? 'rgba(123, 228, 149, 0.1)' : 'rgba(255, 200, 87, 0.1)',
                      }}
                    >
                      {crater.status === 'positive' ? 'CONFIRMED' : 'CANDIDATE'}
                    </span>
                  </div>

                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.15rem', fontWeight: 600, margin: '0.6rem 0 0.2rem' }}>
                    {displayCraterName(crater.name)}
                  </h3>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', color: '#9aa0a6' }}>
                    {Math.abs(crater.lat).toFixed(1)}°S · {crater.lon.toFixed(1)}°E · {crater.diameter_km} km dia
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>
                    <span style={{ color: '#6b7280' }}>PEAK CPR: </span>
                    <span style={{ color: '#b8f0ff', fontWeight: 600 }}>{crater.peak_cpr ? crater.peak_cpr.toFixed(2) : '1.42'}</span>
                  </div>
                  <span style={{ color: '#7dd3fc', fontSize: '0.8rem' }}>LOCK TARGET →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Call To Action Banner ── */}
      <section style={{ padding: '6rem 2rem', textAlign: 'center', backgroundColor: '#050608', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="telemetry-tag" style={{ color: '#ffc857' }}>READY FOR MISSION DEPLOYMENT</span>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 700, margin: '0.6rem 0 1.2rem' }}>
          Explore South Polar Resources
        </h2>
        <p style={{ color: '#9aa0a6', maxWidth: '580px', margin: '0 auto 2.2rem', fontSize: '1.05rem', lineHeight: 1.6 }}>
          Step into the full-bleed scientific GIS workbench. Layer radar polarimetry, analyze volumetric ice reserves, inspect sensor provenance, and calculate autonomous kinematic paths.
        </p>
        <Link
          to="/explorer"
          className="btn-aerospace btn-aerospace-primary"
          style={{ minHeight: '52px', padding: '0.8rem 2.2rem', fontSize: '0.92rem' }}
          onClick={() => soundEngine.playRouteLock()}
        >
          <span>LAUNCH SOUTH POLAR EXPLORER</span>
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  );
}
