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
      setErrorMsg('Clearance credential key required.');
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
      // Offline fallback
    }

    if (VALID_CLEARANCE_KEYS.includes(trimmed)) {
      soundEngine.playTargetAcquired();
      setUserRole('scientist');
      localStorage.setItem('laep_user_role', 'scientist');
      setSuccessMsg('Clearance Verified: Investigator Access Granted.');
      setTimeout(() => {
        setIsOpen(false);
      }, 700);
    } else {
      setErrorMsg('Invalid key. Default key: CH2-PI-CLEARANCE-2026');
    }
  };

  const handleSelectRole = (role) => {
    soundEngine.playTelemetryClick();
    setUserRole(role);
    localStorage.setItem('laep_user_role', role);
    setErrorMsg('');
    setSuccessMsg(`Active role: ${role === 'scientist' ? 'Investigator (Tier 2)' : 'Public Explorer (Tier 1)'}`);
    setTimeout(() => {
      setIsOpen(false);
    }, 500);
  };

  return (
    <div className="clearance-modal-backdrop">
      <div className="clearance-modal-card">
        {/* Header */}
        <div className="clearance-modal-header">
          <div>
            <div className="clearance-modal-title">SYSTEM ACCESS CONTROL // CLEARANCE LEVEL</div>
            <div className="clearance-modal-sub">ISRO CHANDRAYAAN-2 SCIENCE PLATFORM</div>
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

        {/* Current Status */}
        <div className="clearance-current-banner">
          <span>ACTIVE TIER:</span>
          <span className={`clearance-pill ${userRole}`}>
            {userRole === 'scientist' ? 'TIER 2 // INVESTIGATOR' : 'TIER 1 // PUBLIC EXPLORER'}
          </span>
        </div>

        {/* Role Comparison */}
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
            <p className="tier-desc">Read-only scientific observation of polar craters and pre-calculated routes.</p>
            <ul className="tier-list">
              <li>• Multi-instrument map layers (11 channels)</li>
              <li>• 8 ground truth benchmark craters</li>
              <li>• Optimal A* kinematic routes</li>
              <li>• 3D rover physics simulation</li>
              <li>• Mission Copilot technical queries</li>
              <li className="dim">• Custom waypoint coordinates</li>
              <li className="dim">• Simpson 2D ice volume calculator</li>
            </ul>
            <button
              type="button"
              className={`btn-tier ${userRole === 'explorer' ? 'btn-tier-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectRole('explorer');
              }}
            >
              {userRole === 'explorer' ? 'ACTIVE' : 'SELECT TIER 1'}
            </button>
          </div>

          {/* Tier 2: Scientist / PI */}
          <div
            className={`tier-card ${userRole === 'scientist' ? 'active-tier' : ''}`}
            onClick={() => handleSelectRole('scientist')}
          >
            <div className="tier-header">
              <span className="tier-badge">TIER 2</span>
              <h4>Investigator / PI</h4>
            </div>
            <p className="tier-desc">Parameter overrides and arbitrary coordinate injection for researchers.</p>
            <ul className="tier-list">
              <li>• All Tier 1 capabilities</li>
              <li>• Custom waypoint coordinates (Lon/Lat)</li>
              <li>• Simpson 2D regional ice calculator</li>
              <li>• Kinematic parameter tuning</li>
              <li>• Full CSV telemetry export</li>
              <li>• ±9% Bayesian uncertainty intervals</li>
            </ul>
            <button
              type="button"
              className={`btn-tier ${userRole === 'scientist' ? 'btn-tier-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectRole('scientist');
              }}
            >
              {userRole === 'scientist' ? 'ACTIVE' : 'SELECT TIER 2'}
            </button>
          </div>
        </div>

        {/* Key Verification */}
        <form className="clearance-key-form" onSubmit={handleVerifyKey}>
          <div className="key-input-label">
            <span>ENTER CLEARANCE KEY:</span>
            <span style={{ fontSize: '0.62rem', color: '#64748b' }}>Key: CH2-PI-CLEARANCE-2026</span>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <input
              type="text"
              className="clearance-key-input"
              placeholder="CH2-PI-CLEARANCE-2026"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
            />
            <button type="submit" className="btn-clearance-submit">
              AUTHENTICATE
            </button>
          </div>

          {errorMsg && <div className="clearance-feedback error">! {errorMsg}</div>}
          {successMsg && <div className="clearance-feedback success">✓ {successMsg}</div>}
        </form>
      </div>
    </div>
  );
}
