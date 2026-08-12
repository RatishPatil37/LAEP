/**
 * laepApi.js — All API calls to the FastAPI backend.
 * The Vite proxy forwards /api/* to http://localhost:8000 in dev.
 */
const BASE = import.meta.env.VITE_API_URL ?? '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); detail = j.detail ?? detail; } catch {}
    throw new Error(detail);
  }
  return res;
}

export async function getDEM() {
  const r = await request('/api/dem');
  return r.json();
}

export async function getIceStats() {
  const r = await request('/api/ice-stats');
  return r.json();
}

export async function getLandingSites() {
  const r = await request('/api/landing-sites');
  return r.json();
}

export async function getCH2Footprints() {
  const r = await request('/api/ch2-footprints');
  return r.json();
}

/**
 * Returns a URL string for use as an <img> src or OL ImageLayer.
 * Query params control the hazard map appearance.
 */
export function getHazardMapUrl(wSlope = 1, wShadow = 2, maxSlope = 15) {
  return `${BASE}/api/hazard-map?w_slope=${wSlope}&w_shadow=${wShadow}&max_slope=${maxSlope}`;
}

export function getIceHeatmapUrl() {
  return `${BASE}/api/ice-detection`;
}

export async function findPath({ startLon, startLat, goalLon, goalLat, wSlope, wShadow, maxSlope }) {
  const r = await request('/api/pathfind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_lon: startLon, start_lat: startLat,
      goal_lon:  goalLon,  goal_lat:  goalLat,
      w_slope: wSlope, w_shadow: wShadow, max_slope: maxSlope,
    }),
  });
  return r.json();
}
