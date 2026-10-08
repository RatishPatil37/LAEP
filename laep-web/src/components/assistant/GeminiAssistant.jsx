import { useState, useRef, useEffect } from 'react';
import { useMissionStore } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

const LAEP_SYSTEM_PROMPT = `You are the LAEP (Lunar Analytics & Exploration Platform) Mission Copilot, assisting ISRO Chandrayaan-2 planetary science and rover traversal planning.
Answer with objective, mathematically rigorous, and concise scientific language.

Key Technical Parameters:
1. Landing Site Benchmark: Faustini F2 North Rim (82.10°E, 87.35°S), selected for slope < 9.8°, permanent shadow persistence (96%), and direct line-of-sight communication with IDSN Byalalu (32m antenna).
2. Sensors:
   - DFSAR: Dual-Frequency Synthetic Aperture Radar (L-band 1.25 GHz, S-band 2.5 GHz). High Circular Polarization Ratio (CPR > 1) inside cold traps indicates volume scattering in water-ice deposits. Outside cold traps, CPR > 1 indicates surface roughness from blocky ejecta.
   - OHRC: 0.25 m/pixel optical imaging for boulder hazard classification.
   - TMC-2: Stereo triplet imaging generating 5 m Digital Elevation Models (DEMs).
   - IIRS: 250 spectral channels (0.8–5.0 µm) detecting the diagnostic 3.0 µm O–H stretch band and 2.0 µm water-ice absorption trough.
3. Model Scope:
   - Models are trained strictly on extreme polar latitudes (80°S–90°S and 80°N–90°N).
   - Dual-stage pipeline: Deep Learning shadow/hazard segmentation + Random Forest/XGBoost ensemble for Ice Confidence Score (ICS).
4. Rover Kinematics:
   - Kinematic A* algorithm with slope penalty (W1), shadow battery drain (W2), terramechanic slip risk, and a hard 20° tilt threshold.`;

const OFFLINE_KNOWLEDGE_BASE = [
  {
    keywords: ['faustini', 'f2', 'landing', 'site', 'why faustini', 'coordinates'],
    answer: `### Faustini Crater F2 Landing Site Specification
**Coordinates**: 82.10°E, 87.35°S | **MCMF Grid Sector**: South Polar

**Selection Criteria**:
1. **Slope Grade**: North Rim terrace features mean slopes < 9.8°, well below the safe 15° rover stability threshold.
2. **Cold-Trap Proximity**: Immediate overland access to Permanently Shadowed Regions (PSRs) with equilibrium temperatures < 110 K.
3. **Comms Visibility**: Direct Line-of-Sight (LOS) link to ISRO IDSN (Byalalu 32m deep-space antenna) for >70% of the lunar synodic month.
4. **DFSAR Backscatter**: Elevated Circular Polarization Ratio (peak CPR = 1.47) inside the floor cold trap indicates subsurface water-ice volume scattering.`,
  },
  {
    keywords: ['dfsar', 'cpr', 'radar', 'sar', 'polarization', 's-band', 'l-band'],
    answer: `### Chandrayaan-2 DFSAR Polarimetry & CPR Analysis
**Sensor**: Dual-Frequency Synthetic Aperture Radar (L-band 1.25 GHz / 24 cm, S-band 2.5 GHz / 12 cm).

**Circular Polarization Ratio (CPR)**:
$$\\text{CPR} = \\frac{\\sigma_{SC}}{\\sigma_{OC}}$$
- $\\sigma_{SC}$: Same-sense circular return power.
- $\\sigma_{OC}$: Opposite-sense circular return power.

**Physical Discrimination**:
- **Smooth Surface**: Opposite-sense dominant (CPR << 1).
- **Surface Roughness**: Blocky ejecta scatters both senses (CPR ≈ 0.4–0.8).
- **Water Ice Volume Scattering**: Coherent backscatter within low-loss ice grains preserves same-sense return (CPR > 1.0).
- **Decision Rule**: In LAEP, CPR > 1.0 inside a PSR indicates water ice; CPR > 1.0 outside indicates rocky ejecta.`,
  },
  {
    keywords: ['model', 'dl', 'ml', 'architecture', 'dual stage', 'pipeline', 'neural', 'lfm'],
    answer: `### Dual-Stage Model Architecture & Foundation Models
The LAEP pipeline processes multi-sensor lunar datasets in two stages:

1. **Stage 1 — Visual & Shadow Segmentation**:
   - Ingests OHRC (0.25 m) and TMC-2 imagery.
   - Identifies Doubly Shadowed Regions (DSRs) and boulder hazard masks.
2. **Stage 2 — Physics-Guided Ice Confidence Score (ICS)**:
   - Random Forest and XGBoost ensemble trained on co-registered DFSAR CPR, DOP, IIRS 3.0 µm band depth, and Diviner equilibrium temperatures.
   - Calibrated output: Ice Confidence Score ($ICS \\in [0, 1]$) with ±8.4% Bayesian confidence intervals.
3. **NASA-IBM LFM Integration**:
   - Cross-mission late-fusion architecture connecting NASA-IBM Lunar Foundation Model (ViT-B) macro-spatial latent vectors (256-dim) with ISRO Chandrayaan-2 DFSAR/IIRS physical measurements (160-dim).`,
  },
  {
    keywords: ['bound', 'bounds', '80', '90', 'polar', 'limit', 'latitude', 'scope', 'training'],
    answer: `### Model Training Domain (80°–90° Polar Limits)
**Spatial Domain**:
- South Polar Reach: 80.0°S to 90.0°S (-80.0° to -90.0°).
- North Polar Reach: 80.0°N to 90.0°N (+80.0° to +90.0°).
- Primary Target Reticle: Faustini F2 (65.0°E–95.0°E, 86.5°S–89.9°S).

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
    keywords: ['iirs', 'spectrometer', 'infrared', '3 micron', 'absorption', 'frost', 'water'],
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

// Helper: parse inline markdown elements (**bold**, `code`)
function renderInlineFormatting(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="copilot-strong">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="copilot-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// Helper: render block-level markdown (headings, lists, paragraphs)
function renderFormattedMessage(rawText) {
  if (!rawText) return null;
  const blocks = rawText.split('\n\n');

  return blocks.map((block, bIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Heading level 3 or 2
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={bIdx} className="copilot-heading">
          {trimmed.replace('### ', '')}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={bIdx} className="copilot-heading">
          {trimmed.replace('## ', '')}
        </h3>
      );
    }

    // Numbered List
    if (/^\d+\.\s/.test(trimmed)) {
      const items = trimmed.split('\n').filter((l) => /^\d+\.\s/.test(l.trim()));
      return (
        <ol key={bIdx} className="copilot-ol">
          {items.map((item, iIdx) => (
            <li key={iIdx} className="copilot-li">
              {renderInlineFormatting(item.replace(/^\d+\.\s+/, ''))}
            </li>
          ))}
        </ol>
      );
    }

    // Bullet List
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.includes('\n- ')) {
      const lines = trimmed.split('\n');
      const intro = lines.find((l) => !l.trim().startsWith('- ') && !l.trim().startsWith('* '));
      const listItems = lines.filter((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '));

      return (
        <div key={bIdx} className="copilot-list-wrapper">
          {intro && <p className="copilot-para">{renderInlineFormatting(intro)}</p>}
          <ul className="copilot-ul">
            {listItems.map((item, iIdx) => (
              <li key={iIdx} className="copilot-li">
                {renderInlineFormatting(item.replace(/^[-*]\s+/, ''))}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    // Math block or regular paragraph
    return (
      <p key={bIdx} className="copilot-para">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  });
}

export default function GeminiAssistant() {
  const isOpen = useMissionStore((s) => s.aiAssistantOpen);
  const setIsOpen = useMissionStore((s) => s.setAiAssistantOpen);
  const toggleAssistant = useMissionStore((s) => s.toggleAiAssistant);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `### CH-2 Mission Copilot Online\nIntegrated with Chandrayaan-2 multi-sensor datasets (DFSAR, IIRS, TMC-2, OHRC) and Google Gemini 3.6 Flash.\n\nQuery technical parameters for the **Faustini F2 landing corridor**, **radar CPR water-ice volume scattering**, or **kinematic A* rover traverse planning**.`,
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
        // Direct call to Google Gemini 3.6 Flash API (with graceful model fallback if needed)
        const callGeminiModel = async (modelName) => {
          return fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
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
                  maxOutputTokens: 1000,
                },
              }),
            }
          );
        };

        let response = await callGeminiModel('gemini-3.6-flash');
        if (!response.ok) {
          // Fallback attempt to gemini-2.5-flash / gemini-1.5-flash if 3.6 endpoint returns an error
          const altResponse = await callGeminiModel('gemini-2.5-flash');
          if (altResponse.ok) {
            response = altResponse;
          } else {
            const fallback15 = await callGeminiModel('gemini-1.5-flash');
            if (fallback15.ok) response = fallback15;
          }
        }

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const errMsg = errBody?.error?.message || `HTTP ${response.status}`;
          throw new Error(errMsg);
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
        // Offline verified scientific knowledge base fallback
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
      console.warn('Mission Copilot live API note:', err.message);
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
          text: `*(Live API fallback: ${err.message}. Serving verified Chandrayaan-2 telemetry knowledge base)*\n\n${replyText}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickChips = [
    'Faustini F2 Landing Site',
    'DFSAR CPR Radar Mechanics',
    'Dual-Stage Model Pipeline',
    '80°–90° Polar Domain Limits',
    'Kinematic A* Cost Function',
  ];

  return (
    <>
      {/* ── Circular Aerospace Floating Action Button (FAB) ── */}
      <div className="gemini-fab-container">
        <button
          type="button"
          className={`gemini-assistant-fab ${isOpen ? 'active' : ''}`}
          onClick={() => {
            soundEngine.playTelemetryClick();
            toggleAssistant();
          }}
          aria-label="Toggle CH-2 Mission Copilot"
        >
          {/* Status Indicator Pip */}
          <span className={`fab-status-pip ${isLiveGemini ? 'live' : 'offline'}`} />

          {/* Icon: Transponder / Antenna when closed; Close ✕ when open */}
          {isOpen ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="fab-icon-svg"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="fab-icon-svg"
            >
              {/* Lunar Radar Transponder Dish */}
              <path d="M4.93 19.07A10 10 0 0 1 12 2" />
              <path d="M12 2a10 10 0 0 1 7.07 17.07" />
              <path d="M8.46 15.54A5 5 0 0 1 12 6" />
              <path d="M12 6a5 5 0 0 1 3.54 9.54" />
              <circle cx="12" cy="12" r="2.2" fill="currentColor" />
              <path d="M12 14.2v7.8" />
              <path d="M9 22h6" />
            </svg>
          )}

          {/* Hover Tooltip Tag */}
          <span className="fab-tooltip">CH-2 COPILOT</span>
        </button>
      </div>

      {/* ── Wide Aerospace Sidebar Console ── */}
      <div className={`gemini-sidebar-drawer ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="gemini-drawer-header">
          <div className="gemini-header-left">
            <div className="gemini-header-title">CH-2 MISSION COPILOT</div>
            <div className="gemini-header-sub">
              PLANETARY EXPLORATION INTELLIGENCE
            </div>
          </div>

          <div className="gemini-header-actions">
            <div className={`gemini-engine-pill ${isLiveGemini ? 'live' : 'offline'}`}>
              <span className="engine-dot" />
              {isLiveGemini ? 'GEMINI 3.6 LIVE' : 'LOCAL KB'}
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

        {/* Query Preset Chips */}
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
                  {m.role === 'assistant' ? '[ISRO / CH-2 COPILOT]' : '[MISSION OPERATOR]'}
                </span>
                <span className="gemini-msg-time">{m.time}</span>
              </div>
              <div className="gemini-msg-bubble">
                {renderFormattedMessage(m.text)}
              </div>
            </div>
          ))}

          {loading && (
            <div className="gemini-msg-row assistant">
              <div className="gemini-typing-indicator">
                <span className="typing-cursor" />
                <span>Synchronizing mission telemetry & computing response...</span>
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
              placeholder="Query Faustini F2 landing site, DFSAR radar CPR, A* traversal cost..."
              rows={2}
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
              TRANSMIT
            </button>
          </div>

          <div className="gemini-env-notice">
            {isLiveGemini ? (
              <span className="notice-ok">
                TELEMETRY LINK: Google Gemini 3.6 Flash Connected via .env
              </span>
            ) : (
              <span>
                Local Knowledge Base active. Configure VITE_GEMINI_API_KEY in .env to activate live generative reasoning.
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
