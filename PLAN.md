# PLAN.md - InkNest Implementation Roadmap

## Project Goal

InkNest is a local-first desktop Markdown note-taking app for writing, organizing, searching, and exporting notes stored as plain `.md` files. The MVP should prioritize a fast, offline, secure writing experience with one active workspace, visual Markdown editing, reliable auto-save, search, themes, and export.

This plan turns `SPEC.md` into an implementation roadmap. It is not a replacement for the full product specification.

## MVP Defaults

- Use one active workspace at a time.
- Store tags in YAML frontmatter.
- Move deleted notes to an app-level trash folder inside workspace metadata.
- Treat the visual editor/editable preview as the primary editing surface.
- Sanitize or disable raw HTML before rendering Markdown.
- Start search with an in-memory index before considering SQLite FTS or another search backend.
- Keep filesystem access in Electron main-process services and expose it only through validated preload IPC.
- Keep the app useful without internet access, account creation, analytics, or cloud sync.

## Roadmap Overview

The MVP is broken into small phases so each step can be implemented, checked, and tested independently.

| Phase | Focus | Main Result |
| ----- | ----- | ----------- |
| 0 | Repository baseline | Project scripts and conventions are clear |
| 1 | App shell scaffold | Electron, Vite, React, TypeScript, and Tailwind are running |
| 2 | Secure Electron boundary | Renderer talks to main process through a safe preload API |
| 3 | Static application layout | The main note-taking UI exists with empty states |
| 4 | Workspace selection | User can choose and reopen one active workspace |
| 5 | Workspace file model | Main process can scan folders and Markdown notes safely |
| 6 | Note CRUD | User can create, read, rename, duplicate, move, and delete notes |
| 7 | Folder organization | User can organize notes in folders |
| 8 | Visual Markdown editor | User edits formatted content and saves valid Markdown |
| 9 | Toolbar and editing commands | Common Markdown actions are available through visible controls |
| 10 | Auto-save and safe writes | Edits persist reliably with visible save status |
| 11 | Search and tags | User can search titles, content, and frontmatter tags |
| 12 | Import, assets, and links | Images, local assets, and external links behave safely |
| 13 | Export | Notes export to Markdown, HTML, and PDF |
| 14 | Settings and themes | Preferences persist across restarts |
| 15 | Reliability and external changes | Conflicts, missing files, and trash restore are handled |
| 16 | Accessibility and polish | MVP is comfortable, keyboard-friendly, and ready to package |
| 17 | Release validation | MVP acceptance criteria and tests pass |

## Phase 0: Repository Baseline

Purpose:

Create a clean starting point before app code grows. This phase should make it obvious how to run, check, and extend the project.

Work:

- Review `SPEC.md` and this roadmap before writing app code.
- Add or confirm `package.json` scripts for development, checking, testing, and packaging.
- Add a short project `README.md` if one does not exist yet.
- Decide the initial source layout before adding features.
- Keep generated output, build artifacts, dependency folders, and local workspace data out of version control.

Done when:

- A new contributor can identify the app goal, MVP scope, and first development command.
- The repo has a clear place for main-process, preload, renderer, shared types, and tests.

## Phase 1: App Shell Scaffold

Purpose:

Start the actual desktop app with the intended stack and a minimal running window.

Work:

- Set up Electron with Vite.
- Add React and TypeScript for the renderer.
- Add Tailwind CSS or the selected styling setup.
- Create initial files for `src/main`, `src/preload`, `src/renderer`, and shared types.
- Render a minimal InkNest screen through Electron.
- Add scripts such as `dev`, `check`, `test`, and `build`.

Detailed behavior:

- The first rendered screen should be the app workspace experience, not a landing page.
- The UI can show empty workspace states at this point.
- The native window title should remain `InkNest`.

Done when:

- The Electron app opens a renderer window.
- The renderer displays an InkNest app shell.
- `npm run check` or the equivalent lightweight check passes.

## Phase 2: Secure Electron Boundary

Purpose:

Create the security boundary before adding filesystem features.

Work:

- Create the main browser window with `contextIsolation: true`.
- Keep `nodeIntegration: false`.
- Do not expose unrestricted Node.js APIs to renderer code.
- Expose a narrow `window.inknest` preload API.
- Add IPC handlers in grouped modules for workspace, notes, settings, links, dialogs, and export.
- Validate all IPC payloads before handling them.
- Reject paths outside the active workspace.
- Open external links through the main process using Electron's safe shell API.

Detailed behavior:

- Renderer code requests actions; it never directly reads or writes local files.
- Main-process services own filesystem, native dialogs, export, and external link behavior.
- IPC errors should return useful messages without leaking unnecessary internal details.

Done when:

- Renderer can call one harmless preload method successfully.
- An invalid IPC payload is rejected.
- Direct filesystem access from renderer code is not used.

## Phase 3: Static Application Layout

Purpose:

Build the permanent UI structure before wiring all behavior.

Work:

- Create the main layout: top bar, sidebar, note list, editor area, and status bar.
- Add a workspace switcher area.
- Add visible buttons for new note and new folder.
- Add a search input location.
- Add empty states for no workspace, no folder, no note, and no search results.
- Add placeholders for save status, word count, character count, and current file path.

Detailed behavior:

- The sidebar should contain workspace name, folder tree area, note list area, search, new note, and new folder controls.
- The editor area should be ready for the visual editor and toolbar.
- Controls should be discoverable; common actions should not rely only on hidden shortcuts.

Done when:

- The app has the same rough shape as the MVP layout from `SPEC.md`.
- Empty states explain the current state without requiring app data.

## Phase 4: Workspace Selection And Startup Restore

Purpose:

Let the user choose the local folder where notes live.

Work:

- Add a native folder picker for selecting a workspace.
- Add support for creating or choosing an empty folder.
- Persist the last opened workspace path in app settings.
- Track recent workspaces.
- Reopen the last workspace on startup when it still exists and is accessible.
- Show a clear prompt when the previous workspace is missing or permission is denied.

Detailed behavior:

- The MVP supports one active workspace at a time.
- The app must not modify files outside the selected workspace.
- The app should clearly explain where notes are stored.

Done when:

- User can select a workspace.
- App remembers and reopens it after restart.
- Missing or inaccessible workspace paths produce a clear user-facing state.

## Phase 5: Workspace File Model

Purpose:

Create the backend services that understand Markdown files, folders, assets, metadata, and trash.

Work:

- Add a workspace service for validating active workspace paths.
- Add a note service for scanning `.md` files.
- Add a folder service for scanning and changing directories.
- Add an app metadata folder inside the workspace.
- Add an `assets/` folder convention for images.
- Add an app-level trash folder for deleted notes.
- Add safe path utilities that prevent path traversal and out-of-workspace writes.
- Add filename generation and duplicate-name handling.

Detailed behavior:

- Notes are plain `.md` files.
- New note names should be generated from titles and made filesystem-safe.
- Duplicate names should append a number, such as `Untitled 2.md`.
- Unicode note text should be preserved.

Done when:

- Main process can scan a workspace and return note summaries.
- Path validation prevents reads and writes outside the workspace.
- Empty, nested, and duplicate-name folders behave predictably.

## Phase 6: Note CRUD

Purpose:

Make notes usable as local files.

Work:

- Create new notes with a default title when needed.
- Open and read selected notes.
- Rename notes and update their filename safely.
- Duplicate notes into the same folder with a collision-safe name.
- Move notes between folders.
- Delete notes by moving them to app-level trash.
- Restore notes from trash.
- Permanently delete trash items only after confirmation.

Detailed behavior:

- New notes should open immediately after creation.
- Rename and move actions should preserve note content.
- Delete should be reversible in the MVP.
- File operation errors should show clear messages.

Done when:

- A user can create, open, rename, duplicate, move, delete, and restore a Markdown note.
- The resulting files on disk match the visible app state.

## Phase 7: Folder Organization

Purpose:

Let users organize notes into folders from the sidebar.

Work:

- Render a collapsible folder tree.
- Create folders from a visible control.
- Rename folders from a context menu or inline action.
- Move notes into folders.
- Move folders when safe.
- Delete folders after confirmation.
- Refresh the workspace tree.

Detailed behavior:

- Folder actions must be limited to the active workspace.
- Deleting a non-empty folder should require confirmation.
- Folder tree state should remain understandable after creates, renames, moves, and deletes.

Done when:

- A user can organize notes with folders without leaving the app.
- Folder and note lists refresh after filesystem changes.

## Phase 8: Visual Markdown Editor

Purpose:

Build the primary writing surface: a formatted editor that saves valid Markdown.

Work:

- Render Markdown as editable formatted content.
- Convert editor DOM changes back into valid Markdown.
- Preserve Markdown structures such as headings, paragraphs, lists, task lists, links, images, blockquotes, inline code, code blocks, tables, and horizontal rules.
- Keep undo and redo usable.
- Preserve selection during edits where possible.
- Track word count, character count, and note dirty state.

Detailed behavior:

- The user should not need to switch between raw Markdown, preview, or split view for normal editing.
- The saved file must remain valid Markdown.
- The editor should handle normal paste behavior gracefully.
- Complex structures should degrade safely instead of corrupting note content.

Done when:

- A user can edit formatted note content directly.
- The app can save and reopen the note without losing basic Markdown structure.

## Phase 9: Toolbar And Editing Commands

Purpose:

Make Markdown formatting discoverable through visible controls.

Work:

- Add toolbar groups for headings, inline formatting, lists, block formatting, links, images, tables, and code.
- Add actions for H1 through H6.
- Add bold, italic, inline code, and blockquote actions.
- Add ordered list, unordered list, and checklist actions.
- Add table insertion and table editing controls.
- Add code block insertion and language selection.
- Add link insertion/editing through a dialog.
- Add image insertion through a file picker.
- Add keyboard shortcuts for common actions.

Detailed behavior:

- Toolbar actions should update the visual editor immediately.
- Link and image flows should use explicit dialogs, not browser prompts.
- Dialogs must restore the editor selection before applying changes.
- Table and code actions should target the active table or code block when one is selected.

Done when:

- A user can create and edit the common Markdown elements from `SPEC.md` using visible toolbar controls.
- Keyboard shortcuts and toolbar actions produce equivalent saved Markdown.

## Phase 10: Auto-Save And Safe Writes

Purpose:

Make editing feel automatic while protecting note data.

Work:

- Auto-save after a 500ms to 1000ms debounce.
- Show save states: unsaved changes, saving, saved, and save failed.
- Save with a safe-write flow where possible: write temporary file, flush, then rename.
- Prevent closing the app while a save is in progress without handling the pending write.
- Surface permission errors and disk write failures clearly.

Detailed behavior:

- Manual save via `Ctrl+S` or `Cmd+S` should still be supported.
- Save failure should not mark the note as saved.
- The status bar should always make the current save state visible.

Done when:

- A user can type, wait briefly, close the app, reopen it, and find the latest content saved.
- Failed saves remain visible and actionable.

## Phase 11: Search And Tags

Purpose:

Help users find notes quickly in a normal personal workspace.

Work:

- Build an in-memory index when the workspace opens.
- Index note title, path, body content, and YAML frontmatter tags.
- Update the index when notes are created, edited, renamed, moved, restored, or deleted.
- Search case-insensitively by default.
- Show title, path, and a short matching snippet.
- Open a note when a result is selected.
- Generate the tag list from existing notes.
- Filter notes by tag.

Detailed behavior:

- Search should update as the user types.
- Search should work well enough for small and medium workspaces.
- SQLite FTS or another search backend remains a future optimization.

Done when:

- A user can find notes by title, body content, and tag.
- Search results stay current after note changes.

## Phase 12: Import, Assets, Images, And Links

Purpose:

Support real note content that includes files, images, and external references.

Work:

- Import one or more `.md` files into the active workspace.
- Import a folder of `.md` files.
- Copy pasted or selected images into the workspace `assets/` folder.
- Generate collision-safe asset filenames.
- Insert image links as relative Markdown paths.
- Show placeholders for broken local images.
- Open external links in the default browser through the main process.
- Handle local links safely inside the app where possible.

Detailed behavior:

- The app should not link to arbitrary outside files when the user expects portable workspace assets.
- Relative asset links should keep notes usable when the workspace folder moves.
- External URLs should never open inside a privileged Electron context.

Done when:

- A user can import notes, add images, reopen the workspace, and still see valid relative image links.
- External links open safely outside the app.

## Phase 13: Export

Purpose:

Let users share notes outside InkNest.

Work:

- Export the current note as `.md`.
- Export the current note as `.html`.
- Export the current note as `.pdf`.
- Preserve readable formatting for headings, lists, tables, blockquotes, links, images, and code blocks.
- Report export failures with actionable messages.
- Validate export destinations.

Detailed behavior:

- Markdown export can copy or save the current `.md` content.
- HTML export should use sanitized rendered output.
- PDF export can use Electron print APIs once HTML rendering is stable.

Done when:

- A user can export a note to Markdown, HTML, and PDF.
- Exported documents preserve basic formatting and readable code/table output.

## Phase 14: Settings And Themes

Purpose:

Persist user preferences and make the app comfortable across sessions.

Work:

- Add settings persistence.
- Support theme choices: light, dark, and system.
- Support font size and font family preferences.
- Support auto-save delay preference.
- Support default workspace preference.
- Support line wrap on/off.
- Support word count visibility.
- Support sidebar visibility.

Detailed behavior:

- Settings should load before the main UI paints whenever possible.
- Theme preference should persist across restarts.
- System theme should follow the OS when selected.

Done when:

- A user can change settings, restart the app, and see those settings preserved.

## Phase 15: Reliability, Trash, And External Changes

Purpose:

Handle real filesystem behavior without surprising the user.

Work:

- Watch the active workspace for file changes.
- Reload externally changed files automatically when there are no local unsaved edits.
- Show a conflict warning when external changes collide with unsaved local edits.
- Mark externally deleted open notes as missing.
- Let the user reload from disk, keep their version, or save as a new note when conflicts happen.
- Support trash restore and permanent delete.
- Handle invalid frontmatter without making the note unreadable.

Detailed behavior:

- The app should never silently throw away local unsaved edits.
- External changes should be visible without forcing the user to restart.
- Trash behavior should be predictable and reversible until permanent delete.

Done when:

- External edit, external delete, permission denied, invalid frontmatter, and trash restore scenarios are handled with clear UI states.

## Phase 16: Accessibility, Keyboard Support, And UI Polish

Purpose:

Make the MVP feel complete and usable for repeated daily work.

Work:

- Add visible focus states.
- Add accessible labels for icon-only controls.
- Ensure sufficient light and dark theme contrast.
- Add keyboard navigation for core actions.
- Add command palette for important app commands after core flows are stable.
- Add status bar details: save state, word count, character count, current mode, and file path.
- Make layout responsive to narrow and wide desktop windows.
- Avoid text overlap in buttons, panels, and toolbar controls.

Detailed behavior:

- Common workflows should be discoverable and efficient.
- Toolbar actions should use familiar icons where possible.
- The app should remain quiet and work-focused rather than marketing-like.

Done when:

- Core actions are reachable by keyboard and visible controls.
- UI text fits cleanly across normal desktop window sizes.

## Phase 17: Release Validation

Purpose:

Confirm the MVP works end to end before packaging or calling it complete.

Work:

- Run unit tests for Markdown parsing, Markdown serialization, frontmatter parsing, filename generation, safe path validation, search indexing, settings persistence, and note creation logic.
- Run integration tests for creating, reading, saving, renaming, moving, deleting, restoring, importing, and exporting notes.
- Run Playwright flows for open app, select workspace, create note, edit note, verify saved Markdown, search note, rename note, export note, delete note, and restore note.
- Manually verify startup, theme switching, auto-save status, external links, image insertion, and export output.
- Package the app only after the MVP acceptance checklist passes.

Done when:

- MVP acceptance criteria pass.
- Basic E2E flows pass.
- The app can be packaged for the initial desktop target.

## Intended Preload API

The preload bridge should expose a small, typed API. Exact names may evolve, but the surface should stay narrow and validated.

```ts
window.inknest = {
  selectWorkspace(): Promise<WorkspaceInfo>;
  getRecentWorkspaces(): Promise<WorkspaceInfo[]>;
  openWorkspace(path: string): Promise<WorkspaceInfo>;

  listNotes(workspacePath: string): Promise<NoteSummary[]>;
  readNote(notePath: string): Promise<NoteContent>;
  createNote(input: CreateNoteInput): Promise<NoteSummary>;
  writeNote(input: WriteNoteInput): Promise<void>;
  renameNote(input: RenameNoteInput): Promise<NoteSummary>;
  duplicateNote(notePath: string): Promise<NoteSummary>;
  moveNote(input: MoveNoteInput): Promise<NoteSummary>;
  deleteNote(notePath: string): Promise<void>;
  restoreNote(notePath: string): Promise<NoteSummary>;

  createFolder(input: CreateFolderInput): Promise<void>;
  renameFolder(input: RenameFolderInput): Promise<void>;
  moveFolder(input: MoveFolderInput): Promise<void>;
  deleteFolder(folderPath: string): Promise<void>;

  loadSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;

  selectImage(): Promise<string | null>;
  openExternalLink(url: string): Promise<void>;
  exportNote(input: ExportNoteInput): Promise<void>;
};
```

## Core Data Shapes

```ts
type WorkspaceInfo = {
  name: string;
  path: string;
  noteCount: number;
  lastOpenedAt: string;
};

type NoteSummary = {
  id: string;
  title: string;
  path: string;
  relativePath: string;
  folderPath: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
};

type NoteContent = {
  summary: NoteSummary;
  content: string;
  frontmatter?: Record<string, unknown>;
};

type AppSettings = {
  theme: "light" | "dark" | "system";
  defaultEditorMode: "visual" | "preview";
  fontSize: number;
  fontFamily: string;
  autoSaveDelayMs: number;
  lastWorkspacePath?: string;
  showWordCount: boolean;
  lineWrap: boolean;
  showSidebar: boolean;
};
```

## Testing Plan

- For documentation-only changes like this file, verify that `PLAN.md` exists and that it reflects the MVP features, architecture, security requirements, and roadmap from `SPEC.md`.
- When app code is added later, use `npm run check` as the first lightweight validation command.
- Unit tests should cover Markdown parsing, Markdown serialization, frontmatter parsing, filename generation, safe path validation, search indexing, settings persistence, note creation logic, and save-state behavior.
- Integration tests should cover workspace selection, create/read/write note, rename note, move note, delete to trash, restore from trash, create folder, rename folder, import Markdown, add image asset, export HTML, and export PDF.
- E2E tests should cover the main user path from opening the app through creating, editing, saving, searching, exporting, deleting, and restoring a note.

## MVP Completion Checklist

- A user can select one workspace folder.
- A user can create, edit, rename, move, delete, and restore Markdown notes.
- Notes are saved as local `.md` files.
- The visual editor stores valid Markdown.
- Auto-save is visible and reliable.
- Search works across titles, content, and tags.
- Folders organize notes in the sidebar.
- Images are copied into workspace assets and referenced with relative paths.
- External links open safely in the default browser.
- HTML and PDF export work.
- Light, dark, and system themes work.
- Markdown output is rendered safely.
- Basic create, edit, save, search, export, delete, and restore flows are covered by tests.

## Future Versions

- Multi-workspace sessions.
- SQLite FTS or another scalable search backend.
- Backlinks and richer knowledge-management features.
- Mermaid diagrams, LaTeX math, footnotes, and frontmatter editing UI.
- Cloud sync and end-to-end encryption.
- Plugin system.
- AI assistant.
- Mobile or web companion apps.
