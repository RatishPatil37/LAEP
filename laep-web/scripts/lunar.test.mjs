import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Ellipsoid, Cartesian3, Cartographic } from 'cesium';
import { findFeatures, locationText, nearbyFeatures, VIEW } from '../src/features/lunar-explorer/catalog.js';

const catalog = JSON.parse(readFileSync(new URL('../public/data/lunar/catalog.json', import.meta.url)));
test('catalog preserves unique official identifiers and valid source coordinates', () => {
  assert.equal(catalog.features.length, catalog.count);
  assert.equal(new Set(catalog.features.map(f => f.id)).size, catalog.count);
  assert.match(catalog.sha256, /^[a-f0-9]{64}$/);
  for (const f of catalog.features) {
    assert.ok(f.latitude >= -90 && f.latitude <= 90);
    assert.ok(f.longitude >= -180 && f.longitude < 180);
    assert.ok(f.diameterKm === null || f.diameterKm > 0);
    assert.equal('iceProbability' in f, false);
  }
});
test('sharded source records cover every catalog ID exactly once', () => {
  const detailFolder = new URL('../public/data/lunar/details/', import.meta.url);
  const details = readdirSync(detailFolder).flatMap(name => JSON.parse(readFileSync(new URL(name, detailFolder))));
  assert.equal(details.length, catalog.count);
  assert.equal(new Set(details.map(f => f.id)).size, catalog.count);
  assert.deepEqual(new Set(details.map(f => f.id)), new Set(catalog.features.map(f => f.id)));
  for (const record of details) {
    assert.equal(record.sourceUrl, `https://planetarynames.wr.usgs.gov/Feature/${record.id}`);
  }
});
test('search ranks exact names first and handles diacritics', () => {
  assert.equal(findFeatures(catalog.features, 'Tycho')[0].name, 'Tycho');
  assert.equal(findFeatures(catalog.features, 'Hedervari')[0].name, 'Hédervári');
  assert.ok(findFeatures(catalog.features, '', true).every(f => f.latitude <= -80));
  assert.deepEqual(findFeatures(catalog.features, 'not-a-real-feature'), []);
});
test('locations round only for presentation; Moon coordinates round trip', () => {
  const f = catalog.features.find(f => f.name === 'Faustini');
  const p = Cartesian3.fromDegrees(f.longitude, f.latitude, 0, Ellipsoid.MOON);
  const c = Cartographic.fromCartesian(p, Ellipsoid.MOON);
  assert.ok(Math.abs(c.latitude * 180 / Math.PI - f.latitude) < 1e-8);
  assert.ok(Math.abs(c.longitude * 180 / Math.PI - f.longitude) < 1e-8);
  assert.ok(Math.abs(Cartesian3.magnitude(p) - Ellipsoid.MOON.maximumRadius) < 1e-6);
  assert.match(locationText(f), /°S · .*°E/);
  assert.ok(VIEW.overviewMinHeight > VIEW.terrainMinHeight);
});
test('nearby center distances handle the antimeridian and do not return the target', () => {
  const target = { id: 'a', name: 'A', latitude: 0, longitude: 179 };
  const near = { id: 'b', name: 'B', latitude: 0, longitude: -179 };
  const far = { id: 'c', name: 'C', latitude: 0, longitude: 0 };
  const result = nearbyFeatures([target, far, near], target, Ellipsoid.MOON.maximumRadius);
  assert.equal(result[0].id, 'b');
  assert.equal(result.length, 2);
  assert.ok(Math.abs(result[0].distanceKm - Ellipsoid.MOON.maximumRadius * Math.PI / 90 / 1000) < 1e-8);
});
