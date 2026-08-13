/**
 * MoonMap.jsx — OpenLayers map with real NASA WMTS tile layers.
 *
 * Key fix: Use ol/source/WMTS with REST encoding + proper WMTSTileGrid.
 * NASA Moon Trek tiles use {TileMatrix}/{TileRow}/{TileCol} (not {z}/{x}/{y}).
 * The view stays in EPSG:4326 (equirectangular lon/lat).
 */
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

import Map          from 'ol/Map';
import View         from 'ol/View';
import TileLayer    from 'ol/layer/Tile';
import ImageLayer   from 'ol/layer/Image';
import VectorLayer  from 'ol/layer/Vector';
import WMTS         from 'ol/source/WMTS';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import ImageStatic  from 'ol/source/ImageStatic';
import VectorSource from 'ol/source/Vector';
import GeoJSON      from 'ol/format/GeoJSON';
import { Style, Stroke, Circle as CircleStyle, Fill } from 'ol/style';
import Feature      from 'ol/Feature';
import Point        from 'ol/geom/Point';

// ── NASA WMTS tile grid (derived from official WMTSCapabilities.xml) ──────
// Level 0: 2 cols × 1 row, 256px tiles, origin top-left (-180, 90)
// Resolution at level 0: 360° / (2 × 256px) = 0.703125 deg/px
const MOON_RESOLUTIONS = Array.from({ length: 9 }, (_, z) => 0.703125 / Math.pow(2, z));
const MOON_MATRIX_IDS  = MOON_RESOLUTIONS.map((_, z) => String(z));

const moonTileGrid = new WMTSTileGrid({
  extent:      [-180, -90, 180, 90],
  resolutions: MOON_RESOLUTIONS,
  matrixIds:   MOON_MATRIX_IDS,
  tileSize:    256,
});

// ── NASA Moon Trek WMTS sources (REST encoding, no API key required) ──────
// NOTE: The URL template MUST use {TileMatrix}/{TileRow}/{TileCol}
// The double-slash (//) is required by the NASA WMTS REST endpoint.
function makeNASASource(layerName, ext = 'jpg') {
  return new WMTS({
    url: `https://trek.nasa.gov/tiles/Moon/EQ/${layerName}/1.0.0//default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.${ext}`,
    layer:     layerName,
    matrixSet: 'default028mm',
    format:    `image/${ext === 'jpg' ? 'jpeg' : 'png'}`,
    projection: 'EPSG:4326',
    tileGrid:  moonTileGrid,
    style:     'default',
    crossOrigin: 'anonymous',
    requestEncoding: 'REST',
    attributions: '© <a href="https://trek.nasa.gov/">NASA Moon Trek</a>',
  });
}

// ── Simulation overlay bounding box (South Pole region, in lon/lat) ───────
// IMPORTANT: View is EPSG:4326, so coordinates ARE lon/lat — no reprojection!
const BBOX = { lonMin: -10, lonMax: 10, latMin: -90, latMax: -80 };
const OVERLAY_EXTENT = [BBOX.lonMin, BBOX.latMin, BBOX.lonMax, BBOX.latMax];

// ── Layer IDs ─────────────────────────────────────────────────────────────
export const LAYER_IDS = {
  WAC:     'wac',
  LOLA:    'lola',
  ICE:     'ice',
  HAZARD:  'hazard',
  PATH:    'path',
  MARKERS: 'markers',
  CH2:     'ch2',
};

// ── Styles ────────────────────────────────────────────────────────────────
const START_STYLE = new Style({
  image: new CircleStyle({ radius: 9, fill: new Fill({ color: '#00e676' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
});
const GOAL_STYLE = new Style({
  image: new CircleStyle({ radius: 9, fill: new Fill({ color: '#29b6f6' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
});
const PATH_STYLE = new Style({
  stroke: new Stroke({ color: '#69ff47', width: 3, lineDash: [8, 4] }),
});
const CH2_STYLE = new Style({
  stroke: new Stroke({ color: 'rgba(255,107,0,0.7)', width: 1.5 }),
  fill:   new Fill({  color: 'rgba(255,107,0,0.08)' }),
});

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────
const MoonMap = forwardRef(function MoonMap({ layers, onCoordMove, onMapClick }, ref) {
  const mapEl   = useRef(null);
  const mapRef  = useRef(null);
  const layerMap = useRef({});

  useImperativeHandle(ref, () => ({
    addPathLayer(geojson) {
      const src = layerMap.current[LAYER_IDS.PATH]?.getSource();
      if (!src) return;
      src.clear();
      if (geojson?.geometry?.coordinates?.length) {
        const feat = new GeoJSON().readFeature(geojson, {
          featureProjection: 'EPSG:4326',
          dataProjection:    'EPSG:4326',
        });
        src.addFeature(feat);
      }
    },

    addCH2Footprints(fc) {
      const src = layerMap.current[LAYER_IDS.CH2]?.getSource();
      if (!src || !fc?.features?.length) return;
      src.clear();
      const feats = new GeoJSON().readFeatures(fc, {
        featureProjection: 'EPSG:4326',
        dataProjection:    'EPSG:4326',
      });
      src.addFeatures(feats);
    },

    setMarkers(start, goal) {
      const src = layerMap.current[LAYER_IDS.MARKERS]?.getSource();
      if (!src) return;
      src.clear();
      // View is EPSG:4326 — coordinates are already [lon, lat]
      if (start) { const f = new Feature(new Point(start)); f.setStyle(START_STYLE); src.addFeature(f); }
      if (goal)  { const f = new Feature(new Point(goal));  f.setStyle(GOAL_STYLE);  src.addFeature(f); }
    },

    updateOverlays(hazardUrl, iceUrl) {
      const updateImg = (id, url) => {
        layerMap.current[id]?.setSource(new ImageStatic({
          url, imageExtent: OVERLAY_EXTENT, projection: 'EPSG:4326',
        }));
      };
      updateImg(LAYER_IDS.HAZARD, hazardUrl);
      updateImg(LAYER_IDS.ICE,    iceUrl);
    },
  }), []);

  const onCoordMoveRef = useRef(onCoordMove);
  const onMapClickRef  = useRef(onMapClick);

  useEffect(() => { onCoordMoveRef.current = onCoordMove; }, [onCoordMove]);
  useEffect(() => { onMapClickRef.current  = onMapClick;  }, [onMapClick]);

  // ── Build map once on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    // ── Tile layers (NASA WMTS) ────────────────────────────────────
    const wacLayer = new TileLayer({
      source: makeNASASource('LRO_WAC_Mosaic_Global_303ppd_v02', 'jpg'),
    });
    wacLayer.set('id', LAYER_IDS.WAC);

    const lolaLayer = new TileLayer({
      source:  makeNASASource('LRO_LOLA_ClrShade_Global_128ppd_v04', 'png'),
      opacity: 0,
    });
    lolaLayer.set('id', LAYER_IDS.LOLA);

    // ── Image overlays ─────────────────────────────────────────────
    const makeImgLayer = (url, opacity, visible = true) => {
      const lyr = new ImageLayer({
        source: new ImageStatic({ url, imageExtent: OVERLAY_EXTENT, projection: 'EPSG:4326' }),
        opacity,
        visible,
      });
      return lyr;
    };

    const iceLayer    = makeImgLayer('/api/ice-detection', 0.65, true);
    const hazardLayer = makeImgLayer('/api/hazard-map',    0.55, false);
    iceLayer.set('id',    LAYER_IDS.ICE);
    hazardLayer.set('id', LAYER_IDS.HAZARD);

    // ── Vector layers ──────────────────────────────────────────────
    const ch2Layer = new VectorLayer({ source: new VectorSource(), style: CH2_STYLE, visible: false });
    ch2Layer.set('id', LAYER_IDS.CH2);

    const pathLayer = new VectorLayer({ source: new VectorSource(), style: PATH_STYLE });
    pathLayer.set('id', LAYER_IDS.PATH);

    const markerLayer = new VectorLayer({ source: new VectorSource() });
    markerLayer.set('id', LAYER_IDS.MARKERS);

    // ── Map ───────────────────────────────────────────────────────
    const map = new Map({
      target: mapEl.current,
      layers: [wacLayer, lolaLayer, hazardLayer, iceLayer, ch2Layer, pathLayer, markerLayer],
      view: new View({
        projection: 'EPSG:4326',
        center: [0, -85],   // Lunar South Pole in lon/lat
        zoom: 4,
        minZoom: 1,
        maxZoom: 8,
        extent: [-180, -90, 180, 90],
      }),
    });

    mapRef.current = map;
    layerMap.current = {
      [LAYER_IDS.WAC]:     wacLayer,
      [LAYER_IDS.LOLA]:    lolaLayer,
      [LAYER_IDS.ICE]:     iceLayer,
      [LAYER_IDS.HAZARD]:  hazardLayer,
      [LAYER_IDS.CH2]:     ch2Layer,
      [LAYER_IDS.PATH]:    pathLayer,
      [LAYER_IDS.MARKERS]: markerLayer,
    };

    map.on('pointermove', (e) => {
      const [lon, lat] = e.coordinate;
      onCoordMoveRef.current?.({ lon: lon.toFixed(4), lat: lat.toFixed(4) });
    });

    map.on('singleclick', (e) => {
      onMapClickRef.current?.(e.coordinate);   // [lon, lat] directly (EPSG:4326 view)
    });

    return () => { map.setTarget(null); mapRef.current = null; };
  }, []); // eslint-disable-line

  // ── Sync layer visibility ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    Object.entries(layers).forEach(([id, visible]) => {
      const lyr = layerMap.current[id];
      if (!lyr) return;
      if (id === LAYER_IDS.LOLA) lyr.setOpacity(visible ? 0.5 : 0);
      else lyr.setVisible(visible);
    });
  }, [layers]);

  return <div id="moon-map" ref={mapEl} />;
});

export default MoonMap;
