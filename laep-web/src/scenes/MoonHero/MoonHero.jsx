import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import DataStateBadge from '../../components/scientific/DataStateBadge';
import { displayCraterName } from '../../lib/crater';

const MoonScene = lazy(() => import('./MoonScene'));

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query)?.matches ?? false);
  useEffect(() => { const media = window.matchMedia(query); const update = () => setMatches(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, [query]);
  return matches;
}

function MoonLoading() { return <div className="moon-loading" role="status"><span>Preparing lunar spatial context</span><i /></div>; }

function FocusPanel({ focus, state, onGlobal }) {
  if (!focus || focus.type === 'global') return null;
  const crater = focus.crater; const southPole = focus.type === 'south-pole';
  const evidence = crater?.status === 'negative' ? 'No supporting evidence in this reference record' : crater?.status === 'partial' ? 'Candidate signal — interpretation remains uncertain' : 'Reference evidence — interpretation remains conditional';
  return <aside className="moon-focus-panel" aria-live="polite"><button type="button" className="moon-focus-panel__close" onClick={onGlobal} aria-label="Return to global Moon view">×</button><p className="eyebrow">{southPole ? 'Polar reference' : 'Reference target'}</p><h2>{southPole ? 'Lunar South Pole' : displayCraterName(crater.name)}</h2><div className="moon-focus-panel__location"><span>Location</span><strong>{southPole ? '90.00° S · all longitudes' : `${Math.abs(crater.lat).toFixed(2)}° ${crater.lat < 0 ? 'S' : 'N'} · ${crater.lon.toFixed(2)}° E`}</strong></div><DataStateBadge state={southPole ? 'unavailable' : state} detail={southPole ? 'No illumination or terrain product is loaded in this view' : 'Bundled curated reference-crater attributes'} /><dl><div><dt>Evidence</dt><dd>{southPole ? 'Reference targets are shown where their mapped coordinates are available.' : evidence}</dd></div><div><dt>Uncertainty</dt><dd>{southPole ? 'No illumination or terrain layer is available in this hero scene.' : 'Reference attributes do not establish resource quantity or operational suitability.'}</dd></div><div><dt>Provenance</dt><dd>{southPole ? 'Lunar geographic coordinate; target positions from the bundled crater reference set.' : 'Bundled curated benchmark-crater reference set.'}</dd></div><div><dt>Limitations</dt><dd>Surface appearance is visual orientation only, not a scientific terrain or illumination product.</dd></div></dl></aside>;
}

export default function MoonHero({ craters, selectedCrater, onSelect, state = 'derived' }) {
  const mobile = useMediaQuery('(max-width: 800px)'); const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [focus, setFocus] = useState({ type: 'global' }); const [hovered, setHovered] = useState(null); const [ready, setReady] = useState(false);
  useEffect(() => { if (selectedCrater) setFocus({ type: 'crater', crater: selectedCrater }); }, [selectedCrater]);
  const setGlobal = useCallback(() => { setFocus({ type: 'global' }); onSelect?.(null); }, [onSelect]);
  const handleFocus = useCallback((next) => { setFocus(next); if (next.type === 'crater') onSelect?.(next.crater); if (next.type === 'global') onSelect?.(null); }, [onSelect]);
  const handleHover = useCallback((next) => setHovered(next), []);
  return <div className={`moon-canvas ${ready ? 'is-ready' : ''}`} aria-label="Interactive lunar reference globe. Select a crater marker or the South Pole reference to inspect available context."><Suspense fallback={<MoonLoading />}><MoonScene craters={craters} activeFocus={focus} onFocus={handleFocus} onHoverFocus={handleHover} reducedMotion={reducedMotion} onReady={() => setReady(true)} mobile={mobile} /></Suspense><div className="moon-canvas__label"><span>{focus.type === 'south-pole' ? 'South Pole focus' : focus.type === 'crater' ? 'Crater focus' : 'Global reference view'}</span><small>Visual orientation only · not a scientific surface product</small></div><div className="moon-canvas__controls" aria-label="Lunar view controls"><button type="button" className={focus.type === 'global' ? 'is-active' : ''} onClick={setGlobal}>Global view</button><button type="button" className={focus.type === 'south-pole' ? 'is-active' : ''} onClick={() => handleFocus({ type: 'south-pole' })}>South Pole</button></div>{hovered && focus.type === 'global' && <div className="moon-canvas__hover" role="status">{hovered.type === 'south-pole' ? 'South Pole · 90.00° S' : `${hovered.crater.id} · ${displayCraterName(hovered.crater.name)}`}</div>}<FocusPanel focus={focus} state={state} onGlobal={setGlobal} /><p className="moon-canvas__a11y">For a fully accessible target list, use the reference-target controls below the Moon.</p></div>;
}
