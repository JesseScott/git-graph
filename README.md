# GitGraph 3D

A local 3D visualizer for Git repositories. Built with React Three Fiber + Express.

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
2. Click **Import** — the server runs `git log` and exports a timestamped JSON file
3. The 3D graph loads automatically
4. Previously imported repos appear below the input for quick re-loading

## Controls

| Action | How |
|---|---|
| Orbit | Click + drag |
| Zoom | Scroll wheel |
| Pan | Right-click + drag |
| Select commit | Click a node |
| Deselect | Click empty space or ×  |

## Project structure

```
gitgraph/
├── frontend/          # Vite + React + React Three Fiber
│   └── src/
│       ├── components/
│       │   ├── ImportScreen.jsx
│       │   └── GraphView.jsx
│       └── utils/
│           └── layout.js
└── server/            # Express — runs git, writes JSON exports
    ├── index.js
    └── exports/       # Timestamped JSON files (auto-created)
```

## How it works

```
Browser (React app :5173)
        │  POST /export { path }
        ▼
Express server (:3001)
        │  execSync('git log --all ...')
        │  writes  exports/gitgraph_<repo>_<timestamp>.json
        │
        ◄── { filename, commitCount }
        │
        │  GET /exports/<filename>
        ▼
3D graph renders in browser
```
