import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useMissionStore, LAYER_IDS } from '../../stores/useMissionStore';
import { soundEngine } from '../../lib/soundEffects';

const MOON_RADIUS = 2;
const ORBIT_ALTITUDE = 2.45; // Chandrayaan-2 100 km scaled orbit
const SOUTH_POLE = new THREE.Vector3(0, -1, 0);

export function positionFromLunarCoordinates(longitude, latitude, radius = MOON_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

// Procedural high-fidelity lunar surface texture maps
function createLunarSurfaceMaps() {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  const reliefCanvas = document.createElement('canvas');
  colorCanvas.width = reliefCanvas.width = size;
  colorCanvas.height = reliefCanvas.height = size;
  const color = colorCanvas.getContext('2d');
  const relief = reliefCanvas.getContext('2d');
  const random = seededRandom(24071969);

  // Basaltic regolith baseline
  color.fillStyle = '#7a7a75';
  color.fillRect(0, 0, size, size);
  relief.fillStyle = '#808080';
  relief.fillRect(0, 0, size, size);

  // High-frequency micro-cratering
  for (let i = 0; i < 9000; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const shade = 100 + Math.floor(random() * 55);
    color.fillStyle = `rgba(${shade},${shade},${Math.max(88, shade - 6)},${0.03 + random() * 0.08})`;
    color.fillRect(x, y, 1 + random() * 2.5, 1 + random() * 2.5);
  }

  // Large impact basins and ejecta blankets
  for (let i = 0; i < 320; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = 3 + Math.pow(random(), 2.5) * 45;

    const crater = color.createRadialGradient(x - radius * 0.22, y - radius * 0.22, radius * 0.06, x, y, radius);
    crater.addColorStop(0, 'rgba(210,210,202,.28)');
    crater.addColorStop(0.42, 'rgba(92,92,88,.12)');
    crater.addColorStop(0.76, 'rgba(42,42,40,.32)');
    crater.addColorStop(1, 'rgba(165,164,156,.10)');
    color.fillStyle = crater;
    color.beginPath();
    color.ellipse(x, y, radius, radius * (0.75 + random() * 0.25), random() * Math.PI, 0, Math.PI * 2);
    color.fill();

    const bump = relief.createRadialGradient(x, y, radius * 0.08, x, y, radius);
    bump.addColorStop(0, 'rgb(35,35,35)');
    bump.addColorStop(0.62, 'rgb(95,95,95)');
    bump.addColorStop(0.84, 'rgb(190,190,190)');
    bump.addColorStop(1, 'rgb(120,120,120)');
    relief.fillStyle = bump;
    relief.beginPath();
    relief.ellipse(x, y, radius, radius * 0.82, 0, 0, Math.PI * 2);
    relief.fill();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  const bumpMap = new THREE.CanvasTexture(reliefCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = bumpMap.wrapS = THREE.RepeatWrapping;
  map.wrapT = bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = bumpMap.anisotropy = 4;
  return { map, bumpMap };
}

// ── Chandrayaan-2 100 km Polar Orbital Ring ──
function PolarOrbitTrack() {
  const ringGeo = useMemo(() => {
    return new THREE.RingGeometry(ORBIT_ALTITUDE - 0.008, ORBIT_ALTITUDE + 0.008, 128);
  }, []);

  const satellitePos = useRef(new THREE.Vector3());
  const satelliteMesh = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.45;
    satellitePos.current.set(
      ORBIT_ALTITUDE * Math.sin(t),
      ORBIT_ALTITUDE * Math.cos(t),
      0
    );
    if (satelliteMesh.current) {
      satelliteMesh.current.position.copy(satellitePos.current);
    }
  });

  return (
    <group rotation={[0, 0, 0]}>
      {/* Orbital Ring Line */}
      <mesh geometry={ringGeo} rotation={[0, Math.PI / 2, 0]}>
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Orbiting Satellite Indicator */}
      <mesh ref={satelliteMesh}>
        <sphereGeometry args={[0.032, 16, 16]} />
        <meshBasicMaterial color="#b8f0ff" />
      </mesh>
    </group>
  );
}

// ── 360° Circular Radar Sweep across Selected Crater ──
function RadarSweep({ position, active }) {
  const sweepRef = useRef();
  const normal = useMemo(() => position.clone().normalize(), [position.x, position.y, position.z]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
    [normal.x, normal.y, normal.z]
  );

  useFrame((_, delta) => {
    if (sweepRef.current && active) {
      sweepRef.current.rotation.z += delta * 3.2;
    }
  });

  if (!active) return null;

  return (
    <group position={position.clone().addScaledVector(normal, 0.03)} quaternion={quaternion}>
      <group ref={sweepRef}>
        <mesh>
          <ringGeometry args={[0.02, 0.22, 32, 1, 0, Math.PI * 0.6]} />
          <meshBasicMaterial
            color="#7dd3fc"
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

// ── Interactive Reticle Hotspot ──
function Reticle({ position, selected, hovered, color, onClick, onHover, onBlur, size = 0.085 }) {
  const normal = position.clone().normalize();
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
    [normal.x, normal.y, normal.z]
  );

  return (
    <group
      position={position.clone().addScaledVector(normal, 0.028)}
      quaternion={quaternion}
      scale={selected ? 1.4 : hovered ? 1.2 : 1}
    >
      <mesh onClick={onClick} onPointerOver={onHover} onPointerOut={onBlur}>
        <circleGeometry args={[size * 1.6, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[size * 0.72, size, 28]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.95 : hovered ? 0.85 : 0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <circleGeometry args={[size * 0.14, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Camera Rig with Smooth Bezier Focus Transitions ──
function CameraRig({ activeFocus, controlsRef, reducedMotion }) {
  const { camera } = useThree();
  const destination = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    let focus;
    let targetDistance;

    if (activeFocus?.type === 'crater') {
      focus = positionFromLunarCoordinates(activeFocus.crater.lon, activeFocus.crater.lat);
      targetDistance = 4.45;
    } else if (activeFocus?.type === 'south-pole') {
      focus = SOUTH_POLE.clone().multiplyScalar(MOON_RADIUS);
      targetDistance = 4.65;
    } else {
      focus = new THREE.Vector3();
      targetDistance = 6.15;
    }

    const isGlobal = !activeFocus || activeFocus.type === 'global';
    destination.copy(focus).normalize().multiplyScalar(targetDistance);
    if (isGlobal) {
      destination.set(0.7, 0.45, 6.05);
    }

    lookAt.copy(focus).multiplyScalar(isGlobal ? 0 : 0.85);

    const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.5);
    camera.position.lerp(destination, damping);
    controlsRef.current?.target.lerp(lookAt, damping);
    controlsRef.current?.update();
  });

  return null;
}

// ── Core Moon Mesh with Dynamic Terminator Lighting ──
function Moon({ craters, activeFocus, onFocus, onHoverFocus, reducedMotion }) {
  const moon = useRef();
  const [hovered, setHovered] = useState(null);
  const { map, bumpMap } = useMemo(createLunarSurfaceMaps, []);
  const activeLayer = useMissionStore((s) => s.activeLayer);

  // Surface color tint based on active scientific layer
  const surfaceTint = useMemo(() => {
    if (activeLayer === LAYER_IDS.ICE) return '#d8f4ff';
    if (activeLayer === LAYER_IDS.CPR) return '#ffe6b8';
    if (activeLayer === LAYER_IDS.DOP) return '#bdf4e8';
    return '#deddd5';
  }, [activeLayer]);

  useFrame((_, delta) => {
    if (!moon.current) return;
    if (activeFocus?.type === 'global' && !reducedMotion) {
      moon.current.rotation.y += delta * 0.006;
    } else {
      moon.current.rotation.y = THREE.MathUtils.damp(moon.current.rotation.y, 0, 4, delta);
    }
  });

  const cursor = (value) => {
    if (typeof document !== 'undefined') {
      document.body.style.cursor = value;
    }
  };

  return (
    <group ref={moon}>
      <mesh onClick={() => onFocus({ type: 'global' })} receiveShadow castShadow>
        <sphereGeometry args={[MOON_RADIUS, 144, 96]} />
        <meshStandardMaterial
          map={map}
          bumpMap={bumpMap}
          bumpScale={0.082}
          roughness={0.96}
          metalness={0.02}
          color={surfaceTint}
        />
      </mesh>

      {/* Orbit Track */}
      <PolarOrbitTrack />

      {/* Crater Markers */}
      {craters.map((crater) => {
        const selected = activeFocus?.type === 'crater' && activeFocus.crater.id === crater.id;
        const isHovered = hovered === crater.id;
        const pos = positionFromLunarCoordinates(crater.lon, crater.lat);
        return (
          <group key={crater.id}>
            <Reticle
              position={pos}
              selected={selected}
              hovered={isHovered}
              color={crater.status === 'negative' ? '#ff6b5e' : '#b8f0ff'}
              size={crater.id === 'CABEUS' ? 0.11 : 0.075}
              onClick={(event) => {
                event.stopPropagation();
                soundEngine.playRadarSweep();
                onFocus({ type: 'crater', crater });
              }}
              onHover={(event) => {
                event.stopPropagation();
                setHovered(crater.id);
                onHoverFocus?.({ type: 'crater', crater });
                cursor('pointer');
              }}
              onBlur={() => {
                setHovered(null);
                onHoverFocus?.(null);
                cursor('auto');
              }}
            />
            {selected && <RadarSweep position={pos} active={selected} />}
          </group>
        );
      })}

      {/* South Pole Marker */}
      <Reticle
        position={SOUTH_POLE.clone().multiplyScalar(MOON_RADIUS)}
        selected={activeFocus?.type === 'south-pole'}
        hovered={hovered === 'south-pole'}
        color="#ffc857"
        size={0.11}
        onClick={(event) => {
          event.stopPropagation();
          soundEngine.playTelemetryClick();
          onFocus({ type: 'south-pole' });
        }}
        onHover={(event) => {
          event.stopPropagation();
          setHovered('south-pole');
          onHoverFocus?.({ type: 'south-pole' });
          cursor('pointer');
        }}
        onBlur={() => {
          setHovered(null);
          onHoverFocus?.(null);
          cursor('auto');
        }}
      />
    </group>
  );
}

// ── Scene with Dynamic Physical Terminator Lighting ──
function Scene({ craters, activeFocus, onFocus, onHoverFocus, reducedMotion, onReady }) {
  const controlsRef = useRef();
  const solarElevation = useMissionStore((s) => s.solarElevation);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  // Calculate sun vector from solar elevation (grazing polar angle)
  const sunPosition = useMemo(() => {
    const elRad = THREE.MathUtils.degToRad(solarElevation || 2.8);
    const r = 12.0;
    return [r * Math.cos(elRad), -r * Math.sin(elRad), r * 0.4];
  }, [solarElevation]);

  return (
    <>
      <color attach="background" args={['#050608']} />
      <hemisphereLight args={['#d4e5ee', '#0b0d10', 0.22]} />

      {/* Harsh atmosphere-free solar terminator light */}
      <directionalLight
        position={sunPosition}
        intensity={2.35}
        color="#fff5e6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />

      {/* Subtle deep-space earthshine backfill */}
      <directionalLight position={[-6, 1.5, -4]} intensity={0.09} color="#8ec2db" />

      <Moon
        craters={craters}
        activeFocus={activeFocus}
        onFocus={onFocus}
        onHoverFocus={onHoverFocus}
        reducedMotion={reducedMotion}
      />

      <CameraRig
        activeFocus={activeFocus}
        controlsRef={controlsRef}
        reducedMotion={reducedMotion}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom
        minDistance={4.2}
        maxDistance={7.8}
        minPolarAngle={0.25}
        maxPolarAngle={2.88}
        rotateSpeed={0.32}
        zoomSpeed={0.55}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

function WebGLFallback() {
  return (
    <div className="moon-webgl-fallback" role="status" style={{ padding: '2rem', textAlign: 'center', color: '#9aa0a6' }}>
      <strong style={{ color: '#f4f4f0', display: 'block', marginBottom: '0.5rem' }}>Spatial preview unavailable</strong>
      <span>WebGL initialization halted. Planetary reference records remain accessible in the mission list.</span>
    </div>
  );
}

export default function MoonScene({ craters, activeFocus, onFocus, onHoverFocus, reducedMotion, onReady, mobile }) {
  return (
    <Canvas
      dpr={mobile ? [1, 1.15] : [1, 1.75]}
      camera={{ position: [0.7, 0.45, 6.05], fov: mobile ? 38 : 34 }}
      fallback={<WebGLFallback />}
      gl={{ antialias: !mobile, powerPreference: 'high-performance', alpha: false }}
    >
      <Scene
        craters={craters}
        activeFocus={activeFocus}
        onFocus={onFocus}
        onHoverFocus={onHoverFocus}
        reducedMotion={reducedMotion}
        onReady={onReady}
      />
    </Canvas>
  );
}
