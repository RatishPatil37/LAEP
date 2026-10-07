import { useState, useRef, useEffect } from 'react';
import { useMissionStore } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

const LAEP_SYSTEM_PROMPT = `You are the LAEP (Lunar Analytics & Exploration Platform) Mission Copilot, assisting ISRO Chandrayaan-2 planetary science and mission planning.
Answer with objective, concise, and technically rigorous language without conversational fluff.

Key Technical Parameters:
1. Landing Site Benchmark: Faustini F2 North Rim (82.10°E, 87.35°S), selected for slope < 9.8°, permanent shadow persistence (96%), and direct line-of-sight communication with IDSN Byalalu.
2. Sensors:
   - DFSAR: Dual-Frequency Synthetic Aperture Radar (L-band 1.25 GHz, S-band 2.5 GHz). High Circular Polarization Ratio (CPR > 1) inside cold traps indicates volume scattering in water-ice deposits. Outside cold traps, CPR > 1 indicates surface roughness from blocky ejecta.
   - OHRC: 0.25 m/pixel optical imaging for boulder hazard classification.
   - TMC-2: Stereo triplet imaging generating 5 m DEMs.
   - IIRS: 250 spectral channels (0.8–5.0 µm) detecting the diagnostic 3.0 µm O–H stretch band and 2.0 µm water-ice absorption trough.
3. Model Scope:
   - Models are trained strictly on extreme polar latitudes (80°S–90°S and 80°N–90°N).
   - Dual-stage pipeline: Deep Learning shadow/hazard segmentation + Random Forest/XGBoost ensemble for Ice Confidence Score (ICS).
4. Rover Kinematics:
   - A* algorithm with slope penalty (W1), shadow battery drain (W2), terramechanic slip risk, and a hard 20° tilt threshold.`;

const OFFLINE_KNOWLEDGE_BASE = [
  {
    keywords: ['faustini', 'f2', 'landing', 'site', 'why faustini', 'coordinates'],
    answer: `### Faustini Crater F2 Landing Site Specification
**Coordinates**: 82.10°E, 87.35°S | **MCMF Grid Sector**: South Polar

**Selection Criteria**:
1. **Slope Grade**: North Rim terrace features mean slopes < 9.8°, below the safe 15° rover threshold.
2. **Cold-Trap Proximity**: Immediate overland access to Permanently Shadowed Regions (PSRs) with equilibrium temperatures < 110 K.
3. **Comms Visibility**: Direct Line-of-Sight (LOS) link to ISRO IDSN (Byalalu 32m deep-space antenna) for >70% of the lunar synodic month.
4. **DFSAR Backscatter**: Elevated Circular Polarization Ratio (peak CPR = 1.47) inside the floor cold trap indicates subsurface water ice.`,
  },
  {
    keywords: ['dfsar', 'cpr', 'radar', 'sar', 'polarization', 's-band', 'l-band'],
    answer: `### Chandrayaan-2 DFSAR Polarimetry & CPR Analysis
**Sensor**: Dual-Frequency Synthetic Aperture Radar (L-band 1.25 GHz, S-band 2.5 GHz).

**Circular Polarization Ratio (CPR)**:
$$\\text{CPR} = \\frac{\\sigma_{SC}}{\\sigma_{OC}}$$
- $\\sigma_{SC}$: Same-sense circular return power.
- $\\sigma_{OC}$: Opposite-sense circular return power.

**Physical Discrimination**:
- **Smooth Surface**: Opposite-sense dominant (CPR << 1).
- **Surface Roughness**: Blocky ejecta scatters both senses (CPR ≈ 0.4–0.8).
- **Water Ice Volume Scattering**: Coherent backscatter within low-loss ice grains preserves same-sense return (CPR > 1.0).
- **Criterion**: In LAEP, CPR > 1.0 inside a PSR indicates water ice; CPR > 1.0 outside indicates rocky ejecta.`,
  },
  {
    keywords: ['model', 'dl', 'ml', 'architecture', 'dual stage', 'pipeline', 'neural'],
    answer: `### Dual-Stage Model Architecture
The LAEP pipeline processes multi-sensor lunar datasets in two stages:

1. **Stage 1 — Visual & Shadow Segmentation**:
   - Ingests OHRC (0.25 m) and TMC-2 imagery.
   - Identifies Doubly Shadowed Regions (DSRs) and boulder hazard masks.
2. **Stage 2 — Physics-Guided Ice Confidence Score (ICS)**:
   - Random Forest and XGBoost ensemble trained on co-registered DFSAR CPR, DOP, IIRS 3.0 µm band depth, and Diviner equilibrium temperatures.
   - Calibrated output: Ice Confidence Score ($ICS \\in [0, 1]$) with ±9% Bayesian confidence intervals.`,
  },
  {
    keywords: ['bound', 'bounds', '80', '90', 'polar', 'limit', 'latitude', 'scope', 'training'],
    answer: `### Model Training Domain (80°–90° Polar Limits)
**Spatial Domain**:
- South Polar Reach: 80.0°S to 90.0°S (-80.0° to -90.0°).
- North Polar Reach: 80.0°N to 90.0°N (+80.0° to +90.0°).
- Primary Reticle: Faustini F2 (65.0°E–95.0°E, 86.5°S–89.9°S).

**Scientific Rationale**:
- Cryogenic cold traps (< 110 K) capable of retaining volatile water ice over geological timescales exist exclusively at extreme polar latitudes (|lat| > 80°).
- Sub-polar and equatorial surfaces reach 390 K during lunar day, sublimating volatile ice rapidly.
- Boundary line overlays can be toggled via the MODEL BOUNDS channel in the Layer Mixer.`,
  },
  {
    keywords: ['route', 'kinematic', 'a*', 'path', 'planner', 'rover', 'energy', 'slope penalty'],
    answer: `### Autonomous Kinematic A* Traversal Engine
Plans obstacle-free, energy-minimal rover paths across LOLA DEM grids.

**Cost Function**:
$$J(n) = g(n) + h(n) + W_1 \\cdot \\Delta\\theta(n) + W_2 \\cdot \\Phi_{\\text{shadow}}(n)$$
- $g(n)$: Cumulative traverse distance from start.
- $h(n)$: Octile distance heuristic to destination.
- $W_1 \\cdot \\Delta\\theta$: Slope gradient penalty (avoids rollover and wheel slip).
- $W_2 \\cdot \\Phi_{\\text{shadow}}$: Shadow duration penalty (limits battery drain).
- Hard constraint: 20° tilt cutoff with slip ratio coefficient $\\mu = 0.18$.`,
  },
  {
    keywords: ['iirs', 'spectrometer', 'infrared', '3 micron', 'absorption', 'frost'],
    answer: `### Chandrayaan-2 IIRS Spectrometer
- **Spectral Coverage**: 0.8 µm to 5.0 µm across 250 contiguous bands (~8 nm sampling).
- **Key Absorption Bands**: Detects the diagnostic 3.0 µm O–H fundamental stretch band and the 1.5 µm / 2.0 µm overtone troughs.
- **Band Depth Metric**:
  $$\\text{BD}_{3.0} = 1 - \\frac{R_{3.0}}{0.5 \\cdot (R_{2.8} + R_{3.2})}$$
- Positive band depth indicates surface frost or regolith-adsorbed hydroxyl molecules.`,
  },
  {
    keywords: ['ohrc', 'tmc', 'camera', 'resolution', 'stereo', 'dem', 'boulder'],
    answer: `### High-Resolution Imaging Payloads
- **OHRC (Orbital High Resolution Camera)**: 0.25 m/pixel spatial resolution from 100 km orbit for boulder hazard classification down to 0.5 m.
- **TMC-2 (Terrain Mapping Camera-2)**: Triplet stereo imaging (Fore, Nadir, Aft at ±25°) generating 5 m Digital Elevation Models (DEM) for slope and terrain roughness computation.`,
  },
];

const DEFAULT_FALLBACK_REPLY = `### LAEP Technical Reference
Chandrayaan-2 mission parameters and polar datasets are indexed:
- **Landing Site**: Faustini F2 North Rim (82.10°E, 87.35°S).
- **Radar Payload**: DFSAR CPR volume scattering vs. surface roughness discrimination.
- **Model Scope**: Dual-stage ML pipeline constrained to 80°–90° polar zones.
- **Path Planning**: Kinematic A* pathfinder with slope and shadow penalties.

To query live Google Gemini, configure \`VITE_GEMINI_API_KEY\` in \`laep-web/.env\`.`;

export default function GeminiAssistant() {
  const isOpen = useMissionStore((s) => s.aiAssistantOpen);
  const setIsOpen = useMissionStore((s) => s.setAiAssistantOpen);
  const toggleAssistant = useMissionStore((s) => s.toggleAiAssistant);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `**CH-2 Mission Copilot initialized.**\n\nQuery technical specifications for Faustini F2 landing geology, DFSAR CPR radar data, dual-stage ML ice models, or A* rover path planning.`,
      time: '00:00',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const isLiveGemini = Boolean(apiKey && apiKey.trim().length > 5);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (overrideText) => {
    const query = (overrideText || inputText).trim();
    if (!query || loading) return;

    soundEngine.playTelemetryClick();
    setInputText('');

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      if (isLiveGemini) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${LAEP_SYSTEM_PROMPT}\n\nTechnical Question: ${query}` }],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 800,
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`API response status: ${response.status}`);
        }

        const data = await response.json();
        const replyText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          'Telemetry connection interrupted. Repeat inquiry.';

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: replyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        soundEngine.playTargetAcquired();
      } else {
        await new Promise((r) => setTimeout(r, 200));
        const qLower = query.toLowerCase();

        const match = OFFLINE_KNOWLEDGE_BASE.find((item) =>
          item.keywords.some((kw) => qLower.includes(kw))
        );

        const replyText = match ? match.answer : DEFAULT_FALLBACK_REPLY;

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: replyText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        soundEngine.playTargetAcquired();
      }
    } catch (err) {
      console.warn('Mission Copilot offline fallback:', err);
      const qLower = query.toLowerCase();
      const match = OFFLINE_KNOWLEDGE_BASE.find((item) =>
        item.keywords.some((kw) => qLower.includes(kw))
      );
      const replyText = match ? match.answer : DEFAULT_FALLBACK_REPLY;

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `*(Live API Offline — Serving Offline Data)*\n\n${replyText}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickChips = [
    'Faustini F2 Landing Site',
    'DFSAR CPR Mechanics',
    'Dual-Stage Model Pipeline',
    '80°–90° Polar Domain Limits',
    'Kinematic A* Cost Function',
  ];

  return (
    <>
      {/* ── Utilitarian Trigger Button (Bottom Right) ── */}
      <button
        type="button"
        className={`gemini-assistant-fab ${isOpen ? 'active' : ''}`}
        onClick={() => {
          soundEngine.playTelemetryClick();
          toggleAssistant();
        }}
        title="Toggle CH-2 Mission Copilot"
      >
        <span className={`fab-status-dot ${isLiveGemini ? 'live' : ''}`} />
        <span className="fab-text">CH-2 COPILOT</span>
      </button>

      {/* ── Utilitarian Slide-Over Drawer ── */}
      <div className={`gemini-sidebar-drawer ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="gemini-drawer-header">
          <div className="gemini-header-left">
            <div className="gemini-header-title">CH-2 MISSION COPILOT</div>
            <div className="gemini-header-sub">PLANETARY SCIENCE CONSULTANT</div>
          </div>

          <div className="gemini-header-actions">
            <div className={`gemini-engine-pill ${isLiveGemini ? 'live' : 'offline'}`}>
              <span className="engine-dot" />
              {isLiveGemini ? 'GEMINI 1.5 LIVE' : 'LOCAL KB'}
            </div>
            <button
              type="button"
              className="btn-gemini-close"
              onClick={() => {
                soundEngine.playTelemetryClick();
                setIsOpen(false);
              }}
              title="Close Console"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Query Suggestion Chips */}
        <div className="gemini-chips-shelf">
          <div className="chips-label">QUERY PRESETS:</div>
          <div className="chips-scroll">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="gemini-chip-btn"
                onClick={() => handleSend(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Body */}
        <div className="gemini-messages-body">
          {messages.map((m) => (
            <div key={m.id} className={`gemini-msg-row ${m.role}`}>
              <div className="gemini-msg-header">
                <span className="gemini-msg-author">
                  {m.role === 'assistant' ? '[COPILOT]' : '[OPERATOR]'}
                </span>
                <span className="gemini-msg-time">{m.time}</span>
              </div>
              <div className="gemini-msg-bubble">
                {m.text.split('\n\n').map((para, i) => (
                  <p key={i} style={{ margin: i === 0 ? 0 : '0.45rem 0 0 0' }}>
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {loading && (
            <div className="gemini-msg-row assistant">
              <div className="gemini-typing-indicator">
                <span className="typing-cursor" />
                <span>Processing query telemetry...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="gemini-input-footer">
          <div className="gemini-input-wrapper">
            <textarea
              className="gemini-textarea"
              placeholder="Query Faustini F2, DFSAR CPR, A* kinematics..."
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="button"
              className="btn-gemini-send"
              onClick={() => handleSend()}
              disabled={!inputText.trim() || loading}
            >
              SEND
            </button>
          </div>

          <div className="gemini-env-notice">
            {isLiveGemini ? (
              <span className="notice-ok">API: Google Gemini 1.5 Flash Connected</span>
            ) : (
              <span>Local KB active. To enable live LLM, configure VITE_GEMINI_API_KEY in .env.</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
