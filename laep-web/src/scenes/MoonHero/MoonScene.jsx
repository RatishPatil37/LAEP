import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const MOON_RADIUS = 2;
const SOUTH_POLE = new THREE.Vector3(0, -1, 0);

export function positionFromLunarCoordinates(longitude, latitude, radius = MOON_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

function seededRandom(seed) {
  let value = seed;
  return () => { value = (value * 1664525 + 1013904223) % 4294967296; return value / 4294967296; };
}

// This compact, deterministic texture is visual orientation only; it is not lunar science imagery.
function createLunarSurfaceMaps() {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  const reliefCanvas = document.createElement('canvas');
  colorCanvas.width = reliefCanvas.width = size;
  colorCanvas.height = reliefCanvas.height = size;
  const color = colorCanvas.getContext('2d');
  const relief = reliefCanvas.getContext('2d');
  const random = seededRandom(24071969);
  color.fillStyle = '#84847f'; color.fillRect(0, 0, size, size);
  relief.fillStyle = '#6f6f6f'; relief.fillRect(0, 0, size, size);
  for (let i = 0; i < 4800; i += 1) {
    const x = random() * size; const y = random() * size; const shade = 105 + Math.floor(random() * 48);
    color.fillStyle = `rgba(${shade},${shade},${Math.max(90, shade - 5)},${0.02 + random() * 0.07})`;
    color.fillRect(x, y, 1 + random() * 2, 1 + random() * 2);
  }
  for (let i = 0; i < 180; i += 1) {
    const x = random() * size; const y = random() * size; const radius = 2 + Math.pow(random(), 2.6) * 31;
    const crater = color.createRadialGradient(x - radius * 0.25, y - radius * 0.25, radius * 0.08, x, y, radius);
    crater.addColorStop(0, 'rgba(182,181,174,.22)'); crater.addColorStop(.45, 'rgba(94,94,91,.08)'); crater.addColorStop(.78, 'rgba(48,48,47,.22)'); crater.addColorStop(1, 'rgba(151,150,144,.08)');
    color.fillStyle = crater; color.beginPath(); color.ellipse(x, y, radius, radius * (.72 + random() * .28), random() * Math.PI, 0, Math.PI * 2); color.fill();
    const bump = relief.createRadialGradient(x, y, radius * .1, x, y, radius);
    bump.addColorStop(0, 'rgb(48,48,48)'); bump.addColorStop(.65, 'rgb(96,96,96)'); bump.addColorStop(.82, 'rgb(170,170,170)'); bump.addColorStop(1, 'rgb(112,112,112)');
    relief.fillStyle = bump; relief.beginPath(); relief.ellipse(x, y, radius, radius * .78, 0, 0, Math.PI * 2); relief.fill();
  }
  const map = new THREE.CanvasTexture(colorCanvas); const bumpMap = new THREE.CanvasTexture(reliefCanvas);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = bumpMap.wrapS = THREE.RepeatWrapping; map.wrapT = bumpMap.wrapT = THREE.ClampToEdgeWrapping; map.anisotropy = bumpMap.anisotropy = 2;
  return { map, bumpMap };
}

function CameraRig({ activeFocus, controlsRef, reducedMotion }) {
  const { camera } = useThree();
  const destination = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    const focus = activeFocus?.type === 'crater' ? positionFromLunarCoordinates(activeFocus.crater.lon, activeFocus.crater.lat) : activeFocus?.type === 'south-pole' ? SOUTH_POLE.clone().multiplyScalar(MOON_RADIUS) : new THREE.Vector3();
    const isGlobal = !activeFocus || activeFocus.type === 'global';
    destination.copy(focus).normalize().multiplyScalar(isGlobal ? 6.15 : 4.75);
    if (isGlobal) destination.set(.7, .45, 6.05);
    lookAt.copy(focus).multiplyScalar(isGlobal ? 0 : .83);
    const damping = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.5);
    camera.position.lerp(destination, damping);
    controlsRef.current?.target.lerp(lookAt, damping);
    controlsRef.current?.update();
  });
  return null;
}

function Reticle({ position, selected, hovered, color, onClick, onHover, onBlur, size = .085 }) {
  const normal = position.clone().normalize();
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal), [normal.x, normal.y, normal.z]);
  return <group position={position.clone().addScaledVector(normal, .028)} quaternion={quaternion} scale={selected ? 1.35 : hovered ? 1.18 : 1}>
    <mesh onClick={onClick} onPointerOver={onHover} onPointerOut={onBlur}><circleGeometry args={[size * 1.5, 20]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    <mesh><ringGeometry args={[size * .72, size, 28]} /><meshBasicMaterial color={color} transparent opacity={selected ? .95 : hovered ? .82 : .54} side={THREE.DoubleSide} depthWrite={false} /></mesh>
    <mesh position={[0, 0, .002]}><circleGeometry args={[size * .13, 16]} /><meshBasicMaterial color={color} transparent opacity={.9} side={THREE.DoubleSide} depthWrite={false} /></mesh>
  </group>;
}

function Moon({ craters, activeFocus, onFocus, onHoverFocus, reducedMotion }) {
  const moon = useRef(); const [hovered, setHovered] = useState(null); const { map, bumpMap } = useMemo(createLunarSurfaceMaps, []);
  useFrame((_, delta) => {
    if (!moon.current) return;
    if (activeFocus?.type === 'global' && !reducedMotion) moon.current.rotation.y += delta * .006;
    else moon.current.rotation.y = THREE.MathUtils.damp(moon.current.rotation.y, 0, 4, delta);
  });
  const cursor = (value) => { document.body.style.cursor = value; };
  return <group ref={moon}>
    <mesh onClick={() => onFocus({ type: 'global' })} receiveShadow><sphereGeometry args={[MOON_RADIUS, 144, 96]} /><meshStandardMaterial map={map} bumpMap={bumpMap} bumpScale={.075} roughness={.98} metalness={0} color="#deddd5" /></mesh>
    {craters.map((crater) => { const selected = activeFocus?.type === 'crater' && activeFocus.crater.id === crater.id; const isHovered = hovered === crater.id; return <Reticle key={crater.id} position={positionFromLunarCoordinates(crater.lon, crater.lat)} selected={selected} hovered={isHovered} color={crater.status === 'negative' ? '#f29b8d' : '#b8f0ff'} size={crater.id === 'CABEUS' ? .115 : .075} onClick={(event) => { event.stopPropagation(); onFocus({ type: 'crater', crater }); }} onHover={(event) => { event.stopPropagation(); setHovered(crater.id); onHoverFocus?.({ type: 'crater', crater }); cursor('pointer'); }} onBlur={() => { setHovered(null); onHoverFocus?.(null); cursor('auto'); }} />; })}
    <Reticle position={SOUTH_POLE.clone().multiplyScalar(MOON_RADIUS)} selected={activeFocus?.type === 'south-pole'} hovered={hovered === 'south-pole'} color="#ffc857" size={.11} onClick={(event) => { event.stopPropagation(); onFocus({ type: 'south-pole' }); }} onHover={(event) => { event.stopPropagation(); setHovered('south-pole'); onHoverFocus?.({ type: 'south-pole' }); cursor('pointer'); }} onBlur={() => { setHovered(null); onHoverFocus?.(null); cursor('auto'); }} />
  </group>;
}

function Scene({ craters, activeFocus, onFocus, onHoverFocus, reducedMotion, onReady }) {
  const controlsRef = useRef(); useEffect(() => { onReady?.(); }, [onReady]);
  return <><color attach="background" args={['#050608']} /><hemisphereLight args={['#e8eef2', '#121416', .26]} /><directionalLight position={[5.5, 3.5, 4.5]} intensity={2.15} color="#fff1d7" /><directionalLight position={[-4, -1.5, -3]} intensity={.08} color="#9fc7db" /><Moon craters={craters} activeFocus={activeFocus} onFocus={onFocus} onHoverFocus={onHoverFocus} reducedMotion={reducedMotion} /><CameraRig activeFocus={activeFocus} controlsRef={controlsRef} reducedMotion={reducedMotion} /><OrbitControls ref={controlsRef} enablePan={false} enableZoom minDistance={4.25} maxDistance={7.4} minPolarAngle={.3} maxPolarAngle={2.82} rotateSpeed={.3} zoomSpeed={.55} enableDamping dampingFactor={.08} /></>;
}

function WebGLFallback() { return <div className="moon-webgl-fallback" role="status"><strong>Spatial preview unavailable</strong><span>This browser cannot create the lunar WebGL scene. The reference target list remains available below.</span></div>; }

export default function MoonScene({ craters, activeFocus, onFocus, onHoverFocus, reducedMotion, onReady, mobile }) {
  return <Canvas dpr={mobile ? [1, 1.15] : [1, 1.65]} camera={{ position: [.7, .45, 6.05], fov: mobile ? 38 : 34 }} fallback={<WebGLFallback />} gl={{ antialias: !mobile, powerPreference: 'high-performance', alpha: false }}><Scene craters={craters} activeFocus={activeFocus} onFocus={onFocus} onHoverFocus={onHoverFocus} reducedMotion={reducedMotion} onReady={onReady} /></Canvas>;
}
