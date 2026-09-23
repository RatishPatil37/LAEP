import { useState, useEffect } from 'react';
import { soundEngine } from '../../lib/soundEffects';

const BOOT_STEPS = [
  { id: '01', label: 'LUNAR MCMF REFERENCE FRAME (R=1737.4 km)', status: 'VERIFIED' },
  { id: '02', label: 'CHANDRAYAAN-2 DFSAR POLARIMETRY CALIBRATION', status: 'SYNCHRONIZED' },
  { id: '03', label: 'POLAR STEREOGRAPHIC CONFORMAL PROJECTION', status: 'INITIALIZED' },
  { id: '04', label: 'RADARGRAMMETRIC INCIDENCE & SLOPE ENGINE', status: 'ONLINE' },
  { id: '05', label: 'IIRS WATER-ICE ABSORPTION DETECTOR (2000nm)', status: 'ACTIVE' },
  { id: '06', label: 'KINEMATIC A* ROVER TRAVERSAL PLANNER', status: 'READY' },
];

export default function MissionBoot({ onComplete }) {
  const [completedIndex, setCompletedIndex] = useState(-1);
  const [done, setDone] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    soundEngine.playRadarSweep();

    // Escape key listener to skip intro
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const interval = setInterval(() => {
      setCompletedIndex((prev) => {
        const next = prev + 1;
        if (next < BOOT_STEPS.length) {
          soundEngine.playTelemetryClick();
          return next;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            soundEngine.playRouteLock();
            setIsFading(true);
            setTimeout(() => {
              setDone(true);
              onComplete?.();
            }, 300);
          }, 250);
          return prev;
        }
      });
    }, 160);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onComplete]);

  const handleSkip = () => {
    soundEngine.playTelemetryClick();
    setIsFading(true);
    setTimeout(() => {
      setDone(true);
      onComplete?.();
    }, 150);
  };

  if (done) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#050608',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
        fontFamily: "'IBM Plex Mono', monospace",
        color: '#f4f4f0',
        opacity: isFading ? 0 : 1,
        transition: 'opacity 250ms ease-out',
        pointerEvents: isFading ? 'none' : 'auto',
      }}
    >
      <div style={{ maxWidth: '640px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
          <div>
            <span style={{ color: '#b8f0ff', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.12em' }}>LAEP // FLIGHT COMPUTER</span>
            <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.2rem' }}>SYSTEM BOOT DIAGNOSTIC SEQUENCE</div>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            style={{
              padding: '0.35rem 0.75rem',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '2px',
              color: '#9aa0a6',
              fontSize: '0.68rem',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            SKIP INTRO [ESC]
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {BOOT_STEPS.map((step, idx) => {
            const isFinished = idx <= completedIndex;
            const isCurrent = idx === completedIndex + 1;
            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '2px',
                  backgroundColor: isCurrent ? 'rgba(184, 240, 255, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid',
                  borderColor: isFinished ? 'rgba(123, 228, 149, 0.3)' : isCurrent ? 'rgba(184, 240, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                  fontSize: '0.72rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: '#7dd3fc', fontWeight: 600 }}>{step.id}</span>
                  <span style={{ color: isFinished ? '#f4f4f0' : isCurrent ? '#b8f0ff' : '#6b7280' }}>
                    {step.label}
                  </span>
                </div>
                <div>
                  {isFinished ? (
                    <span style={{ color: '#7be495', fontWeight: 600 }}>[{step.status}]</span>
                  ) : isCurrent ? (
                    <span style={{ color: '#ffc857', animation: 'wavefrontPulse 1s infinite' }}>[TESTING...]</span>
                  ) : (
                    <span style={{ color: '#4b5563' }}>[PENDING]</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#6b7280' }}>
          <span>ISRO CHANDRAYAAN-2 SCIENCE OPERATIONS</span>
          <span>BUILD: 2026.09-REV4</span>
        </div>
      </div>
    </div>
  );
}
