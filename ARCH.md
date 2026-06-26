# ARCH.md - InkNest Architecture

This document describes the architecture established by Phase 0 and Phase 1 of
`PLAN.md`. It focuses on the repository baseline and the first running app
shell, before workspace selection, note storage, and filesystem features are
implemented.

## Phase 0 Architecture: Repository Baseline

Phase 0 creates the project foundation. Its main job is to make the repository
easy to understand, run, check, and extend before feature code grows.

### Responsibilities

- Keep the product direction anchored in `SPEC.md` and `PLAN.md`.
- Provide clear scripts for development, checking, testing, building, and
  packaging.
- Establish a predictable source layout for Electron main-process code, preload
  code, renderer code, shared types, tests, and scripts.
- Keep generated output, dependency folders, build artifacts, and local
  workspace data out of version control.
- Give new contributors a clear first command and a clear map of where code
  belongs.

### Repository-Level Structure

```text
InkNest/
  PLAN.md
  SPEC.md
  README.md
  ARCH.md
  package.json
  electron.vite.config.ts
  tailwind.config.ts
  tsconfig.json
  tsconfig.node.json
  tsconfig.web.json
  scripts/
  tests/
  src/
    main/
    preload/
    renderer/
    shared/
```

### Directory Roles

- `src/main/` contains Electron main-process code. This is where native desktop
  behavior and future filesystem services belong.
- `src/preload/` contains the preload bridge exposed to renderer code.
- `src/renderer/` contains the React app, styles, and browser-like UI code.
- `src/shared/` contains shared TypeScript types and future shared validation
  contracts.
- `tests/` contains automated checks for the scaffold and future app behavior.
- `scripts/` contains repository maintenance and validation scripts.

### Baseline Commands

The repository baseline is expected to support these commands:

```sh
npm run dev
npm run check
npm test
npm run build
npm run package
```

In the current scaffold, `npm run check` is the lightweight validation command.
It runs scaffold checks, tests, and TypeScript validation.

### Phase 0 Boundary

Phase 0 does not implement note-taking features. It defines the place where
those features will live and the rules that keep the project maintainable as it
grows.

## Phase 1 Architecture: App Shell Scaffold

Phase 1 creates the first running desktop app. The goal is to open an Electron
window, load a Vite-powered React renderer, and display a minimal InkNest
workspace screen.

### Runtime Layers

```text
Electron main process
  creates BrowserWindow
  configures desktop window behavior
  loads Vite dev URL or built renderer HTML
  attaches preload script

Preload bridge
  exposes a narrow window.inknest API
  keeps renderer code away from direct Electron and Node.js access

React renderer
  renders the InkNest app shell
  owns visible UI state for the scaffold
  calls window.inknest for allowed app information

Shared types
  define the typed preload API contract used by preload and renderer code
```

### Main Process

The Phase 1 main process lives in `src/main/index.ts`.

Its current responsibilities are:

- Create the main `BrowserWindow`.
- Keep the native window title as `InkNest`.
- Set the initial window size and minimum window size.
- Hide the native application menu for a focused app shell.
- Load the Vite development URL during development.
- Load the built renderer HTML in production builds.
- Attach the preload script from `src/preload/index.ts`.
- Apply Linux development startup hardening for local Electron rendering issues.

The main process is also the future home for native services such as workspace
selection, note file access, dialogs, export, and external link handling.

### Preload Bridge

The Phase 1 preload bridge lives in `src/preload/index.ts`.

It exposes a small `window.inknest` object through Electron's context bridge.
The current API is intentionally harmless:

```ts
window.inknest.getAppInfo();
```

This proves that renderer code can call a preload method without giving the
renderer unrestricted access to Electron or Node.js APIs.

### Shared Preload Contract

The preload API type contract lives in `src/shared/preload.ts`.

It defines:

- `AppInfo`
- `InkNestApi`

Keeping this contract in `src/shared/` lets preload and renderer code agree on
the same API shape. Later phases can extend this pattern for workspace, notes,
settings, dialogs, links, and export APIs.

### Renderer App

The Phase 1 renderer is a React and TypeScript app under `src/renderer/`.

Important files include:

- `src/renderer/index.html` as the renderer HTML entry.
- `src/renderer/src/main.tsx` as the React bootstrap.
- `src/renderer/src/App.tsx` as the current InkNest app shell.
- `src/renderer/src/styles.css` as the Tailwind and app style entry.
- `src/renderer/src/types/window.d.ts` as the renderer-side `window.inknest`
  type declaration.

The current UI renders the first workspace-oriented app screen, not a marketing
landing page. It includes the major future layout areas:

- top bar
- workspace control
- search location
- folder area
- note list area
- editor area
- status bar

These areas are mostly static in Phase 1. Later phases will attach real
workspace, note, editor, search, and save behavior.

### Styling Layer

The Phase 1 renderer uses Tailwind CSS through the Vite renderer setup. Styling
should stay focused on the app experience: quiet, work-oriented, responsive, and
ready for dense note-taking workflows.

### Phase 1 Data Flow

```text
App starts
  -> Electron main process creates BrowserWindow
  -> BrowserWindow loads preload script
  -> BrowserWindow loads React renderer
  -> React renderer reads window.inknest.getAppInfo()
  -> UI displays the phase shell and empty workspace state
```

There is no workspace file flow yet. Phase 1 only proves that the desktop shell,
renderer, styling, and preload contract are connected.

### Phase 1 Done State

Phase 1 is complete when:

- The Electron app opens a renderer window.
- The renderer displays the InkNest app shell.
- The native title remains `InkNest`.
- The first screen is the workspace app experience.
- `npm run check` or the equivalent lightweight check passes.

## Architecture Direction After Phase 1

Phase 2 will harden the Electron boundary before filesystem features begin.
That means future work should preserve the current split:

- Renderer code requests actions.
- Preload exposes a narrow typed API.
- Main-process services own native and filesystem behavior.
- Shared types keep IPC contracts explicit.

This keeps InkNest aligned with the local-first goal while avoiding direct
filesystem access from the renderer.
