import DataStateBadge from './DataStateBadge';
import { displayCraterName } from '../../lib/crater';

function Metric({ label, value }) {
  return <div className="crater-inspector__metric"><span>{label}</span><strong>{value ?? 'Unavailable'}</strong></div>;
}

export default function CraterInspector({ crater, state = 'derived', onExplore }) {
  if (!crater) {
    return (
      <aside className="crater-inspector crater-inspector--empty" aria-live="polite">
        <p className="eyebrow">Crater intelligence</p>
        <h2>Select a reference target</h2>
        <p>Choose a labelled crater marker to inspect the source-backed reference attributes available to LAEP.</p>
      </aside>
    );
  }

  const evidence = crater.status === 'negative' ? 'No supporting evidence in this reference set' :
    crater.status === 'partial' ? 'Candidate signal — interpretation remains uncertain' :
    'Reference evidence — interpretation remains conditional';

  return (
    <aside className="crater-inspector" aria-live="polite">
      <div className="crater-inspector__topline">
        <p className="eyebrow">Crater intelligence</p>
        <DataStateBadge state={state} detail="Curated reference-crater attributes" />
      </div>
      <h2>{displayCraterName(crater.name)}</h2>
      <p className="crater-inspector__coordinates">{Math.abs(crater.lat).toFixed(2)}° {crater.lat < 0 ? 'S' : 'N'} · {crater.lon.toFixed(2)}° E</p>
      <div className="crater-inspector__evidence">
        <span>Evidence statement</span>
        <strong>{evidence}</strong>
      </div>
      <div className="crater-inspector__metrics">
        <Metric label="Peak CPR" value={crater.peak_cpr} />
        <Metric label="DOP" value={crater.dop} />
        <Metric label="Diameter" value={crater.diameter_km ? `${crater.diameter_km} km` : null} />
        <Metric label="Terrain context" value={crater.wall_slope_deg ?? 'Unavailable'} />
      </div>
      <p className="crater-inspector__note">{crater.summary || 'No explanatory annotation is available for this target.'}</p>
      <button className="button button--quiet" type="button" onClick={() => onExplore?.(crater)}>Open in Explorer <span aria-hidden="true">↗</span></button>
    </aside>
  );
}
