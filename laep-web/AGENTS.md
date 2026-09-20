
# LAEP — Codex Project Instructions

## Project

LAEP is a software-only lunar exploration and analysis platform combining machine learning, deep learning, space science, geospatial visualization and interactive planetary interfaces.

The current repository is a prototype. The objective is to evolve it into a technically credible, practical and production-grade project.

## Core Rules

- Read this file before making changes.
- Read the relevant skill before working on frontend, 3D or visual QA tasks.
- Preserve working functionality unless there is a clear reason to replace it.
- Do not invent scientific results, datasets, measurements or claims.
- Do not implement fake functionality merely to make the UI look complete.
- Clearly distinguish real data, derived analysis, simulation and placeholder content.
- Prefer practical implementation over unnecessary complexity.
- Do not modify backend/ML/DL logic during frontend-only tasks unless explicitly requested.
- Do not add dependencies without a clear technical reason.
- Avoid large unrelated refactors.
- Keep commits focused and coherent.

## Product Identity

LAEP should feel like a serious lunar exploration/scientific platform.

Visual direction:

- planetary mission control
- scientific GIS
- spatial computing
- aerospace instrumentation
- cinematic planetary exploration

Avoid:

- generic SaaS dashboards
- generic AI dashboards
- generic space landing pages
- excessive glassmorphism
- excessive neon
- unnecessary gradients
- meaningless cards
- fake telemetry
- decorative statistics
- excessive HUD elements
- AI-generated-looking layouts

## Scientific Integrity

Scientific credibility is more important than visual spectacle.

Never present:

- simulated values as observations
- estimated values as confirmed measurements
- synthetic data as real data
- model predictions as scientific certainty

Use appropriate terminology such as:

- prediction
- likelihood
- confidence
- estimated
- inferred
- simulation
- evidence
- uncertainty

when applicable.

## Frontend Quality

Every major frontend feature should have:

- responsive layout
- loading state
- error state where appropriate
- sensible interaction feedback
- accessible controls
- performant rendering
- clean component structure
- consistent typography
- consistent spacing
- consistent design tokens

## 3D

Use 3D only where it improves understanding or interaction.

Preferred stack where appropriate:

- Three.js
- React Three Fiber
- Drei

Keep WebGL and normal DOM UI responsibilities separated.

3D scenes must consider:

- performance
- asset size
- texture resolution
- lazy loading
- device capability
- camera behavior
- mobile fallback

## Browser Verification

A feature is not complete merely because the code compiles.

When browser tooling is available:

1. Run the application.
2. Open it in a browser.
3. Test the main interaction.
4. Check console errors.
5. Check desktop layout.
6. Check mobile layout.
7. Inspect loading/performance issues.
8. Fix obvious visual defects.
9. Re-test.

## Implementation Strategy

Work incrementally.

For large features:

1. inspect existing implementation
2. understand dependencies
3. design the change
4. implement
5. run
6. verify
7. fix
8. summarize

Do not attempt to rebuild the entire project in one uncontrolled change.

## Completion Standard

Do not call something production-ready simply because it looks impressive.

It must also be:

- functional
- maintainable
- responsive
- performant
- scientifically honest
- internally consistent
- testable
- free of obvious runtime errors
