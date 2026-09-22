/**
 * crater.js — Lunar Crater Formatting & Nomenclature Utilities
 * Standardizes IAU nomenclature and peer-reviewed benchmark crater identifiers.
 */

export function displayCraterName(name) {
  if (!name) return 'Unknown Crater';
  const clean = String(name).trim();
  // Capitalize each word properly
  return clean.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatCraterCoordinates(lon, lat) {
  const lonNum = Number(lon);
  const latNum = Number(lat);
  if (isNaN(lonNum) || isNaN(latNum)) return '—';
  const lonDir = lonNum >= 0 ? 'E' : 'W';
  const latDir = latNum >= 0 ? 'N' : 'S';
  return `${Math.abs(latNum).toFixed(2)}°${latDir}, ${Math.abs(lonNum).toFixed(2)}°${lonDir}`;
}
