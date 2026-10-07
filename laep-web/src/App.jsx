import { NavLink, Outlet } from 'react-router-dom';
import { useMissionStore } from './stores/useMissionStore';
import { soundEngine } from './lib/soundEffects';
import CommandPalette from './components/navigation/CommandPalette';
import MissionBoot from './components/navigation/MissionBoot';
import GeminiAssistant from './components/assistant/GeminiAssistant';
import ClearanceModal from './components/auth/ClearanceModal';
import './styles/globals.css';
import './styles/aerospace.css';
import './styles/assistant.css';

export default function App() {
  const isResearchMode = useMissionStore((s) => s.isResearchMode);
  const toggleResearchMode = useMissionStore((s) => s.toggleResearchMode);
  const setCommandPaletteOpen = useMissionStore((s) => s.setCommandPaletteOpen);
  const audioMuted = useMissionStore((s) => s.audioMuted);
  const toggleAudio = useMissionStore((s) => s.toggleAudio);
  const userRole = useMissionStore((s) => s.userRole);
  const setClearanceModalOpen = useMissionStore((s) => s.setClearanceModalOpen);

  return (
    <div className="app-shell">
      {/* ── Cinematic Mission Diagnostic Boot Sequence (Runs on browser load/refresh) ── */}
      <MissionBoot />

      {/* ── Global Topbar ─────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="topbar-logo-icon">L</span>
          <span style={{ letterSpacing: '0.08em', fontWeight: 700 }}>LAEP</span>
          <span className="topbar-logo-badge">ISRO / CH-2</span>
        </div>

        <nav className="topbar-nav">
          <NavLink
            to="/"
            className={({ isActive }) => `topbar-link ${isActive ? 'active' : ''}`}
            end
            onClick={() => soundEngine.playTelemetryClick()}
          >
            Overview
          </NavLink>
          <NavLink
            to="/explorer"
            className={({ isActive }) => `topbar-link ${isActive ? 'active' : ''}`}
            onClick={() => soundEngine.playTelemetryClick()}
          >
            Mission Planner
          </NavLink>
          <NavLink
            to="/simulator"
            className={({ isActive }) => `topbar-link ${isActive ? 'active' : ''}`}
            onClick={() => soundEngine.playTelemetryClick()}
          >
            3D Simulator
          </NavLink>
          <NavLink
            to="/analytics"
            className={({ isActive }) => `topbar-link ${isActive ? 'active' : ''}`}
            onClick={() => soundEngine.playTelemetryClick()}
          >
            Analytics Lab
          </NavLink>
          <NavLink
            to="/methodology"
            className={({ isActive }) => `topbar-link ${isActive ? 'active' : ''}`}
            onClick={() => soundEngine.playTelemetryClick()}
          >
            Methodology
          </NavLink>
        </nav>

        {/* Right Status & Aerospace Utility Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
          {/* Quick Command Palette Button */}
          <button
            type="button"
            className="btn-aerospace"
            onClick={() => {
              soundEngine.playTelemetryClick();
              setCommandPaletteOpen(true);
            }}
            title="Press ⌘K or Ctrl+K to open Command Palette"
            style={{
              padding: '0.3rem 0.65rem',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.68rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>SEARCH</span>
            <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: '2px', fontSize: '0.6rem' }}>
              ⌘K
            </kbd>
          </button>

          {/* Research Mode Toggle */}
          <button
            type="button"
            className={`btn-aerospace ${isResearchMode ? 'active' : ''}`}
            onClick={toggleResearchMode}
            title="Toggle uncertainty bounds and research mode"
            style={{
              padding: '0.3rem 0.6rem',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.65rem',
            }}
          >
            <span style={{ color: isResearchMode ? '#7be495' : '#9aa0a6' }}>
              {isResearchMode ? '● RESEARCH (±UNCERT)' : '○ OPERATIONAL'}
            </span>
          </button>

          {/* Audio Mute HUD Control */}
          <button
            type="button"
            className="btn-aerospace"
            onClick={toggleAudio}
            title={audioMuted ? 'Telemetry audio muted (click to enable)' : 'Telemetry audio active (click to mute)'}
            style={{
              padding: '0.3rem 0.55rem',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.65rem',
            }}
          >
            <span>AUDIO: </span>
            <span style={{ color: audioMuted ? '#6b7280' : '#7be495' }}>
              {audioMuted ? 'MUTED' : 'ACTIVE'}
            </span>
          </button>

          {/* User Clearance Badge & Switcher */}
          <button
            type="button"
            className="btn-aerospace"
            onClick={() => {
              soundEngine.playTelemetryClick();
              setClearanceModalOpen(true);
            }}
            title={`Click to switch clearance role (Current: ${userRole === 'scientist' ? 'Principal Investigator / Scientist' : 'Public Explorer'})`}
            style={{
              padding: '0.3rem 0.65rem',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: userRole === 'scientist' ? 'rgba(255, 215, 64, 0.5)' : 'rgba(56, 189, 248, 0.4)',
              background: userRole === 'scientist' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(15, 23, 42, 0.4)',
            }}
          >
            <span style={{ color: userRole === 'scientist' ? '#ffd740' : '#38bdf8', fontWeight: 600 }}>
              {userRole === 'scientist' ? '⚡ PI CLEARANCE' : '🌐 EXPLORER'}
            </span>
          </button>

          {/* Telemetry Status Indicator */}
          <div className="topbar-status">
            <div className="status-indicator">
              <span className="status-dot" />
              CH-2 POLAR 100KM
            </div>
          </div>
        </div>
      </header>

      {/* ── Page Content ──────────────────────────────────────────── */}
      <main className="page-content">
        <Outlet />
      </main>

      {/* ── Global ⌘K Command Palette ─────────────────────────────── */}
      <CommandPalette />

      {/* ── Global Planetary Clearance & Role Modal ────────────────── */}
      <ClearanceModal />

      {/* ── Chrome-Style "Ask Gemini" AI Assistant ─────────────────── */}
      <GeminiAssistant />
    </div>
  );
}
