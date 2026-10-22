import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDemo, scoreColor } from './iceDemo.js';

test('blue scale clamps display values', () => {
  assert.equal(scoreColor(-1), scoreColor(0));
  assert.equal(scoreColor(2), scoreColor(1));
  assert.notEqual(scoreColor(0), scoreColor(1));
});

test('product validation rejects malformed payloads and HTTP errors', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(loadDemo('/demo'), /503/);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ samples: [] }) });
    await assert.rejects(loadDemo('/demo'), /Invalid prediction manifest/);
  } finally { globalThis.fetch = original; }
});

test('missing scores are retained; invalid coordinates and duplicate IDs fail closed', async () => {
  const original = globalThis.fetch;
  const data = { schema_version: 1, model: { sha256: 'test', features: [], classes: [0, 1] },
    source: { sha256: 'test', file: 'fixture' }, lfm: { reason: 'unavailable' }, limitations: [],
    counts: { eligible: 0, unobserved: 1 }, samples: [{ id: 'a', lon: 0, lat: -87, score: null, qc: [] }] };
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => data });
    assert.equal((await loadDemo('/demo')).samples[0].score, null);
    data.samples[0].lat = -100;
    await assert.rejects(loadDemo('/demo'), /Invalid coordinates/);
    data.samples[0].lat = -87;
    data.samples.push({ ...data.samples[0] });
    await assert.rejects(loadDemo('/demo'), /Invalid coordinates/);
  } finally { globalThis.fetch = original; }
});
