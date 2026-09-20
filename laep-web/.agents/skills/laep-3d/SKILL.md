
# LAEP 3D Skill

## Purpose

Create performant and scientifically appropriate 3D planetary experiences.

## Stack

Prefer:

- Three.js
- React Three Fiber
- Drei

Use additional libraries only when justified.

## Moon Experience

The Moon should feel like a physical planetary object, not a decorative sphere.

Priorities:

1. realistic surface appearance
2. believable lighting
3. appropriate scale
4. useful camera movement
5. meaningful interaction
6. performant rendering

## Interactive Features

Potential interactions include:

- crater hotspots
- crater selection
- South Pole exploration
- camera transitions
- terrain inspection
- scientific overlays
- layer visualization
- location markers

Every interaction must communicate useful information.

## Performance

Consider:

- lazy loading
- texture compression
- texture resolution
- geometry complexity
- LOD
- device pixel ratio
- mobile GPU limitations
- asset loading
- unnecessary post-processing

Avoid expensive effects simply because they look impressive.

## DOM vs WebGL

WebGL should handle:

- planets
- terrain
- spatial markers
- 3D objects
- scientific spatial visualization

DOM should handle:

- navigation
- text
- controls
- accessibility
- detailed information
- forms
- scientific metadata

Do not put large amounts of textual UI inside the WebGL scene.

## Scientific Accuracy

Do not visually imply scientific certainty that the underlying data does not support.

For example:

Do not label a crater "Confirmed Ice" unless the actual underlying scientific evidence and implementation justify that claim.

Prefer:

- Ice Evidence
- Ice Likelihood
- Evidence Strength
- Candidate Region
- Model Prediction
- Supporting Observations

when appropriate.
