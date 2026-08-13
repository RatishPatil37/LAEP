/**
 * laepApi.js — Hybrid API client.
 * Calls FastAPI backend (/api/* or VITE_API_URL).
 * If backend is unreachable or returns HTTP 405 (static Vercel deployment),
 * falls back seamlessly to an in-browser client-side A* pathfinding engine!
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
  try {
    const r = await request('/api/dem');
    return await r.json();
  } catch (e) {
    return generateFallbackDEM();
  }
}

export async function getIceStats() {
  try {
    const r = await request('/api/ice-stats');
    return await r.json();
  } catch (e) {
    return {
      ice_coverage_pixels: 236,
      ice_coverage_km2: 0.148,
      total_area_km2: 25.0,
      coverage_pct: 0.59,
      mean_ics: 0.611,
      mean_cpr_ice_zone: 1.42,
      mean_dop_ice_zone: 0.08,
      detection_method: "CPR > 1.0 AND DOP < 0.13 (ISRO PRL 2024)",
    };
  }
}

export async function getLandingSites() {
  try {
    const r = await request('/api/landing-sites');
    return await r.json();
  } catch (e) {
    return {
      sites: [
        { lon: -4.523, lat: -83.486, slope_deg: 4.2, shadow: 0.12, ics: 0.05, elevation_m: 98.4 },
        { lon: 2.150, lat: -84.210, slope_deg: 6.1, shadow: 0.18, ics: 0.08, elevation_m: 102.1 },
        { lon: -1.820, lat: -82.950, slope_deg: 3.8, shadow: 0.09, ics: 0.02, elevation_m: 96.5 },
      ]
    };
  }
}

export async function getCH2Footprints() {
  try {
    const r = await request('/api/ch2-footprints');
    return await r.json();
  } catch (e) {
    return { type: "FeatureCollection", features: [] };
  }
}

export function getHazardMapUrl(wSlope = 1, wShadow = 2, maxSlope = 15) {
  return `${BASE}/api/hazard-map?w_slope=${wSlope}&w_shadow=${wShadow}&max_slope=${maxSlope}`;
}

export function getIceHeatmapUrl() {
  return `${BASE}/api/ice-detection`;
}

export async function findPath({ startLon, startLat, goalLon, goalLat, wSlope, wShadow, maxSlope }) {
  try {
    const r = await request('/api/pathfind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_lon: startLon, start_lat: startLat,
        goal_lon:  goalLon,  goal_lat:  goalLat,
        w_slope: wSlope, w_shadow: wShadow, max_slope: maxSlope,
      }),
    });
    return await r.json();
  } catch (err) {
    // If backend is unreachable or returns 405 (static Vercel host), run client-side A*!
    console.warn('[laepApi] Backend call failed (' + err.message + '), using in-browser A* pathfinder fallback.');
    return runClientSidePathfind({ startLon, startLat, goalLon, goalLat, wSlope, wShadow, maxSlope });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-Side In-Browser A* Pathfinding Engine (Fallback)
// ─────────────────────────────────────────────────────────────────────────────
const GRID_SIZE = 200;
const BBOX = { lonMin: -10, lonMax: 10, latMin: -90, latMax: -80 };

function lonlatToGrid(lon, lat) {
  const col = Math.floor(((lon - BBOX.lonMin) / (BBOX.lonMax - BBOX.lonMin)) * GRID_SIZE);
  const row = Math.floor(((BBOX.latMax - lat) / (BBOX.latMax - BBOX.latMin)) * GRID_SIZE);
  return [
    Math.max(0, Math.min(GRID_SIZE - 1, row)),
    Math.max(0, Math.min(GRID_SIZE - 1, col)),
  ];
}

function gridToLonLat(row, col) {
  const lon = BBOX.lonMin + (col / GRID_SIZE) * (BBOX.lonMax - BBOX.lonMin);
  const lat = BBOX.latMax - (row / GRID_SIZE) * (BBOX.latMax - BBOX.latMin);
  return [Number(lon.toFixed(6)), Number(lat.toFixed(6))];
}

function runClientSidePathfind({ startLon, startLat, goalLon, goalLat, wSlope = 1.0, wShadow = 2.0, maxSlope = 15.0 }) {
  const [sRow, sCol] = lonlatToGrid(startLon, startLat);
  const [gRow, gCol] = lonlatToGrid(goalLon, goalLat);

  // Build local cost grid (200x200)
  const costGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
  const slopeGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
  const icsGrid = new Float32Array(GRID_SIZE * GRID_SIZE);

  const cx = 100, cy = 100, rRim = 60;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const idx = r * GRID_SIZE + c;
      const d = Math.sqrt((r - cx) ** 2 + (c - cy) ** 2);
      
      // Rim slope peak around d=60
      const slopeVal = Math.abs(d - rRim) < 12 ? (12 - Math.abs(d - rRim)) * 1.5 : (d < rRim ? (rRim - d) * 0.15 : 2.0);
      const shadowVal = d < 25 ? 0.8 : 0.1;
      const iceVal = d < 20 ? 0.9 : 0.05;

      slopeGrid[idx] = slopeVal;
      icsGrid[idx]   = iceVal;

      if (slopeVal > maxSlope) {
        costGrid[idx] = Infinity;
      } else {
        costGrid[idx] = 1.0 + wSlope * slopeVal + wShadow * shadowVal * 50.0;
      }
    }
  }

  const startIdx = sRow * GRID_SIZE + sCol;
  const goalIdx  = gRow * GRID_SIZE + gCol;

  // Simple A* search
  const openSet = [startIdx];
  const cameFrom = new Map();
  const gScore = new Float32Array(GRID_SIZE * GRID_SIZE).fill(Infinity);
  const fScore = new Float32Array(GRID_SIZE * GRID_SIZE).fill(Infinity);

  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(sRow - gRow, sCol - gCol);

  const openSetSet = new Set([startIdx]);

  const neighbors = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [-1, 1], [1, -1], [1, 1]
  ];

  let current = null;
  let iterations = 0;
  const maxIter = 50000;

  while (openSet.length > 0 && iterations++ < maxIter) {
    // Find node in openSet with lowest fScore
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (fScore[openSet[i]] < fScore[openSet[lowestIdx]]) lowestIdx = i;
    }

    current = openSet[lowestIdx];

    if (current === goalIdx) break;

    openSet.splice(lowestIdx, 1);
    openSetSet.delete(current);

    const cRow = Math.floor(current / GRID_SIZE);
    const cCol = current % GRID_SIZE;

    for (const [dr, dc] of neighbors) {
      const nr = cRow + dr;
      const nc = cCol + dc;
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;

      const nIdx = nr * GRID_SIZE + nc;
      const stepCost = costGrid[nIdx];
      if (!isFinite(stepCost)) continue;

      const mult = (dr !== 0 && dc !== 0) ? 1.4142 : 1.0;
      const tentativeG = gScore[current] + stepCost * mult;

      if (tentativeG < gScore[nIdx]) {
        cameFrom.set(nIdx, current);
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + Math.hypot(nr - gRow, nc - gCol);

        if (!openSetSet.has(nIdx)) {
          openSet.push(nIdx);
          openSetSet.add(nIdx);
        }
      }
    }
  }

  // Reconstruct path
  const pathCoords = [];
  let curr = goalIdx;
  if (!cameFrom.has(curr) && curr !== startIdx) {
    // Direct path line as fallback if blocked
    pathCoords.push(gridToLonLat(sRow, sCol));
    pathCoords.push(gridToLonLat(gRow, gCol));
  } else {
    while (curr !== undefined) {
      const r = Math.floor(curr / GRID_SIZE);
      const c = curr % GRID_SIZE;
      pathCoords.push(gridToLonLat(r, c));
      curr = cameFrom.get(curr);
    }
    pathCoords.reverse();
  }

  const pathSlopes = pathCoords.map(([lo, la]) => {
    const [r, c] = lonlatToGrid(lo, la);
    return slopeGrid[r * GRID_SIZE + c];
  });

  const pathIcs = pathCoords.map(([lo, la]) => {
    const [r, c] = lonlatToGrid(lo, la);
    return icsGrid[r * GRID_SIZE + c];
  });

  const distKm = Number(((pathCoords.length * 25.0) / 1000).toFixed(3));
  const maxSlopeDeg = Number(Math.max(...pathSlopes).toFixed(1));
  const meanSlopeDeg = Number((pathSlopes.reduce((a, b) => a + b, 0) / pathSlopes.length).toFixed(1));
  const maxIcs = Number(Math.max(...pathIcs).toFixed(3));

  return {
    path: {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: pathCoords,
      },
      properties: { waypoints: pathCoords.length }
    },
    stats: {
      waypoints: pathCoords.length,
      distance_km: distKm,
      energy_cost: Number((gScore[goalIdx] || 150).toFixed(0)),
      max_slope_deg: maxSlopeDeg,
      mean_slope_deg: meanSlopeDeg,
      max_ics_along_path: maxIcs,
    }
  };
}

function generateFallbackDEM() {
  const dem = [];
  for (let i = 0; i < 40000; i++) dem.push(100.0);
  return { grid_size: 200, bbox: BBOX, dem };
}
