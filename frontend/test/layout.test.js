import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutCommits, topoSort, buildEdges } from '../src/utils/layout.js';

const c = (hash, timestamp, parents = [], refs = []) => ({ hash, timestamp, parents, refs });

test('topoSort puts children before parents despite clock skew', () => {
  // child "b" has an OLDER timestamp than its parent "a"
  const sorted = topoSort([c('a', 100), c('b', 50, ['a'])]);
  assert.deepEqual(sorted.map(x => x.hash), ['b', 'a']);
});

test('topoSort is newest-first for independent commits', () => {
  const sorted = topoSort([c('x', 1), c('y', 3), c('z', 2)]);
  assert.deepEqual(sorted.map(x => x.hash), ['y', 'z', 'x']);
});

test('linear history lives in lane 0 with strictly decreasing z', () => {
  const out = layoutCommits([c('3', 3, ['2'], ['main']), c('2', 2, ['1']), c('1', 1)]);
  assert.ok(out.every(x => x.lane === 0));
  assert.deepEqual(out.map(x => x.zIndex), [0, 1, 2]);
  assert.ok(out[0].position[2] > out[1].position[2]);
});

test('concurrent branches get different lanes; main gets lane 0', () => {
  const out = layoutCommits([
    c('m2', 5, ['m1'], ['main']),
    c('f2', 4, ['f1'], ['feature']),
    c('f1', 3, ['m1']),
    c('m1', 2),
  ]);
  const lane = Object.fromEntries(out.map(x => [x.hash, x.lane]));
  assert.equal(lane.m2, 0);
  assert.notEqual(lane.f2, lane.m2);
  assert.equal(lane.f1, lane.f2);
});

test('lanes are reused once a branch has ended', () => {
  // two short-lived, non-overlapping side branches off main
  const out = layoutCommits([
    c('m4', 9, ['m3'], ['main']),
    c('s2', 8, ['m3'], ['side2']),
    c('m3', 7, ['m2']),
    c('s1', 6, ['m2'], ['side1']),
    c('m2', 5, ['m1']),
    c('m1', 1),
  ]);
  const lane = Object.fromEntries(out.map(x => [x.hash, x.lane]));
  assert.equal(lane.s1, lane.s2);
  assert.equal(Math.max(...out.map(x => x.lane)), 1);
});

test('merged-and-deleted branches still get their own lane', () => {
  const out = layoutCommits([
    c('merge', 5, ['m1', 'f1'], ['main']),
    c('f1', 4, ['m0']),
    c('m1', 3, ['m0']),
    c('m0', 1),
  ]);
  const lane = Object.fromEntries(out.map(x => [x.hash, x.lane]));
  assert.notEqual(lane.f1, lane.m1);
});

test('empty input and dangling parents are handled', () => {
  assert.deepEqual(layoutCommits([]), []);
  assert.equal(layoutCommits([c('a', 1, ['missing'], ['main'])]).length, 1);
});

test('buildEdges marks merge edges and skips missing parents', () => {
  const edges = buildEdges(layoutCommits([
    c('m', 3, ['a', 'gone'], ['main']),
    c('a', 1),
  ]));
  assert.equal(edges.length, 1);
  assert.equal(edges[0].isMerge, true);
});
