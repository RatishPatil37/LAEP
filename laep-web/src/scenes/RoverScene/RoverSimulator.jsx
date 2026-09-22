/**
 * RoverSimulator.jsx — 3D Kinematic Lunar Rover Traversal Simulator
 * Fuses:
 * - 3D Parametric Crater Terrain with rim-to-floor slope and boulder hazards.
 * - 6-Wheel Rocker-Bogie Lunar Rover chassis with rotating wheels and stereo cameras.
 * - Dynamic Spotlights (Rover Headlights) casting beams into permanent shadow (PSR).
 * - Real-time Inclinometer & Artificial Horizon Gyro HUD (Pitch, Roll, Slip Risk).
 * - Interactive Timeline Scrubber & Speed Controls (1x, 2x, 5x).
 * - Triple Camera Perspectives: Chase Cam, Driver Hazard Cam, Orbital Satellite View.
 * - Real-time Chronological Telemetry Stream.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useMissionStore } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

// Procedural Heightmap for Crater Rim-to-Floor Descent
function getTerrainHeight(x, z) {
  // Overall crater wall slope (descending toward negative z)
  const baseSlope = -0.18 * z;
  // Large crater bowl depression
  const distFromCenter = Math.sqrt(x * x + (z + 10) * (z + 10));
  const craterDepression = Math.max(0, 15 - distFromCenter * 0.5) * -0.25;
  // Multi-frequency roughness & micro-craters
  const micro1 = Math.sin(x * 0.4) * Math.cos(z * 0.4) * 0.35;
  const micro2 = Math.sin(x * 1.2 + z * 0.8) * 0.12;
  const micro3 = Math.cos(x * 2.5 - z * 2.1) * 0.05;
  return baseSlope + craterDepression + micro1 + micro2 + micro3;
}

// Terrain Surface Component
function LunarTerrain({ wireframe }) {
  const meshRef = useRef();

  const { geometry, colors } = useMemo(() => {
    const geom = new THREE.PlaneGeometry(80, 80, 100, 100);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    const cols = [];
    const colorA = new THREE.Color('#383b42'); // Lowland cold trap regolith
    const colorB = new THREE.Color('#686c75'); // Sunlit rim regolith
    const colorIce = new THREE.Color('#8ce8ff'); // Diagnostic ice-consistent anomaly

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getTerrainHeight(x, z);
      pos.setY(i, y);

      // Color based on depth / shadow and icy pocket
      const depthFactor = THREE.MathUtils.clamp((y + 6) / 10, 0, 1);
      const isIcePocket = z < -8 && Math.abs(x) < 7 && y < -2;
      const finalColor = isIcePocket ? colorIce : colorA.clone().lerp(colorB, depthFactor);
      cols.push(finalColor.r, finalColor.g, finalColor.b);
    }

    geom.computeVertexNormals();
    return { geometry: geom, colors: new Float32Array(cols) };
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

// Boulders and Scatter Hazards
function LunarBoulders() {
  const boulders = useMemo(() => {
    const items = [];
    const count = 35;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 60;
      const z = (Math.random() - 0.5) * 60;
      const y = getTerrainHeight(x, z);
      const scale = 0.3 + Math.random() * 0.9;
      items.push({ pos: [x, y + scale * 0.4, z], scale });
    }
    return items;
  }, []);

  return (
    <group>
      {boulders.map((b, idx) => (
        <mesh key={idx} position={b.pos} scale={b.scale} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#555861" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

// 6-Wheel Lunar Rover Chassis with Dynamic Headlights
function LunarRoverChassis({ progress, onTelemetryUpdate, cameraMode }) {
  const roverGroupRef = useRef();
  const wheelRefs = useRef([]);
  const headlightLeftRef = useRef();
  const headlightRightRef = useRef();

  // Waypoint Traversal Path (Faustini Rim to Floor PSR)
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, getTerrainHeight(0, 28) + 0.6, 28),
      new THREE.Vector3(3, getTerrainHeight(3, 18) + 0.6, 18),
      new THREE.Vector3(-2, getTerrainHeight(-2, 8) + 0.6, 8),
      new THREE.Vector3(4, getTerrainHeight(4, -4) + 0.6, -4),
      new THREE.Vector3(-1, getTerrainHeight(-1, -16) + 0.6, -16),
      new THREE.Vector3(0, getTerrainHeight(0, -26) + 0.6, -26),
    ]);
  }, []);

  useFrame((state, delta) => {
    if (!roverGroupRef.current) return;

    // Current point and look-ahead tangent
    const t = THREE.MathUtils.clamp(progress, 0, 0.999);
    const pos = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();

    // Align with terrain surface
    const terrainY = getTerrainHeight(pos.x, pos.z);
    pos.y = terrainY + 0.55;
    roverGroupRef.current.position.copy(pos);

    // Calculate heading, pitch, roll
    const nextPos = curve.getPointAt(Math.min(0.999, t + 0.01));
    const nextY = getTerrainHeight(nextPos.x, nextPos.z);
    const deltaY = nextY - terrainY;
    const pitchRad = Math.atan2(deltaY, 0.5);
    const pitchDeg = THREE.MathUtils.radToDeg(pitchRad);

    const normal = new THREE.Vector3(0, 1, 0);
    const rollDeg = Math.sin(t * 30) * 1.8; // Chassis micro-oscillation over regolith

    // Orientation
    const targetQuat = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    m.lookAt(pos, pos.clone().add(tangent), normal);
    targetQuat.setFromRotationMatrix(m);
    roverGroupRef.current.quaternion.slerp(targetQuat, 0.1);

    // Rotate wheels
    const wheelRot = progress * 80;
    wheelRefs.current.forEach((w) => {
      if (w) w.rotation.x = wheelRot;
    });

    // Dynamic telemetry emission
    const slopeDeg = Math.abs(pitchDeg) + Math.abs(rollDeg);
    const slipRisk = Math.min(100, Math.round((slopeDeg / 20) * 45 + Math.random() * 4));
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
        <meshStandardMaterial color="#c29b38" roughness={0.4} metalness={0.7} /> {/* Gold insulation foil */}
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
  const isResearchMode = useMissionStore((s) => s.isResearchMode);
  const solarElevation = useMissionStore((s) => s.solarElevation);

  // Traversal Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0.12);
  const [wireframe, setWireframe] = useState(false);
  const [cameraMode, setCameraMode] = useState('chase'); // 'chase' | 'hazard' | 'orbital'

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

  // Traversal Metrics
  const totalDistanceKm = 4.72;
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
        <LunarBoulders />
        <LunarRoverChassis
          progress={progress}
          onTelemetryUpdate={setTelemetry}
          cameraMode={cameraMode}
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
            <span>PSR RESOURCE TARGET [GOAL]</span>
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
