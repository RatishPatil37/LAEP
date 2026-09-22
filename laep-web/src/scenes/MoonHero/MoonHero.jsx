import { lazy, Suspense, useCallback, useState } from 'react';
import MoonScene from './MoonScene';
import CraterScanDrawer from '../../components/scientific/CraterScanDrawer';
import { useMissionStore, LAYER_IDS } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

function MoonLoading() {
  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        height: '100%',
        color: '#9aa0a6',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.8rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div
          style={{
            width: '18px',
            height: '18px',
            border: '2px solid rgba(184, 240, 255, 0.2)',
            borderTopColor: '#b8f0ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span>SYNCHRONIZING 3D LUNAR MCMF REFERENCE SPHERE...</span>
      </div>
    </div>
  );
}

export default function MoonHero({ craters = [] }) {
  const selectedCrater = useMissionStore((s) => s.selectedCrater);
  const selectCrater = useMissionStore((s) => s.selectCrater);
  const solarElevation = useMissionStore((s) => s.solarElevation);
  const setSolarElevation = useMissionStore((s) => s.setSolarElevation);
  const activeLayer = useMissionStore((s) => s.activeLayer);
  const setActiveLayer = useMissionStore((s) => s.setActiveLayer);

  const [focus, setFocus] = useState({ type: 'global' });
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);

  const handleSetGlobal = useCallback(() => {
    soundEngine.playTelemetryClick();
    setFocus({ type: 'global' });
    selectCrater(null);
  }, [selectCrater]);

  const handleFocus = useCallback(
    (next) => {
      setFocus(next);
      if (next.type === 'crater') selectCrater(next.crater);
      if (next.type === 'global') selectCrater(null);
    },
    [selectCrater]
  );

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '680px',
        backgroundColor: '#050608',
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* 3D R3F Moon Scene */}
      <Suspense fallback={<MoonLoading />}>
        <MoonScene
          craters={craters}
          activeFocus={selectedCrater ? { type: 'crater', crater: selectedCrater } : focus}
          onFocus={handleFocus}
          onHoverFocus={setHovered}
          onReady={() => setReady(true)}
          mobile={false}
        />
      </Suspense>

      {/* Top HUD: Spatial Coordinates & View Mode */}
      <div
        className="glass-instrument-subtle"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          padding: '0.5rem 0.85rem',
          borderRadius: '3px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem',
          color: '#f4f4f0',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7be495' }} />
          <span style={{ color: '#7dd3fc', fontWeight: 600 }}>
            {focus.type === 'south-pole' ? 'POLAR PERSPECTIVE (90.00° S)' : selectedCrater ? `ORBITAL LOCK: ${selectedCrater.name.toUpperCase()}` : 'GLOBAL LUNAR SPHERE (1737.4 km)'}
          </span>
        </div>
        <div style={{ color: '#9aa0a6', fontSize: '0.62rem' }}>
          CHANDRAYAAN-2 DFSAR INCLINATION 90.0° · ORBIT 100 KM
        </div>
      </div>

      {/* Top Right: Camera Presets */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: selectedCrater ? '420px' : '20px',
          display: 'flex',
          gap: '0.35rem',
          zIndex: 10,
          transition: 'right 250ms ease',
        }}
      >
        <button
          type="button"
          className="btn-aerospace"
          onClick={handleSetGlobal}
          style={{
            borderColor: focus.type === 'global' && !selectedCrater ? '#b8f0ff' : 'rgba(255,255,255,0.12)',
            color: focus.type === 'global' && !selectedCrater ? '#b8f0ff' : '#9aa0a6',
          }}
        >
          GLOBAL ORBIT
        </button>
        <button
          type="button"
          className="btn-aerospace"
          onClick={() => handleFocus({ type: 'south-pole' })}
          style={{
            borderColor: focus.type === 'south-pole' ? '#ffc857' : 'rgba(255,255,255,0.12)',
            color: focus.type === 'south-pole' ? '#ffc857' : '#9aa0a6',
          }}
        >
          SOUTH POLE (-90°S)
        </button>
      </div>

      {/* Bottom Left: Interactive Solar Terminator Controller */}
      <div
        className="glass-instrument"
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '20px',
          padding: '0.75rem 1rem',
          borderRadius: '3px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          width: '260px',
          fontFamily: "'IBM Plex Mono', monospace",
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}>
          <span style={{ color: '#ffc857' }}>SOLAR ELEVATION:</span>
          <span style={{ color: '#f4f4f0', fontWeight: 600 }}>{solarElevation.toFixed(1)}°</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="12.0"
          step="0.1"
          value={solarElevation}
          onChange={(e) => setSolarElevation(parseFloat(e.target.value))}
          style={{
            width: '100%',
            accentColor: '#ffc857',
            cursor: 'ew-resize',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#6b7280' }}>
          <span>POLAR HORIZON (0.5°)</span>
          <span>HIGH SUN (12.0°)</span>
        </div>
      </div>

      {/* Bottom Center: Scientific Layer Filter (Optical / CPR / DOP / Ice) */}
      <div
        className="glass-instrument"
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '0.35rem',
          borderRadius: '3px',
          display: 'flex',
          gap: '0.35rem',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.68rem',
          zIndex: 10,
        }}
      >
        {[
          { id: LAYER_IDS.OPTICAL, label: 'OPTICAL' },
          { id: LAYER_IDS.CPR, label: 'RADAR CPR' },
          { id: LAYER_IDS.DOP, label: 'DOP MATRIX' },
          { id: LAYER_IDS.ICE, label: 'ICE CONSISTENCY' },
        ].map((layer) => (
          <button
            key={layer.id}
            type="button"
            onClick={() => setActiveLayer(layer.id)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '2px',
              border: '1px solid',
              borderColor: activeLayer === layer.id ? '#b8f0ff' : 'transparent',
              backgroundColor: activeLayer === layer.id ? 'rgba(184, 240, 255, 0.12)' : 'transparent',
              color: activeLayer === layer.id ? '#b8f0ff' : '#9aa0a6',
              cursor: 'pointer',
              fontWeight: activeLayer === layer.id ? 600 : 400,
            }}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Hover Tooltip (When hovering a crater hotspot) */}
      {hovered && !selectedCrater && (
        <div
          className="glass-instrument"
          style={{
            position: 'absolute',
            bottom: '85px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '0.4rem 0.85rem',
            borderRadius: '2px',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.72rem',
            color: '#b8f0ff',
            pointerEvents: 'none',
            border: '1px solid rgba(184, 240, 255, 0.4)',
            boxShadow: '0 0 12px rgba(184, 240, 255, 0.25)',
          }}
        >
          {hovered.type === 'south-pole' ? (
            'LUNAR SOUTH POLE · 90.00° S · ALL LONGITUDES'
          ) : (
            `TARGET // ${hovered.crater.id} · ${hovered.crater.name.toUpperCase()} · ${Math.abs(hovered.crater.lat).toFixed(1)}°S`
          )}
        </div>
      )}

      {/* Slide-out Crater Evidence Drawer */}
      <CraterScanDrawer crater={selectedCrater} onClose={() => selectCrater(null)} />
    </div>
  );
}
