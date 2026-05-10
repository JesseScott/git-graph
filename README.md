# GitGraph 3D

A local 3D visualizer for Git repositories. Walk through commit history in 3D, explore branches spatially, and inspect commits as you go. Built with React Three Fiber + Express.

[!gif](docs/git-graph%20walk%20through.gif)

## Setup

```bash
# 1. Install all dependencies
npm run install:all

# 2. Start both servers
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Usage

1. Paste the absolute path to any local git repo (e.g. `/Users/you/projects/my-app`)
   - Windows "Copy as Path" format (`"C:\Users\you\project"`) is supported
2. Click **Import** — the server runs `git log` and exports a JSON snapshot
3. The 3D graph loads automatically
4. Previously imported repos appear below the input for quick re-loading
   - **↺** re-imports from the original path (syncs latest commits)
   - **✕** removes the entry

## Controls

### Walk mode (default)
| Action | Keys |
|---|---|
| Move forward (towards older/newer commits) | `↑` or `W` |
| Move back | `↓` or `S` |
| Switch branch lane | `←` `→` or `A` `D` |
| Toggle free orbit | `O` |

Keys automatically flip direction based on whether you're walking from **oldest → newest** or **newest → oldest** (toggle in the top bar).

### Orbit mode (`O` to toggle)
| Action | How |
|---|---|
| Rotate | Click + drag |
| Zoom | Scroll wheel |
| Pan | Right-click + drag |

### General
| Action | How |
|---|---|
| Inspect a commit | Click a node (shows detail panel bottom-left) |
| Jump to oldest commit | `⟪ oldest` button in top bar |
| Jump to newest commit | `⟫ newest` button in top bar |
| Deselect | Click empty space |

## Project structure

```
gitgraph/
├── frontend/          # Vite + React + React Three Fiber
│   └── src/
│       ├── components/
│       │   ├── ImportScreen.jsx   # Repo picker + previously imported list
│       │   ├── GraphView.jsx      # 3D scene, HUD, commit panel
│       │   └── CameraRig.jsx      # Smooth camera animation + swoop transition
│       ├── hooks/
│       │   └── useKeyboardNav.js  # WASD/arrow key navigation
│       └── utils/
│           └── layout.js          # Branch lane assignment + 3D positioning
└── server/            # Express — runs git, writes JSON exports
    ├── index.js
    └── exports/       # JSON snapshots, one per repo (auto-created)
```

## How it works

```
Browser (React app :5173)
        │  POST /export { path }
        ▼
Express server (:3001)
        │  execSync('git log --all ...')  ← delimiter-based parsing, no shell quoting issues
        │  deletes old snapshot for repo
        │  writes exports/gitgraph_<repo>_<timestamp>.json
        │
        ◄── { filename, commitCount }
        │
        │  GET /exports/<filename>
        ▼
3D graph renders in browser
        │
        ├── layout.js traces branch tips → assigns X lanes (alternating left/right)
        ├── Z axis = time (configurable direction)
        └── CameraRig lerps camera to current commit, swoops on direction flip
```