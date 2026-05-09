/**
 * Assigns 3D positions to commits for rendering.
 * Layout: time flows along Z axis (oldest = most negative Z).
 * Branches spread out on the X axis.
 */
export function layoutCommits(commits) {
  if (!commits || commits.length === 0) return [];

  // Sort by timestamp descending (newest first = front of scene)
  const sorted = [...commits].sort((a, b) => b.timestamp - a.timestamp);

  // Assign a "lane" (X position) per branch/ref
  const laneMap = {};
  let nextLane = 0;

  function getLane(commit) {
    // Use first ref if available, else hash prefix as key
    const key = commit.refs && commit.refs.length > 0 ? commit.refs[0] : commit.hash;
    if (laneMap[key] === undefined) {
      laneMap[key] = nextLane++;
    }
    return laneMap[key];
  }

  // Centre the lanes around 0
  const positioned = sorted.map((commit, i) => {
    const lane = getLane(commit);
    return { ...commit, lane, zIndex: i };
  });

  const maxLane = Math.max(...positioned.map(c => c.lane), 0);
  const laneOffset = maxLane / 2;

  const LANE_SPACING = 3;
  const Z_SPACING = 2.5;

  return positioned.map(commit => ({
    ...commit,
    position: [
      (commit.lane - laneOffset) * LANE_SPACING,
      0,
      -commit.zIndex * Z_SPACING,
    ],
  }));
}

/**
 * Build edges: for each commit, draw a line to each parent.
 */
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

/** Deterministic colour from a branch/ref name */
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
