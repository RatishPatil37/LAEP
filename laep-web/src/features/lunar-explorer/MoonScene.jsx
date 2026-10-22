import { useEffect, useRef } from 'react';
import * as C from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { VIEW } from './catalog';

/** Owns one viewer. No global ellipsoid mutation; safe across route changes and StrictMode. */
export default function MoonScene({ features, selected, destination, labels, onSelect, onHover, onState, sceneApi }) {
  const host = useRef(null);
  const current = useRef({ features, selected, labels, onSelect, onHover, onState });
  current.current = { features, selected, labels, onSelect, onHover, onState, destination };
  const runtime = useRef(null);

  useEffect(() => {
    let disposed = false;
    let viewer;
    let handler;
    let stopCamera;
    let stopError;
    let stopPendingMarkers;
    let failed = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ellipsoid = C.Ellipsoid.MOON;
    const state = value => !disposed && current.current.onState(value);
    const position = feature => C.Cartesian3.fromDegrees(feature.longitude, feature.latitude, 0, ellipsoid);
    const destroy = () => {
      disposed = true;
      stopCamera?.(); stopError?.();
      stopPendingMarkers?.();
      handler?.destroy();
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      runtime.current = null;
      sceneApi.current = null;
    };
    try {
      viewer = new C.Viewer(host.current, {
        ellipsoid, globe: new C.Globe(ellipsoid), mapProjection: new C.GeographicProjection(ellipsoid),
        terrainProvider: new C.EllipsoidTerrainProvider({ ellipsoid }),
        baseLayer: false, animation: false, timeline: false, geocoder: false,
        baseLayerPicker: false, sceneModePicker: false, navigationHelpButton: false,
        homeButton: false, fullscreenButton: false, selectionIndicator: false, infoBox: false,
        skyAtmosphere: false, skyBox: false, sun: false, moon: false,
        requestRenderMode: true, maximumRenderTimeChange: Infinity, showRenderLoopErrors: false,
        contextOptions: { webgl: { alpha: false, powerPreference: 'default' } },
      });
      viewer.resolutionScale = window.innerWidth < 600 ? 0.85 : 1;
      viewer.scene.backgroundColor = C.Color.fromCssColorString('#05080d');
      viewer.scene.globe.baseColor = C.Color.fromCssColorString('#8b8f96');
      viewer.scene.globe.enableLighting = false;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = VIEW.overviewMinHeight;
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = VIEW.maxHeight;
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
      viewer.scene.screenSpaceCameraController.enableTilt = false;
      viewer.scene.screenSpaceCameraController.enableLook = false;
      viewer.cesiumWidget.creditContainer.style.fontSize = '10px';
      const rt = { viewer, terrain: false, updateMarkers: null, focus: null };
      runtime.current = rt;

      const updateMarkers = () => {
        if (disposed || failed) return;
        viewer.entities.removeAll();
        if (!current.current.labels && !current.current.selected) return;
        const occluder = new C.EllipsoidalOccluder(ellipsoid, viewer.camera.positionWC);
        const candidates = current.current.features.filter(f => current.current.labels || f.id === current.current.selected?.id)
          .sort((a, b) => Number(b.id === current.current.selected?.id) - Number(a.id === current.current.selected?.id) || (b.diameterKm || 0) - (a.diameterKm || 0));
        const occupied = [];
        let count = 0;
        for (const f of candidates) {
          const p = position(f);
          if (!occluder.isPointVisible(p)) continue;
          const screen = viewer.scene.cartesianToCanvasCoordinates(p);
          if (!screen || screen.x < 12 || screen.y < 85 || screen.x > host.current.clientWidth - 24 || screen.y > host.current.clientHeight - 110) continue;
          // Approximate rendered text bounds rather than grid cells: adjacent cells can still overlap.
          const bounds = { left: screen.x - 8, top: screen.y - 30,
            right: screen.x + 18 + f.name.length * 7, bottom: screen.y + 14 };
          if (occupied.some(b => bounds.left < b.right && bounds.right > b.left && bounds.top < b.bottom && bounds.bottom > b.top)) continue;
          occupied.push(bounds);
          const active = f.id === current.current.selected?.id;
          viewer.entities.add({ id: f.id, position: p, properties: { featureId: f.id },
            point: { pixelSize: active ? 11 : 5, color: C.Color.fromCssColorString(active ? '#bceaff' : '#c0ced8'),
              outlineColor: C.Color.fromCssColorString('#162333'), outlineWidth: active ? 3 : 1,
              heightReference: rt.terrain ? C.HeightReference.CLAMP_TO_3D_TILE : C.HeightReference.NONE },
            label: { text: f.name, font: `${active ? 600 : 400} 12px sans-serif`,
              fillColor: C.Color.fromCssColorString(active ? '#dbf5ff' : '#d2dce5'),
              style: C.LabelStyle.FILL_AND_OUTLINE, outlineColor: C.Color.BLACK, outlineWidth: 3,
              pixelOffset: new C.Cartesian2(10, -10), horizontalOrigin: C.HorizontalOrigin.LEFT,
              heightReference: rt.terrain ? C.HeightReference.CLAMP_TO_3D_TILE : C.HeightReference.NONE },
          });
          if (++count >= (window.innerWidth < 600 ? 14 : viewer.camera.positionCartographic.height < 2500000 ? 18 : VIEW.maxMarkers)) break;
        }
        viewer.scene.requestRender();
      };
      const scheduleMarkers = () => {
        stopPendingMarkers?.();
        stopPendingMarkers = viewer.scene.postRender.addEventListener(() => {
          stopPendingMarkers?.(); stopPendingMarkers = null;
          updateMarkers();
        });
        viewer.scene.requestRender();
      };
      rt.updateMarkers = scheduleMarkers;
      rt.focus = (view, feature) => {
        viewer.camera.cancelFlight();
        const target = feature || { longitude: 0, latitude: view === 'south' ? -89.8 : 12 };
        const height = feature ? Math.max(rt.terrain ? VIEW.terrainMinHeight * 10 : VIEW.overviewMinHeight,
          (feature.diameterKm || 40) * 2400) : view === 'south' ? VIEW.polarHeight : VIEW.overviewHeight;
        viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(target.longitude, target.latitude, height, ellipsoid),
          orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
          duration: reducedMotion.matches ? 0 : 1.7, complete: scheduleMarkers });
      };
      sceneApi.current = { zoom: factor => {
        viewer.camera.cancelFlight();
        const height = viewer.camera.positionCartographic.height;
        const minimum = rt.terrain ? VIEW.terrainMinHeight : VIEW.overviewMinHeight;
        const next = Math.min(VIEW.maxHeight, Math.max(minimum, height * factor));
        viewer.camera.moveForward(height - next); scheduleMarkers();
      } };
      stopCamera = viewer.camera.moveEnd.addEventListener(scheduleMarkers);
      stopError = viewer.scene.renderError.addEventListener(() => {
        failed = true;
        viewer.useDefaultRenderLoop = false;
        state({ kind: 'error', message: 'The graphics context could not continue. The feature catalog is still available.' });
      });
      handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction(event => {
        const picked = viewer.scene.pick(event.position);
        const feature = current.current.features.find(f => f.id === picked?.id?.id);
        if (feature) current.current.onSelect(feature);
      }, C.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction(event => {
        const picked = viewer.scene.pick(event.endPosition);
        const feature = current.current.features.find(f => f.id === picked?.id?.id);
        viewer.scene.canvas.style.cursor = feature ? 'pointer' : 'grab';
        current.current.onHover(feature || null);
      }, C.ScreenSpaceEventType.MOUSE_MOVE);
      rt.focus(destination.view, current.current.selected);

      (async () => {
        try {
          const url = import.meta.env.VITE_LUNAR_TILESET_URL;
          const token = import.meta.env.VITE_CESIUM_ION_TOKEN;
          const asset = import.meta.env.VITE_CESIUM_MOON_ASSET_ID;
          if (url || (token && asset)) {
            state({ kind: 'loading', message: 'Connecting lunar terrain…' });
            if (!url && (!/^\d+$/.test(asset) || Number(asset) <= 0)) throw new Error('Invalid asset ID');
            const tiles = url ? await C.Cesium3DTileset.fromUrl(url) :
              await C.Cesium3DTileset.fromIonAssetId(Number(asset), { accessToken: token });
            if (disposed) { tiles.destroy(); return; }
            tiles.maximumScreenSpaceError = window.innerWidth < 600 ? 12 : 6;
            viewer.scene.primitives.add(tiles);
            viewer.scene.globe.show = false;
            rt.terrain = true;
            viewer.scene.screenSpaceCameraController.minimumZoomDistance = VIEW.terrainMinHeight;
            viewer.scene.screenSpaceCameraController.enableTilt = true;
            tiles.tileFailed.addEventListener(() => state({ kind: 'warning', message: 'Some terrain tiles failed to load. Surface detail may be incomplete.' }));
            state({ kind: 'terrain', message: 'Streamed lunar terrain · source-dependent resolution' });
            rt.focus(current.current.destination.view, current.current.selected);
          } else {
            state({ kind: 'loading', message: 'Preparing the global overview…' });
            const imagery = await C.SingleTileImageryProvider.fromUrl(`${import.meta.env.BASE_URL}data/lunar/lroc_color_2k.jpg`, {
              rectangle: C.Rectangle.MAX_VALUE,
              credit: new C.Credit('<a href="https://svs.gsfc.nasa.gov/4720/">NASA SVS / LRO CGI Moon Kit</a> · visualization only; polar albedo fill; not terrain', true),
              ellipsoid,
            });
            if (disposed) return;
            viewer.imageryLayers.addImageryProvider(imagery);
            state({ kind: 'overview', message: 'Overview only · connect terrain for surface-level exploration' });
          }
          scheduleMarkers();
        } catch {
          state({ kind: 'error', message: 'Lunar imagery or terrain could not load. Check asset access, network and configuration. Catalog remains usable.' });
        }
      })();
    } catch {
      state({ kind: 'error', message: '3D is unavailable on this device. Search and inspect the verified catalog below.' });
    }
    return destroy;
  }, []);

  useEffect(() => { runtime.current?.focus(destination.view, selected); }, [destination, selected]);
  useEffect(() => { runtime.current?.updateMarkers(); }, [features, labels, selected]);
  return <div ref={host} className="lunar-canvas" aria-label="Interactive Moon. Drag to orbit, scroll to zoom. Use the search and view buttons for keyboard access." />;
}
