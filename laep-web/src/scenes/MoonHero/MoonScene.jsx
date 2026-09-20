import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

function positionFromLunarCoordinates(longitude, latitude, radius = 2.05) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function Moon({ craters, selectedCrater, onSelect }) {
  const group = useRef();
  const targetRotation = useRef(0.18);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    if (selectedCrater) {
      targetRotation.current = THREE.MathUtils.degToRad(-selectedCrater.lon + 90);
    }
  }, [selectedCrater]);

  useFrame((_, delta) => {
    if (!group.current) return;
    const idleRotation = selectedCrater ? targetRotation.current : group.current.rotation.y + delta * 0.022;
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, idleRotation, 2.5, delta);
  });

  return (
    <group ref={group} rotation={[THREE.MathUtils.degToRad(-12), 0.18, 0]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[2, 96, 64]} />
        <meshStandardMaterial color="#a7a6a0" roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh scale={1.004}>
        <sphereGeometry args={[2, 96, 64]} />
        <meshBasicMaterial color="#f4f4f0" transparent opacity={0.035} side={THREE.BackSide} />
      </mesh>
      {craters.map((crater) => {
        const position = positionFromLunarCoordinates(crater.lon, crater.lat);
        const isSelected = selectedCrater?.id === crater.id;
        const isHovered = hoveredId === crater.id;
        return (
          <group key={crater.id} position={position}>
            <mesh
              onClick={(event) => { event.stopPropagation(); onSelect(crater); }}
              onPointerOver={(event) => { event.stopPropagation(); setHoveredId(crater.id); document.body.style.cursor = 'crosshair'; }}
              onPointerOut={() => { setHoveredId(null); document.body.style.cursor = 'auto'; }}
              scale={isSelected || isHovered ? 1.5 : 1}
            >
              <sphereGeometry args={[0.045, 20, 20]} />
              <meshBasicMaterial color={crater.status === 'negative' ? '#ff6b5e' : '#b8f0ff'} />
            </mesh>
            {(isSelected || isHovered) && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.075, 0.09, 32]} />
                <meshBasicMaterial color="#ffc857" transparent opacity={0.9} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}
      <group position={[0, -2.03, 0]}>
        <mesh>
          <cylinderGeometry args={[0.018, 0.018, 0.28, 16]} />
          <meshBasicMaterial color="#ffc857" />
        </mesh>
      </group>
    </group>
  );
}

function Scene({ craters, selectedCrater, onSelect }) {
  return (
    <>
      <color attach="background" args={['#050608']} />
      <ambientLight intensity={0.16} />
      <directionalLight position={[4, 3, 5]} intensity={2.8} color="#fff7df" castShadow />
      <directionalLight position={[-5, -1, -3]} intensity={0.18} color="#7dd3fc" />
      <Moon craters={craters} selectedCrater={selectedCrater} onSelect={onSelect} />
      <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.65} maxPolarAngle={2.5} rotateSpeed={0.35} />
    </>
  );
}

function WebGLFallback() {
  return <div className="moon-webgl-fallback">3D lunar context is unavailable on this device. Use the target list to inspect reference craters.</div>;
}

export default function MoonScene(props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.05, 5.5], fov: 35 }}
      fallback={<WebGLFallback />}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
