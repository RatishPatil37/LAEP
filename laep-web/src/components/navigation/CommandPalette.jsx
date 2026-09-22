/**
 * CommandPalette.jsx — Global Aerospace ⌘K / Ctrl+K Command Palette
 * Quick-jump navigation across all lunar craters, scientific layers, simulation tools,
 * and data export actions.
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMissionStore, LAYER_IDS } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

const COMMANDS = [
  { id: 'faustini', label: 'Faustini Crater (82.1°E, 87.3°S)', category: 'CRATER BENCHMARK', action: 'crater', target: 'faustini' },
  { id: 'shoemaker', label: 'Shoemaker Crater (45.3°E, 88.1°S)', category: 'CRATER BENCHMARK', action: 'crater', target: 'shoemaker' },
  { id: 'haworth', label: 'Haworth Crater (5.2°W, 87.4°S)', category: 'CRATER BENCHMARK', action: 'crater', target: 'haworth' },
  { id: 'amundsen', label: 'Amundsen Crater (82.8°E, 84.5°S)', category: 'CRATER BENCHMARK', action: 'crater', target: 'amundsen' },
  { id: 'cabeus', label: 'Cabeus Crater (42.1°W, 84.9°S)', category: 'CRATER BENCHMARK', action: 'crater', target: 'cabeus' },
  { id: 'slater', label: 'Slater Crater (149.2°E, 62.6°S)', category: 'CRATER BENCHMARK', action: 'crater', target: 'slater' },
  { id: 'idelson', label: "Idel'son-L Control Crater (115.8°E, 84.2°S)", category: 'CRATER BENCHMARK', action: 'crater', target: 'idelson' },

  { id: 'nav_explorer', label: 'Open Planetary GIS Cockpit (Map Explorer)', category: 'NAVIGATION', action: 'route', target: '/explorer' },
  { id: 'nav_sim', label: 'Open 3D Kinematic Rover Simulator', category: 'NAVIGATION', action: 'route', target: '/simulator' },
  { id: 'nav_analytics', label: 'Open Mission Analytics & ML Benchmarks Lab', category: 'NAVIGATION', action: 'route', target: '/analytics' },
  { id: 'nav_home', label: 'Return to Mission Overview (8-Phase Storyboard)', category: 'NAVIGATION', action: 'route', target: '/' },

  { id: 'tool_curtain', label: 'Toggle Split-Screen Comparison Curtain', category: 'TOOL', action: 'curtain' },
  { id: 'tool_ruler', label: 'Toggle 3D Terrain Measurement Ruler', category: 'TOOL', action: 'ruler' },
  { id: 'tool_research', label: 'Toggle Uncertainty Bounds & Research Mode', category: 'MODE', action: 'research' },
  { id: 'tool_audio', label: 'Toggle Procedural Telemetry Audio Cues', category: 'AUDIO', action: 'audio' },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const commandPaletteOpen = useMissionStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useMissionStore((s) => s.setCommandPaletteOpen);
  const toggleComparisonMode = useMissionStore((s) => s.toggleComparisonMode);
  const toggleMeasurement = useMissionStore((s) => s.toggleMeasurement);
  const toggleResearchMode = useMissionStore((s) => s.toggleResearchMode);
  const toggleAudio = useMissionStore((s) => s.toggleAudio);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Global Keyboard shortcut: ⌘K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        soundEngine.playTelemetryClick();
        setCommandPaletteOpen(!commandPaletteOpen);
      } else if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  const filtered = COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (cmd) => {
    soundEngine.playTargetAcquired();
    setCommandPaletteOpen(false);

    if (cmd.action === 'route') {
      navigate(cmd.target);
    } else if (cmd.action === 'crater') {
      navigate('/explorer');
    } else if (cmd.action === 'curtain') {
      toggleComparisonMode();
      navigate('/explorer');
    } else if (cmd.action === 'ruler') {
      toggleMeasurement();
      navigate('/explorer');
    } else if (cmd.action === 'research') {
      toggleResearchMode();
    } else if (cmd.action === 'audio') {
      toggleAudio();
    }
  };

  if (!commandPaletteOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 3, 5, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 100,
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="glass-instrument hud-corner-bracket"
        style={{
          width: '100%',
          maxWidth: '620px',
          background: 'rgba(10, 14, 23, 0.95)',
          borderRadius: '4px',
          border: '1px solid rgba(125, 211, 252, 0.3)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(125, 211, 252, 0.15)',
          overflow: 'hidden',
          fontFamily: "'IBM Plex Mono', monospace",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0.85rem 1.2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <span style={{ color: '#7dd3fc', marginRight: '0.75rem', fontSize: '0.9rem' }}>⌘</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a crater, layer, tool, or mission command..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f4f4f0',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.85rem',
            }}
          />
          <span style={{ fontSize: '0.65rem', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)', padding: '0.15rem 0.4rem', borderRadius: '2px' }}>
            ESC
          </span>
        </div>

        {/* Command List */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '0.5rem 0' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem' }}>
              No matching lunar targets or tools found.
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 1.2rem',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(125, 211, 252, 0.1)' : 'transparent',
                    borderLeft: isSelected ? '3px solid #7dd3fc' : '3px solid transparent',
                  }}
                >
                  <span style={{ color: isSelected ? '#f4f4f0' : '#d1d5db', fontSize: '0.76rem' }}>
                    {cmd.label}
                  </span>
                  <span style={{ fontSize: '0.58rem', color: '#7dd3fc', border: '1px solid rgba(125, 211, 252, 0.2)', padding: '0.1rem 0.35rem', borderRadius: '2px' }}>
                    {cmd.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1.2rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.62rem', color: '#6b7280' }}>
          <span>Navigate with ↑ / ↓ keys</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  );
}
