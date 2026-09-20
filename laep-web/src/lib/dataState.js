export const DATA_STATE = Object.freeze({
  REAL: 'real',
  DERIVED: 'derived',
  SIMULATED: 'simulated',
  UNAVAILABLE: 'unavailable',
});

const LABELS = {
  [DATA_STATE.REAL]: 'Real data',
  [DATA_STATE.DERIVED]: 'Derived data',
  [DATA_STATE.SIMULATED]: 'Simulation',
  [DATA_STATE.UNAVAILABLE]: 'Unavailable',
};

export function dataStateLabel(state) {
  return LABELS[state] ?? LABELS[DATA_STATE.UNAVAILABLE];
}

export function attachDataMeta(payload, state, provenance) {
  return {
    ...payload,
    meta: { state, provenance },
  };
}
