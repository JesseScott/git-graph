import { useState, useEffect } from 'react';

const styles = {
  root: {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#080c10',
    fontFamily: "'JetBrains Mono', monospace",
  },
  grid: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'linear-gradient(rgba(0,255,140,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,140,0.03) 1px, transparent 1px)',
    backgroundSize: '40px 40px',
  },
  card: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: 560,
    padding: '48px 40px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(0,255,140,0.15)',
    borderRadius: 2,
  },
  title: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em',
    color: '#fff', marginBottom: 4,
  },
  subtitle: {
    fontSize: 11, color: 'rgba(0,255,140,0.6)', letterSpacing: '0.15em',
    textTransform: 'uppercase', marginBottom: 40,
  },
  label: {
    fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em',
    textTransform: 'uppercase', marginBottom: 8,
  },
  inputRow: {
    display: 'flex', gap: 8, marginBottom: 24,
  },
  input: {
    flex: 1, padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 2, color: '#e2e8f0',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13, outline: 'none',
  },
  button: {
    padding: '10px 20px',
    background: 'rgba(0,255,140,0.1)',
    border: '1px solid rgba(0,255,140,0.4)',
    borderRadius: 2, color: '#00ff8c',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
    letterSpacing: '0.05em',
  },
  divider: {
    borderColor: 'rgba(255,255,255,0.06)', margin: '24px 0',
  },
  prevLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em',
    textTransform: 'uppercase', marginBottom: 12,
  },
  repoItem: {
    display: 'flex', alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 2, marginBottom: 6,
    gap: 8,
  },
  repoName: { fontSize: 12, color: '#e2e8f0', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  repoMeta: { fontSize: 10, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', flexShrink: 0 },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '2px 6px', borderRadius: 2,
    fontSize: 11, lineHeight: 1, flexShrink: 0,
    fontFamily: "'JetBrains Mono', monospace",
  },
  error: {
    marginTop: 12, padding: '10px 14px',
    background: 'rgba(255,60,60,0.08)',
    border: '1px solid rgba(255,60,60,0.2)',
    borderRadius: 2, color: '#ff6b6b', fontSize: 12,
  },
  status: {
    marginTop: 12, fontSize: 11, color: 'rgba(0,255,140,0.7)',
    letterSpacing: '0.05em',
  },
};

export default function ImportScreen({ onLoad }) {
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [exports, setExports] = useState([]); // [{ filename, repoName, repoPath, exportedAt }]

  useEffect(() => { fetchExports(); }, []);

  async function fetchExports() {
    try {
      const res = await fetch('/exports');
      const files = await res.json();

      // Load metadata from each JSON file to get the real repo name
      const withMeta = await Promise.all(
        files.map(async ({ filename }) => {
          try {
            const r = await fetch(`/exports/${filename}`);
            const d = await r.json();
            return { filename, repoName: d.repoName, repoPath: d.repoPath, exportedAt: d.exportedAt };
          } catch {
            return { filename, repoName: filename, repoPath: '', exportedAt: '' };
          }
        })
      );
      setExports(withMeta);
    } catch { /* server may not be ready */ }
  }

  async function handleExport(overridePath) {
    const repoPath = (overridePath ?? path).trim();
    if (!repoPath) return;
    setLoading(true);
    setError('');
    setStatus('Running git log...');

    try {
      const res = await fetch('/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: repoPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStatus(`Exported ${data.commitCount} commits — loading graph...`);
      await loadExport(data.filename);
    } catch (err) {
      setError(err.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  async function loadExport(filename) {
    const res = await fetch(`/exports/${filename}`);
    const data = await res.json();
    onLoad(data);
  }

  async function handleDelete(e, filename) {
    e.stopPropagation();
    try {
      await fetch(`/exports/${filename}`, { method: 'DELETE' });
      setExports(prev => prev.filter(x => x.filename !== filename));
    } catch {
      // If DELETE not implemented, just remove from UI
      setExports(prev => prev.filter(x => x.filename !== filename));
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch { return ''; }
  }

  return (
    <div style={styles.root}>
      <div style={styles.grid} />
      <div style={styles.card}>
        <div style={styles.title}>GitGraph</div>
        <div style={styles.subtitle}>3D repository visualizer</div>

        <div style={styles.label}>Repository path</div>
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            placeholder="/path/to/your/repo"
            value={path}
            onChange={e => setPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleExport()}
          />
          <button
            style={{ ...styles.button, opacity: loading ? 0.5 : 1 }}
            onClick={() => handleExport()}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Import'}
          </button>
        </div>

        {error && <div style={styles.error}>⚠ {error}</div>}
        {status && <div style={styles.status}>↳ {status}</div>}

        {exports.length > 0 && (
          <>
            <hr style={styles.divider} />
            <div style={styles.prevLabel}>Previously imported</div>
            {exports.map(({ filename, repoName, repoPath, exportedAt }) => (
              <div
                key={filename}
                style={styles.repoItem}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,255,140,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                {/* Clickable name area */}
                <div
                  style={{ ...styles.repoName, cursor: 'pointer' }}
                  onClick={() => loadExport(filename)}
                >
                  {repoName}
                </div>

                <div style={styles.repoMeta}>{formatDate(exportedAt)}</div>

                {/* Reimport */}
                {repoPath && (
                  <button
                    style={{ ...styles.iconBtn, color: 'rgba(0,255,140,0.6)' }}
                    title={`Reimport from ${repoPath}`}
                    onClick={e => { e.stopPropagation(); handleExport(repoPath); }}
                    onMouseEnter={e => e.currentTarget.style.color = '#00ff8c'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(0,255,140,0.6)'}
                  >↺</button>
                )}

                {/* Delete */}
                <button
                  style={{ ...styles.iconBtn, color: 'rgba(255,100,100,0.5)' }}
                  title="Remove from list"
                  onClick={e => handleDelete(e, filename)}
                  onMouseEnter={e => e.currentTarget.style.color = '#ff6b6b'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,100,100,0.5)'}
                >✕</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}