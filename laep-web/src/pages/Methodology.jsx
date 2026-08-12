import '../styles/components.css';

const ALGO_TABLE = [
  { algo: 'A*',     type: 'Graph-based',  strengths: 'Optimal on static grid, fast', weakness: 'Cannot adapt to dynamic hazards', use: '✅ Global planner' },
  { algo: 'D3QN',   type: 'RL Agent',      strengths: 'Dynamic obstacles, adaptive', weakness: 'Needs training, unstable alone', use: '🔜 Local planner (Month 4)' },
  { algo: 'RRT*',   type: 'Sample-based',  strengths: 'High-DoF, any geometry',      weakness: 'Slow, jagged paths', use: '🔄 Backup fallback' },
  { algo: 'ACO',    type: 'Swarm',         strengths: 'Multi-objective',             weakness: 'Very slow convergence', use: '❌ Not used' },
];

export default function Methodology() {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div className="method-page">
        <h1>Science & Methodology</h1>
        <p style={{ color: 'var(--c-text-dim)', marginBottom: 0 }}>
          How LAEP detects lunar water ice and plans autonomous rover traversal using Chandrayaan-2 data.
        </p>

        <h2>1. Why the Moon's South Pole?</h2>
        <p>
          The Lunar South Pole contains <strong>Permanently Shadowed Regions (PSRs)</strong> — 
          craters whose floors never receive direct sunlight. Temperatures can drop below 
          −230°C. Water ice deposited by asteroid/comet impacts is preserved here for billions of years.
          Chandrayaan-2 was specifically designed to probe these regions.
        </p>

        <h2>2. Ice Detection — CPR & DOP Physics</h2>
        <p>
          The <strong>DFSAR (Dual Frequency Synthetic Aperture Radar)</strong> transmits and 
          receives radar pulses in L-band (1.25 GHz) and S-band (3.2 GHz). Two key metrics
          are computed per pixel:
        </p>
        <ul style={{ paddingLeft: 20, color: 'var(--c-text-dim)', lineHeight: 1.8, fontSize: '0.9rem', marginBottom: 12 }}>
          <li><code>CPR</code> (Circular Polarisation Ratio): Ratio of same-sense to opposite-sense backscatter. 
              Subsurface ice creates <em>volume scattering</em> which elevates CPR well above 1.0.</li>
          <li><code>DOP</code> (Degree of Polarisation): Low DOP distinguishes ice volume scattering from 
              rough rocky surface scattering (which shows high DOP).</li>
        </ul>
        <p>
          Detection criterion (Physical Research Laboratory & ISRO, 2024):<br/>
          <code>ICE DETECTED ↔ CPR &gt; 1.0 AND DOP &lt; 0.13</code>
        </p>
        <p>
          LAEP extends this to a continuous <strong>Ice Confidence Score (ICS ∈ [0,1])</strong> using 
          a geometric mean of normalised CPR and DOP confidences.
        </p>

        <h2>3. Terrain Intelligence</h2>
        <p>
          The DEM (Digital Elevation Model from LOLA/TMC-2) is processed to produce:
        </p>
        <ul style={{ paddingLeft: 20, color: 'var(--c-text-dim)', lineHeight: 1.8, fontSize: '0.9rem', marginBottom: 12 }}>
          <li><strong>Slope Map</strong>: <code>∇DEM</code> via central differences. Slopes &gt;15° are impassable.</li>
          <li><strong>Roughness Map</strong>: Local standard deviation of elevation (sliding window).</li>
          <li><strong>Shadow Persistence</strong>: Correlated with crater depth — deeper = always dark = battery drain.</li>
        </ul>

        <h2>4. Pathfinding Algorithm — Why A*?</h2>
        <p>
          On the Moon there are no roads, no GPS, and no existing network graph.
          Every square metre of terrain has a unique traversal cost. 
          A* treats this as a <strong>weighted grid search problem</strong>:
        </p>
        <ul style={{ paddingLeft: 20, color: 'var(--c-text-dim)', lineHeight: 1.8, fontSize: '0.9rem', marginBottom: 12 }}>
          <li>Cost function: <code>cost(cell) = 1 + W₁·slope + W₂·shadow·50</code></li>
          <li>Heuristic <code>h(n)</code>: Euclidean distance to goal (admissible → A* is optimal)</li>
          <li>8-connected movement (cardinal + diagonal, with √2 penalty for diagonals)</li>
          <li>BFS reachability pre-filter prevents A* from entering impassable crater bowls</li>
        </ul>

        <table className="algo-table">
          <thead>
            <tr>
              <th>Algorithm</th><th>Type</th><th>Strengths</th><th>Weakness</th><th>LAEP Use</th>
            </tr>
          </thead>
          <tbody>
            {ALGO_TABLE.map(r => (
              <tr key={r.algo}>
                <td>{r.algo}</td><td>{r.type}</td>
                <td>{r.strengths}</td><td>{r.weakness}</td><td>{r.use}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>5. Data Sources</h2>
        <p>All data is open-access. No proprietary datasets required.</p>
        <ul style={{ paddingLeft: 20, color: 'var(--c-text-dim)', lineHeight: 1.8, fontSize: '0.9rem' }}>
          <li><strong>Chandrayaan-2 DFSAR</strong>: Available at <a href="https://pradan.issdc.gov.in" target="_blank" rel="noreferrer" style={{color:'var(--c-ice)'}}>pradan.issdc.gov.in</a> (ISRO PRADAN Portal). Requires free registration.</li>
          <li><strong>NASA LRO WAC Mosaic</strong>: Live WMTS tiles via <a href="https://trek.nasa.gov" target="_blank" rel="noreferrer" style={{color:'var(--c-ice)'}}>trek.nasa.gov</a>. No API key required.</li>
          <li><strong>LOLA DEM</strong>: Via NASA Moon Trek WMTS — colour hillshade overlay.</li>
        </ul>

        <h2>6. Real ISRO Data (ch2_sp)</h2>
        <p>
          The project includes a real <strong>Chandrayaan-2 SAR derived mosaic shapefile</strong>
          (<code>ch2_sar_der_mosaic_sp.shp</code>) downloaded from ISRO PRADAN. 
          It is stored in <strong>Moon 2000 South Pole Stereographic</strong> projection 
          (<code>PROJCS["Moon_2000_South_Pole_Stereographic"...]</code>).
          The API automatically reprojects these polygons to lon/lat and serves them 
          as the "CH-2 SAR Footprints" overlay on the map.
        </p>
      </div>
    </div>
  );
}
