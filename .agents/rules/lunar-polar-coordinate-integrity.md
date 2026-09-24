# Lunar & Planetary Polar Geospatial Integrity

## 1. Mandatory Polar Stereographic Projection for Metric Operations
- **The Polar Singularity Problem**: Near planetary poles (e.g., lunar South Pole, Latitude < -75°), 1° of longitude spans only ~30 meters near the pole, while 1° of latitude spans ~30,323 meters.
- **Strict Constraint**: Never compute Euclidean distances, bounding boxes, or spatial search trees (e.g., `scipy.spatial.cKDTree`) directly on raw angular coordinates `(Latitude, Longitude)`.
- **Mandatory Transformation**: Convert coordinates to conformal Polar Stereographic projection in meters before spatial indexing:
  - Lunar South Pole Proj4: `+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs`
  - Explicit projection equations:
    ```python
    R = 1737400.0  # Lunar mean radius in meters
    lat_rad = np.radians(lat)
    lon_rad = np.radians(lon)
    # South Polar Stereographic conformal projection:
    rho = 2.0 * R * np.tan(np.pi / 4.0 + lat_rad / 2.0)
    X = rho * np.sin(lon_rad)
    Y = -rho * np.cos(lon_rad)
    ```

## 2. Prohibition of Synthetic / Random Noise Fills
- Never invent synthetic random values (e.g., `np.random.uniform(...)`) to fill unmeasured sensor features, terrain slopes, or elevations.
- Synthetic noise corrupts machine learning models and causes false hazard/resource predictions.
- If a sensor ground swath does not intersect a point, assign explicit `NaN` (PDS4 NoData standard).
- If physical parameters like slope are required, derive them from physical look geometry (e.g., radargrammetric incidence difference |θ_inc - θ_spherical|) or valid digital elevation models (DEMs).
