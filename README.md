# InkNest

InkNest is a local-first desktop Markdown note-taking app. The MVP focuses on one active workspace, plain `.md` files, visual Markdown editing, reliable auto-save, search, themes, and export without accounts, analytics, cloud sync, or required internet access.

## Current Status

This repository has the phase 1 app shell from `PLAN.md`: Electron, Vite, React, TypeScript, and Tailwind are scaffolded with a minimal InkNest workspace screen. Filesystem features and workspace selection begin in later phases.

## First Command

Install dependencies, then run the lightweight scaffold check:

```sh
npm install
npm run check
```

Start the desktop app during development:

```sh
npm run dev
```

On Linux, the development command runs Electron with `--no-sandbox` through
electron-vite's `--noSandbox` option. This avoids local SUID sandbox helper
permission failures in development environments where Electron's
`chrome-sandbox` binary is not owned and configured by root.

Build the Electron/Vite output:

```sh
npm run build
```

## Source Layout

- `src/main/` - Electron main-process code and native services.
- `src/preload/` - safe preload bridge exposed to the renderer.
- `src/renderer/` - React renderer application and visual Markdown editor UI.
- `src/shared/` - shared types, constants, and validation schemas.
- `tests/` - automated tests.
- `scripts/` - repository maintenance scripts.

Filesystem access should stay in main-process services and be exposed only through validated preload IPC. The renderer should not directly read or write workspace files.

## MVP Notes

- One active workspace at a time.
- Tags are stored in YAML frontmatter.
- Deleted notes move to app-level trash inside workspace metadata.
- Raw HTML should be sanitized or disabled before rendering Markdown.
- Search starts with an in-memory index.
