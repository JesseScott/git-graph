import { useState, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { layoutCommits, buildEdges, branchColor } from '../utils/layout.js';
import { useKeyboardNav } from '../hooks/useKeyboardNav.js';
import { CameraRig } from './CameraRig.jsx';
import { CommitNodes, EdgeLines, nodeColor } from './CommitNodes.jsx';

// ── Commit detail panel ───────────────────────────────────────────────────────
function CommitPanel({ commit }) {
  if (!commit) return null;
  const color = nodeColor(commit);
  const date = new Date(commit.timestamp * 1000).toLocaleString();
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: 24,
        zIndex: 10,
        width: 340,
        padding: '20px 22px',
        background: 'rgba(8,12,16,0.92)',
        border: `1px solid ${color}40`,
        borderRadius: 2,
        fontFamily: "'JetBrains Mono', monospace",
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontSize: 10,
            color: color,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Commit
        </span>
      </div>
      <div
        style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: 15,
          fontWeight: 700,
          color: '#fff',
          marginBottom: 12,
        }}
      >
        {commit.message}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}>
        <div>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>hash </span>
          {commit.hash.slice(0, 16)}...
        </div>
        <div>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>author </span>
          {commit.author}
        </div>
        <div>
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>date </span>
          {date}
        </div>
        {commit.refs?.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {commit.refs.map((ref) => (
              <span
                key={ref}
                style={{
                  padding: '2px 8px',
                  borderRadius: 2,
                  background: `${branchColor(ref)}20`,
                  border: `1px solid ${branchColor(ref)}50`,
                  color: branchColor(ref),
                  fontSize: 10,
                }}
              >
                {ref}
              </span>
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
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 3,
        fontSize: 10,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: "'JetBrains Mono', monospace",
        marginRight: 3,
      }}
    >
      {label}
    </span>
  );
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div
        style={{
          padding: '4px 10px',
          background: orbitMode ? 'rgba(0,255,140,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${orbitMode ? 'rgba(0,255,140,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 2,
          fontSize: 10,
          color: orbitMode ? '#00ff8c' : 'rgba(255,255,255,0.3)',
          letterSpacing: '0.1em',
        }}
      >
        {orbitMode ? '⊙ ORBIT MODE' : '⊙ WALK MODE'}
      </div>
      <div
        style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 2, textAlign: 'right' }}
      >
        {orbitMode ? (
          <span>drag · scroll · {key('O')} exit orbit</span>
        ) : (
          <>
            <div>
              {key('↑')} {key('W')} newer &nbsp; {key('↓')} {key('S')} older
            </div>
            <div>
              {key('←')} {key('A')} {key('→')} {key('D')} switch lane
            </div>
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
  const normalEdges = useMemo(() => edges.filter((e) => !e.isMerge), [edges]);
  const mergeEdges = useMemo(() => edges.filter((e) => e.isMerge), [edges]);

  const { currentIndex, orbitMode, setCurrentIndex } = useKeyboardNav(positioned, null, facing);
  const currentCommit = positioned[currentIndex];

  function handleNodeClick(commit) {
    const idx = positioned.findIndex((c) => c.hash === commit.hash);
    if (idx !== -1) setCurrentIndex(idx);
    setSelected(commit);
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#080c10' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          overflow: 'hidden',
          padding: '14px 20px',
          background: 'rgba(8,12,16,0.8)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 2,
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'inherit',
            fontSize: 11,
            padding: '4px 10px',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          ← back
        </button>
        <span
          style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: '#fff' }}
        >
          {data.repoName}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(0,255,140,0.5)', letterSpacing: '0.1em' }}>
          {data.commitCount} commits
        </span>
        {currentCommit && (
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
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
              <button
                key={value}
                onClick={() => setFacing(value)}
                style={{
                  background: active ? 'rgba(0,255,140,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? 'rgba(0,255,140,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 2,
                  color: active ? '#00ff8c' : 'rgba(255,255,255,0.35)',
                  fontFamily: 'inherit',
                  fontSize: 10,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
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

        <EdgeLines edges={normalEdges} color="#ffffff" opacity={0.15} />
        <EdgeLines edges={mergeEdges} color="#c77dff" opacity={1} />

        <CommitNodes
          commits={positioned}
          selectedHash={selected?.hash}
          currentIndex={currentIndex}
          onClick={handleNodeClick}
        />
      </Canvas>

      <CommitPanel commit={currentCommit} />
      <KeyHUD orbitMode={orbitMode} currentIndex={currentIndex} total={positioned.length} />
    </div>
  );
}
