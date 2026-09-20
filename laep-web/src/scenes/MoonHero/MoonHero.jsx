import { lazy, Suspense } from 'react';

const MoonScene = lazy(() => import('./MoonScene'));

function MoonLoading() {
  return <div className="moon-loading" role="status"><span>Loading spatial context</span><i /></div>;
}

export default function MoonHero({ craters, selectedCrater, onSelect }) {
  return (
    <div className="moon-canvas" aria-label="Interactive lunar reference globe. Select a crater marker to inspect its available reference attributes.">
      <Suspense fallback={<MoonLoading />}>
        <MoonScene craters={craters} selectedCrater={selectedCrater} onSelect={onSelect} />
      </Suspense>
      <div className="moon-canvas__label"><span>Spatial overview</span><small>Visual orientation only · not a scientific surface product</small></div>
    </div>
  );
}
