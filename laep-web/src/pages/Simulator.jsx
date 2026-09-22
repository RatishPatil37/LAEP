/**
 * Simulator.jsx — 3D Kinematic Rover Traversal Simulator Page
 * Hosts the full 3D interactive lunar crater environment with real-time attitude telemetry,
 * dynamic spotlights, timeline scrubber, and chronological mission event stream.
 */
import { Link } from 'react-router-dom';
import RoverSimulator from '../scenes/RoverScene/RoverSimulator';
import OperationalStatusHUD from '../components/telemetry/OperationalStatusHUD';
import { useMissionStore } from '../stores/useMissionStore';
import { soundEngine } from '../lib/soundEffects';

export default function Simulator() {
  const selectedCrater = useMissionStore((s) => s.selectedCrater);
  const isResearchMode = useMissionStore((s) => s.isResearchMode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: 'calc(100vh - 56px)', overflow: 'hidden', background: '#020305' }}>
      {/* Top Operational Telemetry Banner */}
      <OperationalStatusHUD />

      {/* Main Simulator Viewport & Mission Stream */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Left 3D WebGL Canvas */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <RoverSimulator />
        </div>

        {/* Right Event Stream Drawer */}
        <aside
          style={{
            width: '320px',
            backgroundColor: '#050608',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '0.72rem',
            color: '#f4f4f0',
            zIndex: 10,
          }}
        >
          <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#7dd3fc', fontWeight: 600 }}>MISSION EVENT LOG</div>
              <div style={{ color: '#6b7280', fontSize: '0.58rem' }}>AUTONOMOUS ROVER DISPATCH</div>
            </div>
            <Link
              to="/explorer"
              onClick={() => soundEngine.playTelemetryClick()}
              style={{
                color: '#2dd4bf',
                fontSize: '0.65rem',
                textDecoration: 'none',
                padding: '0.25rem 0.5rem',
                border: '1px solid rgba(45, 212, 191, 0.3)',
                borderRadius: '2px',
              }}
            >
              ← MAP
            </Link>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ padding: '0.65rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}>
              <div style={{ color: '#7be495', fontSize: '0.65rem', fontWeight: 600 }}>T+00:00:00 — COMMENCE TRAVERSE</div>
              <div style={{ color: '#9aa0a6', fontSize: '0.65rem', marginTop: '0.2rem' }}>
                Rim departure verified. NavCam stereo photogrammetry calibrated to ±1.4 cm accuracy.
              </div>
            </div>

            <div style={{ padding: '0.65rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}>
              <div style={{ color: '#ffc857', fontSize: '0.65rem', fontWeight: 600 }}>T+00:04:12 — RIM SLOPE INCLINE (11.8°)</div>
              <div style={{ color: '#9aa0a6', fontSize: '0.65rem', marginTop: '0.2rem' }}>
                Rocker-bogie bogie angle adjusted. Wheel slip compensated: 8.4% wheel odometry drift.
              </div>
            </div>

            <div style={{ padding: '0.65rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}>
              <div style={{ color: '#7dd3fc', fontSize: '0.65rem', fontWeight: 600 }}>T+00:07:45 — ENTERING PERMANENT SHADOW</div>
              <div style={{ color: '#9aa0a6', fontSize: '0.65rem', marginTop: '0.2rem' }}>
                Solar lux dropped to 0.00%. High-efficiency LED spotlights deployed. Thermoelectric heaters activated (40 K cold trap).
              </div>
            </div>

            <div style={{ padding: '0.65rem', background: 'rgba(45,212,191,0.05)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: '2px' }}>
              <div style={{ color: '#2dd4bf', fontSize: '0.65rem', fontWeight: 600 }}>T+00:11:30 — HIGH-CPR ANOMALY IDENTIFIED</div>
              <div style={{ color: '#b8f0ff', fontSize: '0.65rem', marginTop: '0.2rem' }}>
                Subsurface radar reflection peak CPR: 1.48 ± 0.12. Co-registered IIRS band depth (BD2000): 0.28.
              </div>
            </div>

            <div style={{ padding: '0.65rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}>
              <div style={{ color: '#7be495', fontSize: '0.65rem', fontWeight: 600 }}>T+00:14:50 — SAMPLING SITE REACHED</div>
              <div style={{ color: '#9aa0a6', fontSize: '0.65rem', marginTop: '0.2rem' }}>
                Goal coordinates locked. In-situ volatile Raman drill sequence ready for initiation.
              </div>
            </div>
          </div>

          <div style={{ padding: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.015)' }}>
            <div style={{ fontSize: '0.6rem', color: '#6b7280', marginBottom: '0.4rem' }}>AUTONOMOUS SAFETY OVERRIDE</div>
            <button
              type="button"
              className="btn-aerospace"
              onClick={() => {
                soundEngine.playWarningBeep();
                alert('EMERGENCY TRAVERSAL HOLD SIGNAL TRANSMITTED TO ROVER CHASSIS');
              }}
              style={{ width: '100%', borderColor: '#ff6b5e', color: '#ff6b5e', fontSize: '0.65rem' }}
            >
              HALT ROVER TRAVERSE [HOLD]
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
