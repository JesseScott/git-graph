import { useState, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Billboard, Text } from '@react-three/drei';
import { layoutCommits, buildEdges, branchColor } from '../utils/layout.js';

// ── Single commit node ────────────────────────────────────────────────────────
function CommitNode({ commit, onClick, isSelected }) {
  const [hovered, setHovered] = useState(false);
  const color = commit.refs?.length > 0 ? branchColor(commit.refs[0]) : '#4a9eff';
  const scale = isSelected ? 1.6 : hovered ? 1.3 : 1;

  return (
    <group position={commit.position}>
      {/* Glow ring */}
      {(hovered || isSelected) && (
        <mesh scale={[scale * 1.6, scale * 1.6, scale * 1.6]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} />
        </mesh>
      )}

      {/* Core sphere */}
      <mesh
        scale={[scale, scale, scale]}
        onClick={e => { e.stopPropagation(); onClick(commit); }}
        onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || isSelected ? 0.8 : 0.3}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Short hash label */}
      <Billboard>
        <Text
          position={[0, 0.42, 0]}
          fontSize={0.18}
          color={hovered || isSelected ? '#fff' : 'rgba(255,255,255,0.5)'}
          anchorX="center"
          anchorY="bottom"
          font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOTk6OThhvA.woff"
        >
          {commit.shortHash}
        </Text>
      </Billboard>

      {/* Ref badges (branch/tag names) */}
      {commit.refs?.slice(0, 2).map((ref, i) => (
        <Billboard key={ref}>
          <Text
            position={[0, 0.42 + 0.28 * (i + 1), 0]}
            fontSize={0.14}
            color={branchColor(ref)}
            anchorX="center"
            anchorY="bottom"
            font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOTk6OThhvA.woff"
          >
            {ref}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}

// ── Commit detail panel (HTML overlay) ───────────────────────────────────────
function CommitPanel({ commit, onClose }) {
  if (!commit) return null;
  const color = commit.refs?.length > 0 ? branchColor(commit.refs[0]) : '#4a9eff';
  const date = new Date(commit.timestamp * 1000).toLocaleString();

  return (
    <div style={{
      position: 'absolute', bottom: 24, left: 24, zIndex: 10,
      width: 340, padding: '20px 22px',
      background: 'rgba(8,12,16,0.92)',
      border: `1px solid ${color}40`,
      borderRadius: 2, fontFamily: "'JetBrains Mono', monospace",
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Commit
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer', fontSize: 16, lineHeight: 1,
        }}>×</button>
      </div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
        {commit.message}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}>
        <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>hash </span>{commit.hash.slice(0, 16)}...</div>
        <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>author </span>{commit.author}</div>
        <div><span style={{ color: 'rgba(255,255,255,0.25)' }}>date </span>{date}</div>
        {commit.refs?.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {commit.refs.map(ref => (
              <span key={ref} style={{
                padding: '2px 8px', borderRadius: 2,
                background: `${branchColor(ref)}20`,
                border: `1px solid ${branchColor(ref)}50`,
                color: branchColor(ref), fontSize: 10,
              }}>{ref}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main graph view ───────────────────────────────────────────────────────────
export default function GraphView({ data, onBack }) {
  const [selected, setSelected] = useState(null);

  const positioned = useMemo(() => layoutCommits(data.commits), [data.commits]);
  const edges = useMemo(() => buildEdges(positioned), [positioned]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#080c10' }}>

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 20px',
        background: 'rgba(8,12,16,0.8)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 2, color: 'rgba(255,255,255,0.5)',
          fontFamily: 'inherit', fontSize: 11, padding: '4px 10px',
          cursor: 'pointer', letterSpacing: '0.05em',
        }}>← back</button>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: '#fff' }}>
          {data.repoName}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(0,255,140,0.5)', letterSpacing: '0.1em' }}>
          {data.commitCount} commits
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
          drag to orbit · scroll to zoom · click a node
        </span>
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 8, 20], fov: 60 }}
        style={{ position: 'absolute', inset: 0 }}
        onClick={() => setSelected(null)}
      >
        <color attach="background" args={['#080c10']} />
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4a9eff" />
        <fog attach="fog" args={['#080c10', 40, 120]} />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={3}
          maxDistance={120}
        />

        {/* Edges */}
        {edges.map(edge => (
          <Line
            key={edge.id}
            points={[edge.from, edge.to]}
            color={edge.isMerge ? '#c77dff' : 'rgba(255,255,255,0.15)'}
            lineWidth={edge.isMerge ? 1.5 : 0.8}
          />
        ))}

        {/* Nodes */}
        {positioned.map(commit => (
          <CommitNode
            key={commit.hash}
            commit={commit}
            isSelected={selected?.hash === commit.hash}
            onClick={setSelected}
          />
        ))}
      </Canvas>

      {/* Commit detail panel */}
      <CommitPanel commit={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
