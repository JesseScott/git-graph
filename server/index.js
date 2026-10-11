import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { join, basename, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { normalizeRepoPath, isGitRepo, readRepo, parseLimit, isValidExportName } from './git.js';

const app = express();
const PORT = 3001;
// Local tool: only listen on loopback and only accept the dev UI's origin.
const HOST = '127.0.0.1';
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'exports');

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '10kb' }));
app.use('/exports', express.static(OUTPUT_DIR));

// Ensure exports directory exists
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// POST /export  { path: "/path/to/repo" }
app.post('/export', async (req, res) => {
  const repoPath = normalizeRepoPath(req.body?.path);

  if (!repoPath) {
    return res.status(400).json({ error: 'No path provided' });
  }

  if (!isAbsolute(repoPath)) {
    return res.status(400).json({ error: 'Path must be absolute' });
  }

  let limit;
  try {
    limit = parseLimit(req.body?.limit);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (!existsSync(repoPath)) {
    return res.status(400).json({ error: `Path does not exist: ${repoPath}` });
  }

  if (!(await isGitRepo(repoPath))) {
    return res.status(400).json({ error: 'Not a git repository' });
  }

  try {
    const { commits, refs } = await readRepo(repoPath, { limit });

    const repoName = basename(repoPath).replace(/[^a-zA-Z0-9-_]/g, '_');
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const filename = `gitgraph_${repoName}_${stamp}.json`;
    const outputPath = join(OUTPUT_DIR, filename);

    // Remove any previous exports for the same repo
    readdirSync(OUTPUT_DIR)
      .filter((f) => f.startsWith(`gitgraph_${repoName}_`) && f.endsWith('.json'))
      .forEach((f) => unlinkSync(join(OUTPUT_DIR, f)));

    const output = {
      repoName,
      repoPath,
      exportedAt: new Date().toISOString(),
      commitCount: commits.length,
      commits,
      refs,
    };

    writeFileSync(outputPath, JSON.stringify(output));

    res.json({ filename, commitCount: commits.length, repoName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /exports  - list all exported files
app.get('/exports', (req, res) => {
  const files = readdirSync(OUTPUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((filename) => ({ filename, display: filename }))
    .sort()
    .reverse(); // newest first
  res.json(files);
});

// DELETE /exports/:filename
app.delete('/exports/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!isValidExportName(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = join(OUTPUT_DIR, filename);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  unlinkSync(filePath);
  res.json({ deleted: filename });
});

app.listen(PORT, HOST, () => {
  console.log(`GitGraph server running on http://${HOST}:${PORT}`);
  console.log(`Exports directory: ${OUTPUT_DIR}`);
});
