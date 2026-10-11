import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ASCII unit separator — never appears in git output
export const SEP = '\x1f';

const LOG_FORMAT = ['%H', '%h', '%ct', '%P', '%an', '%ae', '%s'].join(SEP);
const REF_FORMAT = ['%(refname:short)', '%(objectname)', '%(refname)'].join(SEP);

// Large repos produce far more output than execFile's 1 MiB default.
const MAX_BUFFER = 1024 * 1024 * 1024;

function git(args, cwd) {
  return execFileAsync('git', args, { cwd, maxBuffer: MAX_BUFFER }).then(r => r.stdout);
}

/** Strip whitespace and surrounding quotes (Windows "Copy as Path" wraps in double quotes). */
export function normalizeRepoPath(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/^["']+|["']+$/g, '').replace(/\\/g, '/');
}

export function parseCommits(output) {
  return output
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
        message: msgParts.join(SEP),
      };
    });
}

export function parseRefs(output) {
  return output
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [name, hash, type] = line.split(SEP);
      return { name, hash, type };
    });
}

/** Attach the list of ref names pointing at each commit. */
export function attachRefs(commits, refs) {
  const hashToRefs = new Map();
  for (const ref of refs) {
    if (!hashToRefs.has(ref.hash)) hashToRefs.set(ref.hash, []);
    hashToRefs.get(ref.hash).push(ref.name);
  }
  for (const commit of commits) commit.refs = hashToRefs.get(commit.hash) || [];
  return commits;
}

export async function isGitRepo(repoPath) {
  try {
    await git(['rev-parse', '--is-inside-work-tree'], repoPath);
    return true;
  } catch {
    return false;
  }
}

export async function readRepo(repoPath) {
  const [logOut, refsOut] = await Promise.all([
    git(['log', '--all', `--pretty=format:${LOG_FORMAT}`], repoPath),
    git(['for-each-ref', `--format=${REF_FORMAT}`, 'refs/heads', 'refs/remotes', 'refs/tags'], repoPath),
  ]);
  const refs = parseRefs(refsOut.trim());
  const commits = attachRefs(parseCommits(logOut.trim()), refs);
  return { commits, refs };
}
