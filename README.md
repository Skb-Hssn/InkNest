# InkNest

InkNest is a local-first desktop Markdown note-taking app. The MVP focuses on one active workspace, plain `.md` files, visual Markdown editing, reliable auto-save, search, themes, and export without accounts, analytics, cloud sync, or required internet access.

## Current Status

This repository is at the phase 0 baseline from `PLAN.md`. App code has not been scaffolded yet; the Electron, Vite, React, TypeScript, and Tailwind setup begins in phase 1.

## First Command

Run the baseline check:

```sh
npm run check
```

The `dev`, `build`, and `package` scripts are present as phase-0 placeholders so contributors can see the intended workflow. They should be replaced with real Electron/Vite commands during phase 1.

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
