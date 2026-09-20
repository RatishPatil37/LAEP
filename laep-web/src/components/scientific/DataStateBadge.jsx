import { dataStateLabel } from '../../lib/dataState';

export default function DataStateBadge({ state = 'unavailable', detail }) {
  return (
    <span className={`data-state data-state--${state}`} title={detail || dataStateLabel(state)}>
      <span aria-hidden="true" className="data-state__mark" />
      {dataStateLabel(state)}
    </span>
  );
}
