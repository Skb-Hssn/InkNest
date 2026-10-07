# InkNest

InkNest is a local-first desktop Markdown note-taking app. Notes live in ordinary
`.md` files in your own folders, with visual editing and automatic saving. No
account, cloud service, or internet connection is required to write and read notes.

## Features

- **Workspaces and tabs:** organize files in folders, open multiple notes, and
  restore each workspace's open tabs and active note after restarting.
- **Visual Markdown editing:** headings, bold, italic, strikethrough, inline code,
  lists, tasks, tables, quotes, callouts, links, images, and dividers.
- **Slash commands:** type `/` for searchable formatting suggestions.
- **Code blocks:** a searchable language picker and grammar-based syntax colors
  for the programming languages it offers, including C++, Java, Python, and Rust.
- **Math:** editable inline and display LaTeX rendered with KaTeX.
- **Search:** filter file and folder names in the sidebar; find and replace text
  inside the current note.
- **Favorites and locks:** bookmark notes for quick access or make them view-only.
- **Reading layout:** a floating, scrollable heading minimap with resizing,
  animated visibility, and navigation to the selected heading.
- **Appearance:** light, dark, and system themes; eight accent colors; font family
  and size; line wrapping; readable or full-width notes; sidebar and word counts.
- **Import and export:** import Markdown files and folders, store images in the
  workspace, and export notes as Markdown, HTML, or PDF.
- **External changes:** watch the active workspace, reload clean notes when they
  change, and preserve local edits when there is a conflict.

## Development

Use Node.js 22, matching the GitHub Actions workflows. Install the locked
dependencies and run the checks:

```sh
npm ci
npm run check
```

Start the desktop app:

```sh
npm run dev
```

Build the Electron/Vite output:

```sh
npm run build
```

On Linux, the development command runs Electron with `--no-sandbox` through
electron-vite's `--noSandbox` option. This handles local sandbox-helper permission
issues in development. The `.deb` installer configures the installed sandbox
helper separately.

## Workspaces and storage

One workspace is active at a time. You can select an existing folder of Markdown
notes or switch between recent workspaces.

On first launch, InkNest creates an example workspace in its app-data folder at
`workspaces/Personal`. It opens the sample note, reading list, and an empty unnamed
note. A separate `workspaces/Research` folder appears in Recent workspaces. The
example is created only when no settings file exists; later launches retain your
edits, deleted notes, and workspace choice.

New notes are completely empty. Their initial filenames are `Untitled.md`,
`Untitled 2.md`, and so on; rename them from the file menu or tab menu.

Your notes stay in the selected workspace folder. Images use its `asset/`
folder, deleted notes go to `.inknest/trash/`, and tags are stored in YAML
frontmatter. Invalid frontmatter does not prevent a note from opening.

InkNest's app-data folder contains:

- `settings.json`: appearance, editor preferences, recent workspaces, favorites,
  and note locks.
- `workspace-sessions.json`: each workspace's open tabs, their order, and its
  active note.
- `workspaces/`: the local example workspaces.

Development and installed builds use the same `inknest` app-data directory.
`INKNEST_USER_DATA_DIR` can override it, including for isolated tests.

## Note tabs

Use the plus button on the tab bar to create a new empty note. Closing a tab
preserves its file. Pending edits are saved before closing the active note, and
closed tabs stay closed after restarting. Missing files are skipped when a
workspace session is restored.

Right-click a tab for **Rename**, **Close Tab**, **Close Other Tabs**,
**Close All Tabs**, or **Close Tabs to the Right**. If saving a note is blocked,
close actions that would discard its pending edits keep the tabs open. Rename
edits the filename directly in the tab: Enter applies it and Escape cancels.
Shift+F10 opens the tab menu from the keyboard, and arrow keys navigate it.

## Slash formatting

Type `/` at the start of a text block or after a space to open formatting
suggestions. Keep typing to filter commands; use arrow keys and Enter or Tab to
choose, or click an option. Escape dismisses the menu and keeps the typed text.

The menu includes all toolbar formatting options, with table-editing actions
available inside tables. It uses the note's selected font and stays closed in
code and locked notes. Existing shortcuts such as `/heading`, `/todo`, `/table`,
and `/math` still work.

## Code block languages

Click a code block's language label to open a searchable picker with 46 choices.
The picker stays 300px high while filtering, and its results list scrolls. Search
by language name or alias, such as `js`, `golang`, or `yml`. Arrow keys and Enter
select a language; Escape cancels. Existing custom language names are preserved,
and changing the language keeps the code intact.

Programming languages use grammar-based syntax highlighting, with colors for
keywords, strings, numbers, functions, and other tokens in light and dark themes.
Plain text and unrecognized custom languages stay uncolored.

## Math

Inline and display equations render locally with KaTeX. Insert them from the
formatting toolbar or slash menu, or use Markdown math delimiters:

```markdown
Inline: $E = mc^2$.

$$
V_n = V_0 (1 + r)^n
$$
```

Click a rendered equation to edit its LaTeX source. Pasting delimited math or a
recognized standalone LaTeX equation formats it automatically. Copying a rendered
equation retains its editable source. Math written inside code remains literal.

## Searching files and notes

The sidebar search (`Ctrl+K`) matches **file and folder names only**, using partial
and case-insensitive matching. Its filtered list hides unrelated entries and
parent folders and shows no content previews. Selecting a matching folder clears
the filter and opens that folder in the normal tree. The separate tag filter can
narrow the file list.

Use `Ctrl+F` to find text inside the current note and `Ctrl+H` for Find and Replace.
The search bar supports case sensitivity, whole words, regular expressions,
selection-only search, and preserving case during replacement. Moving to a match
scrolls it into view when needed. Replacement is disabled for locked notes.

## Favorite notes

Use the toolbar star or **Add to favorites** in a file's menu to bookmark a note.
Favorites appear in a collapsible sidebar section with quick-access and removal
controls. They are remembered per workspace after restarting and follow note and
folder renames inside InkNest. Trashing a note hides its favorite entry; restoring
the note brings it back.

The Favorites section is hidden while filtering the file list so search continues
to show only matching files and folders.

## Note locks

Use the lock button beside the note's search controls to make the note view-only.
Locking saves pending edits first; unlocking restores editing. Locks persist per
workspace and note, including after restart and renaming inside InkNest.

Find, copying, links, the heading panel, and export remain available. Typing,
formatting, task toggles, table changes, pasting, and replacement cannot change a
locked note.

## Reading layout and themes

Use **Reading width** to switch between a readable text column and full width.
The floating **On this page** panel lists headings, highlights the selected
section, and follows scrolling. Resize it from its left edge or bottom-right
corner; arrow keys also resize it, and Escape cancels an active drag. Toggle it
from the toolbar or close it from the panel.

Settings provides light, dark, or system appearance; Forest, Teal, Blue, Violet,
Rose, Orange, Amber, or Graphite accents; system, serif, or monospace fonts; font
size; autosave delay; line wrapping; and visibility preferences.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+K` | Focus file and folder search |
| `Ctrl+Shift+K` | Open the command palette |
| `Ctrl+F` | Find in the current note |
| `Ctrl+H` | Find and replace in the current note |
| `Ctrl+S` | Save the current note |
| `Ctrl+B` / `Ctrl+I` | Toggle bold / italic |
| `Ctrl+Shift+X` | Toggle strikethrough |
| `Ctrl+E` | Toggle inline code |
| `F3` / `Shift+F3` | Next / previous in-note match |
| `Shift+F10` | Open the focused note tab's menu |
| `/` while editing | Open formatting suggestions |
| `/` outside a text input or editor | Focus sidebar search |

## Testing

| Command | Checks |
| --- | --- |
| `npm test` | Unit tests |
| `npm run check` | Scaffold, unit tests, and TypeScript checks |
| `npm run test:e2e` | Production build and Electron E2E tests |
| `npm run release-check` | Checks, production build, and the full Electron E2E suite |

On Linux, run Electron tests headlessly with Xvfb and Openbox. Install `xvfb`,
`openbox`, and `xauth` first. Openbox provides real window-manager behavior for
maximize and restore tests:

```sh
xvfb-run -a -s "-screen 0 1280x1024x24" sh -c 'openbox >/tmp/inknest-openbox.log 2>&1 & npm run test:e2e'
```

For the complete validation gate, use `npm run release-check` in the same wrapper.
The acceptance criteria are in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). GitHub
Actions uses headless validation and uploads traces and error contexts on failure.

`npm run package` builds production output; `npm run package:deb` creates the Linux
installer.

## Linux installer

Build an amd64 Debian/Ubuntu installer:

```sh
npm ci
npm run package:deb
```

For version `0.1.0`, the output is `release/inknest_0.1.0_amd64.deb`. Install it with:

```sh
sudo apt install ./release/inknest_0.1.0_amd64.deb
```

The filename follows the version in `package.json`. Launch InkNest from the
application menu or run `inknest`. The installer includes Electron; Node.js is
needed only for building. Existing workspaces and app-data preferences are reused.

## Automated GitHub releases

[The release workflow](.github/workflows/release.yml) builds and publishes the
amd64 `.deb` when a stable version tag such as `v0.1.0` is pushed. The tag must match
both `package.json` and `package-lock.json`. The workflow runs headless release
checks, builds the installer, verifies its metadata, and tests the extracted app's
rendering, saving, and tab restoration before publishing it with a SHA-256 checksum.

Commit and merge the changes into `main`, then tag that version:

```sh
git switch main
git pull --ff-only
git tag -a v0.1.0 -m "InkNest 0.1.0"
git push origin v0.1.0
```

Use a new version and tag for each release. Update both version files with
`npm version patch --no-git-tag-version`, commit and merge, then push the matching
tag. Generated installers stay out of Git history.

Check **Actions** for progress and **Releases** for the installer, `SHA256SUMS`, and
generated release notes. Publishing uses GitHub's built-in token; no personal
access token is required. Existing releases are not overwritten.

To verify a downloaded installer, put it beside `SHA256SUMS` and run:

```sh
sha256sum --check SHA256SUMS
```

## Source layout

- `src/main/`: Electron main process, native dialogs, and filesystem services.
- `src/preload/`: validated bridge between the renderer and main process.
- `src/renderer/`: React interface and Milkdown Markdown editor.
- `src/shared/`: shared types and constants.
- `tests/`: unit and Electron E2E tests.
- `scripts/`: validation and packaging checks.
- `.github/workflows/`: pull-request tests and Linux releases.

Filesystem access belongs in main-process services and reaches the renderer
through validated preload IPC. See [ARCH.md](ARCH.md) for architecture and
[SPEC.md](SPEC.md) for the project specification.
