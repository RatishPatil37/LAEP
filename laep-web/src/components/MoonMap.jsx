/**
 * MoonMap.jsx — OpenLayers interactive Lunar Map.
 * Features:
 * - NASA Moon Trek WMTS base layers (LRO WAC & LOLA color hillshade).
 * - Chandrayaan-2 DFSAR CPR & Ice confidence heatmaps.
 * - Interactive Robbins Lunar Crater & Benchmark vector layer with tooltips.
 * - Seamless, glowing neon LineString rover route with zero-gap waypoint joining.
 * - Smooth camera flyTo animations.
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
import { Style, Stroke, Circle as CircleStyle, Fill, Text } from 'ol/style';
import Feature      from 'ol/Feature';
import Point        from 'ol/geom/Point';

// ── NASA WMTS Tile Grid (EPSG:4326) ───────────────────────────────────────
const MOON_RESOLUTIONS = Array.from({ length: 9 }, (_, z) => 0.703125 / Math.pow(2, z));
const MOON_MATRIX_IDS  = MOON_RESOLUTIONS.map((_, z) => String(z));

const moonTileGrid = new WMTSTileGrid({
  extent:      [-180, -90, 180, 90],
  resolutions: MOON_RESOLUTIONS,
  matrixIds:   MOON_MATRIX_IDS,
  tileSize:    256,
});

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
    attributions: '© NASA Moon Trek / LRO / LOLA',
  });
}

// ── Simulation Overlay Extent ─────────────────────────────────────────────
const BBOX = { lonMin: -10, lonMax: 10, latMin: -90, latMax: -80 };
const OVERLAY_EXTENT = [BBOX.lonMin, BBOX.latMin, BBOX.lonMax, BBOX.latMax];

// ── Layer IDs ─────────────────────────────────────────────────────────────
export const LAYER_IDS = {
  WAC:     'wac',
  LOLA:    'lola',
  ICE:     'ice',
  HAZARD:  'hazard',
  CRATERS: 'craters',
  CH2:     'ch2',
  PATH:    'path',
  MARKERS: 'markers',
};

// ── Styles ────────────────────────────────────────────────────────────────
const START_STYLE = new Style({
  image: new CircleStyle({
    radius: 9,
    fill: new Fill({ color: '#00e676' }),
    stroke: new Stroke({ color: '#ffffff', width: 2.5 })
  }),
});

const GOAL_STYLE = new Style({
  image: new CircleStyle({
    radius: 9,
    fill: new Fill({ color: '#00ffcc' }),
    stroke: new Stroke({ color: '#ffffff', width: 2.5 })
  }),
});

// Dual Glowing Route Line Styles
const PATH_GLOW_STYLE = new Style({
  stroke: new Stroke({
    color: 'rgba(0, 255, 204, 0.45)',
    width: 7,
  }),
});

const PATH_CORE_STYLE = new Style({
  stroke: new Stroke({
    color: '#00ffcc',
    width: 3.5,
    lineCap: 'round',
    lineJoin: 'round',
  }),
});

const CH2_STYLE = new Style({
  stroke: new Stroke({ color: 'rgba(255, 107, 0, 0.75)', width: 1.8 }),
  fill:   new Fill({  color: 'rgba(255, 107, 0, 0.08)' }),
});

function craterStyleFunction(feature) {
  const props = feature.getProperties();
  const isBenchmark = Boolean(props.status);
  const isPositive = props.status === 'positive';
  const color = isPositive ? '#00ffcc' : (props.status === 'partial' ? '#ffd740' : (isBenchmark ? '#ff5252' : '#29b6f6'));
  const radius = Math.min(18, Math.max(5, (props.diam_km || 2.0) * 2.5));

  return new Style({
    image: new CircleStyle({
      radius: radius,
      fill: new Fill({ color: isBenchmark ? `${color}33` : 'rgba(41, 182, 246, 0.15)' }),
      stroke: new Stroke({ color: color, width: isBenchmark ? 2.5 : 1.2 })
    }),
    text: isBenchmark ? new Text({
      text: props.crater_id || props.name,
      font: 'bold 11px Orbitron, sans-serif',
      fill: new Fill({ color: '#ffffff' }),
      stroke: new Stroke({ color: '#050811', width: 3 }),
      offsetY: -radius - 8
    }) : null
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────
const MoonMap = forwardRef(function MoonMap({ layers, onCoordMove, onMapClick, onSelectCrater }, ref) {
  const mapEl   = useRef(null);
  const mapRef  = useRef(null);
  const layerMap = useRef({});

  useImperativeHandle(ref, () => ({
    flyTo(coords, zoom = 6) {
      if (!mapRef.current) return;
      mapRef.current.getView().animate({
        center: coords,
        zoom: zoom,
        duration: 1200
      });
    },

    addPathLayer(geojson) {
      const src = layerMap.current[LAYER_IDS.PATH]?.getSource();
      if (!src) return;
      src.clear();
      if (geojson?.geometry?.coordinates?.length) {
        const feat = new GeoJSON().readFeature(geojson, {
          featureProjection: 'EPSG:4326',
          dataProjection:    'EPSG:4326',
        });
        feat.setStyle([PATH_GLOW_STYLE, PATH_CORE_STYLE]);
        src.addFeature(feat);
      }
    },

    addCratersLayer(fc) {
      const src = layerMap.current[LAYER_IDS.CRATERS]?.getSource();
      if (!src || !fc?.features?.length) return;
      src.clear();
      const feats = new GeoJSON().readFeatures(fc, {
        featureProjection: 'EPSG:4326',
        dataProjection:    'EPSG:4326',
      });
      src.addFeatures(feats);
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
  const onSelectCraterRef = useRef(onSelectCrater);

  useEffect(() => { onCoordMoveRef.current = onCoordMove; }, [onCoordMove]);
  useEffect(() => { onMapClickRef.current  = onMapClick;  }, [onMapClick]);
  useEffect(() => { onSelectCraterRef.current = onSelectCrater; }, [onSelectCrater]);

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
      return new ImageLayer({
        source: new ImageStatic({ url, imageExtent: OVERLAY_EXTENT, projection: 'EPSG:4326' }),
        opacity,
        visible,
      });
    };

    const iceLayer    = makeImgLayer('/api/ice-detection', 0.70, true);
    const hazardLayer = makeImgLayer('/api/hazard-map',    0.55, false);
    iceLayer.set('id',    LAYER_IDS.ICE);
    hazardLayer.set('id', LAYER_IDS.HAZARD);

    // ── Vector layers ──────────────────────────────────────────────
    const craterLayer = new VectorLayer({
      source: new VectorSource(),
      style: craterStyleFunction,
      visible: true
    });
    craterLayer.set('id', LAYER_IDS.CRATERS);

    const ch2Layer = new VectorLayer({ source: new VectorSource(), style: CH2_STYLE, visible: false });
    ch2Layer.set('id', LAYER_IDS.CH2);

    const pathLayer = new VectorLayer({ source: new VectorSource() });
    pathLayer.set('id', LAYER_IDS.PATH);

    const markerLayer = new VectorLayer({ source: new VectorSource() });
    markerLayer.set('id', LAYER_IDS.MARKERS);

    // ── Map ───────────────────────────────────────────────────────
    const map = new Map({
      target: mapEl.current,
      layers: [wacLayer, lolaLayer, hazardLayer, iceLayer, craterLayer, ch2Layer, pathLayer, markerLayer],
      view: new View({
        projection: 'EPSG:4326',
        center: [0, -85],   // Lunar South Pole in lon/lat
        zoom: 4,
        minZoom: 1,
        maxZoom: 9,
        extent: [-180, -90, 180, 90],
      }),
    });

    mapRef.current = map;
    layerMap.current = {
      [LAYER_IDS.WAC]:     wacLayer,
      [LAYER_IDS.LOLA]:    lolaLayer,
      [LAYER_IDS.ICE]:     iceLayer,
      [LAYER_IDS.HAZARD]:  hazardLayer,
      [LAYER_IDS.CRATERS]: craterLayer,
      [LAYER_IDS.CH2]:     ch2Layer,
      [LAYER_IDS.PATH]:    pathLayer,
      [LAYER_IDS.MARKERS]: markerLayer,
    };

    map.on('pointermove', (e) => {
      const [lon, lat] = e.coordinate;
      // Convert to Polar Stereographic X, Y (km offset)
      const rPolar = (90.0 + lat) * 30.32; // km per deg
      const thPolar = (lon * Math.PI) / 180.0;
      const xKm = (rPolar * Math.cos(thPolar)).toFixed(1);
      const yKm = (rPolar * Math.sin(thPolar)).toFixed(1);

      onCoordMoveRef.current?.({
        lon: lon.toFixed(4),
        lat: lat.toFixed(4),
        polarX: xKm,
        polarY: yKm
      });
    });

    map.on('singleclick', (e) => {
      // Check if user clicked a crater feature
      const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f);
      if (feature && feature.get('crater_id')) {
        onSelectCraterRef.current?.(feature.getProperties());
      }
      onMapClickRef.current?.(e.coordinate);
    });

    return () => { map.setTarget(null); mapRef.current = null; };
  }, []); // eslint-disable-line

  // ── Sync layer visibility ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    Object.entries(layers).forEach(([id, visible]) => {
      const lyr = layerMap.current[id];
      if (!lyr) return;
      if (id === LAYER_IDS.LOLA) lyr.setOpacity(visible ? 0.55 : 0);
      else lyr.setVisible(visible);
    });
  }, [layers]);

  return <div id="moon-map" ref={mapEl} />;
});

export default MoonMap;
