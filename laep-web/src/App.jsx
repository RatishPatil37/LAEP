import { NavLink, Outlet } from 'react-router-dom';
import './styles/globals.css';

export default function App() {
  return (
    <div className="app-shell">
      {/* ── Topbar ─────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo">
          <span className="topbar-logo-icon">L</span>
          <span>LAEP</span>
          <span className="topbar-logo-badge">ISRO</span>
        </div>

        <nav className="topbar-nav">
          <NavLink
            to="/"
            className={({isActive}) => `topbar-link ${isActive ? 'active' : ''}`}
            end
          >
            Overview
          </NavLink>
          <NavLink
            to="/explorer"
            className={({isActive}) => `topbar-link ${isActive ? 'active' : ''}`}
          >
            Mission Planner
          </NavLink>
          <NavLink
            to="/methodology"
            className={({isActive}) => `topbar-link ${isActive ? 'active' : ''}`}
          >
            Methodology
          </NavLink>
        </nav>

        <div className="topbar-status">
          <div className="status-indicator">
            <span className="status-dot" />
            System Online
          </div>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────────────── */}
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
