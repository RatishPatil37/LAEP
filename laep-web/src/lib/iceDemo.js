/** Pure display helpers. Scores are model outputs, never measured ice abundance. */
export function scoreColor(score, alpha = 1) {
  const t = Math.min(1, Math.max(0, score));
  return `rgba(${Math.round(219 - 190 * t)},${Math.round(234 - 156 * t)},${Math.round(254 - 38 * t)},${alpha})`;
}

export async function loadDemo(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Prediction product unavailable (HTTP ${response.status}).`);
  const data = await response.json();
  if (data.schema_version !== 1 || !Array.isArray(data.samples) || !data.model?.sha256
    || !Array.isArray(data.model.features) || !Array.isArray(data.model.classes)
    || !data.source?.sha256 || !data.source?.file || !data.lfm?.reason
    || !Array.isArray(data.limitations)
    || !Number.isInteger(data.counts?.eligible) || !Number.isInteger(data.counts?.unobserved)) {
    throw new Error('Invalid prediction manifest. No scientific fallback will be substituted.');
  }
  if (new Set(data.samples.map(s => s.id)).size !== data.samples.length
    || data.samples.some(s => typeof s.id !== 'string' || !Array.isArray(s.qc)
    || !Number.isFinite(s.lon) || !Number.isFinite(s.lat)
    || Math.abs(s.lon) > 180 || Math.abs(s.lat) > 90
    || (s.score !== null && (!Number.isFinite(s.score) || s.score < 0 || s.score > 1)))) {
    throw new Error('Invalid coordinates or scores in prediction product.');
  }
  return data;
}
