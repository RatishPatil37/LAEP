import { NavLink, Outlet } from 'react-router-dom';
import './styles/globals.css';

export default function App() {
  return (
    <div className="app-shell">
      {/* ── Topbar ─────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo">
          <span style={{ fontSize: '1.2rem' }}>🌕</span>
          <span>LAEP</span>
          <span className="topbar-logo-badge">ISRO</span>
        </div>

        <nav className="topbar-nav">
          <NavLink to="/"           className={({isActive}) => isActive ? 'active' : ''} end>
            <span>🏠</span><span>Overview</span>
          </NavLink>
          <NavLink to="/explorer"   className={({isActive}) => isActive ? 'active' : ''}>
            <span>🗺️</span><span>Mission Planner</span>
          </NavLink>
          <NavLink to="/methodology" className={({isActive}) => isActive ? 'active' : ''}>
            <span>📖</span><span>Methodology</span>
          </NavLink>
        </nav>
      </header>

      {/* ── Page content ──────────────────────────────────────────── */}
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
