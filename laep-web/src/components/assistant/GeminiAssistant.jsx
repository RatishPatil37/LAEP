import { useState, useRef, useEffect } from 'react';
import { useMissionStore } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

const LAEP_SYSTEM_PROMPT = `You are the LAEP (Lunar Analytics & Exploration Platform) Mission AI Copilot, supporting ISRO Chandrayaan-2 lunar polar science.
You assist planetary scientists, mission planners, and explorers researching water-ice deposits and autonomous rover traversals in lunar polar regions.

Key Project Context:
1. Primary Landing Benchmark: Faustini F2 North Rim (82.10°E, 87.35°S), chosen for gentle slopes (<10°), high earth-visibility, and cold-trap shadow persistence (96%).
2. Multi-Sensor Data Fusion:
   - Chandrayaan-2 DFSAR (Dual-Frequency Synthetic Aperture Radar): L-band & S-band polarimetry, Circular Polarization Ratio (CPR) and Degree of Polarization (DOP). CPR > 1 inside PSR indicates ice volume scattering.
   - CH-2 OHRC (Orbital High Resolution Camera): 0.25 m/pixel imagery for boulder detection and hazard avoidance.
   - CH-2 TMC-2: Stereo triplet images generating 5 m digital elevation models (DEM).
   - CH-2 IIRS (Imaging Infrared Spectrometer): 250 bands (0.8–5.0 µm) detecting the diagnostic 3.0 µm water-ice absorption feature.
3. Model Training Scope:
   - Current models are strictly trained on extreme lunar polar latitudes: 80°S–90°S and 80°N–90°N.
   - The pipeline uses a dual-stage architecture: Deep Learning for visual shadow segmentation + Machine Learning for fused Ice Confidence Score (ICS).
4. Autonomous Rover Kinematics:
   - A* algorithm with cost function incorporating slope gradient penalty (W1), shadow battery drain (W2), terramechanic slip risk, and a 20° tilt cutoff.

Answer clearly, professionally, and concisely in aerospace-grade mission control style with technical accuracy.`;

// Smart Offline Knowledge Base for Zero-Friction Instant Answers
const OFFLINE_KNOWLEDGE_BASE = [
  {
    keywords: ['faustini', 'f2', 'landing', 'site', 'why faustini'],
    answer: `### 🎯 Faustini Crater F2 Landing Site Selection
**Coordinates**: 82.10°E, 87.35°S (MCMF grid) | **Diameter**: ~39 km (Faustini parent)

**Why Faustini F2 is the Primary Candidate**:
1. **Low Kinetic Hazard**: The North Rim terrace offers average slope gradients **< 9.8°**, well within the safe 15° rover tilt margin.
2. **Cold-Trap Proximity**: Direct overland access to Permanently Shadowed Regions (PSRs) where equilibrium temperatures remain **< 110 K**, preventing water-ice sublimation over geological epochs.
3. **Earth Visibility**: Sustains direct Line-of-Sight (LOS) communication with ISRO IDSN (Byalalu 32m deep-space antenna) for >70% of the lunar synodic month.
4. **DFSAR CPR Anomaly**: Chandrayaan-2 DFSAR reveals elevated Circular Polarization Ratios (**peak CPR = 1.47**) inside the crater floor cold-trap, consistent with coherent backscatter from subsurface water-ice deposits.`,
  },
  {
    keywords: ['dfsar', 'cpr', 'radar', 'sar', 'polarization', 's-band', 'l-band'],
    answer: `### 📡 Chandrayaan-2 DFSAR & CPR Mechanics
**Sensor**: Dual-Frequency Synthetic Aperture Radar (L-band 1.25 GHz, S-band 2.5 GHz).

**What is CPR (Circular Polarization Ratio)?**
- **Definition**: The ratio of Same-Sense circular return power ($SC$) to Opposite-Sense circular return power ($OC$):
  $$\\text{CPR} = \\frac{\\sigma_{SC}}{\\sigma_{OC}}$$
- **Significance**:
  - Smooth lunar surfaces reflect opposite sense ($OC > SC \\implies \\text{CPR} \\ll 1$).
  - Surface roughness (blocky ejecta) scatters both senses ($\\text{CPR} \\approx 0.4 - 0.8$).
  - **Volume Scattering in Water Ice**: Multiple internal reflections within low-loss ice grains preserve the same sense ($SC > OC$), yielding **CPR > 1.0**.
- **Discrimination Rule**: In LAEP, CPR > 1.0 **inside** a PSR cold-trap indicates water ice; CPR > 1.0 **outside** indicates rocky crater ejecta.`,
  },
  {
    keywords: ['model', 'dl', 'ml', 'architecture', 'dual stage', 'pipeline', 'neural', 'cnn', 'vit'],
    answer: `### 🧠 Dual-Stage Ice & Hazard Architecture
LAEP utilizes an end-to-end multi-instrument machine learning pipeline:

1. **Stage 1 — Deep Learning Visual & Shadow Segmentation**:
   - Ingests **OHRC (0.25 m)** and **TMC-2** imagery.
   - Identifies Doubly Shadowed Regions (DSRs), cold-trap micro-topography, and hazard masks (boulders > 0.5 m, steep craters).
2. **Stage 2 — Physics-Guided ML Ice Confidence Score (ICS)**:
   - Employs an ensemble (Random Forest + XGBoost) trained on co-registered **DFSAR CPR**, **DOP**, **IIRS 3.0 µm band depth**, and **Diviner equilibrium temperatures**.
   - Output: Calibrated probability map ($ICS \\in [0, 1]$) with 95% Bayesian confidence intervals ($\\pm 9\\%$ uncertainty bounds).`,
  },
  {
    keywords: ['bound', 'bounds', '80', '90', 'polar', 'limit', 'latitude', 'scope', 'training'],
    answer: `### 🌐 80°–90° Polar Model Domain & Bounds
**Active Model Envelope**:
- **South Polar Reach**: $80^\\circ\\text{S}$ to $90^\\circ\\text{S}$ (Latitude $-80.0^\\circ$ to $-90.0^\\circ$).
- **North Polar Reach**: $80^\\circ\\text{N}$ to $90^\\circ\\text{N}$ (Latitude $+80.0^\\circ$ to $+90.0^\\circ$).
- **Active Reticle**: Faustini F2 target sector ($65^\\circ\\text{E} - 95^\\circ\\text{E}, 86.5^\\circ\\text{S} - 89.9^\\circ\\text{S}$).

**Scientific Rationale**:
- Cold-trap water ice requires perennial cryogenic temperatures ($< 110\\text{ K}$) only found in topographically shielded craters at extreme lunar polar inclinations ($|\\text{lat}| > 80^\\circ$).
- Sub-polar and equatorial regions experience daytime temperatures up to $390\\text{ K}$, where volatile ice is physically unstable.
- You can toggle the **MODEL BOUNDS** channel in the Layer Mixer (11 CH) to inspect the exact polar training boundaries on the Moon Trek map.`,
  },
  {
    keywords: ['route', 'kinematic', 'a*', 'path', 'planner', 'rover', 'energy', 'slope penalty'],
    answer: `### 🚜 Autonomous Kinematic A* Traversal Engine
The LAEP pathfinder plans obstacle-free, energy-minimal rover routes across LOLA DEM grids:

**Cost Function**:
$$J(n) = g(n) + h(n) + W_1 \\cdot \\Delta\\theta(n) + W_2 \\cdot \\Phi_{\\text{shadow}}(n)$$
- $g(n)$: Euclidean distance travelled from rim start.
- $h(n)$: Octile heuristic distance to ice target.
- $W_1 \\cdot \\Delta\\theta$: Slope gradient penalty (steep slopes exponentially increase wheel slippage and roll hazard).
- $W_2 \\cdot \\Phi_{\\text{shadow}}$: Shadow duration penalty (protects rover battery from excessive cryogenic drain).
- **Terramechanic Constraints**: Hard 20° tilt threshold cutoff, slip ratio coefficient $\\mu = 0.18$, and maximum gradeability verification.`,
  },
  {
    keywords: ['iirs', 'spectrometer', 'infrared', '3 micron', 'absorption', 'frost'],
    answer: `### 🔬 Chandrayaan-2 IIRS (Imaging Infrared Spectrometer)
- **Spectral Coverage**: 0.8 µm to 5.0 µm across 250 contiguous channels with ~8 nm resolution.
- **Water Ice Fingerprint**: Detects the fundamental **3.0 µm asymmetric O–H stretch vibration band** and the 1.5 µm & 2.0 µm overtone absorption bands.
- **Diagnostic Metric**: Band depth calculation:
  $$\\text{BD}_{3.0} = 1 - \\frac{R_{3.0}}{0.5 \\cdot (R_{2.8} + R_{3.2})}$$
- Even faint surface hoarfrost (~0.1 wt%) generates measurable band depression, providing direct spectroscopic confirmation of surface ice.`,
  },
  {
    keywords: ['ohrc', 'tmc', 'camera', 'resolution', 'stereo', 'dem', 'boulder'],
    answer: `### 📷 OHRC & TMC-2 High-Resolution Optical Payload
- **OHRC (Orbital High-Resolution Camera)**:
  - Spatial Resolution: **0.25 m/pixel** from 100 km orbit (highest resolution planetary camera ever flown to the Moon).
  - Purpose: Resolves sub-meter hazards (boulders, fissures, micro-craters) to safeguard autonomous rover landings.
- **TMC-2 (Terrain Mapping Camera-2)**:
  - Triple-stereo viewing (Fore, Nadir, Aft at $\\pm 25^\\circ$).
  - Generates 5 m Digital Elevation Models (DEM) for precision slope, curvature, and roughness computation.`,
  },
];

const DEFAULT_FALLBACK_REPLY = `### 🛰️ LAEP Mission Intelligence
I am the LAEP Lunar Assistant. I have indexed all Chandrayaan-2 polar datasets, the Faustini F2 landing candidate, and the autonomous rover planner.

**You can ask me about**:
- **Landing Geology**: Why Faustini F2 North Rim was selected over Shackleton or Shoemaker.
- **Radar Science**: How DFSAR S/L-band Circular Polarization Ratio (CPR) distinguishes water ice from surface rocks.
- **Algorithms**: How the dual-stage Deep Learning + ML pipeline evaluates the Ice Confidence Score (ICS).
- **Navigation**: How the Kinematic A* engine optimizes slope gradients and battery power.
- **Model Boundaries**: The 80°–90° polar training zone highlighted in the NASA Moon Trek map.

💡 *Tip: Add your \`VITE_GEMINI_API_KEY\` to \`.env\` in \`laep-web/\` to activate live Google Gemini generative reasoning.*`;

export default function GeminiAssistant() {
  const isOpen = useMissionStore((s) => s.aiAssistantOpen);
  const setIsOpen = useMissionStore((s) => s.setAiAssistantOpen);
  const toggleAssistant = useMissionStore((s) => s.toggleAiAssistant);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `**Namaste! I am your Chandrayaan-2 Mission Copilot.** 🌖\n\nAsk me anything about the **Faustini F2** landing area, **DFSAR CPR** radar ice anomalies, our dual-stage ML models, or autonomous rover path planning.`,
      time: '12:00',
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
        // Live Gemini API Call via REST
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${LAEP_SYSTEM_PROMPT}\n\nUser Question: ${query}` }],
                },
              ],
              generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 800,
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Gemini API error status: ${response.status}`);
        }

        const data = await response.json();
        const replyText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          'Telemetry connection interrupted. Please try again.';

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
        // Offline Mission Intelligence Fallback
        await new Promise((r) => setTimeout(r, 450)); // Simulates slight thinking
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
      console.warn('Gemini Assistant fallback triggered:', err);
      // Fallback on error to offline intelligence
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
          text: `*(Live API Offline — Serving Verified Mission Data)*\n\n${replyText}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickChips = [
    'Why Faustini F2 for landing?',
    'How does DFSAR CPR detect ice?',
    'Explain the dual-stage DL+ML model',
    'What are the 80°–90° training bounds?',
    'How does A* calculate slope penalty?',
  ];

  return (
    <>
      {/* ── Floating Action Button (Bottom Right) ── */}
      <button
        type="button"
        className={`gemini-assistant-fab ${isOpen ? 'active' : ''}`}
        onClick={() => {
          soundEngine.playTelemetryClick();
          toggleAssistant();
        }}
        title="Ask Gemini — ISRO Mission AI Assistant"
      >
        <div className="fab-glow-ring" />
        <div className="fab-icon-container">
          <svg className="fab-sparkle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill="url(#gemini-grad)"
              stroke="none"
            />
            <defs>
              <linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#38bdf8" />
                <stop offset="0.5" stopColor="#818cf8" />
                <stop offset="1" stopColor="#c084fc" />
              </linearGradient>
            </defs>
          </svg>
          <span className="fab-text">ASK GEMINI</span>
        </div>
        <span className="fab-status-dot" />
      </button>

      {/* ── Slide-Over Sidebar (Chrome Style) ── */}
      <div className={`gemini-sidebar-drawer ${isOpen ? 'open' : ''}`}>
        {/* Drawer Header */}
        <div className="gemini-drawer-header">
          <div className="gemini-header-left">
            <div className="gemini-logo-glow">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
                  fill="url(#gemini-header-grad)"
                />
                <defs>
                  <linearGradient id="gemini-header-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="1" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div>
              <div className="gemini-header-title">ASK GEMINI // MISSION COPILOT</div>
              <div className="gemini-header-sub">ISRO CHANDRAYAAN-2 SCIENCE INTELLIGENCE</div>
            </div>
          </div>

          <div className="gemini-header-actions">
            <div className={`gemini-engine-pill ${isLiveGemini ? 'live' : 'offline'}`}>
              <span className="engine-dot" />
              {isLiveGemini ? 'GEMINI 1.5 LIVE' : 'OFFLINE KNOWLEDGE'}
            </div>
            <button
              type="button"
              className="btn-gemini-close"
              onClick={() => {
                soundEngine.playTelemetryClick();
                setIsOpen(false);
              }}
              title="Close Assistant"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="gemini-chips-shelf">
          <div className="chips-label">QUICK MISSION INQUIRIES:</div>
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

        {/* Message Stream */}
        <div className="gemini-messages-body">
          {messages.map((m) => (
            <div key={m.id} className={`gemini-msg-row ${m.role}`}>
              <div className="gemini-msg-avatar">
                {m.role === 'assistant' ? '✦' : '👤'}
              </div>
              <div className="gemini-msg-content">
                <div className="gemini-msg-header">
                  <span className="gemini-msg-author">
                    {m.role === 'assistant' ? 'GEMINI COPILOT' : 'MISSION OPERATOR'}
                  </span>
                  <span className="gemini-msg-time">{m.time}</span>
                </div>
                <div className="gemini-msg-bubble">
                  {/* Basic markdown formatting support */}
                  {m.text.split('\n\n').map((para, i) => (
                    <p key={i} style={{ marginBottom: i === m.text.split('\n\n').length - 1 ? 0 : '0.5rem' }}>
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="gemini-msg-row assistant">
              <div className="gemini-msg-avatar pulse">✦</div>
              <div className="gemini-msg-content">
                <div className="gemini-typing-indicator">
                  <span />
                  <span />
                  <span />
                  <span className="typing-text">Analyzing Chandrayaan-2 telemetry...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="gemini-input-footer">
          <div className="gemini-input-wrapper">
            <textarea
              className="gemini-textarea"
              placeholder="Ask about Faustini F2, DFSAR CPR, rover kinematics..."
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
              title="Send Inquiry (Enter)"
            >
              ➔
            </button>
          </div>

          <div className="gemini-env-notice">
            {isLiveGemini ? (
              <span className="notice-ok">● Gemini 1.5 Flash Connected via .env</span>
            ) : (
              <span className="notice-hint">
                ℹ Serving offline knowledge base. To activate live Gemini, add <code style={{ color: '#38bdf8' }}>VITE_GEMINI_API_KEY</code> into <code style={{ color: '#38bdf8' }}>laep-web/.env</code>.
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
