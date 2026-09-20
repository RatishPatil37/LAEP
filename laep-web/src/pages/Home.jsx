import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBenchmarkCraters } from '../api/laepApi';
import DataStateBadge from '../components/scientific/DataStateBadge';
import CraterInspector from '../components/scientific/CraterInspector';
import MoonHero from '../scenes/MoonHero/MoonHero';
import { displayCraterName } from '../lib/crater';
import '../styles/components.css';

const NARRATIVE_STEPS = [
  ['01', 'Remote sensing', 'Polarimetric radar, optical imagery, and terrain products provide distinct observations of the south polar environment.'],
  ['02', 'Evidence context', 'LAEP presents supporting observations and their limits together; it does not convert a signal into certainty.'],
  ['03', 'Reachability', 'Terrain and illumination constraints are evaluated separately from resource-evidence interpretation.'],
  ['04', 'Mission planning', 'The Explorer is where available data can be examined, compared, and used to construct an explicitly labelled route preview.'],
];

export default function Home() {
  const [craterData, setCraterData] = useState({ craters: [], meta: { state: 'unavailable' } });
  const [selectedCrater, setSelectedCrater] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    getBenchmarkCraters()
      .then((data) => { if (active) setCraterData(data); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, []);

  const status = craterData.meta?.state ?? 'unavailable';

  return (
    <div className="mission-page">
      <section className="mission-hero">
        <div className="mission-hero__copy">
          <p className="eyebrow">LAEP / Lunar Autonomous Exploration & Planning</p>
          <h1>Read the terrain.<br /><em>Respect the uncertainty.</em></h1>
          <p className="mission-hero__lede">A planetary intelligence interface for examining lunar south-polar reference targets, their supporting evidence, and operational constraints.</p>
          <div className="mission-hero__actions">
            <Link className="button button--primary" to="/explorer">Enter the Explorer <span aria-hidden="true">↓</span></Link>
            <a className="button button--quiet" href="#evidence">Inspect reference evidence</a>
          </div>
          <div className="mission-hero__metadata">
            <DataStateBadge state={status} detail={craterData.meta?.provenance} />
            <span>South polar reference targets</span>
          </div>
        </div>
        <MoonHero craters={craterData.craters} selectedCrater={selectedCrater} onSelect={setSelectedCrater} state={status} />
      </section>

      <section className="mission-statement" aria-labelledby="mission-statement-title">
        <p className="eyebrow">A scientific interface, not a claim engine</p>
        <h2 id="mission-statement-title">From remote sensing to <em>decision context.</em></h2>
        <p>Every LAEP view must say what it knows, how it was produced, and what it cannot establish. The system separates curated reference data, derived analysis, simulations, and unavailable products.</p>
      </section>

      <section className="crater-intelligence" id="evidence" aria-labelledby="crater-intelligence-title">
        <div className="section-heading">
          <div><p className="eyebrow">Reference targets</p><h2 id="crater-intelligence-title">Crater intelligence</h2></div>
          <DataStateBadge state={status} detail={craterData.meta?.provenance} />
        </div>
        {error ? <div className="notice notice--error" role="alert">Reference targets could not be loaded: {error}</div> : (
          <div className="crater-intelligence__layout">
            <div className="target-list" role="list" aria-label="Available crater reference targets">
              {craterData.craters.length === 0 ? <div className="notice" role="status">Loading available reference targets…</div> : craterData.craters.map((crater) => (
                <button className={`target-list__item ${selectedCrater?.id === crater.id ? 'is-selected' : ''}`} type="button" key={crater.id} onClick={() => setSelectedCrater(crater)} role="listitem">
                  <span className="target-list__index">{crater.id}</span>
                  <span><strong>{displayCraterName(crater.name)}</strong><small>{Math.abs(crater.lat).toFixed(2)}° {crater.lat < 0 ? 'S' : 'N'} · {crater.lon.toFixed(2)}° E</small></span>
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            <CraterInspector crater={selectedCrater} state={status} onExplore={() => { window.location.assign('/explorer'); }} />
          </div>
        )}
      </section>

      <section className="narrative-grid" aria-labelledby="narrative-title">
        <div className="narrative-grid__intro"><p className="eyebrow">The LAEP sequence</p><h2 id="narrative-title">Observe. Interpret. Plan.</h2><p>A deliberate progression keeps observations, inferences, and operational choices legible rather than collapsing them into a single score.</p></div>
        <ol>
          {NARRATIVE_STEPS.map(([number, title, description]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}
        </ol>
      </section>

      <section className="mission-cta"><p className="eyebrow">Spatial workbench</p><h2>Move from an orbital reference to a working map.</h2><p>Use the Explorer to inspect layers, choose start and target coordinates, and generate a route only when its data state is explicit.</p><Link className="button button--primary" to="/explorer">Open South Polar Explorer <span aria-hidden="true">→</span></Link></section>
    </div>
  );
}
