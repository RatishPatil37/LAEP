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

  useEffect(() => {
    // Check if user already completed boot in this session
    if (sessionStorage.getItem('laep_boot_completed') === 'true') {
      onComplete?.();
      return;
    }

    soundEngine.playRadarSweep();
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
            sessionStorage.setItem('laep_boot_completed', 'true');
            setDone(true);
            setTimeout(() => onComplete?.(), 450);
          }, 350);
          return prev;
        }
      });
    }, 180);

    return () => clearInterval(interval);
  }, [onComplete]);

  const handleSkip = () => {
    soundEngine.playTelemetryClick();
    sessionStorage.setItem('laep_boot_completed', 'true');
    setDone(true);
    onComplete?.();
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
                  fontSize: '0.74rem',
                  opacity: isFinished ? 1 : isCurrent ? 0.75 : 0.25,
                  transition: 'opacity 150ms ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: isFinished ? '#7be495' : '#7dd3fc' }}>[{step.id}]</span>
                  <span>{step.label}</span>
                </div>
                <span
                  style={{
                    color: isFinished ? '#7be495' : isCurrent ? '#ffc857' : '#6b7280',
                    fontWeight: 600,
                  }}
                >
                  {isFinished ? `[ ${step.status} ]` : isCurrent ? '[ CHECKING... ]' : '[ PENDING ]'}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              height: '3px',
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round(((completedIndex + 1) / BOOT_STEPS.length) * 100))}%`,
                backgroundColor: '#b8f0ff',
                boxShadow: '0 0 10px #b8f0ff',
                transition: 'width 180ms ease',
              }}
            />
          </div>
          <span style={{ fontSize: '0.68rem', color: '#b8f0ff' }}>
            {Math.min(100, Math.round(((completedIndex + 1) / BOOT_STEPS.length) * 100))}%
          </span>
        </div>
      </div>
    </div>
  );
}
