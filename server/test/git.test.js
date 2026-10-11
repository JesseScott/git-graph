import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SEP, normalizeRepoPath, parseCommits, parseRefs, attachRefs, readRepo, isGitRepo } from '../git.js';

test('normalizeRepoPath strips quotes and converts backslashes', () => {
  assert.equal(normalizeRepoPath('  "C:\\Users\\me\\proj"  '), 'C:/Users/me/proj');
  assert.equal(normalizeRepoPath(undefined), '');
});

test('parseCommits handles root, merge and separator-containing messages', () => {
  const line = (...f) => f.join(SEP);
  const out = [
    line('h1', 'h1s', '10', '', 'A', 'a@x', 'root'),
    line('h2', 'h2s', '20', 'h1 h3', 'B', 'b@x', `has${SEP}sep | pipe`),
  ].join('\n');
  const [root, merge] = parseCommits(out);
  assert.deepEqual(root.parents, []);
  assert.deepEqual(merge.parents, ['h1', 'h3']);
  assert.equal(merge.timestamp, 20);
  assert.equal(merge.message, `has${SEP}sep | pipe`);
});

test('attachRefs maps ref names onto commits', () => {
  const commits = [{ hash: 'a' }, { hash: 'b' }];
  const refs = parseRefs(['main', 'a', 'refs/heads/main'].join(SEP));
  attachRefs(commits, refs);
  assert.deepEqual(commits[0].refs, ['main']);
  assert.deepEqual(commits[1].refs, []);
});

test('readRepo works against a real repository', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gg-'));
  try {
    const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 'T');
    writeFileSync(join(dir, 'f'), '1');
    git('add', '.');
    git('commit', '-qm', 'first | commit');
    git('tag', 'v1');
    assert.equal(await isGitRepo(dir), true);
    const { commits, refs } = await readRepo(dir);
    assert.equal(commits.length, 1);
    assert.equal(commits[0].message, 'first | commit');
    assert.ok(commits[0].refs.includes('main'));
    assert.ok(refs.some(r => r.name === 'v1'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('isGitRepo is false for a plain directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gg-'));
  try {
    assert.equal(await isGitRepo(dir), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
