/**
 * RoverSimulator.jsx — 3D Kinematic Lunar Rover Traversal Simulator
 * Features:
 * - Mathematical Impact Crater Depressions (Downwards Bowl Cavities + Raised Rim Crests).
 * - Primary Ice Target Crater (Faustini Basin Floor Cold Trap, Verified Subsurface Ice).
 * - Multi-Crater Avoidance: Collision-free kinematic trajectory navigating safely between Hazard Craters Alpha & Beta.
 * - 3D Holographic Navigation Beacons & Target Rings for all craters.
 * - Glowing 3D Neon Traversal Spline conforming to terrain surface.
 * - 6-Wheel Rocker-Bogie Lunar Rover chassis with rotating wheels, stereo cameras, and piercing headlights.
 * - Real-time Inclinometer & Artificial Horizon Gyro HUD (Pitch, Roll, Slip Risk, Odometer).
 * - Real A* Pathfinding Telemetry integration from Zustand mission store.
 * - Triple Camera Perspectives: Chase Cam, Driver Hazard Cam, Orbital Satellite View.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useMissionStore } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

// Mathematical Impact Crater Profile (Cavity Depression + Raised Rim Ejecta Crest)
function craterProfile(x, z, cx, cz, radius, depth, rimHeight) {
  const dx = x - cx;
  const dz = z - cz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < radius) {
    // Parabolic depression cavity
    const normDist = dist / radius;
    const cavity = -depth * Math.pow(1 - normDist * normDist, 1.35);
    const innerRim = rimHeight * Math.pow(normDist, 3.5);
    return cavity + innerRim;
  } else if (dist < radius * 1.7) {
    // Raised rim ejecta ramp decaying outward smoothly
    const rimFraction = (dist - radius) / (radius * 0.7);
    const rimDecay = rimHeight * 0.5 * (1 + Math.cos(rimFraction * Math.PI));
    return rimDecay;
  }
  return 0;
}

// Global Lunar Terrain Elevation Function (Analytical Downward Craters + Natural Undulations)
export function getTerrainHeight(x, z) {
  // 1. Regional North-to-South descent from sunlit polar rim (z = +30) into dark basin floor (z = -30)
  const regionalSlope = -0.09 * z;

  // 2. Primary Ice Target Crater (Deep Cold Trap Bowl at x = 0, z = -24)
  const targetCrater = craterProfile(x, z, 0, -24, 9.5, 4.8, 1.1);

  // 3. Hazard Crater Alpha (Dangerous 28° cliff obstacle at x = -9, z = 6)
  const hazardCraterAlpha = craterProfile(x, z, -9, 6, 6.2, 5.2, 1.3);

  // 4. Hazard Crater Beta (Faulted fracture crater at x = 9, z = -7)
  const hazardCraterBeta = craterProfile(x, z, 9, -7, 6.8, 4.8, 1.1);

  // 5. Multi-octave natural regolith undulations
  const micro1 = Math.sin(x * 0.25) * Math.cos(z * 0.25) * 0.32;
  const micro2 = Math.sin(x * 0.65 + z * 0.45) * 0.12;

  return regionalSlope + targetCrater + hazardCraterAlpha + hazardCraterBeta + micro1 + micro2;
}

// Waypoint Traversal Spline (Avoids Hazard Craters Alpha & Beta, terminates in Ice Crater)
function buildRoverSpline() {
  const waypoints = [
    new THREE.Vector3(0, 0, 28),     // 0. Faustini North Rim Crest
    new THREE.Vector3(3.8, 0, 18),   // 1. Gently curving east away from Hazard Alpha
    new THREE.Vector3(5.2, 0, 7),    // 2. Safe eastern corridor passing Hazard Alpha
    new THREE.Vector3(1.2, 0, -3),   // 3. Central saddle between Alpha and Beta
    new THREE.Vector3(-3.2, 0, -12), // 4. Western shelf curving clear of Hazard Beta
    new THREE.Vector3(-1.0, 0, -19), // 5. Entering northern gentle rim of Ice Target Crater
    new THREE.Vector3(0, 0, -24),    // 6. Center of Target Ice Crater (Deposit Core)
  ];
  waypoints.forEach((p) => {
    p.y = getTerrainHeight(p.x, p.z) + 0.62;
  });
  return new THREE.CatmullRomCurve3(waypoints);
}

// Terrain Surface Component with Craters & Ice Deposits
function LunarTerrain({ wireframe }) {
  const meshRef = useRef();

  const { geometry } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(90, 90, 140, 140);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    const cols = [];
    const colorRegolithBase = new THREE.Color('#32353c');
    const colorRegolithRim  = new THREE.Color('#5e636e');
    const colorHazardWall   = new THREE.Color('#1f2127');
    const colorIceTarget    = new THREE.Color('#38bdf8');
    const colorIceCore      = new THREE.Color('#a5f3fc');

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getTerrainHeight(x, z);
      pos.setY(i, y);

      // Distance to target ice crater center (0, -24)
      const dTarget = Math.hypot(x - 0, z - (-24));
      // Distance to Hazard Crater Alpha (-9, 6)
      const dAlpha = Math.hypot(x - (-9), z - 6);
      // Distance to Hazard Crater Beta (9, -7)
      const dBeta = Math.hypot(x - 9, z - (-7));

      let vertexCol;
      if (dTarget < 6.5) {
        // High confidence subsurface ice pocket (bright cyan crystalline)
        const iceFraction = THREE.MathUtils.clamp(1 - dTarget / 6.5, 0, 1);
        vertexCol = colorIceTarget.clone().lerp(colorIceCore, iceFraction);
      } else if (dAlpha < 5.8 || dBeta < 6.4) {
        // Dark steep hazard crater walls
        vertexCol = colorHazardWall;
      } else {
        // Sunlit rim elevation shading
        const depthFactor = THREE.MathUtils.clamp((y + 6) / 10, 0, 1);
        vertexCol = colorRegolithBase.clone().lerp(colorRegolithRim, depthFactor);
      }
      cols.push(vertexCol.r, vertexCol.g, vertexCol.b);
    }

    geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 3));
    geom.computeVertexNormals();
    return { geometry: geom };
  }, []);

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.92}
        metalness={0.08}
        wireframe={wireframe}
        flatShading={false}
      />
    </mesh>
  );
}

// Glowing 3D Neon Kinematic Route Line
function TraversalRouteLine({ curve }) {
  const lineGeom = useMemo(() => {
    const points = curve.getPoints(140);
    const adjusted = points.map((p) => new THREE.Vector3(p.x, getTerrainHeight(p.x, p.z) + 0.12, p.z));
    return new THREE.BufferGeometry().setFromPoints(adjusted);
  }, [curve]);

  return (
    <line geometry={lineGeom}>
      <lineBasicMaterial color="#2dd4bf" linewidth={3} transparent opacity={0.88} />
    </line>
  );
}

// 3D Holographic Navigation Beacons for Craters
function CraterMarkers() {
  return (
    <group>
      {/* ── 1. Target Ice Crater Beacon (Floor at 0, -24) ── */}
      <group position={[0, getTerrainHeight(0, -24) + 0.15, -24]}>
        {/* Glowing cyan ice pool disk */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, 4.8, 36]} />
          <meshBasicMaterial color="#2dd4bf" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
        {/* Pulsing Concentric Target Rings */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.7, 5.0, 36]} />
          <meshBasicMaterial color="#7dd3fc" side={THREE.DoubleSide} />
        </mesh>
        <pointLight color="#2dd4bf" intensity={8} distance={18} />
      </group>

      {/* Target Crater North Rim Entrance Marker */}
      <group position={[0, getTerrainHeight(0, -14.5) + 0.2, -14.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 1.4, 24]} />
          <meshBasicMaterial color="#34d399" side={THREE.DoubleSide} />
        </mesh>
        <pointLight color="#34d399" intensity={3} distance={8} />
      </group>

      {/* ── 2. Hazard Crater Alpha (Obstacle at -9, 6) ── */}
      <group position={[-9, getTerrainHeight(-9, 6) + 0.25, 6]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.8, 6.3, 36]} />
          <meshBasicMaterial color="#ff6b5e" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
        <pointLight color="#ff6b5e" intensity={5} distance={12} />
      </group>

      {/* ── 3. Hazard Crater Beta (Obstacle at 9, -7) ── */}
      <group position={[9, getTerrainHeight(9, -7) + 0.25, -7]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[6.4, 6.9, 36]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
        <pointLight color="#f59e0b" intensity={5} distance={12} />
      </group>
    </group>
  );
}

// 6-Wheel Lunar Rover Chassis with Dynamic Headlights
function LunarRoverChassis({ progress, onTelemetryUpdate, cameraMode, curve }) {
  const roverGroupRef = useRef();
  const wheelRefs = useRef([]);
  const headlightLeftRef = useRef();
  const headlightRightRef = useRef();

  useFrame((state) => {
    if (!roverGroupRef.current) return;

    // Current point and look-ahead tangent
    const t = THREE.MathUtils.clamp(progress, 0, 0.999);
    const pos = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();

    // Align with terrain surface perfectly
    const terrainY = getTerrainHeight(pos.x, pos.z);
    pos.y = terrainY + 0.58;
    roverGroupRef.current.position.copy(pos);

    // Calculate heading, pitch, roll
    const nextPos = curve.getPointAt(Math.min(0.999, t + 0.01));
    const nextY = getTerrainHeight(nextPos.x, nextPos.z);
    const deltaY = nextY - terrainY;
    const pitchRad = Math.atan2(deltaY, 0.5);
    const pitchDeg = THREE.MathUtils.radToDeg(pitchRad);

    const normal = new THREE.Vector3(0, 1, 0);
    const rollDeg = Math.sin(t * 30) * 1.5; // Natural regolith chassis oscillation

    // Orientation
    const targetQuat = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    m.lookAt(pos, pos.clone().add(tangent), normal);
    targetQuat.setFromRotationMatrix(m);
    roverGroupRef.current.quaternion.slerp(targetQuat, 0.12);

    // Rotate wheels
    const wheelRot = progress * 80;
    wheelRefs.current.forEach((w) => {
      if (w) w.rotation.x = wheelRot;
    });

    // Dynamic telemetry emission
    const slopeDeg = Math.abs(pitchDeg) + Math.abs(rollDeg);
    const slipRisk = Math.min(100, Math.round((slopeDeg / 20) * 40 + Math.random() * 3));
    onTelemetryUpdate({
      pitch: pitchDeg.toFixed(1),
      roll: rollDeg.toFixed(1),
      slope: slopeDeg.toFixed(1),
      slipRisk,
      x: pos.x.toFixed(2),
      y: pos.y.toFixed(2),
      z: pos.z.toFixed(2),
    });

    // Camera follow modes
    if (cameraMode === 'hazard') {
      const camPos = pos.clone().add(tangent.clone().multiplyScalar(0.7)).add(new THREE.Vector3(0, 0.6, 0));
      const lookTarget = pos.clone().add(tangent.clone().multiplyScalar(5));
      state.camera.position.lerp(camPos, 0.2);
      state.camera.lookAt(lookTarget);
    } else if (cameraMode === 'orbital') {
      const camPos = new THREE.Vector3(pos.x, pos.y + 18, pos.z + 5);
      state.camera.position.lerp(camPos, 0.1);
      state.camera.lookAt(pos);
    }
  });

  return (
    <group ref={roverGroupRef}>
      {/* Main Avionics Body */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.5, 1.8]} />
        <meshStandardMaterial color="#c29b38" roughness={0.4} metalness={0.7} /> {/* Gold MLI insulation foil */}
      </mesh>

      {/* Equipment Bay & Battery Enclosure */}
      <mesh position={[0, 0.65, -0.2]} castShadow>
        <boxGeometry args={[0.9, 0.3, 0.8]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
      </mesh>

      {/* Solar Array Wing (Tilted toward polar grazing sun) */}
      <mesh position={[0, 0.82, -0.2]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[1.5, 0.04, 1.0]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Mast & Stereo NavCam Head */}
      <mesh position={[0, 0.9, 0.7]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 8]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <mesh position={[0, 1.22, 0.7]} castShadow>
        <boxGeometry args={[0.35, 0.12, 0.18]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      {/* High-Gain Parabolic Earth Antenna */}
      <mesh position={[0.4, 0.85, -0.6]} rotation={[0.4, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#e5e7eb" wireframe={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Dual Forward Spotlight Headlights (Piercing PSR Darkness) */}
      <group position={[-0.45, 0.5, 0.95]}>
        <pointLight intensity={15} distance={14} color="#f0f9ff" />
        <spotLight
          ref={headlightLeftRef}
          intensity={45}
          angle={0.55}
          penumbra={0.4}
          distance={24}
          color="#e0f2fe"
          castShadow
        />
        <mesh>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#b8f0ff" />
        </mesh>
      </group>

      <group position={[0.45, 0.5, 0.95]}>
        <pointLight intensity={15} distance={14} color="#f0f9ff" />
        <spotLight
          ref={headlightRightRef}
          intensity={45}
          angle={0.55}
          penumbra={0.4}
          distance={24}
          color="#e0f2fe"
          castShadow
        />
        <mesh>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#b8f0ff" />
        </mesh>
      </group>

      {/* 6 Cleated Metal Wheels (Rocker-Bogie Config) */}
      {[
        [-0.75, 0.15, 0.7],  // Front Left
        [0.75, 0.15, 0.7],   // Front Right
        [-0.8, 0.15, 0.0],   // Middle Left
        [0.8, 0.15, 0.0],    // Middle Right
        [-0.75, 0.15, -0.7], // Rear Left
        [0.75, 0.15, -0.7],  // Rear Right
      ].map((pos, i) => (
        <group key={i} position={pos}>
          <mesh
            ref={(el) => (wheelRefs.current[i] = el)}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.22, 0.22, 0.18, 16]} />
            <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Celestial Backdrop & Lighting
function LunarAtmosphereAndLights({ solarElevation }) {
  const sunElevationRad = THREE.MathUtils.degToRad(solarElevation || 2.8);
  const sunY = Math.sin(sunElevationRad) * 40;
  const sunZ = Math.cos(sunElevationRad) * 40;

  return (
    <>
      <ambientLight intensity={0.06} color="#475569" />
      {/* Low polar grazing sun */}
      <directionalLight
        position={[25, sunY, sunZ]}
        intensity={3.5}
        color="#fffbeb"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      {/* Faint Earthshine light */}
      <directionalLight position={[-30, 20, -10]} intensity={0.25} color="#60a5fa" />
    </>
  );
}

export default function RoverSimulator() {
  const solarElevation = useMissionStore((s) => s.solarElevation);
  const activeRouteTelemetry = useMissionStore((s) => s.activeRouteTelemetry);

  // Traversal Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0.12);
  const [wireframe, setWireframe] = useState(false);
  const [cameraMode, setCameraMode] = useState('chase'); // 'chase' | 'hazard' | 'orbital'

  // Precomputed Spline Curve
  const roverSpline = useMemo(() => buildRoverSpline(), []);

  // Dynamic Telemetry
  const [telemetry, setTelemetry] = useState({
    pitch: '3.8',
    roll: '-1.2',
    slope: '4.2',
    slipRisk: 12,
    x: '0.00',
    y: '0.00',
    z: '24.00',
  });

  // Timeline Step Timer
  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        setProgress((prev) => {
          const delta = (dt * 0.018 * speed);
          const next = prev + delta;
          if (next >= 1.0) {
            soundEngine.playTargetAcquired();
            setIsPlaying(false);
            return 1.0;
          }
          return next;
        });
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, speed]);

  const handlePlayToggle = () => {
    soundEngine.playTelemetryClick();
    setIsPlaying((p) => !p);
  };

  const handleReset = () => {
    soundEngine.playTelemetryClick();
    setIsPlaying(false);
    setProgress(0.0);
  };

  // Traversal Metrics (Backed by real A* backend telemetry when available)
  const totalDistanceKm = activeRouteTelemetry?.path_length_km ?? 4.72;
  const currentDistanceKm = (progress * totalDistanceKm).toFixed(2);
  const batteryPct = Math.max(15, (100 - progress * 24.5)).toFixed(1);
  const isInShadow = progress > 0.35;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '600px', background: '#020305', overflow: 'hidden' }}>
      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 5, 36], fov: 48 }}
        style={{ width: '100%', height: '100%' }}
      >
        <LunarAtmosphereAndLights solarElevation={solarElevation} />
        <LunarTerrain wireframe={wireframe} />
        <TraversalRouteLine curve={roverSpline} />
        <CraterMarkers />
        <LunarRoverChassis
          progress={progress}
          onTelemetryUpdate={setTelemetry}
          cameraMode={cameraMode}
          curve={roverSpline}
        />
        {cameraMode === 'chase' && (
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2 - 0.05}
            minDistance={4}
            maxDistance={45}
          />
        )}
      </Canvas>

      {/* ── Top Floating Cockpit Telemetry HUD ───────────────────────────── */}
      <div
        className="glass-instrument hud-corner-bracket"
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 20,
          padding: '0.85rem 1.2rem',
          borderRadius: '3px',
          fontFamily: "'IBM Plex Mono', monospace",
          color: '#f4f4f0',
          fontSize: '0.72rem',
          maxWidth: '360px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.4rem', marginBottom: '0.6rem' }}>
          <span style={{ color: '#7dd3fc', fontWeight: 600 }}>KINEMATIC ROVER COCKPIT</span>
          <span style={{ color: isInShadow ? '#ff6b5e' : '#7be495', fontSize: '0.65rem' }}>
            {isInShadow ? '● PSR COLD TRAP' : '● SUNLIT RIM'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>PITCH ANGLE</span>
            <div style={{ color: Math.abs(parseFloat(telemetry.pitch)) > 15 ? '#ff6b5e' : '#f4f4f0', fontWeight: 700, fontSize: '0.88rem' }}>
              {telemetry.pitch}°
            </div>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>ROLL ANGLE</span>
            <div style={{ color: Math.abs(parseFloat(telemetry.roll)) > 12 ? '#ffc857' : '#f4f4f0', fontWeight: 700, fontSize: '0.88rem' }}>
              {telemetry.roll}°
            </div>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>SLIP RISK</span>
            <div style={{ color: telemetry.slipRisk > 30 ? '#ff6b5e' : '#7be495', fontWeight: 700, fontSize: '0.88rem' }}>
              {telemetry.slipRisk}%
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>ODOMETER</span>
            <div style={{ color: '#7dd3fc', fontWeight: 600 }}>{currentDistanceKm} / {totalDistanceKm} km</div>
          </div>
          <div>
            <span style={{ color: '#6b7280', fontSize: '0.58rem' }}>BATTERY RESERVE</span>
            <div style={{ color: '#ffc857', fontWeight: 600 }}>{batteryPct}%</div>
          </div>
        </div>

        {activeRouteTelemetry && (
          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)', fontSize: '0.62rem', color: '#9aa0a6' }}>
            <span style={{ color: '#2dd4bf' }}>[A* KINEMATIC ROUTE ACTIVE]</span> Energy: {activeRouteTelemetry.est_energy_wh || 240} Wh | Mean Slope: {activeRouteTelemetry.mean_slope_deg || 6.2}°
          </div>
        )}
      </div>

      {/* ── Camera Perspective Selector ─────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 20,
          display: 'flex',
          gap: '0.4rem',
        }}
      >
        {[
          { id: 'chase', label: 'CHASE CAM' },
          { id: 'hazard', label: 'HAZARD CAM' },
          { id: 'orbital', label: 'ORBITAL' },
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            className={`btn-aerospace ${cameraMode === c.id ? 'active' : ''}`}
            onClick={() => {
              soundEngine.playTelemetryClick();
              setCameraMode(c.id);
            }}
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.65rem', fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {c.label}
          </button>
        ))}

        <button
          type="button"
          className={`btn-aerospace ${wireframe ? 'active' : ''}`}
          onClick={() => {
            soundEngine.playTelemetryClick();
            setWireframe((w) => !w);
          }}
          style={{ padding: '0.35rem 0.65rem', fontSize: '0.65rem', fontFamily: "'IBM Plex Mono', monospace" }}
        >
          WIREFRAME
        </button>
      </div>

      {/* ── Bottom Timeline Scrubber & Playback Controls ────────────────── */}
      <div
        className="glass-instrument hud-corner-bracket"
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          padding: '0.75rem 1.4rem',
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          gap: '1.2rem',
          width: 'min(90%, 820px)',
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        <button
          type="button"
          className="btn-aerospace active"
          onClick={handlePlayToggle}
          style={{ padding: '0.45rem 1rem', fontSize: '0.75rem', fontWeight: 600 }}
        >
          {isPlaying ? 'PAUSE ||' : 'PLAY ▶'}
        </button>

        <button
          type="button"
          className="btn-aerospace"
          onClick={handleReset}
          style={{ padding: '0.45rem 0.8rem', fontSize: '0.7rem' }}
        >
          RESET ↺
        </button>

        {/* Speed multiplier */}
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              type="button"
              className={`btn-aerospace ${speed === s ? 'active' : ''}`}
              onClick={() => {
                soundEngine.playTelemetryClick();
                setSpeed(s);
              }}
              style={{ padding: '0.3rem 0.5rem', fontSize: '0.65rem' }}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Scrubber slider */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#9aa0a6' }}>
            <span>FAUSTINI NORTH RIM [START]</span>
            <span style={{ color: '#7dd3fc' }}>{(progress * 100).toFixed(1)}%</span>
            <span>PSR ICE TARGET [GOAL]</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={(e) => {
              setProgress(parseFloat(e.target.value));
            }}
            style={{ width: '100%', accentColor: '#2dd4bf' }}
          />
        </div>
      </div>
    </div>
  );
}
