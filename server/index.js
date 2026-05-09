import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const app = express();
const PORT = 3001;
const OUTPUT_DIR = join(process.cwd(), 'exports');

app.use(cors());
app.use(express.json());
app.use('/exports', express.static(OUTPUT_DIR));

// Ensure exports directory exists
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR);

// POST /export  { path: "/path/to/repo" }
app.post('/export', (req, res) => {
  // Trim whitespace and surrounding quotes (Windows "Copy as Path" wraps in double quotes)
  const repoPath = req.body.path?.trim().replace(/^["']+|["']+$/g, '').replace(/\\/g, '/');

  if (!repoPath) {
    return res.status(400).json({ error: 'No path provided' });
  }

  if (!existsSync(repoPath)) {
    return res.status(400).json({ error: `Path does not exist: ${repoPath}` });
  }

  // Check it's actually a git repo
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: repoPath, stdio: 'pipe' });
  } catch {
    return res.status(400).json({ error: 'Not a git repository' });
  }

  try {
    // Use a safe delimiter-based format instead of JSON templates to avoid shell quoting issues.
    // Each commit is one line: HASH|SHORTHASH|TIMESTAMP|PARENTS|AUTHOR|EMAIL|MESSAGE
    // Message is last so any pipe chars in it don't break earlier fields.
    const SEP = '\x1f'; // ASCII unit separator — never appears in git output
    const logOutput = execSync(
      `git log --all --pretty=format:"%H${SEP}%h${SEP}%ct${SEP}%P${SEP}%an${SEP}%ae${SEP}%s"`,
      { cwd: repoPath, stdio: 'pipe' }
    ).toString().trim();

    // Get branch/ref info using safe delimiters too
    const refsOutput = execSync(
      `git for-each-ref --format="%(refname:short)${SEP}%(objectname)${SEP}%(refname)" refs/heads refs/remotes refs/tags`,
      { cwd: repoPath, stdio: 'pipe' }
    ).toString().trim();

    // Parse commits
    const commits = logOutput
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [hash, shortHash, timestamp, parentsRaw, author, email, ...msgParts] = line.split(SEP);
        return {
          hash,
          shortHash,
          timestamp: parseInt(timestamp, 10),
          parents: parentsRaw ? parentsRaw.split(' ').filter(Boolean) : [],
          author,
          email,
          message: msgParts.join(SEP), // rejoin in case message contained SEP (extremely unlikely but safe)
        };
      });

    // Parse refs
    const refs = refsOutput
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [name, hash, type] = line.split(SEP);
        return { name, hash, type };
      });

    // Tag each commit with its branch names
    const hashToRefs = {};
    refs.forEach(ref => {
      if (!hashToRefs[ref.hash]) hashToRefs[ref.hash] = [];
      hashToRefs[ref.hash].push(ref.name);
    });

    commits.forEach(commit => {
      commit.refs = hashToRefs[commit.hash] || [];
    });

    const repoName = basename(repoPath).replace(/[^a-zA-Z0-9-_]/g, '_');
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const filename = `gitgraph_${repoName}_${timestamp}.json`;
    const outputPath = join(OUTPUT_DIR, filename);

    const output = {
      repoName,
      repoPath,
      exportedAt: new Date().toISOString(),
      commitCount: commits.length,
      commits,
      refs,
    };

    writeFileSync(outputPath, JSON.stringify(output, null, 2));

    res.json({ filename, commitCount: commits.length, repoName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /exports  - list all exported files
app.get('/exports', (req, res) => {
  const files = readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(filename => {
      const parts = filename.replace('.json', '').split('_');
      return { filename, display: filename };
    })
    .sort()
    .reverse(); // newest first
  res.json(files);
});

app.listen(PORT, () => {
  console.log(`GitGraph server running on http://localhost:${PORT}`);
  console.log(`Exports directory: ${OUTPUT_DIR}`);
});