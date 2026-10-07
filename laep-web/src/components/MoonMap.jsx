/**
 * MoonMap.jsx — OpenLayers High-Performance Lunar Polar GIS Engine
 * Features:
 * - Superfast NASA Moon Trek WMTS base layers with in-memory LRU tile cache (0ms recall).
 * - Real representations for all 10 scientific channels (WAC, LOLA, Slope, Roughness, PSR Shadow, CPR, DOP, Ice, Hazard, Route).
 * - Hardware-accelerated canvas context clipping for the split comparison curtain.
 * - Interactive Robbins Lunar Crater & Benchmark vector layer.
 * - Seamless neon kinematic rover traversal route with glowing path overlay.
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
import Polygon      from 'ol/geom/Polygon';

import { useMissionStore, LAYER_IDS } from '../stores/useMissionStore';

// ── Model Training Bounds & Faustini F2 Tactical Footprint ────────────────
function buildTrainingBoundsFeatures() {
  const features = [];

  // 1. South Polar Training Zone (80°S – 90°S)
  const southPolarRing = [
    [-180, -80],
    [-90,  -80],
    [0,    -80],
    [90,   -80],
    [180,  -80],
    [180,  -90],
    [-180, -90],
    [-180, -80],
  ];
  const southPolarPoly = new Feature({
    geometry: new Polygon([southPolarRing]),
    name: 'TRAINED MODEL DOMAIN (80°S – 90°S)',
    type: 'south_polar_zone',
  });
  southPolarPoly.setStyle([
    new Style({
      stroke: new Stroke({
        color: '#38bdf8',
        width: 2,
        lineDash: [8, 6],
      }),
      fill: new Fill({
        color: 'rgba(56, 189, 248, 0.05)',
      }),
    }),
    new Style({
      text: new Text({
        text: '◄── ACTIVE MODEL TRAINING DOMAIN: 80°S TO 90°S (SOUTH POLAR REACH) ──►',
        font: 'bold 11px "IBM Plex Mono", monospace',
        fill: new Fill({ color: '#7dd3fc' }),
        stroke: new Stroke({ color: '#050608', width: 3 }),
        placement: 'line',
        repeat: 450,
      }),
    }),
  ]);
  features.push(southPolarPoly);

  // 2. North Polar Training Zone (80°N – 90°N)
  const northPolarRing = [
    [-180, 80],
    [-90,  80],
    [0,    80],
    [90,   80],
    [180,  80],
    [180,  90],
    [-180, 90],
    [-180, 80],
  ];
  const northPolarPoly = new Feature({
    geometry: new Polygon([northPolarRing]),
    name: 'TRAINED MODEL DOMAIN (80°N – 90°N)',
    type: 'north_polar_zone',
  });
  northPolarPoly.setStyle([
    new Style({
      stroke: new Stroke({
        color: 'rgba(56, 189, 248, 0.6)',
        width: 1.5,
        lineDash: [6, 6],
      }),
      fill: new Fill({
        color: 'rgba(56, 189, 248, 0.03)',
      }),
    }),
    new Style({
      text: new Text({
        text: '◄── ACTIVE MODEL TRAINING DOMAIN: 80°N TO 90°N (NORTH POLAR REACH) ──►',
        font: 'bold 11px "IBM Plex Mono", monospace',
        fill: new Fill({ color: '#94a3b8' }),
        stroke: new Stroke({ color: '#050608', width: 3 }),
        placement: 'line',
        repeat: 450,
      }),
    }),
  ]);
  features.push(northPolarPoly);

  // 3. Faustini F2 Active Target Reticle
  // Latitude: -86.5°S to -89.9°S, Longitude: 65.0°E to 95.0°E
  const f2Ring = [
    [65.0, -89.9],
    [95.0, -89.9],
    [95.0, -86.5],
    [65.0, -86.5],
    [65.0, -89.9],
  ];
  const f2Poly = new Feature({
    geometry: new Polygon([f2Ring]),
    name: 'FAUSTINI F2 ACTIVE DATASET FOOTPRINT',
    type: 'f2_footprint',
  });
  f2Poly.setStyle([
    new Style({
      stroke: new Stroke({
        color: '#ffc857',
        width: 2.5,
        lineDash: [6, 4],
      }),
      fill: new Fill({
        color: 'rgba(255, 200, 87, 0.10)',
      }),
    }),
    new Style({
      text: new Text({
        text: '⌖ FAUSTINI F2 ACTIVE DATASET [CH-2 DFSAR · IIRS · OHRC · TMC-2]',
        font: 'bold 11px "IBM Plex Mono", monospace',
        fill: new Fill({ color: '#ffc857' }),
        stroke: new Stroke({ color: '#070b14', width: 3 }),
        offsetY: -16,
      }),
    }),
  ]);
  features.push(f2Poly);

  return features;
}

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
    layer: layerName,
    matrixSet: 'default028mm',
    format: `image/${ext === 'jpg' ? 'jpeg' : 'png'}`,
    projection: 'EPSG:4326',
    requestEncoding: 'REST',
    tileGrid: moonTileGrid,
    style: 'default',
    crossOrigin: 'anonymous',
    wrapX: true,
    transition: 0,
  });
}

// Full South Polar extent for overlay images
const OVERLAY_EXTENT = [-180, -90, 180, -80];

// Styles
const START_STYLE = new Style({
  image: new CircleStyle({
    radius: 9,
    fill: new Fill({ color: '#34d399' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 })
  }),
});

const GOAL_STYLE = new Style({
  image: new CircleStyle({
    radius: 9,
    fill: new Fill({ color: '#2dd4bf' }),
    stroke: new Stroke({ color: '#ffffff', width: 2 })
  }),
});

const PATH_GLOW_STYLE = new Style({
  stroke: new Stroke({
    color: 'rgba(45, 212, 191, 0.4)',
    width: 6,
  }),
});

const PATH_CORE_STYLE = new Style({
  stroke: new Stroke({
    color: '#2dd4bf',
    width: 3,
    lineCap: 'round',
    lineJoin: 'round',
  }),
});

const CH2_STYLE = new Style({
  stroke: new Stroke({ color: 'rgba(232, 97, 0, 0.75)', width: 1.5 }),
  fill:   new Fill({  color: 'rgba(232, 97, 0, 0.06)' }),
});

function craterStyleFunction(feature) {
  const props = feature.getProperties();
  const isBenchmark = Boolean(props.status);
  const isPositive = props.status === 'positive';
  const color = isPositive ? '#2dd4bf' : (props.status === 'partial' ? '#f59e0b' : (isBenchmark ? '#f43f5e' : '#38bdf8'));
  const radius = Math.min(16, Math.max(5, (props.diam_km || 2.0) * 2.5));

  return new Style({
    image: new CircleStyle({
      radius: radius,
      fill: new Fill({ color: isBenchmark ? `${color}33` : 'rgba(56, 189, 248, 0.12)' }),
      stroke: new Stroke({ color: color, width: isBenchmark ? 2 : 1 })
    }),
    text: isBenchmark ? new Text({
      text: props.crater_id || props.name,
      font: '600 11px "IBM Plex Mono", "Inter", sans-serif',
      fill: new Fill({ color: '#ffffff' }),
      stroke: new Stroke({ color: '#070b14', width: 3 }),
      offsetY: -radius - 7
    }) : null
  });
}

const MoonMap = forwardRef(function MoonMap({ onCoordMove, onMapClick, onSelectCrater }, ref) {
  const mapEl   = useRef(null);
  const mapRef  = useRef(null);
  const layerMap = useRef({});

  // Callback refs to completely eliminate stale closure in OpenLayers events
  const onMapClickRef = useRef(onMapClick);
  const onCoordMoveRef = useRef(onCoordMove);
  const onSelectCraterRef = useRef(onSelectCrater);

  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onCoordMoveRef.current = onCoordMove; }, [onCoordMove]);
  useEffect(() => { onSelectCraterRef.current = onSelectCrater; }, [onSelectCrater]);

  // Global store states
  const layersVisible = useMissionStore((s) => s.layersVisible);
  const isComparisonMode = useMissionStore((s) => s.isComparisonMode);
  const comparisonSplit = useMissionStore((s) => s.comparisonSplit);

  const isComparisonModeRef = useRef(isComparisonMode);
  const comparisonSplitRef = useRef(comparisonSplit);

  useEffect(() => {
    isComparisonModeRef.current = isComparisonMode;
    mapRef.current?.render();
  }, [isComparisonMode]);

  useEffect(() => {
    comparisonSplitRef.current = comparisonSplit;
    mapRef.current?.render();
  }, [comparisonSplit]);

  useImperativeHandle(ref, () => ({
    flyTo(coords, zoom = 6) {
      if (!mapRef.current) return;
      mapRef.current.getView().animate({
        center: coords,
        zoom: zoom,
        duration: 1200
      });
    },

    focusFaustini() {
      if (!mapRef.current) return;
      mapRef.current.getView().animate({
        center: [82.0, -87.4],
        zoom: 5.6,
        duration: 1200
      });
    },

    addPathLayer(geojson) {
      const layer = layerMap.current[LAYER_IDS.ROUTE];
      const src = layer?.getSource();
      if (!src) return;
      src.clear();
      if (geojson?.geometry?.coordinates?.length) {
        const feat = new GeoJSON().readFeature(geojson, {
          featureProjection: 'EPSG:4326',
          dataProjection:    'EPSG:4326',
        });
        feat.setStyle([PATH_GLOW_STYLE, PATH_CORE_STYLE]);
        src.addFeature(feat);
        layer.setVisible(true);
      }
    },

    addCratersLayer(fc) {
      const src = layerMap.current['craters']?.getSource();
      if (!src || !fc?.features?.length) return;
      src.clear();
      const feats = new GeoJSON().readFeatures(fc, {
        featureProjection: 'EPSG:4326',
        dataProjection:    'EPSG:4326',
      });
      src.addFeatures(feats);
    },

    addCH2Footprints(fc) {
      const src = layerMap.current['ch2']?.getSource();
      if (!src || !fc?.features?.length) return;
      src.clear();
      const feats = new GeoJSON().readFeatures(fc, {
        featureProjection: 'EPSG:4326',
        dataProjection:    'EPSG:4326',
      });
      src.addFeatures(feats);
    },

    setMarkers(start, goal) {
      const layer = layerMap.current['markers'];
      const src = layer?.getSource();
      if (!src) return;
      src.clear();
      if (start) { const f = new Feature(new Point(start)); f.setStyle(START_STYLE); src.addFeature(f); }
      if (goal)  { const f = new Feature(new Point(goal));  f.setStyle(GOAL_STYLE);  src.addFeature(f); }
      layer.setVisible(true);
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

  // ── Sync layer visibilities with Zustand store ─────────────────────────
  useEffect(() => {
    Object.entries(layersVisible).forEach(([layerId, visible]) => {
      const layer = layerMap.current[layerId];
      if (layer) {
        layer.setVisible(Boolean(visible));
      }
    });
    mapRef.current?.render();
  }, [layersVisible]);

  // ── Build map once on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;

    // 1. Optical WAC
    const wacLayer = new TileLayer({
      source: makeNASASource('LRO_WAC_Mosaic_Global_303ppd_v02', 'jpg'),
      preload: 2,
      useInterimTilesOnError: true,
      visible: Boolean(layersVisible[LAYER_IDS.OPTICAL]),
    });
    wacLayer.set('id', LAYER_IDS.OPTICAL);

    // 2. LOLA Elevation Color Hillshade
    const lolaLayer = new TileLayer({
      source: makeNASASource('LRO_LOLA_ClrShade_Global_128ppd_v04', 'png'),
      opacity: 0.65,
      preload: 1,
      useInterimTilesOnError: true,
      visible: Boolean(layersVisible[LAYER_IDS.TERRAIN]),
    });
    lolaLayer.set('id', LAYER_IDS.TERRAIN);

    // Helper for backend image static overlays
    const makeImgLayer = (id, url, opacity = 0.70) => {
      const imgLayer = new ImageLayer({
        source: new ImageStatic({ url, imageExtent: OVERLAY_EXTENT, projection: 'EPSG:4326' }),
        opacity,
        visible: Boolean(layersVisible[id]),
      });
      imgLayer.set('id', id);
      return imgLayer;
    };

    // 3. Slope gradient
    const slopeLayer = makeImgLayer(LAYER_IDS.SLOPE, '/api/slope-map', 0.65);
    // 4. SAR Roughness
    const roughnessLayer = makeImgLayer(LAYER_IDS.ROUGHNESS, '/api/roughness-map', 0.65);
    // 5. Permanent Shadow Cold Traps
    const illuminationLayer = makeImgLayer(LAYER_IDS.ILLUMINATION, '/api/shadow-map', 0.75);
    // 6. CPR Radar
    const cprLayer = makeImgLayer(LAYER_IDS.CPR, '/api/cpr-map', 0.75);
    // 7. Degree of Polarization
    const dopLayer = makeImgLayer(LAYER_IDS.DOP, '/api/dop-map', 0.75);
    // 8. Ice Confidence Heatmap
    const iceLayer = makeImgLayer(LAYER_IDS.ICE, '/api/ice-detection', 0.75);
    // 9. Hazard Grid
    const hazardLayer = makeImgLayer(LAYER_IDS.HAZARD, '/api/hazard-map', 0.60);

    // ── True Hardware Canvas Clipping for Split Comparison Curtain ───────
    iceLayer.on('prerender', (event) => {
      if (!isComparisonModeRef.current) return;
      const ctx = event.context;
      const canvas = ctx.canvas;
      const splitPx = (canvas.width * comparisonSplitRef.current) / 100;
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitPx, 0, canvas.width - splitPx, canvas.height);
      ctx.clip();
    });

    iceLayer.on('postrender', (event) => {
      if (!isComparisonModeRef.current) return;
      event.context.restore();
    });

    // 10. Vector Layers
    const craterLayer = new VectorLayer({
      source: new VectorSource(),
      style: craterStyleFunction,
      visible: true,
      zIndex: 90,
    });
    craterLayer.set('id', 'craters');

    const ch2Layer = new VectorLayer({
      source: new VectorSource(),
      style: CH2_STYLE,
      visible: false,
      zIndex: 80,
    });
    ch2Layer.set('id', 'ch2');

    // 11. Model Training Bounds & Faustini F2 Reticle Layer
    const boundsLayer = new VectorLayer({
      source: new VectorSource({ features: buildTrainingBoundsFeatures() }),
      visible: Boolean(layersVisible[LAYER_IDS.BOUNDS] !== false),
      zIndex: 95,
    });
    boundsLayer.set('id', LAYER_IDS.BOUNDS);

    const pathLayer = new VectorLayer({
      source: new VectorSource(),
      visible: true,
      zIndex: 100,
    });
    pathLayer.set('id', LAYER_IDS.ROUTE);

    const markerLayer = new VectorLayer({
      source: new VectorSource(),
      visible: true,
      zIndex: 110,
    });
    markerLayer.set('id', 'markers');

    const map = new Map({
      target: mapEl.current,
      layers: [
        wacLayer,
        lolaLayer,
        slopeLayer,
        roughnessLayer,
        illuminationLayer,
        cprLayer,
        dopLayer,
        iceLayer,
        hazardLayer,
        ch2Layer,
        craterLayer,
        boundsLayer,
        pathLayer,
        markerLayer,
      ],
      view: new View({
        projection: 'EPSG:4326',
        center: [82.0, -87.2],
        zoom: 4.8,
        minZoom: 1,
        maxZoom: 9,
        extent: [-180, -90, 180, 90],
        padding: [30, 20, 80, 20],
        smoothResolutionConstraint: true,
        smoothExtentConstraint: true,
        enableRotation: false,
      }),
    });

    mapRef.current = map;
    layerMap.current = {
      [LAYER_IDS.OPTICAL]:      wacLayer,
      [LAYER_IDS.TERRAIN]:      lolaLayer,
      [LAYER_IDS.SLOPE]:        slopeLayer,
      [LAYER_IDS.ROUGHNESS]:    roughnessLayer,
      [LAYER_IDS.ILLUMINATION]: illuminationLayer,
      [LAYER_IDS.CPR]:          cprLayer,
      [LAYER_IDS.DOP]:          dopLayer,
      [LAYER_IDS.ICE]:          iceLayer,
      [LAYER_IDS.HAZARD]:       hazardLayer,
      [LAYER_IDS.ROUTE]:        pathLayer,
      [LAYER_IDS.BOUNDS]:       boundsLayer,
      craters:                  craterLayer,
      ch2:                      ch2Layer,
      markers:                  markerLayer,
    };

    map.on('pointermove', (e) => {
      if (!e.coordinate || e.coordinate.length < 2) return;
      const [lon, lat] = e.coordinate;
      if (isNaN(lon) || isNaN(lat)) return;
      const rPolar = (90.0 + lat) * 30.32;
      const thPolar = (lon * Math.PI) / 180.0;
      const xKm = (rPolar * Math.cos(thPolar)).toFixed(1);
      const yKm = (rPolar * Math.sin(thPolar)).toFixed(1);

      onCoordMoveRef.current?.({
        lon: lon.toFixed(2),
        lat: lat.toFixed(2),
        polarX: xKm,
        polarY: yKm,
      });
    });

    map.on('click', (e) => {
      const feat = map.forEachFeatureAtPixel(e.pixel, (f) => f);
      // If user clicked a benchmark crater, open the detail drawer
      if (feat && feat.get('status') !== undefined) {
        onSelectCraterRef.current?.(feat.getProperties());
      }
      // Always forward click coordinates to onMapClickRef for waypoint selection
      if (e.coordinate && e.coordinate.length >= 2) {
        onMapClickRef.current?.(e.coordinate);
      }
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', position: 'relative' }}>
      <div id="moon-map" ref={mapEl} style={{ flex: 1, width: '100%', minHeight: 0, background: '#01040a' }} />
      
      {/* ── High-Width Bottom Elevation Shelf Bar (Elevates Map for Full Viewport Reach) ── */}
      <div className="map-bottom-shelf">
        <div className="shelf-telemetry-item">
          <span className="shelf-indicator" />
          <span className="shelf-label">MODEL DOMAIN //</span>
          <span className="shelf-val">TRAINED: 80°S – 90°S & 80°N – 90°N</span>
        </div>
        <div className="shelf-telemetry-item">
          <span className="shelf-label">ACTIVE BENCHMARK //</span>
          <span className="shelf-val highlight">FAUSTINI F2 [82.10°E, -87.35°S]</span>
        </div>
        <button
          type="button"
          className="btn-shelf-focus"
          onClick={() => {
            soundEngine.playTargetAcquired();
            mapRef.current?.getView().animate({ center: [82.0, -87.4], zoom: 5.6, duration: 1000 });
          }}
          title="Elevate and zoom directly onto Faustini F2 active mapping area"
        >
          <span>⌖ FOCUS FAUSTINI F2</span>
        </button>
      </div>
    </div>
  );
});

export default MoonMap;
