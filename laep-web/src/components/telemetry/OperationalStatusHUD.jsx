import { useMissionStore } from '../../stores/useMissionStore';

export default function OperationalStatusHUD() {
  const audioMuted = useMissionStore((s) => s.audioMuted);
  const toggleAudio = useMissionStore((s) => s.toggleAudio);
  const isResearchMode = useMissionStore((s) => s.isResearchMode);

  return (
    <div className="operational-banner">
      <div className="operational-banner__item">
        <span className="operational-banner__dot" />
        <span>ORBIT: </span>
        <span className="operational-banner__val">CH-2 POLAR (100 km)</span>
      </div>

      <div className="operational-banner__item">
        <span>SOLAR LUX: </span>
        <span className="operational-banner__val" style={{ color: '#ffc857' }}>100% ILLUM</span>
      </div>

      <div className="operational-banner__item">
        <span>COMMS LINK: </span>
        <span className="operational-banner__val" style={{ color: '#7be495' }}>DIRECT-TO-EARTH (NOMINAL)</span>
      </div>

      <div className="operational-banner__item">
        <span>REGOLITH TEMP: </span>
        <span className="operational-banner__val">120 K (COLD TRAP: 40 K)</span>
      </div>

      <div className="operational-banner__item">
        <span>MODE: </span>
        <span className="operational-banner__val" style={{ color: isResearchMode ? '#b8f0ff' : '#7dd3fc' }}>
          {isResearchMode ? 'RESEARCH / UNCERTAINTY' : 'OPERATIONAL MISSION'}
        </span>
      </div>

      {/* Audio Mute HUD Control */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={toggleAudio}
          title={audioMuted ? 'Unmute telemetry audio' : 'Mute telemetry audio'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.15rem 0.5rem',
            borderRadius: '2px',
            border: '1px solid rgba(255,255,255,0.15)',
            backgroundColor: audioMuted ? 'rgba(255,255,255,0.02)' : 'rgba(184, 240, 255, 0.1)',
            color: audioMuted ? '#6b7280' : '#b8f0ff',
            fontSize: '0.62rem',
            cursor: 'pointer',
          }}
        >
          <span>{audioMuted ? '🔇 AUDIO OFF' : '🔊 AUDIO ON'}</span>
        </button>
      </div>
    </div>
  );
}
