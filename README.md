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
for icon controls, note search on `Ctrl+K`, a command palette on `Ctrl+Shift+K`, `/` search focusing, and a
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


On first launch, InkNest creates a local example workspace under its app-data
folder (`workspaces/Personal`) and opens the sample note, reading list, and an
empty unnamed note. A separate `workspaces/Research` folder is available in
Recent workspaces. Sample content is created only when no settings file exists;
subsequent launches preserve edits, deleted notes, and the chosen workspace.
Existing installations retain their own workspaces and settings.

The compact formatting toolbar keeps heading levels and additional commands in
menus. `Ctrl+F` opens Find and `Ctrl+H` opens Find and Replace beneath the toolbar.
The heading panel can be resized from its left edge or bottom-right corner;
keyboard arrows resize it, and Escape cancels an active drag.


InkNest restores the open note tabs, their order, and the active note when it
reopens. Each workspace has its own session, stored in `workspace-sessions.json`
inside the app-data folder beside `settings.json`. Closed tabs stay closed;
missing files are skipped, and the first surviving tab becomes active if the
previously active file is unavailable. Pending note edits and the latest tab
session are saved before the window closes.

Right-click a note tab for **Rename**, **Close Tab**, **Close Other Tabs**,
**Close All Tabs**, and **Close Tabs to the Right**. These actions close tabs
without deleting notes. Pending edits are saved before closing their tab; if
saving is blocked, the tabs remain open. Rename edits the title directly in the
tab (Enter to apply, Escape to cancel). Shift+F10 opens the menu from a focused
tab, and arrow keys navigate its options.


## Slash formatting

Type `/` at the start of a text block or after a space to open formatting
suggestions. Keep typing to filter the commands; use arrow keys and Enter or Tab
to choose, or click an option. Escape keeps the typed text and dismisses the menu.
The menu includes all toolbar formatting options, with table actions enabled
inside tables. Suggestions stay off in code and locked notes. Existing shortcuts
such as `/heading`, `/todo`, `/table`, and `/math` still work.

## Code block languages

Click a code block's language label to open a searchable picker with 46 common
language choices. Its height stays fixed as results are filtered, and the list
scrolls. Search by name or alias (such as `js`, `golang`, or `yml`), use arrow keys
and Enter to select, or click a language. Escape cancels. Existing custom language
names are preserved, and changing the language keeps the code intact.
Programming languages use grammar-based syntax highlighting with colors for
keywords, strings, numbers, functions, and other tokens in both light and dark
themes. Plain text and unrecognized custom languages stay uncolored.

## Searching notes


The sidebar search (`Ctrl+K`) matches file and folder names only, with partial and
case-insensitive matching. Its filtered list hides unrelated entries and parent
folders, and never matches note contents. Selecting a matching folder clears the
filter and opens that folder in the normal tree. Results have no content previews.
Use Find inside the current note (`Ctrl+F`) or Find and Replace (`Ctrl+H`) to
search its contents. The separate tag filter can still narrow the file list.

## Note locks

Use the lock button beside the note's search controls to make a note view-only.
Locking saves pending edits first; unlocking restores editing. Locks are remembered
per workspace and note in local settings, including after restarting InkNest.
Find, copying, links, the heading panel, and export remain available while locked.
Formatting, task toggles, table changes, pasting, and Find and Replace cannot change
the locked note. Rename operations inside InkNest preserve its lock.

## Linux installer

Build an amd64 Debian/Ubuntu installer with:

```sh
npm ci
npm run package:deb
```

The installer is written to `release/inknest_0.1.0_amd64.deb` (the version follows
`package.json`). Install it with:

```sh
sudo apt install ./release/inknest_0.1.0_amd64.deb
```

Launch InkNest from the application menu or run `inknest`. Installed builds use
the same `inknest` app-data directory as development builds, preserving settings,
workspace sessions, and the local example workspace. Your Markdown files stay in
their existing workspace folders. Node.js is only needed to build the package;
the installer includes the Electron runtime.

## Automated GitHub releases

`.github/workflows/release.yml` builds and publishes the amd64 `.deb` when a stable
version tag such as `v0.1.0` is pushed. The tag must match the version in both
`package.json` and `package-lock.json`. The workflow runs all release checks
headlessly, builds the installer, verifies its metadata, and checks the extracted
app's rendering, note saving, and tab restoration before publishing.

Commit the packaging files and workflow, merge them into `main`, then push a tag:

```sh
git switch main
git pull --ff-only
git tag -a v0.1.0 -m "InkNest 0.1.0"
git push origin v0.1.0
```

Check the **Actions** tab for progress. On success, **Releases** contains the
installer, `SHA256SUMS`, and generated release notes. Publishing uses the built-in
GitHub token; no personal access token is required. Existing releases are not
overwritten. For later releases, update both version files (for example with
`npm version patch --no-git-tag-version`), commit and merge, then push the matching
new tag. Generated packages remain excluded from Git history.

To check a downloaded installer, place it beside `SHA256SUMS` and run:

```sh
sha256sum --check SHA256SUMS
```
