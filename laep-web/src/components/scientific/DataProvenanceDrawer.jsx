import { soundEngine } from '../../lib/soundEffects';

export default function DataProvenanceDrawer({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <aside
      className="glass-instrument hud-corner-bracket"
      style={{
        position: 'fixed',
        top: '64px',
        left: '20px',
        width: '380px',
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 84px)',
        overflowY: 'auto',
        zIndex: 50,
        padding: '1.5rem',
        borderRadius: '3px',
        border: '1px solid rgba(125, 211, 252, 0.3)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 25px rgba(125, 211, 252, 0.12)',
        color: '#f4f4f0',
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.72rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.6rem' }}>
        <div>
          <span style={{ color: '#7dd3fc', fontWeight: 600, fontSize: '0.8rem' }}>DATA PROVENANCE MANIFEST</span>
          <div style={{ color: '#6b7280', fontSize: '0.6rem' }}>PDS4 ARCHIVE AUDIT & TRACEABILITY</div>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.playTelemetryClick();
            onClose?.();
          }}
          style={{
            padding: '0.2rem 0.5rem',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '2px',
            color: '#9aa0a6',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div>
          <div style={{ color: '#6b7280', fontSize: '0.62rem' }}>PRIMARY SENSOR SUITE</div>
          <div style={{ color: '#f4f4f0', fontWeight: 600, marginTop: '0.15rem' }}>ISRO Chandrayaan-2 Orbiter</div>
          <div style={{ color: '#9aa0a6', fontSize: '0.65rem' }}>DFSAR · OHRC · TMC-2 · IIRS</div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
          <div style={{ color: '#6b7280', fontSize: '0.62rem' }}>RADAR PRODUCT ID (DFSAR)</div>
          <div style={{ color: '#b8f0ff', fontSize: '0.64rem', wordBreak: 'break-all', marginTop: '0.15rem' }}>
            ch2_sar_ndxl_20250630mpcpnpwest_d_cpr_xx_fp_xx_xxx.tif
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
          <div style={{ color: '#6b7280', fontSize: '0.62rem' }}>HYPERSPECTRAL PRODUCT ID (IIRS)</div>
          <div style={{ color: '#b8f0ff', fontSize: '0.64rem', wordBreak: 'break-all', marginTop: '0.15rem' }}>
            ch2_iir_nci_20231222T0751377198_d_img_d18.qub (256 Bands)
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
          <div style={{ color: '#6b7280', fontSize: '0.62rem' }}>PROCESSING PIPELINE</div>
          <div style={{ color: '#f4f4f0', marginTop: '0.15rem' }}>
            Level 2 Radiometric Calibration · Conformal Polar Stereographic Reprojection · Sub-pixel IDW Tie-point Grid Interpolation
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.62rem' }}>SPATIAL RESOLUTION</div>
            <div style={{ color: '#7be495', fontWeight: 600 }}>2.0 m / px</div>
          </div>
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.62rem' }}>COORDINATE FRAME</div>
            <div style={{ color: '#f4f4f0', fontWeight: 600 }}>MCMF (EPSG:4326)</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.62rem' }}>ML FUSION MODEL</div>
            <div style={{ color: '#ffc857', fontWeight: 600 }}>LAEP-FUSION-v2.4</div>
          </div>
          <div>
            <div style={{ color: '#6b7280', fontSize: '0.62rem' }}>AUDIT COMMIT</div>
            <div style={{ color: '#7dd3fc', fontWeight: 600 }}>git:8a72c1f</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
