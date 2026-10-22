import WMTSCapabilities from 'ol/format/WMTSCapabilities';

/** NASA publishes some integer WMTS dimensions as XML decimals (e.g. 2.0).
 * OpenLayers' non-negative-integer parser otherwise drops them, yielding NaN
 * tile-grid extents. Normalize lexical representation, never round dimensions.
 */
export function parseNasaCapabilities(text) {
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('Invalid NASA capabilities XML');
  for (const tag of ['MatrixWidth', 'MatrixHeight', 'TileWidth', 'TileHeight',
    'MinTileCol', 'MaxTileCol', 'MinTileRow', 'MaxTileRow']) {
    for (const node of document.getElementsByTagNameNS('*', tag)) {
      const value = Number(node.textContent);
      const minimum = tag.startsWith('Min') || tag.startsWith('Max') ? 0 : 1;
      if (!node.textContent.trim() || !Number.isSafeInteger(value) || value < minimum) {
        throw new Error(`Invalid NASA tile dimension: ${tag}`);
      }
      node.textContent = String(value);
    }
  }
  return new WMTSCapabilities().read(document);
}
