export function findFeatures(features, query, polarOnly = false) {
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const term = normalize(query.trim());
  return features.filter(f => (!polarOnly || f.latitude <= -80) &&
    (!term || normalize(f.name).includes(term)))
    .sort((a, b) => (term ? Number(normalize(b.name) === term) - Number(normalize(a.name) === term) : 0) ||
      (b.diameterKm || 0) - (a.diameterKm || 0)).slice(0, 20);
}

export function locationText(feature) {
  return `${Math.abs(feature.latitude).toFixed(2)}°${feature.latitude < 0 ? 'S' : 'N'} · ${Math.abs(feature.longitude).toFixed(2)}°${feature.longitude < 0 ? 'W' : 'E'}`;
}

/** Spherical great-circle separation of catalog centers, not a traversable route. */
export function nearbyFeatures(features, target, radiusMeters, limit = 4) {
  if (!target || !Number.isFinite(radiusMeters) || radiusMeters <= 0) return [];
  const rad = Math.PI / 180;
  return features.filter(f => f.id !== target.id).map(f => {
    const dLat = (f.latitude - target.latitude) * rad;
    const dLon = (f.longitude - target.longitude) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(target.latitude * rad) * Math.cos(f.latitude * rad) * Math.sin(dLon / 2) ** 2;
    return { ...f, distanceKm: 2 * radiusMeters * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))) / 1000 };
  }).sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name)).slice(0, limit);
}

// Display choices only. These are not instrument resolutions or scientific thresholds.
export const VIEW = Object.freeze({ overviewHeight: 4800000, polarHeight: 1600000,
  overviewMinHeight: 1200000, terrainMinHeight: 150, maxHeight: 11000000, maxMarkers: 26 });
