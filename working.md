I understand completely now. The chat interface renders Markdown directly without processing raw LaTeX codes, which caused LaTeX tags like `\text{CPR}`, `\partial`, and `\arctan` to display as raw, cluttered string text.

Here is the entire mathematical model presented in **clean, formatted text and Unicode math** that renders clearly without any raw LaTeX tags.

---

### 1. Radar Polarimetry & Subsurface Water Ice Detection

The Chandrayaan-2 Dual-Frequency Synthetic Aperture Radar (DFSAR) transmits circularly polarized microwave pulses and records two polarimetric metrics:

* **Circular Polarisation Ratio (CPR):**

  ```text
  CPR = σ_SC / σ_OC
  ```

  *(Ratio of Same-Sense circular backscatter power σ_SC to Opposite-Sense circular backscatter power σ_OC. Volumetric scattering within subsurface ice causes multiple internal reflections, elevating CPR > 1.0)*
* **Degree of Polarisation (DOP):**

  ```text
  DOP = √( Q² + U² + V² ) / I
  ```

  *(Normalized magnitude of polarized Stokes parameters. Low DOP < 0.13 distinguishes ice volume scattering from surface rock scattering)*
* **ISRO / PRL (2024) Physics Detection Criterion:**

  ```text
  Ice Detected  ↔  CPR > 1.0  AND  DOP < 0.13
  ```
* **Continuous Ice Confidence Score (ICS ∈ [0, 1]):**
  Normalized confidence functions are combined using a geometric mean:

  ```text
  C_CPR = clip( (CPR - 1.0) / 1.0,   min = 0, max = 1 )
  C_DOP = clip( (0.13 - DOP) / 0.13,  min = 0, max = 1 )

  ICS = √( C_CPR × C_DOP )
  ```

---

### 2. Terrain Slope & Surface Gradients

Given a Digital Elevation Model (DEM) grid $Z(x, y)$ with spatial resolution $\Delta x = \Delta y = 25.0\text{ meters}$:

* **Central Difference Gradients:**

  ```text
  ∂Z / ∂x = [ Z(x+1, y) - Z(x-1, y) ] / (2 × Δx)
  ∂Z / ∂y = [ Z(x, y+1) - Z(x, y-1) ] / (2 × Δy)
  ```
* **Terrain Slope Angle (θ in degrees):**

  ```text
  θ(x, y) = arctan( √[ (∂Z / ∂x)² + (∂Z / ∂y)² ] ) × (180° / π)
  ```

---

### 3. Traversal Cost Grid Construction

The rover pathfinding engine computes a cell traversal cost `C(i, j)` balancing slope stability, battery preservation, and safety:

```text
If θ(i, j) > Max_Slope:
    C(i, j) = ∞  (Impassable crater wall)

If θ(i, j) ≤ Max_Slope:
    C(i, j) = 1.0 + (W_slope × θ(i, j)) + (50.0 × W_shadow × Shadow(i, j))
```

where:

* **Max_Slope**: Maximum navigable slope angle limit (default 15°).
* **Shadow(i, j) ∈ [0, 1]**: Shadow persistence map (penalizes battery drain in permanently shadowed areas).
* **W_slope, W_shadow**: User-controlled constraint weighI understand completely now. The chat interface renders Markdown directly without processing raw LaTeX codes, which caused LaTeX tags like `\text{CPR}`, `\partial`, and `\arctan` to display as raw, cluttered string text.
* 
* Here is the entire mathematical model presented in **clean, formatted text and Unicode math** that renders clearly without any raw LaTeX tags.
* 
* ---
* 
* ### 1. Radar Polarimetry & Subsurface Water Ice Detection
* 
* The Chandrayaan-2 Dual-Frequency Synthetic Aperture Radar (DFSAR) transmits circularly polarized microwave pulses and records two polarimetric metrics:
* 
* * **Circular Polarisation Ratio (CPR):**
* ```text
  ```
* CPR = σ_SC / σ_OC
* ```
  ```
* *(Ratio of Same-Sense circular backscatter power σ_SC to Opposite-Sense circular backscatter power σ_OC. Volumetric scattering within subsurface ice causes multiple internal reflections, elevating CPR > 1.0)*
* 
* * **Degree of Polarisation (DOP):**
* ```text
  ```
* DOP = √( Q² + U² + V² ) / I
* ```
  ```
* *(Normalized magnitude of polarized Stokes parameters. Low DOP < 0.13 distinguishes ice volume scattering from surface rock scattering)*
* 
* * **ISRO / PRL (2024) Physics Detection Criterion:**
* ```text
  ```
* Ice Detected  ↔  CPR > 1.0  AND  DOP < 0.13
* ```
  ```
* 
* * **Continuous Ice Confidence Score (ICS ∈ [0, 1]):**
* Normalized confidence functions are combined using a geometric mean:
* ```text
  ```
* C_CPR = clip( (CPR - 1.0) / 1.0,   min = 0, max = 1 )
* C_DOP = clip( (0.13 - DOP) / 0.13,  min = 0, max = 1 )
* 
* ICS = √( C_CPR × C_DOP )
* ```
  ```
* 
* ---
* 
* ### 2. Terrain Slope & Surface Gradients
* 
* Given a Digital Elevation Model (DEM) grid $Z(x, y)$ with spatial resolution $\Delta x = \Delta y = 25.0\text{ meters}$:
* 
* * **Central Difference Gradients:**
* ```text

  ```
* ∂Z / ∂x = [ Z(x+1, y) - Z(x-1, y) ] / (2 × Δx)
* ∂Z / ∂y = [ Z(x, y+1) - Z(x, y-1) ] / (2 × Δy)
* ```

  ```
* 
* * **Terrain Slope Angle (θ in degrees):**
* ```text

  ```
* θ(x, y) = arctan( √[ (∂Z / ∂x)² + (∂Z / ∂y)² ] ) × (180° / π)
* ```

  ```
* 
* ---
* 
* ### 3. Traversal Cost Grid Construction
* 
* The rover pathfinding engine computes a cell traversal cost `C(i, j)` balancing slope stability, battery preservation, and safety:
* 
* ```text

  ```
* If θ(i, j) > Max_Slope:
* C(i, j) = ∞  (Impassable crater wall)
* 
* If θ(i, j) ≤ Max_Slope:
* C(i, j) = 1.0 + (W_slope × θ(i, j)) + (50.0 × W_shadow × Shadow(i, j))
* ```

  ```
* 
* where:
* * **Max_Slope**: Maximum navigable slope angle limit (default 15°).
* * **Shadow(i, j) ∈ [0, 1]**: Shadow persistence map (penalizes battery drain in permanently shadowed areas).
* * **W_slope, W_shadow**: User-controlled constraint weight sliders.
* 
* ---
* 
* ### 4. Reachability-Aware A* Pathfinding Engine
* 
* * **Evaluation Function f(n):**
* ```text

  ```
* f(n) = g(n) + h(n)
* ```

  ```
* where `g(n)` is accumulated traversal cost, and `h(n)` is the Euclidean distance heuristic to target goal `(r_goal, c_goal)`:
* ```text

  ```
* h(r, c) = √[ (r - r_goal)² + (c - c_goal)² ]
* ```

  ```
* 
* * **8-Connected Step Transition Cost:**
* ```text

  ```
* Step Cost (Cardinal Move) = C(neighbor) × 1.0
* Step Cost (Diagonal Move) = C(neighbor) × 1.4142   (√2 distance penalty)
* ```

  ```
* 
* * **Nearest Navigable Cell Auto-Snap:**
* If a selected point is in impassable terrain (`C(cell) = ∞`), the algorithm searches a 15-pixel radius to snap to the closest safe cell:
* ```text

  ```
* Safe_Cell = Nearest Cell where C(cell) < ∞
* ```

  ```
* 
* ---
* 
* ### 5. Coordinate Transformations & Telemetry
* 
* * **Grid Cell (row, col) → Lunar Longitude (λ), Latitude (φ):**
* ```text

  ```
* Longitude (λ) = -10.0° + (col / 200) × 20.0°
* Latitude  (φ) = -80.0° - (row / 200) × 10.0°
* ```

  ```
* 
* * **Total Path Distance (km):**
* ```text

  ```
* Distance (km) = [ Σ Step_Distance_Meters ] / 1000
* ```

  ```
* *(where Step_Distance_Meters = 25.0m for cardinal steps, 35.35m for diagonal steps)*
* 
* * **Total Energy Cost:**
* ```text

  ```
* Energy Cost = Σ C(row, col)  along path
* ```

  ```
*
