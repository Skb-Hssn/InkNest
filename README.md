# InkNest

InkNest is a local-first desktop Markdown note-taking app. The MVP focuses on one active workspace, plain `.md` files, visual Markdown editing, reliable auto-save, search, themes, and export without accounts, analytics, cloud sync, or required internet access.

## Current Status

Phase 17 is release-validated: InkNest has workspace-backed note CRUD, visual
Markdown editing with autosave, in-memory search and tags, Markdown file and
folder import, portable workspace image assets, safe external/local links,
Markdown, HTML, and PDF export, plus persisted theme and editor preferences.

Settings include light/dark/system themes, font size and family, auto-save
delay, line wrapping, word-count visibility, and sidebar visibility. The last
selected workspace is persisted as the default workspace and restored when the
app starts.

The app also watches the active workspace for external edits, deletions, and
permission changes. Clean notes reload automatically; local edits are kept
visible until the user chooses to reload, keep, or save a new copy. Invalid
frontmatter does not prevent the Markdown note from being opened.

The interface also provides visible keyboard focus states, accessible labels
for icon controls, a command palette on `Ctrl+K`, `/` search focusing, and a
status bar with the active file path, editor mode, save state, word count, and
character count. The three-column desktop layout contracts cleanly at narrow
window sizes without relying on overlapping text.

Release validation is available through `npm run release-check`. It runs the
scaffold and unit checks, production packaging/build validation, and the full
Electron E2E suite. The acceptance criteria are documented in
`RELEASE_CHECKLIST.md`.

On Linux, run the same validation without visible desktop windows using Xvfb
and Openbox (install the `xvfb` and `openbox` system packages first):

```sh
xvfb-run -a -s "-screen 0 1280x1024x24" sh -c 'openbox >/tmp/inknest-openbox.log 2>&1 & npm run release-check'
```

Openbox supplies window-manager behavior so maximize/restore tests exercise
real window transitions. GitHub Actions uses this setup and uploads test
traces and error contexts when validation fails.

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
