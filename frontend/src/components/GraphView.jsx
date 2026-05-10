import { useState, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line, Billboard, Text } from '@react-three/drei';
import { layoutCommits, buildEdges, branchColor } from '../utils/layout.js';
import { useKeyboardNav } from '../hooks/useKeyboardNav.js';
import { CameraRig } from './CameraRig.jsx';

// ── Single commit node ────────────────────────────────────────────────────────
function CommitNode({ commit, onClick, isSelected, isCurrent }) {
  const [hovered, setHovered] = useState(false);
  const color = commit.refs?.length > 0 ? branchColor(commit.refs[0]) : '#4a9eff';
  const scale = isSelected ? 1.6 : isCurrent ? 1.4 : hovered ? 1.3 : 1;

  return (
    <group position={commit.position}>
      {(hovered || isSelected || isCurrent) && (
        <mesh scale={[scale * 1.6, scale * 1.6, scale * 1.6]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshBasicMaterial
            color={isCurrent && !isSelected ? '#ffffff' : color}
            transparent
            opacity={isCurrent && !isSelected ? 0.08 : 0.15}
          />
        </mesh>
      )}
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
          emissiveIntensity={isSelected ? 0.9 : isCurrent ? 0.6 : hovered ? 0.5 : 0.3}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      <Billboard>
        <Text
          position={[0, 0.42, 0]}
          fontSize={0.18}
          color={hovered || isSelected || isCurrent ? '#fff' : '#888888'}
          anchorX="center"
          anchorY="bottom"
          font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOTk6OThhvA.woff"
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
            font="https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOTk6OThhvA.woff"
          >
            {ref}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}

// ── Commit detail panel ───────────────────────────────────────────────────────
function CommitPanel({ commit }) {
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
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: color, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Commit</span>
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

// ── Key controls HUD ──────────────────────────────────────────────────────────
function KeyHUD({ orbitMode, currentIndex, total }) {
  const key = (label) => (
    <span style={{
      display: 'inline-block', padding: '1px 7px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 3, fontSize: 10, color: 'rgba(255,255,255,0.5)',
      fontFamily: "'JetBrains Mono', monospace", marginRight: 3,
    }}>{label}</span>
  );
  return (
    <div style={{
      position: 'absolute', bottom: 24, right: 24, zIndex: 10,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{
        padding: '4px 10px',
        background: orbitMode ? 'rgba(0,255,140,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${orbitMode ? 'rgba(0,255,140,0.4)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 2, fontSize: 10,
        color: orbitMode ? '#00ff8c' : 'rgba(255,255,255,0.3)',
        letterSpacing: '0.1em',
      }}>
        {orbitMode ? '⊙ ORBIT MODE' : '⊙ WALK MODE'}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 2, textAlign: 'right' }}>
        {orbitMode ? (
          <span>drag · scroll · {key('O')} exit orbit</span>
        ) : (
          <>
            <div>{key('↑')} {key('W')} newer &nbsp; {key('↓')} {key('S')} older</div>
            <div>{key('←')} {key('A')} {key('→')} {key('D')} switch lane</div>
            <div>{key('O')} free orbit</div>
          </>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}>
        {currentIndex + 1} / {total}
      </div>
    </div>
  );
}

// ── Main graph view ───────────────────────────────────────────────────────────
export default function GraphView({ data, onBack }) {
  const [selected, setSelected] = useState(null);
  const [facing, setFacing] = useState('oldest'); // 'oldest' = walking forward through time
  const orbitRef = useRef();

  const positioned = useMemo(() => layoutCommits(data.commits), [data.commits]);
  const edges = useMemo(() => buildEdges(positioned), [positioned]);

  const { currentIndex, orbitMode, setCurrentIndex, setOrbitMode } = useKeyboardNav(positioned, null, facing);
  const currentCommit = positioned[currentIndex];

  function handleNodeClick(commit) {
    const idx = positioned.findIndex(c => c.hash === commit.hash);
    if (idx !== -1) setCurrentIndex(idx);
    setSelected(commit);
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#080c10' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 16, overflow: 'hidden',
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
        {currentCommit && (
          <span style={{
            marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.35)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
          }}>
            {currentCommit.shortHash} — {currentCommit.message}
          </span>
        )}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {[
            { label: '⟪ oldest', value: 'oldest' },
            { label: '⟫ newest', value: 'newest' },
          ].map(({ label, value }) => {
            const active = facing === value;
            return (
              <button key={value} onClick={() => setFacing(value)} style={{
                background: active ? 'rgba(0,255,140,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? 'rgba(0,255,140,0.5)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 2,
                color: active ? '#00ff8c' : 'rgba(255,255,255,0.35)',
                fontFamily: 'inherit', fontSize: 10, padding: '4px 10px',
                cursor: 'pointer', letterSpacing: '0.05em',
                transition: 'all 0.15s',
              }}>{label}</button>
            );
          })}
        </div>
      </div>

      <Canvas
        camera={{ position: [0, 10, 7], fov: 55 }}
        style={{ position: 'absolute', inset: 0 }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={['#080c10']} />
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4a9eff" />
        <fog attach="fog" args={['#080c10', 40, 120]} />

        <CameraRig
          targetPosition={currentCommit?.position}
          orbitMode={orbitMode}
          orbitControlsRef={orbitRef}
          facing={facing}
        />

        <OrbitControls
          ref={orbitRef}
          enabled={orbitMode}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={3}
          maxDistance={120}
        />

        {edges.map(edge => (
          <Line
            key={edge.id}
            points={[edge.from, edge.to]}
            color={edge.isMerge ? '#c77dff' : '#ffffff'}
            lineWidth={edge.isMerge ? 1.5 : 0.8}
            opacity={edge.isMerge ? 1 : 0.15}
            transparent
          />
        ))}

        {positioned.map((commit, i) => (
          <CommitNode
            key={commit.hash}
            commit={commit}
            isSelected={selected?.hash === commit.hash}
            isCurrent={i === currentIndex}
            onClick={handleNodeClick}
          />
        ))}
      </Canvas>

      <CommitPanel commit={currentCommit} />
      <KeyHUD orbitMode={orbitMode} currentIndex={currentIndex} total={positioned.length} />
    </div>
  );
}