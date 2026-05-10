/**
 * Assigns 3D positions to commits for rendering.
 *
 * Layout strategy:
 *   - Z axis: time (newest = z:0, oldest = most negative z)
 *   - X axis: branch lanes, alternating left/right from centre for equilateral feel
 *
 * Lane assignment:
 *   1. Start from branch tip commits (those with refs, or merge targets)
 *   2. Walk each branch backwards through parents, assigning a lane
 *   3. When a commit already has a lane (shared history), stop walking that path
 *   4. Commits with no lane after the walk get lane 0
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

  const sorted = [...commits].sort((a, b) => b.timestamp - a.timestamp);

  const zIndexMap = {};
  sorted.forEach((c, i) => { zIndexMap[c.hash] = i; });

  const laneMap = {};
  let nextLane = 0;

  const refPriority = (commit) => {
    if (!commit.refs || commit.refs.length === 0) return 99;
    if (commit.refs.some(r => r === 'HEAD' || r === 'main' || r === 'master')) return 0;
    return 1;
  };

  const tips = sorted
    .filter(c => c.refs && c.refs.length > 0)
    .sort((a, b) => refPriority(a) - refPriority(b));

  // Also catch branches that were merged and deleted
  sorted.forEach(c => {
    const childList = children[c.hash] || [];
    const mergeChildren = childList.filter(ch => byHash[ch]?.parents.length > 1);
    if (mergeChildren.length > 0 && !tips.find(t => t.hash === c.hash)) {
      tips.push(c);
    }
  });

  function traceBranch(startHash, lane) {
    const queue = [startHash];
    while (queue.length > 0) {
      const hash = queue.shift();
      if (laneMap[hash] !== undefined) continue;
      laneMap[hash] = lane;
      const commit = byHash[hash];
      if (!commit) continue;
      if (commit.parents.length > 0) {
        queue.push(commit.parents[0]);
      }
    }
  }

  tips.forEach(tip => {
    if (laneMap[tip.hash] === undefined) {
      traceBranch(tip.hash, nextLane++);
    }
  });

  sorted.forEach(c => {
    if (laneMap[c.hash] === undefined) laneMap[c.hash] = 0;
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