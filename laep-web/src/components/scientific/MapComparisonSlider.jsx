import { useState, useRef, useCallback, useEffect } from 'react';
import { useMissionStore } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

export default function MapComparisonSlider({ leftLabel = 'OPTICAL WAC', rightLabel = 'ICE CONSISTENCY' }) {
  const isComparisonMode = useMissionStore((s) => s.isComparisonMode);
  const comparisonSplit = useMissionStore((s) => s.comparisonSplit);
  const setComparisonSplit = useMissionStore((s) => s.setComparisonSplit);

  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e) => {
    e.preventDefault();
    soundEngine.playTelemetryClick();
    setIsDragging(true);
  };

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(5, Math.min(95, (x / rect.width) * 100));
      setComparisonSplit(Math.round(pct));
    },
    [isDragging, setComparisonSplit]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  if (!isComparisonMode) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 15,
        overflow: 'hidden',
      }}
    >
      {/* Draggable Divider Line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${comparisonSplit}%`,
          width: '2px',
          backgroundColor: '#b8f0ff',
          boxShadow: '0 0 12px #b8f0ff',
          pointerEvents: 'auto',
          cursor: 'ew-resize',
        }}
        onPointerDown={handlePointerDown}
      >
        {/* Handle Grip */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#0b0d10',
            border: '2px solid #b8f0ff',
            color: '#b8f0ff',
            display: 'grid',
            placeItems: 'center',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.75rem',
            boxShadow: '0 0 16px rgba(184, 240, 255, 0.45)',
          }}
        >
          ↔
        </div>
      </div>

      {/* Left Badge */}
      <div
        className="glass-instrument"
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          padding: '0.4rem 0.8rem',
          borderRadius: '2px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.68rem',
          color: '#f4f4f0',
          borderLeft: '2px solid #7dd3fc',
        }}
      >
        <span>[LEFT] </span>
        <span style={{ color: '#7dd3fc', fontWeight: 600 }}>{leftLabel}</span>
      </div>

      {/* Right Badge */}
      <div
        className="glass-instrument"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '0.4rem 0.8rem',
          borderRadius: '2px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.68rem',
          color: '#f4f4f0',
          borderRight: '2px solid #2dd4bf',
        }}
      >
        <span>[RIGHT] </span>
        <span style={{ color: '#2dd4bf', fontWeight: 600 }}>{rightLabel}</span>
      </div>
    </div>
  );
}
