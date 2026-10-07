import { useRef, useEffect, useState } from 'react';

export default function RadargramProfiler({ crater }) {
  const canvasRef = useRef(null);
  const [probeDepth, setProbeDepth] = useState(1.8); // meters

  // Sensor parameters based on Chandrayaan-2 DFSAR L-Band (1.25 GHz / 24 cm)
  const cpr = crater?.peak_cpr || 1.42;
  const isIceRich = cpr > 1.2;
  const iceLayerDepth = isIceRich ? 1.4 : 3.8; // meters below surface
  const iceThickness = isIceRich ? 1.6 : 0.4;

  // Two-way travel time calculation: tau = 2 * d * sqrt(epsilon_r) / c
  const c = 0.3; // m / ns in vacuum
  const epsRegolith = 2.7;
  const epsIce = 3.15;
  const twttNs = ((2 * probeDepth * Math.sqrt(probeDepth > iceLayerDepth ? epsIce : epsRegolith)) / c).toFixed(1);
  const estIceWt = isIceRich && probeDepth >= iceLayerDepth && probeDepth <= (iceLayerDepth + iceThickness) ? '4.8 ± 0.6 wt%' : '< 0.3 wt%';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear background (dark cosmic void)
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, width, height);

    // Draw synthetic radargram echogram scanlines
    const numTraces = 64;
    const traceWidth = width / numTraces;

    for (let i = 0; i < numTraces; i++) {
      const x = i * traceWidth;
      for (let y = 0; y < height; y += 2) {
        const depthM = (y / height) * 5.0; // 0 to 5m depth
        let echoIntensity = 0;

        // Surface reflection (Z = 0)
        if (depthM < 0.25) {
          echoIntensity = Math.exp(-Math.pow(depthM - 0.1, 2) / 0.01) * 0.9;
        } 
        // Subsurface dielectric interface (Regolith -> Water Ice permafrost)
        else if (Math.abs(depthM - iceLayerDepth) < 0.4) {
          const delta = depthM - iceLayerDepth;
          echoIntensity = Math.exp(-Math.pow(delta, 2) / 0.04) * (isIceRich ? 0.85 : 0.35);
        }
        // Bottom interface (Ice -> Bedrock)
        else if (Math.abs(depthM - (iceLayerDepth + iceThickness)) < 0.4) {
          const delta = depthM - (iceLayerDepth + iceThickness);
          echoIntensity = Math.exp(-Math.pow(delta, 2) / 0.04) * (isIceRich ? 0.65 : 0.25);
        } else {
          // Volume scattering noise (coherent backscatter speckle)
          const speckle = Math.sin(i * 0.4 + y * 0.3) * Math.cos(i * 0.2 - y * 0.4);
          echoIntensity = Math.max(0, speckle * (isIceRich && depthM >= iceLayerDepth && depthM <= iceLayerDepth + iceThickness ? 0.45 : 0.12));
        }

        // Add subtle horizontal radar trace noise
        const noise = (Math.random() - 0.5) * 0.08;
        const total = Math.min(1, Math.max(0, echoIntensity + noise));

        // Radar colormap: Dark Blue -> Cyan -> Ice White
        const r = Math.floor(total * 80);
        const g = Math.floor(total * 210);
        const b = Math.floor(180 + total * 75);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, traceWidth + 1, 2);
      }
    }

    // Draw probe depth horizontal reticle line
    const probeY = (probeDepth / 5.0) * height;
    ctx.strokeStyle = '#ffd740';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, probeY);
    ctx.lineTo(width, probeY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Ice Horizon Label Bracket
    const iceY1 = (iceLayerDepth / 5.0) * height;
    const iceY2 = ((iceLayerDepth + iceThickness) / 5.0) * height;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(0, iceY1, width, iceY2 - iceY1);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, iceY1, width, iceY2 - iceY1);

  }, [crater, isIceRich, iceLayerDepth, iceThickness, probeDepth]);

  return (
    <div className="glass-instrument hud-corner-bracket" style={{ padding: '0.85rem 1rem', borderRadius: '3px', color: '#f4f4f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.72rem' }}>DFSAR SUBSURFACE RADARGRAM</span>
          <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: '0.55rem', padding: '0.1rem 0.35rem', borderRadius: 2 }}>
            L-BAND 24CM
          </span>
        </div>
        <span style={{ color: '#ffc857', fontSize: '0.62rem', fontFamily: 'var(--font-mono)' }}>
          DEPTH: 0 TO -5.0M
        </span>
      </div>

      {/* Synthetic Echogram Canvas */}
      <div style={{ position: 'relative', width: '100%', height: '140px', background: '#06080d', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <canvas ref={canvasRef} width={380} height={140} style={{ width: '100%', height: '100%', display: 'block' }} />
        
        {/* Radar Scale Legend Overlay */}
        <div style={{ position: 'absolute', left: '6px', top: '4px', fontSize: '0.55rem', color: '#94a3b8', fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
          0.0m (SURFACE REGOLITH)
        </div>
        <div style={{ position: 'absolute', left: '6px', top: `${(iceLayerDepth / 5.0) * 100}%`, fontSize: '0.55rem', color: '#38bdf8', fontFamily: 'var(--font-mono)', pointerEvents: 'none', transform: 'translateY(-50%)' }}>
          ◄ ICE HORIZON (-{iceLayerDepth}m)
        </div>
        <div style={{ position: 'absolute', left: '6px', bottom: '4px', fontSize: '0.55rem', color: '#94a3b8', fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
          -5.0m (BASAL BEDROCK)
        </div>
      </div>

      {/* Depth Scrubber Control */}
      <div style={{ marginTop: '0.65rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
          <span>RADAR PROBE SOUNDING DEPTH:</span>
          <span style={{ color: '#ffd740', fontWeight: 600 }}>-{probeDepth.toFixed(1)} m</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="4.8"
          step="0.1"
          value={probeDepth}
          onChange={(e) => setProbeDepth(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#ffd740' }}
        />
      </div>

      {/* Telemetry Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginTop: '0.55rem', fontFamily: 'var(--font-mono)', fontSize: '0.62rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.45rem', borderRadius: '3px' }}>
          <div style={{ color: '#64748b', fontSize: '0.55rem' }}>TWO-WAY TRAVEL</div>
          <div style={{ color: '#f8fafc', fontWeight: 600 }}>{twttNs} ns</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.45rem', borderRadius: '3px' }}>
          <div style={{ color: '#64748b', fontSize: '0.55rem' }}>PERMITTIVITY (εr)</div>
          <div style={{ color: probeDepth >= iceLayerDepth ? '#38bdf8' : '#cbd5e1', fontWeight: 600 }}>
            {probeDepth >= iceLayerDepth ? '3.15 (Ice)' : '2.70 (Soil)'}
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.45rem', borderRadius: '3px' }}>
          <div style={{ color: '#64748b', fontSize: '0.55rem' }}>ICE CONCENTRATION</div>
          <div style={{ color: estIceWt.includes('4.8') ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
            {estIceWt}
          </div>
        </div>
      </div>
    </div>
  );
}
