import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let repoDir;

function git(...args) {
  execFileSync('git', args, {
    cwd: repoDir,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Smoke',
      GIT_AUTHOR_EMAIL: 'smoke@example.com',
      GIT_COMMITTER_NAME: 'Smoke',
      GIT_COMMITTER_EMAIL: 'smoke@example.com',
    },
  });
}

function commit(file, message) {
  writeFileSync(join(repoDir, file), message);
  git('add', '.');
  git('commit', '-m', message);
}

test.beforeAll(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'gitgraph-smoke-'));
  git('init', '-b', 'main');
  commit('a.txt', 'first commit');
  commit('b.txt', 'second commit');
  git('checkout', '-b', 'feature');
  commit('c.txt', 'feature commit');
  git('checkout', 'main');
  commit('d.txt', 'main commit');
  git('merge', '--no-ff', '-m', 'merge feature', 'feature');
});

test.afterAll(() => {
  if (repoDir) rmSync(repoDir, { recursive: true, force: true });
});

test('import a repo and render the 3D graph without errors', async ({ page, request }) => {
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

  // The Vite proxy forwards to the API, so a 200 here proves both dev processes are up.
  const exportsRes = await request.get('/exports');
  expect(exportsRes.ok()).toBeTruthy();

  await page.goto('/');
  await expect(page.getByText('3D repository visualizer')).toBeVisible();

  await page.getByPlaceholder('/path/to/your/repo').fill(repoDir);
  await page.getByRole('button', { name: 'Import' }).click();

  await expect(page.getByText('5 commits')).toBeVisible();
  await expect(page.getByRole('button', { name: '← back' })).toBeVisible();

  // The three.js canvas must exist, have a size, and hold a live WebGL context.
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(100);
  expect(box.height).toBeGreaterThan(100);
  const hasGl = await canvas.evaluate(
    (el) => !!(el.getContext('webgl2') || el.getContext('webgl')),
  );
  expect(hasGl).toBe(true);

  // Let a few frames render, then go back to confirm the view unmounts cleanly.
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '← back' }).click();
  await expect(page.getByText('3D repository visualizer')).toBeVisible();

  expect(problems).toEqual([]);
});
