import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { branchColor } from '../utils/layout.js';

const FONT =
  'https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOTk6OThhvA.woff';
const DEFAULT_COLOR = '#4a9eff';
const NODE_RADIUS = 0.22;

// Above this many commits, only commits near the camera target get text labels.
const LABEL_WINDOW_THRESHOLD = 300;
const LABEL_RADIUS = 40;

export const nodeColor = (commit) =>
  commit.refs?.length > 0 ? branchColor(commit.refs[0]) : DEFAULT_COLOR;

// ── Edges: one draw call per edge type instead of one <Line> per edge ────────
export function EdgeLines({ edges, color, opacity }) {
  const geometry = useMemo(() => {
    const pos = new Float32Array(edges.length * 6);
    edges.forEach((e, i) => {
      pos.set(e.from, i * 6);
      pos.set(e.to, i * 6 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [edges]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
}

// ── Labels ────────────────────────────────────────────────────────────────────
function CommitLabels({ commit, active }) {
  return (
    <group position={commit.position}>
      <Billboard>
        <Text
          position={[0, 0.42, 0]}
          fontSize={0.18}
          color={active ? '#fff' : '#888888'}
          anchorX="center"
          anchorY="bottom"
          font={FONT}
        >
          {commit.shortHash}
        </Text>
      </Billboard>
      {commit.refs?.slice(0, 2).map((ref, i) => (
        <Billboard key={ref}>
          <Text
            position={[0, 0.42 + 0.28 * (i + 1), 0]}
            fontSize={0.14}
            color={branchColor(ref)}
            anchorX="center"
            anchorY="bottom"
            font={FONT}
          >
            {ref}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}

// ── Highlight (halo + enlarged node) for hovered / selected / current commits ─
function Highlight({ commit, isSelected, isCurrent, isHovered }) {
  const color = nodeColor(commit);
  const scale = isSelected ? 1.6 : isCurrent ? 1.4 : 1.3;
  const emphasised = isSelected || isHovered;
  return (
    <group position={commit.position} raycast={() => null}>
      <mesh scale={scale * 1.6}>
        <sphereGeometry args={[NODE_RADIUS, 16, 16]} />
        <meshBasicMaterial
          color={isCurrent && !isSelected ? '#ffffff' : color}
          transparent
          opacity={isCurrent && !isSelected ? 0.08 : 0.15}
        />
      </mesh>
      <mesh scale={scale}>
        <sphereGeometry args={[NODE_RADIUS, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emphasised ? 0.9 : 0.6}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
    </group>
  );
}

// ── All commit spheres as a single InstancedMesh ──────────────────────────────
export function CommitNodes({ commits, selectedHash, currentIndex, onClick }) {
  const meshRef = useRef();
  const [hoveredIndex, setHoveredIndex] = useState(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    commits.forEach((commit, i) => {
      matrix.setPosition(...commit.position);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(nodeColor(commit)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [commits]);

  // Emissive glow tinted by each instance's colour, matching the old per-node material.
  const onBeforeCompile = useMemo(
    () => (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vColor;',
      );
    },
    [],
  );

  const selectedIndex = useMemo(
    () => (selectedHash ? commits.findIndex((c) => c.hash === selectedHash) : -1),
    [commits, selectedHash],
  );

  const highlighted = useMemo(() => {
    const set = new Set([currentIndex, selectedIndex, hoveredIndex]);
    set.delete(-1);
    set.delete(null);
    return [...set].filter((i) => commits[i]);
  }, [commits, currentIndex, selectedIndex, hoveredIndex]);

  const windowed = commits.length > LABEL_WINDOW_THRESHOLD;
  const labelled = useMemo(() => {
    const indices = new Set(highlighted);
    if (!windowed) {
      commits.forEach((_, i) => indices.add(i));
    } else {
      const lo = Math.max(0, currentIndex - LABEL_RADIUS);
      const hi = Math.min(commits.length - 1, currentIndex + LABEL_RADIUS);
      for (let i = lo; i <= hi; i++) indices.add(i);
    }
    return [...indices];
  }, [commits, windowed, currentIndex, highlighted]);

  useEffect(
    () => () => {
      document.body.style.cursor = 'default';
    },
    [],
  );

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[null, null, commits.length]}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) onClick(commits[e.instanceId]);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          if (e.instanceId !== hoveredIndex) setHoveredIndex(e.instanceId ?? null);
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
          setHoveredIndex(null);
        }}
      >
        <sphereGeometry args={[NODE_RADIUS, 16, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.3}
          roughness={0.3}
          metalness={0.6}
          onBeforeCompile={onBeforeCompile}
        />
      </instancedMesh>

      {highlighted.map((i) => (
        <Highlight
          key={commits[i].hash}
          commit={commits[i]}
          isSelected={i === selectedIndex}
          isCurrent={i === currentIndex}
          isHovered={i === hoveredIndex}
        />
      ))}

      {labelled.map((i) => (
        <CommitLabels key={commits[i].hash} commit={commits[i]} active={highlighted.includes(i)} />
      ))}
    </>
  );
}
