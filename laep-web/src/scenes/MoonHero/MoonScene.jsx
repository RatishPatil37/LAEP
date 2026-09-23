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
    <group rotation={[0, 0, THREE.MathUtils.degToRad(88.5)]}>
      {/* Orbital line */}
      <mesh geometry={ringGeo}>
        <meshBasicMaterial
          color="#ffc857"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Orbiting Chandrayaan-2 satellite bus */}
      <group ref={satelliteMesh}>
        <mesh>
          <boxGeometry args={[0.045, 0.03, 0.04]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Solar panels */}
        <mesh position={[0.05, 0, 0]}>
          <boxGeometry args={[0.06, 0.004, 0.03]} />
          <meshBasicMaterial color="#7dd3fc" />
        </mesh>
        <mesh position={[-0.05, 0, 0]}>
          <boxGeometry args={[0.06, 0.004, 0.03]} />
          <meshBasicMaterial color="#7dd3fc" />
        </mesh>
        {/* Radar Footprint Projection Cone */}
        <mesh position={[0, -0.22, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.18, 0.44, 16, 1, true]} />
          <meshBasicMaterial
            color="#2dd4bf"
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

// ── 360° Circular Radar Sweep Animation ──
function RadarSweep({ position, active }) {
  const sweepRef = useRef();
  const normal = position.clone().normalize();
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

// ── Camera Rig with Smooth Deep Zoom Continuum Transitions ──
function CameraRig({ activeFocus, controlsRef, reducedMotion }) {
  const { camera } = useThree();
  const deepZoomLevel = useMissionStore((s) => s.deepZoomLevel);
  const destination = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);

  // Spatial Scale Continuum Multipliers
  const zoomFactor = useMemo(() => {
    switch (deepZoomLevel) {
      case 'submeter': return 0.42; // Extreme close-up
      case 'surface':  return 0.56; // 1 km terrain scale
      case 'approach': return 0.75; // 20 km approach scale
      case 'orbit':
      default:
        return 1.0;  // 100 km orbit baseline
    }
  }, [deepZoomLevel]);

  useFrame((_, delta) => {
    let focus;
    let baseDistance;

    if (activeFocus?.type === 'crater') {
      focus = positionFromLunarCoordinates(activeFocus.crater.lon, activeFocus.crater.lat);
      baseDistance = 4.45;
    } else if (activeFocus?.type === 'south-pole') {
      focus = SOUTH_POLE.clone().multiplyScalar(MOON_RADIUS);
      baseDistance = 4.65;
    } else {
      focus = new THREE.Vector3();
      baseDistance = 5.85;
    }

    const targetDistance = Math.max(2.15, baseDistance * zoomFactor);
    const isGlobal = !activeFocus || activeFocus.type === 'global';

    destination.copy(focus).normalize().multiplyScalar(targetDistance);
    if (isGlobal) {
      destination.set(0.7 * zoomFactor, 0.45 * zoomFactor, 5.85 * zoomFactor);
    }

    lookAt.copy(focus).multiplyScalar(isGlobal ? 0 : 0.85);

    const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.8);
    camera.position.lerp(destination, damping);
    controlsRef.current?.target.lerp(lookAt, damping);
    controlsRef.current?.update();
  });

  return null;
}

// ── Procedural Fallback Lunar Texture (Guarantees zero black screen flash) ──
function createProceduralLunarTexture() {
  const width = 512;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Base lunar regolith tone
  ctx.fillStyle = '#94979e';
  ctx.fillRect(0, 0, width, height);

  // Dark basaltic maria plains
  const maria = [
    { x: 170, y: 105, rx: 65, ry: 40, color: '#666971' },
    { x: 260, y: 90,  rx: 38, ry: 32, color: '#5e6169' },
    { x: 330, y: 110, rx: 34, ry: 28, color: '#62656d' },
    { x: 370, y: 125, rx: 28, ry: 24, color: '#60636b' },
    { x: 410, y: 135, rx: 24, ry: 22, color: '#5c5f67' },
    { x: 250, y: 215, rx: 60, ry: 28, color: '#565961' },
  ];

  maria.forEach((m) => {
    const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, Math.max(m.rx, m.ry));
    grad.addColorStop(0, m.color);
    grad.addColorStop(0.75, m.color);
    grad.addColorStop(1, 'rgba(148, 151, 158, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Impact craters & ray speckles
  for (let i = 0; i < 450; i++) {
    const cx = (Math.sin(i * 7919) * 0.5 + 0.5) * width;
    const cy = (Math.cos(i * 6133) * 0.5 + 0.5) * height;
    const r = (Math.sin(i * 3119) * 0.5 + 0.5) * 5 + 1.2;
    ctx.fillStyle = 'rgba(230, 235, 242, 0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(45, 48, 55, 0.55)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// ── Photorealistic Moon Mesh using NASA Photographic Textures ──
function Moon({ craters, activeFocus, onFocus, onHoverFocus, reducedMotion }) {
  const moon = useRef();
  const [hovered, setHovered] = useState(null);
  const activeLayer = useMissionStore((s) => s.activeLayer);

  // Instant fallback texture + asynchronous 2K NASA photographic texture
  const [textureMap, setTextureMap] = useState(() => createProceduralLunarTexture());
  const [bumpTexture, setBumpTexture] = useState(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      '/textures/moon/2k_moon.jpg',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        setTextureMap(tex);
      },
      undefined,
      (err) => {
        console.warn('Using procedural fallback lunar texture:', err);
      }
    );

    loader.load(
      '/textures/moon/moon_bump.jpg',
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        setBumpTexture(tex);
      },
      undefined,
      () => {}
    );
  }, []);

  // Scientific layer modulation tint
  const surfaceTint = useMemo(() => {
    if (activeLayer === LAYER_IDS.ICE) return '#dcf6ff';
    if (activeLayer === LAYER_IDS.CPR) return '#ffeec7';
    if (activeLayer === LAYER_IDS.DOP) return '#e0f9f3';
    return '#ffffff';
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
      {/* Core Photographic Moon Sphere */}
      <mesh onClick={() => onFocus({ type: 'global' })}>
        <sphereGeometry args={[MOON_RADIUS, 128, 96]} />
        <meshStandardMaterial
          map={textureMap}
          bumpMap={bumpTexture}
          bumpScale={bumpTexture ? 0.045 : 0}
          roughness={0.78}
          metalness={0.04}
          color={surfaceTint}
        />
      </mesh>

      {/* Chandrayaan-2 Polar Orbit Track */}
      <PolarOrbitTrack />

      {/* Crater Target Hotspots */}
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

      {/* South Pole Reference Marker */}
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
    const el = solarElevation || 3.7;
    // Map solar elevation (0.6° to 12.8°) to dynamic orbital lighting
    const azimuthRad = THREE.MathUtils.degToRad((el - 0.6) * 4.8 + 32);
    const elevationRad = THREE.MathUtils.degToRad(el * 2.2 + 10);
    const dist = 12.0;
    return [
      dist * Math.cos(azimuthRad),
      dist * Math.sin(elevationRad),
      dist * Math.sin(azimuthRad) + 3.8,
    ];
  }, [solarElevation]);

  return (
    <>
      <color attach="background" args={['#050608']} />

      {/* Front ambient regolith fill (prevents pitch-black void) */}
      <ambientLight intensity={0.48} color="#e2e8f0" />
      <hemisphereLight args={['#e8eef2', '#141820', 0.38]} />

      {/* Dynamic grazing solar terminator key light */}
      <directionalLight
        position={sunPosition}
        intensity={2.8}
        color="#fffaf0"
      />

      {/* Atmospheric Earthshine celestial backfill (soft lunar mare blue) */}
      <directionalLight position={[-5.5, 2.0, 4.5]} intensity={0.42} color="#9fc7db" />

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
        minDistance={2.1}
        maxDistance={8.5}
        minPolarAngle={0.2}
        maxPolarAngle={2.95}
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
      camera={{ position: [0.7, 0.45, 5.85], fov: mobile ? 38 : 34 }}
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
