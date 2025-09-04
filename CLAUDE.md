# AGENTS guide

This repo is a small Three.js + TypeScript project bundled with esbuild. The entry point is `src/index.ts`; the bundle is emitted to `public/app.js` and loaded by `public/index.html`.

## Prerequisites

- Node.js 22 (recommended; see `.nvmrc`)
- Yarn (Classic, 1.x)

Check your versions:

- `node -v` (use `nvm use` to switch to Node 22)
- `yarn -v`

## Install dependencies

- Install once at the root:
  - `yarn`

# AGENTS quick start

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- Yarn 1.x

## Install

- `nvm use` (if using nvm)
- `yarn`

## Dev (watch + serve + open)

- `yarn dev`
  - Watches and rebuilds with esbuild
  - Serves `public/` at http://localhost:5173 and opens the browser

## Build

- `yarn build`

## Format

- `yarn format` (write)
- `yarn format:check` (check only)

- Before sending changes:
  - Ensure it compiles: `yarn build`
  - Optional type check: `yarn tsc --noEmit`
- Keep bundle size reasonable; prefer small, focused dependencies.
- Static assets belong in `public/`.

## Troubleshooting

- Blank page or missing script:
  - Rebuild with `yarn build` and refresh.
- OrbitControls import errors:
  - The project uses `three/examples/jsm/Addons.js` (ESM). Ensure `three` is installed and TypeScript path resolution is set (already in `tsconfig.json`).
- Textures won’t load via file://:
  - Serve `public/` with a local HTTP server (see “Run locally”).

---

If you want a dev server via Yarn, you can add one to `package.json` and serve `public/`. This project keeps it minimal by default; the build + static-serve flow above is sufficient.
