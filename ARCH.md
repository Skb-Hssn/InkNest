# ARCH.md - InkNest Architecture

This document describes the architecture established by Phase 0 through Phase 9
of `PLAN.md`. It covers the repository baseline, the first running app shell,
the secure Electron boundary, the static application layout, the workspace
selection flow, the workspace file model, note and folder organization, and the
visual Markdown editor with its visible toolbar commands.

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
  -> renderer displays phase-9-toolbar-editing-commands
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
  -> main-process handler returns phase-9-toolbar-editing-commands
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
persistence, and path checks. The app info milestone is now
`phase-9-toolbar-editing-commands`.

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

The app info milestone is now `phase-9-toolbar-editing-commands`.

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
  folder-service.ts   workspace metadata, asset, trash, and folder scanning
  note-service.ts     Markdown note scanning, reading, and filename generation
```

`path-utils.ts` contains the reusable path boundary logic. It resolves candidate
paths against the active workspace, rejects path traversal, converts absolute
paths back into workspace-relative paths, normalizes separators for IPC data,
and sanitizes filesystem names.

`folder-service.ts` establishes the workspace conventions:

- `.inknest/` stores app-owned workspace metadata.
- `.inknest/trash/` is the app-level trash location for deleted notes.
- `asset/` is the workspace asset convention for images and other local note
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
  -> workspace service ensures .inknest, .inknest/trash, and asset/
  -> folder service scans nested user folders
  -> note service scans nested Markdown notes
  -> renderer receives workspace-relative folders, notes, and metadata
```

### Tests

`tests/phase5.test.mjs` verifies the shared contract, preload scan method, safe
path utility, metadata/asset/trash conventions, Markdown scanning and reading,
duplicate filename helpers, and architecture documentation for this phase.

`npm run check` remains the lightweight validation command.

## Phase 6 Architecture: Note CRUD

Phase 6 makes Markdown notes usable as local files. The renderer still requests
every note action through `window.inknest.notes`; the Electron main process owns
all filesystem changes and returns workspace-relative paths.

### Note CRUD Contract

The shared IPC contract now includes `NoteContent` for opened notes and
`DeletedNoteSummary` for trash entries:

```ts
type NoteContent = {
  path: string;
  markdown: string;
};

type DeletedNoteSummary = {
  id: string;
  title: string;
  originalPath: string;
  trashPath: string;
};
```

The preload note surface now exposes:

```ts
window.inknest.notes.create(payload);
window.inknest.notes.read(path);
window.inknest.notes.rename(payload);
window.inknest.notes.duplicate(payload);
window.inknest.notes.move(payload);
window.inknest.notes.delete(payload);
window.inknest.notes.listTrash();
window.inknest.notes.restore(payload);
window.inknest.notes.permanentlyDelete(payload);
```

Permanent deletion requires an explicit `{ confirmed: true }` payload in
addition to renderer-side confirmation.

### Main-Process Note Operations

`src/main/services/note-service.ts` now owns the note file mutations:

- `createMarkdownNote` writes a new UTF-8 `.md` file with a default `# Title`.
- `renameMarkdownNote` changes the filename with collision-safe naming.
- `duplicateMarkdownNote` copies note content into the same folder.
- `moveMarkdownNote` moves a note into another workspace folder.
- `moveMarkdownNoteToTrash` moves deleted notes under `.inknest/trash/`.
- `scanTrashNotes` lists Markdown notes currently in trash.
- `restoreMarkdownNote` moves trash items back to their original location, using
  a collision-safe name when needed.
- `permanentlyDeleteMarkdownNote` removes a trash item after confirmation.

All operations resolve paths through `resolveInsideWorkspace()`. Regular note
scanning still skips `.inknest/`, so trashed notes do not appear in the active
note list.

### Renderer Behavior

`src/renderer/src/App.tsx` now renders scanned folders and notes instead of
placeholder rows. Users can:

- select a workspace and scan its folders and notes
- create a note in the selected folder
- open a note and inspect its saved Markdown content
- rename, duplicate, move, and delete the selected note
- restore or permanently delete notes from trash

The editor area remains an inspection surface in this phase. Visual editing,
toolbar commands, and autosave are intentionally left for later phases.

### Phase 6 Data Flow

```text
User creates a note
  -> renderer calls window.inknest.notes.create({ title, folderPath })
  -> preload invokes notes:create
  -> main process validates the payload and active workspace
  -> note service writes a collision-safe Markdown file
  -> renderer rescans workspace and opens the new note
```

Delete and restore follow the same boundary: renderer requests the action,
main-process services move files inside the workspace, and the renderer rescans
to keep visible state aligned with disk.

### Tests

`tests/phase6.test.mjs` verifies the shared contract, note IPC handlers, service
operations, trash behavior, renderer controls, and architecture documentation
for this phase. Existing phase tests continue to protect the app shell,
workspace boundary, and file model.

`npm run check` remains the lightweight validation command.

## Phase 7 Architecture: Folder Organization

Phase 7 turns folders into a usable organization surface in the sidebar. Notes
and folders remain plain filesystem entries inside the active workspace, and the
renderer still reaches them only through the preload API.

### Folder Organization Contract

The shared IPC contract now includes `MoveFolderPayload`:

```ts
type MoveFolderPayload = {
  path: string;
  parentPath: string;
};
```

The preload folder surface exposes:

```ts
window.inknest.folders.create(payload);
window.inknest.folders.rename(payload);
window.inknest.folders.move(payload);
window.inknest.folders.delete(payload);
```

The `folders:move` channel accepts workspace-relative paths only. The main
process validates the active workspace, the source folder, and the target parent
folder before touching disk.

### Main-Process Folder Operations

`src/main/services/folder-service.ts` owns folder scanning and mutations:

- `scanWorkspaceFolders` returns sorted workspace-relative folder summaries.
- `createWorkspaceFolder` creates collision-safe user folders.
- `renameWorkspaceFolder` renames a user folder without leaving the workspace.
- `moveWorkspaceFolder` moves a folder into another safe workspace folder.
- `deleteWorkspaceFolder` removes a folder after renderer confirmation.

Folder moves reject unsafe targets, including the workspace root as a source,
app-owned folders such as `.inknest/` and `asset/`, and moving a folder into
itself or one of its descendants.

### Renderer Behavior

`src/renderer/src/App.tsx` now builds a collapsible folder tree from scanned
folder summaries. Users can:

- expand and collapse nested folders
- select folders from the tree
- create folders under the selected folder
- rename, move, and delete folders from inline sidebar actions
- move notes into folders from the existing note move menu

The renderer keeps expanded ancestors visible after creates, renames, and moves.
After every folder or note mutation, it rescans the workspace so the sidebar and
note list reflect the filesystem state.

### Phase 7 Data Flow

```text
User moves a folder
  -> renderer calls window.inknest.folders.move({ path, parentPath })
  -> preload invokes folders:move
  -> main process validates payload and active workspace
  -> folder service rejects unsafe moves or renames the directory
  -> renderer rescans workspace and selects the moved folder path
```

Delete follows the same boundary, with renderer-side confirmation plus a
`{ confirmed: true }` payload before recursive folder deletion is allowed.

### Tests

`tests/phase7.test.mjs` verifies the folder move contract, guarded folder move
service behavior, collapsible folder tree renderer controls, and this
architecture documentation. Earlier phase tests continue to protect the shell,
workspace boundary, file model, and note CRUD behavior.

`npm run check` remains the lightweight validation command.

## Markdown Editor Rewrite: Transactional Architecture

The Phase 8 and Phase 9 editor has been replaced with a schema-driven Milkdown
editor. The renderer still owns the active document and the main process still
owns filesystem writes, but editing no longer depends on hand-built HTML,
`document.execCommand`, DOM normalization, or DOM-to-Markdown traversal.

### Note Save Contract

The shared IPC contract now includes `SaveNotePayload`:

```ts
type SaveNotePayload = {
  path: string;
  markdown: string;
};
```

The preload note surface exposes:

```ts
window.inknest.notes.save(payload);
```

The `notes:save` channel accepts a workspace-relative Markdown path and the
next Markdown string. The main process validates the active workspace, rejects
paths outside the workspace, and writes only `.md` files.

### Main-Process Save Operation

`src/main/services/note-service.ts` now includes `saveMarkdownNote`. It resolves
the note path with the same workspace boundary as read, rename, move, delete,
and restore operations, writes UTF-8 Markdown, and returns the saved
`NoteContent` envelope.

Phase 10 extends this save contract with debounced autosave and a safer
temporary-file write flow. The contract remains the same for manual saves and
autosaves.

### Renderer Editor Modules

- `editor/MarkdownEditor.tsx` is the React lifecycle and controlled-value
  boundary. Its imperative handle exposes only commands, link details,
  Markdown snapshots, and focus.
- `editor/create-editor.ts` composes Milkdown presets and editor extensions.
- `editor/editor-controller.ts` maps toolbar actions to ProseMirror
  transactions and derives active toolbar state from `EditorState`.
- `editor/document-envelope.ts` separates YAML frontmatter from the editable
  body and preserves BOM and CRLF/LF style when recomposing a note.
- `editor/extensions/` contains isolated NodeViews and plugins for task items,
  code-block controls, images, callout decoration, slash commands, and syntax
  decoration. A document observer serializes changed editor states and reports
  selection changes without reading the rendered DOM.
- `editor/editor.css` owns editor-only presentation; application chrome remains
  in `styles.css`.

Milkdown's CommonMark and GFM schemas are the canonical in-memory model.
Formatting, list operations, table changes, checkboxes, links, and slash
commands dispatch ProseMirror transactions. Markdown serialization happens
from that model, not from mutable browser DOM.

### Editor Data Flow

```text
User opens a note
  -> renderer calls window.inknest.notes.read(path)
  -> main process returns saved Markdown
  -> document-envelope.ts separates frontmatter from the editable body
  -> Milkdown parses the body into a ProseMirror document
  -> typing and toolbar commands dispatch transactions
  -> Milkdown serializes the document back to Markdown
  -> document-envelope.ts restores frontmatter and newline style
  -> user clicks Save
  -> renderer calls window.inknest.notes.save({ path, markdown })
  -> main process validates the path and writes the Markdown file
  -> renderer clears dirty state and refreshes workspace summaries
```

### Tests

`tests/phase8.test.mjs` verifies the save boundary and modular editor wiring.
`tests/editor-architecture.test.mjs` behaviorally verifies frontmatter, BOM,
and newline preservation and guards against reintroducing the deleted DOM
algorithm.

`npm run check` remains the lightweight validation command.

## Phase 9 Architecture: Toolbar And Editing Commands

The toolbar remains renderer-owned and uses the new transaction command
boundary. It never edits HTML directly.

### Toolbar Command Model

The renderer defines a compact `toolbarPlaceholders` command list in
`src/renderer/src/App.tsx`. Each command has an id, label, icon, and group. The
toolbar exposes visible buttons for:

- H1 and H2 headings
- blockquotes
- unordered, ordered, and task lists
- bold, italic, and inline code
- links
- images
- horizontal dividers

Toolbar buttons use icon controls with `aria-label` and `title` attributes.
Mouse down prevents the button from stealing the current editor selection
before the command runs.

### Editor Command Boundary

`MarkdownEditor.runCommand(command, options)` is the toolbar boundary. The
parent owns dialogs and toolbar layout; `editor-controller.ts` owns focus,
schema commands, and ProseMirror transactions. Active states are derived from
the current selection rather than remembered DOM ranges.

Links and imported images continue through the existing preload IPC boundary.
Local image display is handled by an image NodeView while the saved Markdown
retains the workspace-relative source.

### Phase 9 Data Flow

```text
User places the cursor or selects content
  -> user clicks a toolbar button
  -> toolbar preserves editor focus on mouse down
  -> App calls MarkdownEditor.runCommand(command, options)
  -> editor-controller dispatches a schema transaction
  -> Milkdown updates active command state and serialized Markdown
  -> App marks the note dirty and keeps manual Save available
```

### Tests

`tests/phase9.test.mjs` verifies the command boundary, extension modules,
scoped styles, and Electron behavior coverage. Earlier phase tests continue to
protect the shell, workspace boundary, file model, and persistence workflow.

`npm run check` remains the lightweight validation command.

## Phase 10 Architecture: Auto-Save And Safe Writes

Phase 10 keeps editing in the renderer and makes persistence a small queued
workflow. The renderer owns the current Markdown, the last confirmed Markdown,
the debounce timer, and the in-flight save promise. The main process remains
the only process that writes note files.

### Renderer Save State

`src/renderer/src/App.tsx` exposes four note save states:

- `Unsaved changes` when the editor differs from the last confirmed write
- `Saving` while `window.inknest.notes.save` is in flight
- `Saved` after the main process confirms the write
- `Save failed` when the request or filesystem operation fails

Editor changes schedule a 750ms autosave, within the 500ms to 1000ms product
range. Manual Save and `Ctrl+S`/`Cmd+S` use the same save function. If an edit
arrives while a save is in flight, the latest content remains dirty and is
queued for another save rather than overwriting it with an older response.

### Safe Main-Process Write

`saveMarkdownNote` resolves and validates the workspace-relative Markdown path,
then writes the next content to a same-directory temporary file. The service
flushes the temporary file with `FileHandle.sync()`, closes it, renames it over
the target, and attempts to flush the parent directory. Failed writes are
returned as `SAVE_FAILED` with actionable permission, read-only, or disk-space
messages. Temporary files are cleaned up when the rename does not complete.

### Close Handshake

The main window intercepts its `close` event and calls `event.preventDefault()`
until the renderer acknowledges the close request. The renderer flushes the
debounce timer and any in-flight or dirty note through the same save queue, then
sends `app:close-ready`. A failed pending save sends `app:close-canceled`,
leaves the note dirty, and keeps the error visible for retry. A bounded main
process watchdog prevents a nonresponsive renderer from deadlocking the app
forever; it is only a fallback after the normal acknowledgment path fails.

### Phase 10 Data Flow

```text
User edits the visual Markdown surface
  -> App marks the note unsaved and starts a 750ms debounce
  -> debounce/manual shortcut calls the shared save queue
  -> preload invokes notes:save with workspace-relative Markdown
  -> main process writes a flushed temporary file and renames it into place
  -> renderer marks the confirmed content saved or keeps failure/dirty state
  -> window close requests a final queue flush before destruction
```

### Tests

`tests/phase10.test.mjs` verifies the save-state wiring, manual shortcut,
close handshake, safe-write markers, and that a saved note leaves no temporary
file behind. `tests/e2e/phase10.spec.ts` covers the user path of editing,
waiting for autosave, and closing the app. Earlier phase tests continue to
protect the preload boundary, workspace model, note CRUD behavior, folder
organization, and editor behavior.

`npm run check` remains the lightweight validation command.

## Architecture Direction After Phase 10

Future work should preserve the current split:

- Renderer code requests actions through `window.inknest`.
- Preload exposes a narrow typed API and approved channel invocations only.
- Main-process handlers own native behavior, filesystem behavior, dialogs,
  export, and external links.
- Main-process services validate payloads and workspace paths before acting.
- Shared types keep IPC contracts explicit.

This keeps InkNest aligned with the local-first goal while avoiding direct
filesystem access from the renderer.

## Phase 11 Architecture: Search And Tags

Phase 11 adds a small in-memory search layer while keeping Markdown files as
the source of truth. The index is rebuilt when a workspace opens and after
filesystem mutations that can change note content or paths.

### Search Contract

The shared IPC contract adds:

```ts
type SearchNotesPayload = {
  query?: string;
  tag?: string;
};

type SearchResult = {
  id: string;
  title: string;
  path: string;
  folderPath: string;
  tags: string[];
  snippet: string;
};

type TagSummary = {
  tag: string;
  count: number;
};
```

The narrow preload surface is:

```ts
window.inknest.search.query({ query, tag });
window.inknest.search.listTags();
```

The renderer never reads note files directly. Search requests cross the same
validated preload and main-process IPC boundary as note operations.

### In-Memory Index

`src/main/services/search-service.ts` owns `InMemorySearchIndex`. Each indexed
note contains its title, workspace-relative path, body content, complete
Markdown content, and normalized searchable text. Searches are case-insensitive
and match all query terms across title, path, body, and frontmatter tags.

Results are ranked by title, tag, path, and body matches and include a short
body snippet. Empty queries can be combined with a tag filter to show every
note carrying that tag. Tag summaries are generated from the current index and
include the number of notes using each tag.

### Frontmatter Tags

`note-service.ts` extracts the optional YAML `tags` field from frontmatter.
Both inline lists such as `tags: [writing, work]` and block lists are accepted.
Tags are deduplicated case-insensitively while preserving their first display
spelling. Search index entries and search results carry the parsed tags without
changing the existing workspace scan note-summary contract.

### Index Lifecycle

```text
Workspace opens
  -> scan Markdown notes
  -> read each note and parse title/body/tags
  -> store normalized entries in InMemorySearchIndex

Note or folder changes
  -> main-process file operation completes
  -> rebuild the active workspace index
  -> renderer refreshes search results and tag counts
```

The rebuild approach is intentionally simple for small and medium workspaces.
SQLite FTS remains a future optimization, and external filesystem watchers are
reserved for Phase 15.

### Renderer Behavior

The sidebar search input is controlled and searches as the user types. Tag
chips show the generated tag list and counts; selecting one filters notes by
that tag, and a query plus tag can be used together. Search results display the
note title, matching body preview, path-independent tag chips, and open the
note in its folder when selected. Empty results explain how to try another
query or tag.

### Tests

`tests/phase11.test.mjs` verifies frontmatter tag parsing, index construction,
case-insensitive title/body/path/tag search, snippets, tag counts, IPC/preload
contracts, and renderer search controls. `npm run check` remains the first
lightweight validation command.

## Phase 12 Architecture: Import, Assets, Images, And Links

Phase 12 keeps native file access in the main process while adding the content
workflows needed for portable notes: importing Markdown, saving pasted or
selected images into the workspace, and opening links safely.

### Markdown Import

`src/main/services/import-service.ts` copies one or more `.md` files into the
selected workspace folder. Folder imports recursively copy Markdown files while
preserving their relative subfolders. Destination names are collision-safe,
and non-Markdown or failed sources are reported in `skipped` rather than
silently discarded. The search index is rebuilt after a successful import.

The renderer invokes:

```ts
window.inknest.notes.importFiles({ folderPath });
window.inknest.notes.importFolder({ folderPath });
```

The main process owns both native dialogs and the copy operation, so arbitrary
source paths never become a renderer filesystem capability.

### Workspace Assets

`src/main/services/asset-service.ts` stores images in the existing workspace
`asset/` folder. Selected images are copied there and clipboard images are
received as validated bytes through `dialogs:save-image`. Asset names are
sanitized and receive a numeric suffix when a name already exists. Notes store
workspace-relative links such as `asset/diagram.png`, while the editor uses a
file URL only for the current preview.

Relative image resolution is anchored to the current note path and rejects
paths that would escape the workspace. If a local image cannot be loaded, the
renderer replaces it with a visible missing-image placeholder that serializes
back to the original Markdown image link.

### Link Safety

External links continue through `links:open-external`, where the main process
allows only `http:` and `https:` URLs and delegates to the operating system
browser. Local Markdown links use `links:resolve-local`; the main process
resolves them from the current note, enforces the active workspace boundary,
requires a real `.md` file, and returns a workspace-relative note path for the
renderer to open. Renderer Markdown links also reject executable URL schemes.

### Phase 12 Data Flow

```text
Import or paste action
  -> preload invokes a narrow typed API
  -> main process opens a native dialog or validates image bytes
  -> service copies data into workspace notes/asset paths safely
  -> search index and renderer file model refresh

Ctrl/Cmd-click link
  -> external http(s) link goes to the system browser
  -> local Markdown link is resolved inside the workspace
  -> renderer opens the returned note through notes:read
```

`npm run check` remains the first lightweight validation command.

## Phase 17 Architecture: Release Validation

Phase 17 adds a release gate around the completed MVP rather than introducing
another renderer feature. `scripts/release-check.mjs` runs the scaffold, unit,
and TypeScript checks, validates the production package build, and then runs
the Electron acceptance suite. The GitHub pull-request workflow invokes this
single gate under Xvfb so local and CI validation use the same command.

### Acceptance Coverage

`tests/e2e/phase17.spec.ts` is an integrated smoke flow through the typed
preload boundary. It selects a workspace, creates and edits a note, verifies
the saved Markdown, searches for its content, renames the note, exports a
copy, moves the note to trash, and restores it. The existing phase suites
continue to cover the individual service and renderer behaviors in detail.

`RELEASE_CHECKLIST.md` records the automated gate, MVP acceptance criteria,
and manual checks for themes, autosave, external links, images, exports, and
external file changes. It is the handoff checklist for a packaged desktop
build.

### Phase 17 Validation Flow

```text
npm run release-check
  -> npm run check
  -> npm run package
  -> npm run test:e2e
  -> release validation passed
```

## Phase 14 Architecture: Settings And Themes

Phase 14 stores user preferences in the existing user-data `settings.json`
file and applies them through the typed preload boundary. The main process
owns persistence and validation; the renderer owns the settings popover and
applies the returned values to the document and editor.

### Settings Contract

`AppSettings` contains the theme, editor font size and family, auto-save delay,
line wrapping, word-count visibility, sidebar visibility, and the existing
workspace restore fields. `settings:save` accepts a partial preference update,
validates every supplied value in the main process, merges it with the current
settings, normalizes it, and writes the complete settings object back to disk.

The persisted defaults are:

```ts
{
  theme: "system",
  fontSize: 16,
  fontFamily: "system",
  autoSaveDelayMs: 750,
  lineWrap: true,
  showWordCount: true,
  sidebarVisible: true
}
```

Font sizes are limited to 12–24px and auto-save delays to 500–5000ms. Invalid
or legacy settings fall back field-by-field to these defaults, while recent
workspace paths continue to be normalized and capped at five entries.

### Renderer Application

The renderer requests `settings:get` during startup and keeps the returned
settings in React state. Theme selection is written to
`document.documentElement.dataset.theme`; CSS variables select light, dark, or
OS-following system colors, including `prefers-color-scheme` handling. Font
preferences are exposed as CSS variables on the app root and consumed by the
visual editor. The auto-save scheduler uses the persisted delay, while the
sidebar, line wrapping, and word-count controls update the layout immediately
after a successful save.

The default workspace remains part of the workspace selection flow: selecting
or reopening a workspace updates `lastWorkspacePath` and `recentWorkspaces`,
so a restart can restore the same local folder without direct renderer
filesystem access.

### Phase 14 Data Flow

```text
App startup
  -> renderer invokes settings:get through preload
  -> main reads and normalizes user-data/settings.json
  -> renderer applies theme, font, layout, and autosave preferences

User changes a preference
  -> settings popover sends a partial settings:save request
  -> main validates and merges the request
  -> main writes the complete normalized settings object
  -> renderer applies the returned settings immediately
```

`tests/phase14.test.mjs` covers the shared contract, validation, persistence
defaults, renderer controls, and theme behavior. The Phase 4 end-to-end
settings assertions also verify that newly selected workspaces retain the
complete preference object.

## Phase 15 Architecture: Reliability, Trash, And External Changes

Phase 15 keeps the Markdown workspace as the source of truth while adding a
main-process snapshot watcher. The watcher polls the active workspace at a
small interval, skips app metadata and temporary safe-write files, and tracks
created, changed, and deleted paths. It reports typed events through the
preload boundary without exposing filesystem APIs to the renderer. The main
process also rebuilds the in-memory search index before forwarding a ready
workspace event.

### External Change Handling

The renderer subscribes to `workspace.onChanged`. Changes to other files
refresh the workspace model, folder tree, note list, tags, and trash display.
When the open note changes externally, a clean editor reloads from disk. If
the editor has local unsaved content, InkNest leaves that content untouched and
shows a conflict banner with `Reload from disk`, `Keep my version`, and `Save as
new note` actions. An externally deleted open note is marked in the same banner
and can be kept locally or copied to a newly generated note. Saving is blocked
while a conflict is unresolved, preventing autosave from silently overwriting
an external edit.

Workspace disappearance and permission loss become explicit workspace states
with actionable messages. If the folder becomes available again, the watcher
and renderer restore the ready state and rescan it.

### Frontmatter And Trash

Frontmatter parsing remains deliberately small and tolerant. The parser treats invalid frontmatter and unknown metadata as ignorable rather than allowing them to make the Markdown body
unreadable; note scanning and direct reads continue to return the original
content. Trash restore and permanent delete remain validated main-process
operations, and the watcher refreshes the visible trash list after filesystem
changes.

### Phase 15 Data Flow

```text
WorkspaceWatcher snapshots the active folder
  -> main rebuilds search index and sends workspace:changed through preload
  -> renderer rescans folders, notes, tags, and trash
  -> clean open notes reload automatically
  -> dirty open notes show a conflict banner without losing local edits
  -> user reloads, keeps, or saves the local version as a new note
```

`tests/phase15.test.mjs` covers watcher events and malformed frontmatter, while
the Phase 15 Electron tests exercise external edit, conflict, deletion, and
trash recovery flows.

## Phase 16 Architecture: Accessibility, Keyboard Support, And UI Polish

Phase 16 makes the existing renderer shell usable across keyboard and window
sizes while preserving the local-first data flow. Interactive controls expose
accessible names, icon buttons keep tooltips for discoverability, and a shared
`:focus-visible` treatment makes the active control clear in both light and
dark themes. The main window allows a narrower minimum size, and responsive
layout rules collapse the workspace panels before text can collide with the
editor or header actions.

### Keyboard And Command Palette

The renderer handles `Ctrl+K` by opening a command palette containing the core
workspace, note, settings, search, sidebar, and export actions. The palette
filters by label and description, keeps disabled actions visible with their
reason implied by context, and supports Arrow Up/Down, Enter, and Escape. The
`/` shortcut focuses note search when the user is not already typing in a
control, while `Ctrl+S` continues to save the active note through the existing
preload API.

### Status And Responsive Layout

The status bar is a compact four-part readout for the active file path (or the
workspace prompt when no note is open), current editor mode, app phase, and save
details. Save details include the current save state and, when enabled, word
and character counts. CSS media queries move the path to its own row and hide
secondary panels at narrow widths, keeping the editor usable without changing
the underlying workspace model.

```text
Keyboard shortcut or command button
  -> renderer focuses the requested control or runs an existing app action
  -> action continues through the typed preload bridge
  -> status bar reports mode, path, save state, and document counts
```

`tests/phase16.test.mjs` checks the accessibility and responsive contracts;
the Phase 16 Electron tests exercise command-palette keyboard routing,
workspace note creation, and narrow/wide layout changes.

## Phase 13 Architecture: Export

Phase 13 keeps export filesystem access and PDF printing in the main process.
The renderer requests a format and note path through the typed preload bridge;
the main process validates the active note, opens a native save dialog when a
destination was not supplied, and reports a completed or canceled export.

### Export Contract

The shared contract supports three formats:

```ts
type ExportFormat = "markdown" | "html" | "pdf";

window.inknest.export.note({
  path: "Projects/Design.md",
  format: "html"
});
```

The legacy path-only request remains accepted for compatibility with the
earlier export placeholder, but new callers use the format-aware payload.
Destinations must use the expected extension, live inside an existing writable
folder, and cannot overwrite the active Markdown source note.

### Markdown And HTML

`src/main/services/export-service.ts` reads the source Markdown and builds a
standalone HTML document with readable styles for headings, lists, tables,
blockquotes, links, images, and code blocks. Markdown text is escaped before
formatting, unsafe URL schemes are replaced with safe placeholders, local
images and note links are resolved only inside the active workspace, and the
final document passes through `sanitizeExportedHtml` before it is written.

Markdown export writes the original UTF-8 note content without transforming
it, allowing users to share or archive the exact source file.

### PDF Printing

PDF export loads the generated standalone HTML into a hidden sandboxed
`BrowserWindow`, calls Electron's `webContents.printToPDF` with background and
CSS page-size support, writes the returned bytes to the validated destination,
and destroys the temporary window in a `finally` block.

### Phase 13 Data Flow

```text
User selects Export Markdown, HTML, or PDF
  -> renderer flushes pending note edits
  -> preload invokes export:note with path and format
  -> main validates the note and destination
  -> service writes Markdown or sanitized HTML
  -> PDF format prints the same HTML in a hidden sandboxed window
  -> renderer reports exported, canceled, or actionable failure status
```

`npm run check` remains the first lightweight validation command.
