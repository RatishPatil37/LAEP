import { useState } from 'react';
import { useMissionStore } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

const VALID_CLEARANCE_KEYS = [
  'CH2-PI-CLEARANCE-2026',
  'ISRO-SAC-2026',
  'PRL-PLANETARY-PI',
  'DEMO-SCIENTIST',
];

export default function ClearanceModal() {
  const isOpen = useMissionStore((s) => s.clearanceModalOpen);
  const setIsOpen = useMissionStore((s) => s.setClearanceModalOpen);
  const userRole = useMissionStore((s) => s.userRole);
  const setUserRole = useMissionStore((s) => s.setUserRole);

  const [inputKey, setInputKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleVerifyKey = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmed = inputKey.trim().toUpperCase();
    if (!trimmed) {
      setErrorMsg('Please enter a clearance credential key.');
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) sessionStorage.setItem('laep_jwt', data.token);
      }
    } catch {
      // Graceful offline fallback
    }

    if (VALID_CLEARANCE_KEYS.includes(trimmed)) {
      soundEngine.playTargetAcquired();
      setUserRole('scientist');
      localStorage.setItem('laep_user_role', 'scientist');
      setSuccessMsg('Clearance Verified: Principal Investigator (PI) Level Granted.');
      setTimeout(() => {
        setIsOpen(false);
      }, 900);
    } else {
      setErrorMsg('Invalid Clearance Key. Try default key: CH2-PI-CLEARANCE-2026');
    }
  };

  const handleSelectRole = (role) => {
    soundEngine.playTelemetryClick();
    setUserRole(role);
    localStorage.setItem('laep_user_role', role);
    setErrorMsg('');
    setSuccessMsg(`Mode switched to: ${role === 'scientist' ? 'Principal Investigator / Scientist' : 'Public Explorer'}`);
    setTimeout(() => {
      setIsOpen(false);
    }, 700);
  };

  return (
    <div className="clearance-modal-backdrop">
      <div className="clearance-modal-card hud-corner-bracket">
        {/* Header */}
        <div className="clearance-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="clearance-badge-icon">⎔</span>
            <div>
              <div className="clearance-modal-title">MISSION CLEARANCE & ROLE ACCESS</div>
              <div className="clearance-modal-sub">ISRO CHANDRAYAAN-2 SCIENCE PROTOCOL</div>
            </div>
          </div>
          <button
            type="button"
            className="btn-gemini-close"
            onClick={() => {
              soundEngine.playTelemetryClick();
              setIsOpen(false);
            }}
          >
            ✕
          </button>
        </div>

        {/* Current Status Pill */}
        <div className="clearance-current-banner">
          <span>ACTIVE USER CLEARANCE:</span>
          <span className={`clearance-pill ${userRole}`}>
            {userRole === 'scientist' ? '⚡ SCIENTIST / PRINCIPAL INVESTIGATOR (PI)' : '🌐 PUBLIC MISSION EXPLORER'}
          </span>
        </div>

        {/* Dual Tier Comparison Cards */}
        <div className="clearance-tier-grid">
          {/* Tier 1: Explorer */}
          <div
            className={`tier-card ${userRole === 'explorer' ? 'active-tier' : ''}`}
            onClick={() => handleSelectRole('explorer')}
          >
            <div className="tier-header">
              <span className="tier-badge">TIER 1</span>
              <h4>Public Explorer</h4>
            </div>
            <p className="tier-desc">Designed for students, educators, and science enthusiasts observing polar exploration.</p>
            <ul className="tier-list">
              <li>✓ Full multi-instrument map viewing (11 channels)</li>
              <li>✓ 8 peer-reviewed ground truth benchmark craters</li>
              <li>✓ Pre-computed optimal kinematic A* routes</li>
              <li>✓ 3D rover physics simulation observation</li>
              <li>✓ "Ask Gemini" lunar mission copilot</li>
              <li className="dim">✗ Custom coordinate injection</li>
              <li className="dim">✗ Custom bounding box ice calculations</li>
            </ul>
            <button
              type="button"
              className={`btn-tier ${userRole === 'explorer' ? 'btn-tier-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectRole('explorer');
              }}
            >
              {userRole === 'explorer' ? 'CURRENTLY ACTIVE' : 'SWITCH TO EXPLORER'}
            </button>
          </div>

          {/* Tier 2: Scientist / PI */}
          <div
            className={`tier-card highlight-tier ${userRole === 'scientist' ? 'active-tier' : ''}`}
          >
            <div className="tier-header">
              <span className="tier-badge gold">TIER 2</span>
              <h4 style={{ color: '#ffd740' }}>Scientist / PI</h4>
            </div>
            <p className="tier-desc">Unrestricted access for technical mission planners & planetary researchers.</p>
            <ul className="tier-list">
              <li>✓ All Public Explorer capabilities</li>
              <li>✓ <strong>Custom Waypoint Input</strong> (arbitrary Lon/Lat)</li>
              <li>✓ <strong>Simpson 2D Bounding Box</strong> ice tonnage calculator</li>
              <li>✓ Override rover kinematics (mass, wheel radius, tilt limit)</li>
              <li>✓ Export raw multi-sensor telemetry CSVs</li>
              <li>✓ Bayesian $\pm 9\%$ uncertainty bounds calibration</li>
            </ul>
            <button
              type="button"
              className={`btn-tier btn-tier-gold ${userRole === 'scientist' ? 'btn-tier-active' : ''}`}
              onClick={() => handleSelectRole('scientist')}
            >
              {userRole === 'scientist' ? 'CURRENTLY ACTIVE' : 'AUTHENTICATE AS SCIENTIST'}
            </button>
          </div>
        </div>

        {/* Key Verification Input */}
        <form className="clearance-key-form" onSubmit={handleVerifyKey}>
          <div className="key-input-label">
            <span>ENTER MISSION CLEARANCE KEY //</span>
            <span style={{ fontSize: '0.65rem', color: '#9aa0a6' }}>Demo Key: CH2-PI-CLEARANCE-2026</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="clearance-key-input"
              placeholder="e.g. CH2-PI-CLEARANCE-2026"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
            />
            <button type="submit" className="btn-clearance-submit">
              VERIFY & UNLOCK
            </button>
          </div>

          {errorMsg && <div className="clearance-feedback error">! {errorMsg}</div>}
          {successMsg && <div className="clearance-feedback success">✓ {successMsg}</div>}
        </form>
      </div>
    </div>
  );
}
