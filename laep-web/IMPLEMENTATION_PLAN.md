
# LAEP — 95+/100 FRONTEND IMPLEMENTATION

The audit is approved.

Your job is now to transform LAEP from its current prototype into a **95+/100 production-quality lunar exploration interface**.

Do not interpret 95+/100 as "more animations" or "more effects."

The target is:

**Scientific credibility + exceptional UX + visual originality + functional depth + performance + accessibility + engineering quality.**

The repository remains the source of truth. The master design brief is the desired product vision, not proof that any feature/data currently exists.

---

# NON-NEGOTIABLE RULES

### 1. Never fake capability

Never fabricate:

* scientific measurements
* model outputs
* telemetry
* mission metrics
* datasets
* API responses
* evidence
* accuracy numbers
* route results
* operational status

Every displayed value must be:

`REAL | DERIVED | SIMULATED | UNAVAILABLE`

Make that distinction visible whenever it matters.

If a backend capability is unavailable, design the UI around that limitation rather than hiding it.

### 2. Preserve working functionality

The existing OpenLayers Explorer is the current functional baseline.

Do not destroy it while building the new experience.

Improve architecture incrementally.

### 3. No "AI slop"

Do not compensate for weak UX with:

* excessive glassmorphism
* neon everywhere
* giant gradients
* random glowing borders
* excessive particles
* fake HUDs
* decorative telemetry
* generic bento cards
* unnecessary 3D
* excessive scroll animations

Every visual element must have a reason.

### 4. Do not blindly follow the master prompt

The master prompt describes the intended experience.

Before implementing any feature:

**inspect the repository → verify available data/API/model → design around reality → implement.**

---

# TARGET EXPERIENCE

LAEP should feel like a serious:

**planetary intelligence + lunar GIS + mission planning + scientific analysis platform**

—not a student portfolio, SaaS dashboard, or sci-fi landing page.

The visual identity should communicate:

* precision
* scientific credibility
* exploration
* spatial intelligence
* aerospace instrumentation
* controlled cinematic presentation

Use:

* near-black lunar surfaces
* off-white typography
* restrained ice/cyan accents
* restrained solar amber
* hazard red
* editorial typography
* precise spacing
* subtle instrumentation
* real scientific visualizations

---

# 95+/100 QUALITY BAR

Before considering a milestone complete, evaluate it against these dimensions:

### Visual Design

* Strong visual hierarchy
* Distinctive LAEP identity
* Excellent typography
* Excellent spacing
* Consistent design tokens
* No visual clutter
* No generic dashboard patterns
* No unnecessary effects
* High-quality composition

### UX

* User immediately understands what LAEP does
* Clear interaction hierarchy
* Every major interaction gives feedback
* Navigation is predictable
* Important information is discoverable
* No dead-end experiences
* Loading/error/empty states are intentional

### Scientific UX

* Data provenance is understandable
* Uncertainty is visible
* Real vs simulated data is distinguishable
* Scientific terminology is accurate
* Visualizations communicate information rather than decoration

### Interaction

* 3D interactions feel physical
* Camera movement is smooth
* Controls feel responsive
* Hover/selection states are precise
* Motion has hierarchy
* Reduced-motion mode works

### Engineering

* Components are reusable
* Feature boundaries are clear
* State management is predictable
* No unnecessary dependencies
* No giant monolithic components
* No duplicated UI logic
* No console errors

### Performance

* Fast initial load
* 3D assets lazy-load
* No unnecessary WebGL work
* Mobile GPU is considered
* Assets are appropriately compressed
* No huge textures unnecessarily loaded
* Good fallback when WebGL is unavailable

### Responsive

Test at minimum:

* 1440px+
* 1280px
* 1024px
* 768px
* 390px
* 375px

Mobile must be intentionally designed, not simply compressed desktop.

### Accessibility

* Keyboard navigation
* Visible focus states
* Semantic HTML
* Appropriate ARIA where required
* Contrast
* Reduced motion
* Important scientific information available outside WebGL

---

# IMPLEMENTATION ORDER

Do not attempt the entire transformation in one pass.

Work through these vertical milestones:

## MILESTONE 1 — TRUTH + STABILITY

Fix:

* Production API configuration
* Route-method mismatch / 405
* Silent synthetic fallback
* False operational status
* Map initialization/sizing
* Image decoding failures
* Mobile overflow
* Existing runtime issues

Create a consistent data-state system:

```text
REAL
DERIVED
SIMULATED
UNAVAILABLE
```

Add provenance where appropriate.

The current Explorer must remain usable.

### Acceptance criteria

* No silent fake scientific output
* No misleading "System Online"
* Route failures are understandable
* Map initializes reliably
* 375px layout does not overflow
* Browser console is clean of application errors

---

# MILESTONE 2 — DESIGN SYSTEM + ARCHITECTURE

Establish the visual foundation before building large new screens.

Create reusable tokens for:

* colors
* typography
* spacing
* radius
* borders
* shadows
* motion
* z-index
* scientific status states

Create reusable primitives for:

* buttons
* navigation
* panels
* scientific metadata
* data status
* tooltips
* overlays
* drawers
* loading states
* error states
* empty states

Restructure where useful toward:

```text
app/
features/
scenes/
components/ui/
components/scientific/
data/
stores/
styles/
```

Do not restructure files purely for aesthetics.

---

# MILESTONE 3 — FLAGSHIP 3D MOON

This is the first major visual transformation.

Build a **real interactive Moon**, not a decorative 3D sphere.

Use:

* Three.js
* React Three Fiber
* Drei

Prefer:

**sphere + appropriate lunar texture/normal/displacement maps**

instead of unnecessarily heavy assets.

The Moon should support:

* realistic lighting
* slow rotation
* correct visual scale
* crater markers
* South Pole marker
* camera transitions
* selection
* hover states
* loading state
* error state
* WebGL fallback

The 3D scene must be lazy-loaded.

---

# CRATER INTELLIGENCE

Use actual crater locations/data available in the repository.

Interaction:

```text
Hover crater
→ subtle marker expansion
→ scientific metadata

Click crater
→ camera focuses crater
→ scientific panel opens
→ relevant evidence/data appears
```

The information panel must live in normal DOM/React UI, not only inside WebGL.

Use language such as:

* Ice Evidence
* Ice-Consistent Signal
* Evidence Strength
* Candidate Region
* Model Prediction
* Supporting Observations
* Uncertainty

Never use stronger scientific language than the underlying data supports.

---

# MILESTONE 4 — CINEMATIC HOMEPAGE

Only begin this after Milestones 1–3 are stable.

Transform the homepage into a continuous story:

```text
MOON
 ↓
SOUTH POLE
 ↓
REMOTE SENSING
 ↓
EVIDENCE
 ↓
TERRAIN
 ↓
REACHABILITY
 ↓
MISSION PLANNING
 ↓
EXPLORER
```

Do not make every se
