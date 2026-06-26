# ARCH.md - InkNest Architecture

This document describes the architecture established by Phase 0, Phase 1,
Phase 2, Phase 3, Phase 4, and Phase 5 of `PLAN.md`. It covers the repository baseline,
the first running app shell, the secure Electron boundary, the static
application layout, the workspace selection flow, and the workspace file model
that future note, search, and editor behavior will build on.

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
      ipc/
    preload/
    renderer/
    shared/
```

### Directory Roles

- `src/main/` contains Electron main-process code. This is where native desktop
  behavior and future filesystem services belong.
- `src/main/ipc/` contains grouped IPC handlers, IPC error handling, and request
  validation owned by the main process.
- `src/preload/` contains the preload bridge exposed to renderer code.
- `src/renderer/` contains the React app, styles, and browser-like UI code.
- `src/shared/` contains shared TypeScript types, IPC channel names, and preload
  API contracts.
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
  exposes a narrow typed window.inknest API
  keeps renderer code away from direct Electron and Node.js access

React renderer
  renders the InkNest app shell
  owns visible UI state for the scaffold
  calls window.inknest for allowed app information through IPC

Shared types
  define IPC channel names and the typed preload API contract
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

The preload bridge lives in `src/preload/index.ts`.

It exposes a small `window.inknest` object through Electron's context bridge.
Phase 2 replaced the original synchronous scaffold method with an async IPC
bridge. Renderer code now calls grouped APIs such as:

```ts
window.inknest.app.getInfo();
window.inknest.workspace.getActive();
window.inknest.settings.get();
```

Each method returns a typed result envelope rather than throwing raw main-process
errors into the renderer.

### Shared Preload Contract

The preload API type contract lives in `src/shared/preload.ts`. Shared IPC
types and channel names live in `src/shared/ipc.ts`.

Together they define:

- `AppInfo`
- `IpcResult<T>`
- `WorkspaceInfo`
- `NoteSummary`
- `AppSettings`
- `ipcChannels`
- `InkNestApi`

Keeping these contracts in `src/shared/` lets main, preload, and renderer code
agree on the same channel names and API shape. Later phases should extend this
pattern rather than letting renderer code call arbitrary IPC channels directly.

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
  -> React renderer reads window.inknest.app.getInfo()
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

## Phase 2 Architecture: Secure Electron Boundary

Phase 2 hardens the Electron boundary before filesystem features begin. The
renderer must request actions through `window.inknest`; it must not import
Electron, Node.js modules, or direct filesystem APIs.

### Browser Window Security

The main window is created in `src/main/index.ts` with the security settings
that define the app boundary:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- preload script attached from `src/preload/index.ts`

The native menu remains hidden and the window title remains `InkNest`.

### IPC Handler Layout

Grouped IPC handlers live under `src/main/ipc/`.

```text
src/main/ipc/
  app.ts          app metadata
  workspace.ts    active workspace placeholder state
  notes.ts        note list/read placeholders
  settings.ts     app settings placeholder state
  links.ts        safe external link opening
  dialogs.ts      native dialog placeholders
  export.ts       export placeholder boundary
  validation.ts   shared main-process payload validators
  errors.ts       safe IPC request errors
  register.ts     result-envelope wrapper around ipcMain.handle
  index.ts        registers all handler groups
```

`src/main/ipc/index.ts` registers all handler groups during app startup. Current
handlers are intentionally small because workspace and note storage arrive in
later phases, but the boundary is already in place.

### IPC Result Shape

IPC handlers return a safe result envelope:

```ts
type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

Known request errors return useful messages such as `INVALID_PAYLOAD` or
`WORKSPACE_REQUIRED`. Unexpected errors are logged in the main process and
returned to the renderer as a generic `INTERNAL_ERROR` message.

### Current Preload API

The current `window.inknest` surface is grouped by feature area:

```ts
window.inknest = {
  app: {
    getInfo()
  },
  workspace: {
    getActive(),
    choose(),
    select(path)
  },
  notes: {
    list(),
    read(path)
  },
  settings: {
    get(),
    save(payload)
  },
  links: {
    openExternal(payload)
  },
  dialogs: {
    selectImage()
  },
  export: {
    note(path)
  }
};
```

The preload script invokes only approved channel names from `src/shared/ipc.ts`.
It does not expose `ipcRenderer`, `shell`, Node.js filesystem modules, or broad
process access to renderer code.

### Validation Rules

Main-process handlers validate payloads before doing work. Phase 2 currently
includes validators for:

- plain object payloads
- non-empty string fields
- settings theme values
- safe `http:` and `https:` external URLs
- workspace-bound paths

Path validation resolves requested paths against the active workspace and
rejects paths outside that workspace. Later filesystem services should reuse or
extend this rule before reading or writing files.

External links are opened only from the main process through Electron's
`shell.openExternal`, and only after URL validation rejects unsupported schemes
such as `file:`.

### Phase 2 Data Flow

```text
Renderer asks for app info
  -> window.inknest.app.getInfo()
  -> preload invokes ipcChannels.app.getInfo
  -> main-process app handler returns AppInfo
  -> registerIpcHandler wraps it as { ok: true, data }
  -> renderer displays phase-2-secure-boundary
```

Invalid requests follow the same path, but validators throw safe request errors
that are returned as `{ ok: false, error }`.

### Tests

Current automated coverage includes:

- `tests/phase1.test.mjs` for the Electron/Vite/React scaffold and secure window
  settings.
- `tests/phase2.test.mjs` for grouped IPC registration, exact channel names,
  preload restrictions, validation rules, result envelopes, and main-process
  ownership of native behavior.
- `tests/e2e/phase1.spec.ts` for the rendered app shell and runtime preload API,
  including invalid payload rejection and no renderer Node.js access.

Use `npm run check` as the lightweight validation command. It runs scaffold
checks, Node tests, and TypeScript validation. `npm run test:e2e` builds the app
and runs Playwright/Electron tests; depending on the host sandbox, Electron may
need to run outside restricted filesystem or process sandboxing.

## Phase 3 Architecture: Static Application Layout

Phase 3 turns the early renderer shell into the permanent note-taking layout.
It is still static: workspace selection, file scanning, note CRUD, search, and
editor persistence are intentionally deferred to later phases.

### Renderer Layout

The Phase 3 renderer lives in `src/renderer/src/App.tsx` and is organized as a
desktop note app surface:

```text
top bar
  app identity
  workspace name
  new note, new folder, settings controls

left sidebar
  workspace switcher
  search input
  new note and new folder controls
  folder tree area
  no-workspace empty state
  no-search-results empty state

note list column
  selected-folder label
  sort and new-note controls
  no-folder empty state
  note list placeholder rows

editor area
  note title and file path placeholder
  save status placeholder
  visual editor toolbar placeholder
  no-note empty state

status bar
  workspace path placeholder
  current phase marker
  save, word count, and character count placeholders
```

### Styling

Reusable static-shell controls are defined in `src/renderer/src/styles.css`:

- `.secondary-button`
- `.tree-row`
- `.note-row`
- `.toolbar-button`
- `.status-pill`

The layout remains quiet and work-focused, with stable column sizes and visible
controls for common actions. Later phases should preserve this structure while
replacing placeholder rows and empty states with real workspace and note data.

### Phase 3 Data Flow

```text
App starts
  -> React renderer initializes static placeholders
  -> renderer asks window.inknest.app.getInfo()
  -> preload invokes ipcChannels.app.getInfo
  -> main-process handler returns phase-3-static-layout
  -> status bar displays the current phase marker
```

Phase 3 does not add new IPC channels. It continues to respect the Phase 2 rule
that renderer code must not import Electron, Node.js modules, or filesystem
APIs directly.

### Tests

`tests/phase3.test.mjs` verifies that the renderer contains the permanent
layout regions, required empty states, status placeholders, and no direct
renderer access to Electron or Node.js filesystem modules.

## Phase 4 Architecture: Workspace Selection And Startup Restore

Phase 4 makes the workspace switcher real while keeping one active workspace at
a time. The renderer still has no direct filesystem access; it asks the preload
bridge for workspace actions and the main process owns native dialogs,
persistence, and path checks. The app info milestone is
`phase-4-workspace-selection`.

### Workspace Contract

Workspace state is represented by `WorkspaceInfo` in `src/shared/ipc.ts`:

```ts
type WorkspaceInfo = {
  path: string | null;
  name: string | null;
  status: "none" | "ready" | "missing" | "permission-denied";
  message: string;
  recentWorkspaces: string[];
  lastWorkspacePath: string | null;
};
```

The status lets the renderer distinguish a clean first run from a missing saved
folder or a folder that still exists but cannot be accessed. The message is
safe to show directly in the UI.

### IPC Channels

Phase 4 uses these workspace channels:

- `workspace:get-active` returns the active or restored workspace state.
- `workspace:choose` opens the native folder picker.
- `workspace:select` activates a specific path, mainly for recent workspaces
  and tests.

The preload surface mirrors those channels as:

```ts
window.inknest.workspace.getActive();
window.inknest.workspace.choose();
window.inknest.workspace.select(path);
```

### Main-Process Services

Workspace persistence lives in `src/main/services/settings-store.ts`. It stores
`settings.json` under Electron's `app.getPath("userData")`, not in the selected
workspace. Settings currently include:

- `theme`
- `lastWorkspacePath`
- `recentWorkspaces`

Workspace inspection lives in `src/main/services/workspace-service.ts`. It
checks that a selected path exists, is a directory, and is readable and writable
before it becomes the active workspace. Failed startup restores keep
`activeWorkspace.path` as `null` and return either `missing` or
`permission-denied` for the renderer prompt.

### Startup Flow

```text
App starts
  -> Electron app is ready
  -> registerIpcHandlers() creates one active workspace state
  -> restoreLastWorkspace() reads settings.json
  -> saved workspace is inspected
  -> activeWorkspace.path is set only when the folder is accessible
  -> BrowserWindow opens
  -> renderer asks window.inknest.workspace.getActive()
  -> UI shows the active workspace, a missing-permission prompt, or first-run state
```

### Selection Flow

```text
User clicks Choose workspace
  -> renderer calls window.inknest.workspace.choose()
  -> main process opens dialog.showOpenDialog({ openDirectory, createDirectory })
  -> selected folder is inspected
  -> settings.json saves lastWorkspacePath and recentWorkspaces
  -> renderer receives WorkspaceInfo and updates the workspace switcher/status bar
```

Recent workspace rows call `workspace.select(path)` and go through the same
inspection and persistence path as the native picker.

### Renderer Behavior

`src/renderer/src/App.tsx` now hydrates the static layout with workspace state.
It shows:

- the current workspace name and path when ready
- a first-run prompt when no workspace has been selected
- a missing-workspace prompt when the previous folder is gone
- a permission prompt when the previous folder cannot be accessed
- recent workspaces when settings contain remembered paths

Folder and note scanning remain deferred to later phases. Phase 4 only chooses,
remembers, restores, and validates the workspace root.

### Tests

`tests/phase4.test.mjs` verifies the shared contract, persisted settings store,
startup restore flow, native folder picker channel, renderer prompts, and this
architecture section. `npm run check` remains the lightweight validation
command.

## Phase 5 Architecture: Workspace File Model

Phase 5 turns the selected workspace folder into a typed file model owned by
the Electron main process. The renderer still does not touch the filesystem
directly; it asks `window.inknest.workspace.scan()`, `window.inknest.notes.list()`,
or `window.inknest.notes.read(path)` through the preload bridge.

The app info milestone is now `phase-5-workspace-file-model`.

### Workspace File Contract

The shared contract in `src/shared/ipc.ts` now includes:

```ts
type WorkspaceFileModel = {
  workspace: WorkspaceInfo;
  folders: FolderSummary[];
  notes: NoteSummary[];
  metadata: WorkspaceMetadata;
};
```

Note and folder paths returned to the renderer are workspace-relative. The main
process resolves those paths against the active workspace before reading or
writing anything. This keeps the UI portable while preserving the Phase 2 path
boundary.

### Filesystem Services

Phase 5 adds focused main-process services:

```text
src/main/services/
  path-utils.ts       safe workspace path resolution and filename cleanup
  folder-service.ts   workspace metadata, assets, trash, and folder scanning
  note-service.ts     Markdown note scanning, reading, and filename generation
```

`path-utils.ts` contains the reusable path boundary logic. It resolves candidate
paths against the active workspace, rejects path traversal, converts absolute
paths back into workspace-relative paths, normalizes separators for IPC data,
and sanitizes filesystem names.

`folder-service.ts` establishes the workspace conventions:

- `.inknest/` stores app-owned workspace metadata.
- `.inknest/trash/` is the app-level trash location for deleted notes.
- `assets/` is the workspace asset convention for images and other local note
  attachments.

Folder scanning walks nested directories while skipping app-owned metadata and
assets so those implementation folders do not appear as user note folders.

`note-service.ts` scans nested `.md` files, reads Markdown as UTF-8, derives
note titles from the first `# Heading` when present, and falls back to the file
name when a heading is missing. It also exposes safe Markdown filename helpers,
including duplicate-name handling such as `Untitled 2.md`.

### IPC Flow

Phase 5 adds one workspace-level scan channel:

- `workspace:scan` returns the active `WorkspaceFileModel`.

The preload surface exposes it as:

```ts
window.inknest.workspace.scan();
```

The existing note channels are now backed by real services:

- `notes:list` scans the active workspace and returns `NoteSummary[]`.
- `notes:read` validates a workspace-relative Markdown path and returns its
  UTF-8 content.

Opening or selecting a workspace also ensures the Phase 5 directory conventions
exist before the renderer receives a ready workspace state.

### Phase 5 Data Flow

```text
Renderer asks for workspace file model
  -> window.inknest.workspace.scan()
  -> preload invokes workspace:scan
  -> main process asserts an active workspace
  -> workspace service ensures .inknest, .inknest/trash, and assets/
  -> folder service scans nested user folders
  -> note service scans nested Markdown notes
  -> renderer receives workspace-relative folders, notes, and metadata
```

### Tests

`tests/phase5.test.mjs` verifies the shared contract, preload scan method, safe
path utility, metadata/assets/trash conventions, Markdown scanning and reading,
duplicate filename helpers, and architecture documentation for this phase.

`npm run check` remains the lightweight validation command.

## Architecture Direction After Phase 5

Future work should preserve the current split:

- Renderer code requests actions through `window.inknest`.
- Preload exposes a narrow typed API and approved channel invocations only.
- Main-process handlers own native behavior, filesystem behavior, dialogs,
  export, and external links.
- Main-process services validate payloads and workspace paths before acting.
- Shared types keep IPC contracts explicit.

This keeps InkNest aligned with the local-first goal while avoiding direct
filesystem access from the renderer.
