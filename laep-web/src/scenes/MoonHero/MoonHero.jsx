import { lazy, Suspense, useCallback, useState, useEffect } from 'react';
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
            borderTopColor: '#00e5ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ color: '#b8f0ff', letterSpacing: '0.05em' }}>
          SYNCHRONIZING 3D LUNAR MCMF REFERENCE SPHERE...
        </span>
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

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
        position: isFullscreen ? 'fixed' : 'relative',
        inset: isFullscreen ? 0 : 'auto',
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : '100%',
        minHeight: isFullscreen ? '100vh' : '680px',
        backgroundColor: '#050608',
        borderRadius: isFullscreen ? 0 : '14px',
        overflow: 'hidden',
        border: isFullscreen ? 'none' : '1px solid rgba(0, 229, 255, 0.22)',
        boxShadow: isFullscreen ? 'none' : '0 16px 45px rgba(0, 0, 0, 0.75)',
        zIndex: isFullscreen ? 1000 : 'auto',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
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
          padding: '0.55rem 0.95rem',
          borderRadius: '8px',
          background: 'rgba(8, 12, 20, 0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0, 229, 255, 0.2)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem',
          color: '#f4f4f0',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7be495', boxShadow: '0 0 6px #7be495' }} />
          <span style={{ color: '#00e5ff', fontWeight: 600 }}>
            {focus.type === 'south-pole' ? 'POLAR PERSPECTIVE (90.00° S)' : selectedCrater ? `ORBITAL LOCK: ${selectedCrater.name.toUpperCase()}` : 'GLOBAL LUNAR SPHERE (1737.4 km)'}
          </span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: '0.62rem' }}>
          CHANDRAYAAN-2 DFSAR INCLINATION 90.0° · ORBIT 100 KM
        </div>
      </div>

      {/* Top Right: Camera Presets & Fullscreen < > Zoom Toggle */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: selectedCrater ? '430px' : '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          zIndex: 10,
          transition: 'right 250ms ease',
        }}
      >
        <button
          type="button"
          className="btn-aerospace"
          onClick={handleSetGlobal}
          style={{
            borderColor: focus.type === 'global' && !selectedCrater ? '#00e5ff' : 'rgba(255,255,255,0.12)',
            color: focus.type === 'global' && !selectedCrater ? '#00e5ff' : '#94a3b8',
            borderRadius: '6px',
            fontSize: '0.68rem',
            padding: '0.35rem 0.65rem',
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
            color: focus.type === 'south-pole' ? '#ffc857' : '#94a3b8',
            borderRadius: '6px',
            fontSize: '0.68rem',
            padding: '0.35rem 0.65rem',
          }}
        >
          SOUTH POLE (-90°S)
        </button>

        {/* ── < > Fullscreen Zoom Toggle Button ── */}
        <button
          type="button"
          className="btn-aerospace"
          onClick={() => {
            soundEngine.playTelemetryClick();
            setIsFullscreen((prev) => !prev);
          }}
          title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Zoom 3D Moon to Fullscreen (< >)'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            borderColor: isFullscreen ? '#00e5ff' : 'rgba(0, 229, 255, 0.4)',
            color: isFullscreen ? '#00e5ff' : '#b8f0ff',
            background: isFullscreen ? 'rgba(0, 229, 255, 0.18)' : 'rgba(8, 12, 20, 0.8)',
            borderRadius: '6px',
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '0.35rem 0.75rem',
            boxShadow: 'none',
          }}
        >
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem' }}>
            {isFullscreen ? '><' : '< >'}
          </span>
          <span>{isFullscreen ? 'COLLAPSE' : 'FULLSCREEN'}</span>
        </button>
      </div>

      {/* Bottom Left: Interactive Solar Terminator Controller */}
      <div
        className="glass-instrument"
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '20px',
          padding: '0.65rem 0.95rem',
          borderRadius: '10px',
          background: 'rgba(8, 12, 20, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 229, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#64748b' }}>
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
          borderRadius: '10px',
          background: 'rgba(8, 12, 20, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 229, 255, 0.2)',
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
              padding: '0.38rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: activeLayer === layer.id ? '#00e5ff' : 'transparent',
              backgroundColor: activeLayer === layer.id ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
              color: activeLayer === layer.id ? '#00e5ff' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: activeLayer === layer.id ? 700 : 400,
              transition: 'all 0.15s ease',
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
            borderRadius: '6px',
            background: 'rgba(8, 12, 20, 0.9)',
            backdropFilter: 'blur(16px)',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.72rem',
            color: '#b8f0ff',
            pointerEvents: 'none',
            border: '1px solid rgba(0, 229, 255, 0.4)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
          }}
        >
          {hovered.type === 'south-pole' ? (
            'LUNAR SOUTH POLE · 90.00° S · ALL LONGITUDES'
          ) : (
            `TARGET // ${hovered.crater.id} · ${hovered.crater.name.toUpperCase()} · ${Math.abs(hovered.crater.lat).toFixed(1)}°S`
          )}
        </div>
      )}

      {/* Slide-out Crater Evidence Drawer (Visible both in regular & fullscreen view) */}
      <CraterScanDrawer crater={selectedCrater} onClose={() => selectCrater(null)} />
    </div>
  );
}
