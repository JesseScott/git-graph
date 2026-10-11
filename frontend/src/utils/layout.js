/**
 * Assigns 3D positions to commits for rendering.
 *
 * Layout strategy:
 *   - Z axis: time (newest = z:0, oldest = most negative z)
 *   - X axis: branch lanes, alternating left/right from centre for equilateral feel
 *
 * Lane assignment:
 *   1. Start from branch tip commits (those with refs, or merge targets)
 *   2. Walk each branch backwards through first parents, forming a chain
 *   3. When a commit already belongs to a chain (shared history), stop walking
 *   4. Pack chains into lanes, reusing a lane once its previous chain has ended
 *   5. Commits on no chain (unreachable from any tip) get lane 0
 *
 * X positions alternate: 0, -1, +1, -2, +2, -3, +3 ...
 * so branches fan out symmetrically rather than all stacking to one side.
 */

const LANE_SPACING = 1.4; // tighter than before
const Z_SPACING = 2.5;

/** Convert a lane index to an alternating X offset.
 *  lane 0 → 0, 1 → -1, 2 → +1, 3 → -2, 4 → +2, ...
 */
function laneToX(lane) {
  if (lane === 0) return 0;
  const side = lane % 2 === 0 ? 1 : -1;   // even = right, odd = left
  const dist = Math.ceil(lane / 2);
  return side * dist;
}

/**
 * Order commits newest → oldest, guaranteeing every commit appears before its
 * parents even when committer clocks are skewed (Kahn's algorithm, picking the
 * newest available commit first).
 */
export function topoSort(commits) {
  const byHash = new Map(commits.map(c => [c.hash, c]));
  const pending = new Map(); // hash -> number of unplaced children
  commits.forEach(c => pending.set(c.hash, 0));
  commits.forEach(c => {
    c.parents.forEach(p => {
      if (pending.has(p)) pending.set(p, pending.get(p) + 1);
    });
  });

  // Binary max-heap on timestamp (ties broken by input order for stability).
  const order = new Map(commits.map((c, i) => [c.hash, i]));
  const heap = [];
  const before = (a, b) =>
    a.timestamp !== b.timestamp ? a.timestamp > b.timestamp : order.get(a.hash) < order.get(b.hash);
  const push = (c) => {
    heap.push(c);
    let i = heap.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (!before(heap[i], heap[up])) break;
      [heap[i], heap[up]] = [heap[up], heap[i]];
      i = up;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && before(heap[l], heap[m])) m = l;
        if (r < heap.length && before(heap[r], heap[m])) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };

  commits.forEach(c => { if (pending.get(c.hash) === 0) push(c); });

  const sorted = [];
  while (heap.length > 0) {
    const c = pop();
    sorted.push(c);
    c.parents.forEach(p => {
      if (!byHash.has(p)) return;
      const n = pending.get(p) - 1;
      pending.set(p, n);
      if (n === 0) push(byHash.get(p));
    });
  }
  return sorted;
}

export function layoutCommits(commits) {
  if (!commits || commits.length === 0) return [];

  const byHash = {};
  commits.forEach(c => { byHash[c.hash] = c; });

  const children = {};
  commits.forEach(c => {
    c.parents.forEach(p => {
      if (!children[p]) children[p] = [];
      children[p].push(c.hash);
    });
  });

  const sorted = topoSort(commits);

  const zIndexMap = {};
  sorted.forEach((c, i) => { zIndexMap[c.hash] = i; });

  const refPriority = (commit) => {
    if (!commit.refs || commit.refs.length === 0) return 99;
    if (commit.refs.some(r => r === 'HEAD' || r === 'main' || r === 'master')) return 0;
    return 1;
  };

  // Branch tips: anything with a ref, plus parents of merges (merged-and-deleted branches).
  const tipSet = new Set();
  const tips = sorted
    .filter(c => c.refs && c.refs.length > 0)
    .sort((a, b) => refPriority(a) - refPriority(b)); // stable: keeps newest-first within a priority
  tips.forEach(t => tipSet.add(t.hash));
  sorted.forEach(c => {
    const hasMergeChild = (children[c.hash] || []).some(ch => byHash[ch]?.parents.length > 1);
    if (hasMergeChild && !tipSet.has(c.hash)) {
      tipSet.add(c.hash);
      tips.push(c);
    }
  });

  // Walk each tip down its first-parent chain until reaching an already-claimed commit.
  const claimed = new Set();
  const chains = [];
  tips.forEach(tip => {
    if (claimed.has(tip.hash)) return;
    const chain = [];
    let hash = tip.hash;
    while (hash && byHash[hash] && !claimed.has(hash)) {
      claimed.add(hash);
      chain.push(hash);
      hash = byHash[hash].parents[0];
    }
    chains.push(chain);
  });

  // Pack chains into lanes: a lane is reused once the branch occupying it has ended,
  // so lane count tracks concurrent branches rather than total branches.
  const laneMap = {};
  const laneEnds = []; // laneEnds[lane] = zIndex of the oldest commit currently in that lane
  chains.forEach(chain => {
    const first = zIndexMap[chain[0]];
    const last = zIndexMap[chain[chain.length - 1]];
    let lane = laneEnds.findIndex(end => end < first);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = last;
    chain.forEach(h => { laneMap[h] = lane; });
  });

  return sorted.map(commit => {
    const lane = laneMap[commit.hash] ?? 0;
    const x = laneToX(lane) * LANE_SPACING;
    const z = -zIndexMap[commit.hash] * Z_SPACING;
    return {
      ...commit,
      lane,
      zIndex: zIndexMap[commit.hash],
      position: [x, 0, z],
    };
  });
}

export function buildEdges(positionedCommits) {
  const byHash = {};
  positionedCommits.forEach(c => { byHash[c.hash] = c; });

  const edges = [];
  positionedCommits.forEach(commit => {
    commit.parents.forEach(parentHash => {
      const parent = byHash[parentHash];
      if (parent) {
        edges.push({
          id: `${commit.hash}-${parentHash}`,
          from: commit.position,
          to: parent.position,
          isMerge: commit.parents.length > 1,
        });
      }
    });
  });

  return edges;
}

export function branchColor(refName) {
  if (!refName) return '#4a9eff';
  const palette = [
    '#00ff8c', '#4a9eff', '#ff6b9d', '#ffd93d',
    '#c77dff', '#ff8c42', '#06d6a0', '#ef476f',
  ];
  let hash = 0;
  for (let i = 0; i < refName.length; i++) {
    hash = refName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}