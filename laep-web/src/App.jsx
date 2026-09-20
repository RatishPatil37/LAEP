import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getApiStatus } from './api/laepApi';
import DataStateBadge from './components/scientific/DataStateBadge';
import './styles/globals.css';

export default function App() {
  const [api, setApi] = useState({ state: 'unavailable', message: 'Checking analysis API…' });

  useEffect(() => {
    getApiStatus().then(setApi);
  }, []);

  return (
    <div className="app-shell">
      {/* ── Topbar ─────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo">
          <span className="topbar-logo-icon">L</span>
          <span>LAEP</span>
          <span className="topbar-logo-subtitle">Lunar exploration & planning</span>
        </div>

        <nav className="topbar-nav">
          <NavLink
            to="/"
            className={({isActive}) => `topbar-link ${isActive ? 'active' : ''}`}
            end
          >
            Mission
          </NavLink>
          <NavLink
            to="/explorer"
            className={({isActive}) => `topbar-link ${isActive ? 'active' : ''}`}
          >
            Explorer
          </NavLink>
          <NavLink
            to="/methodology"
            className={({isActive}) => `topbar-link ${isActive ? 'active' : ''}`}
          >
            Research notes
          </NavLink>
        </nav>

        <div className="topbar-status" title={api.message}>
          <DataStateBadge state={api.state} detail={api.message} />
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────────────── */}
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}
