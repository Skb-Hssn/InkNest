# SPEC.md — Markdown Note Editor

## 1. Product Overview

### 1.1 Product Name

**Working name:** InkNest

### 1.2 Product Summary

Markdown Notes is a local-first desktop note-taking application for writing, organizing, searching, and exporting Markdown notes. The app is designed for developers, students, writers, and knowledge workers who want fast writing, plain-text ownership, and a clean editing experience.

The app stores notes as standard `.md` files so users are not locked into a proprietary format. It should work fully offline, support live Markdown preview, and provide a simple but powerful organization system using folders, tags, and search.

### 1.3 Target Platforms

Initial target:

- Desktop Linux
- Desktop Windows
- Desktop macOS

Recommended stack:

- Electron
- React
- TypeScript
- Local filesystem storage

Mobile and web versions are out of scope for the initial release.

---

## 2. Goals and Non-Goals

### 2.1 Goals

The application should:

1. Allow users to create, edit, delete, rename, and organize Markdown notes.
2. Store notes as plain `.md` files on the local filesystem.
3. Provide a smooth Markdown editing experience with live preview.
4. Support fast search across note titles and note contents.
5. Auto-save changes without interrupting the user.
6. Support folders or workspaces for organizing notes.
7. Provide a clean, distraction-free interface.
8. Support dark and light themes.
9. Export notes to useful formats such as HTML and PDF.
10. Be usable offline without requiring an account.

### 2.2 Non-Goals for MVP

The first version should not include:

1. Real-time collaboration.
2. Cloud sync.
3. Mobile applications.
4. Plugin marketplace.
5. AI writing assistant.
6. Web publishing.
7. End-to-end encrypted cloud storage.
8. Multi-user accounts.
9. Complex graph visualization.
10. Full Obsidian-level knowledge management.

These may be added in future versions.

---

## 3. Target Users

### 3.1 Developer

A developer wants to take programming notes, save code snippets, write technical documentation, and keep notes in a Git-friendly format.

Needs:

- Code block syntax highlighting
- Plain Markdown files
- Fast search
- Keyboard shortcuts
- Local storage
- Export to HTML/PDF
- Folder-based organization
- Search
- Simple formatting
- Export to PDF
- Dark mode
- Focus mode
- Word count
- Clean typography
- Auto-save
- Markdown preview



## 4. Core User Stories

### 4.1 Note Creation

As a user, I want to create a new note so that I can quickly capture an idea.

Acceptance criteria:

- User can create a new note from a button or keyboard shortcut.
- A default title is generated if the user does not provide one.
- A new `.md` file is created in the selected folder.
- The note opens immediately in the editor.

### 4.2 Visual Markdown Editing

As a user, I want to edit notes in a formatted Markdown view so that I can write rich notes without typing raw Markdown syntax.

Acceptance criteria:

* User can edit the note directly in a formatted Markdown editor.
* User does not need to switch between raw Markdown, preview mode, or split view.
* The editor displays formatted content while the user is writing.
* User can create and edit common Markdown elements such as headings, bold text, italic text, lists, links, images, tables, blockquotes, code blocks, and checklists.
* User can use toolbar buttons or shortcut actions to apply Markdown formatting.
* The note is auto-saved after changes.
* User can undo and redo edits.
* The underlying note content is stored as valid Markdown.
* Formatting changes made in the visual editor are correctly converted to Markdown in the stored file.

### 4.3 Markdown Formatting Toolbar

As a user, I want to use buttons for common Markdown actions so that I can format notes easily without remembering Markdown syntax.

Acceptance criteria:

* User can apply headings using toolbar buttons.
* User can apply bold, italic, inline code, and blockquote formatting.
* User can create ordered lists, unordered lists, and checklists.
* User can insert links and images.
* User can insert code blocks and tables.
* Toolbar actions update the formatted editor content immediately.
* Toolbar actions preserve valid Markdown output in the stored note.

### 4.4 Note Organization

As a user, I want to organize notes into folders so that I can keep related notes together.

Acceptance criteria:

- User can create folders.
- User can move notes between folders.
- User can rename folders.
- User can delete folders after confirmation.
- Folder tree is shown in the sidebar.

### 4.5 Search

As a user, I want to search notes by title and content so that I can find information quickly.

Acceptance criteria:

- Search input is available in the sidebar or command palette.
- Search matches note titles.
- Search matches note body content.
- Results show note title and a short matching preview.
- Clicking a result opens the note.

### 4.6 Export

As a user, I want to export notes so that I can share them outside the app.

Acceptance criteria:

- User can export a note to HTML.
- User can export a note to PDF.
- Exported document preserves basic formatting.
- Code blocks and tables are readable in exported output.

### 4.7 Theme Switching

As a user, I want dark and light themes so that I can use the app comfortably.

Acceptance criteria:

- User can switch between light mode and dark mode.
- User can choose to follow system theme.
- Theme preference persists across app restarts.

---

## 5. Functional Requirements

## 5.1 Workspace Management

A workspace is a root folder selected by the user. All notes and folders are stored inside the workspace.

Requirements:

- User can select a local folder as workspace.
- User can create a new workspace folder.
- App remembers recently opened workspaces.
- App opens the last used workspace on startup if available.
- App should not modify files outside the selected workspace.

## 5.2 Notes

Requirements:

- Notes are stored as `.md` files.
- User can create a note.
- User can rename a note.
- User can delete a note.
- User can duplicate a note.
- User can move a note to another folder.
- User can open multiple notes during one session.
- Notes should support Unicode text.
- Notes should preserve line endings and formatting.

## 5.3 Editor

Requirements:

- Markdown syntax highlighting.
- Auto-save.
- Undo and redo.
- Keyboard shortcuts.
- Find within current note.
- Find and replace within current note.
- Word count.
- Character count.
- Line numbers can be optional.
- Soft wrap toggle.

Recommended editor library:

- CodeMirror 6, or
- Monaco Editor

CodeMirror is preferred for a lightweight Markdown-focused editor.

## 5.4 Markdown Support

The editor and preview should support:

- Headings: `#`, `##`, `###`
- Bold and italic
- Ordered lists
- Unordered lists
- Task lists: `- [ ]` and `- [x]`
- Links
- Images
- Blockquotes
- Inline code
- Fenced code blocks
- Tables
- Horizontal rules

Optional for v2:

- Mermaid diagrams
- LaTeX math
- Footnotes
- Frontmatter

## 5.5 Preview Modes

Requirements:

- Edit-only mode.
- Preview-only mode.
- External links should open in the default browser.
- Local links should open safely inside the app when possible.

## 5.6 Sidebar

The sidebar should contain:

- Workspace name
- Folder tree
- Note list
- Search box
- New note button
- New folder button

Requirements:

- User can collapse and expand folders.
- User can select a note from the list.
- User can rename notes and folders from context menu.
- User can delete notes and folders from context menu.
- User can refresh workspace file tree.

## 5.7 Tags

MVP approach:

- Tags are optional.
- Tags can be stored in YAML frontmatter or app metadata.

Recommended MVP implementation:

Use YAML frontmatter:

```md
---
tags: [system-design, interview, database]
createdAt: 2026-06-24T00:00:00.000Z
updatedAt: 2026-06-24T00:00:00.000Z
---
```

Requirements:

- User can add tags to a note.
- User can remove tags from a note.
- User can filter notes by tag.
- Tag list is generated from existing notes.

Tags may be moved to a separate metadata database later if needed.

## 5.8 Search

Requirements:

- Search note title.
- Search note content.
- Search tags.
- Search should be case-insensitive by default.
- Search result should show title, path, and matching snippet.
- Search should update as the user types.

MVP implementation:

- Build an in-memory index when workspace opens.
- Update index when note changes.
- For small to medium workspaces, a simple text index is enough.

Future implementation:

- Use SQLite FTS5 or a local search library for large workspaces.

## 5.9 Auto-Save

Requirements:

- Notes auto-save after a short debounce period.
- Recommended debounce: 500ms to 1000ms.
- Saving status should be visible to the user.
- Possible statuses:
  - Saved
  - Saving
  - Unsaved changes
  - Save failed
- App should prevent data loss during close.
- If save fails, user should see a clear error.

## 5.10 Trash and Delete Behavior

Requirements:

- Deleting a note should ask for confirmation.
- MVP can move deleted notes to an internal `.trash` folder.
- User can restore notes from trash.
- User can permanently delete notes from trash.

Alternative:

- Use operating system trash if reliable cross-platform support is available.

## 5.11 Import and Export

Import requirements:

- User can import `.md` files.
- User can import a folder of `.md` files.

Export requirements:

- Export current note as `.md`.
- Export current note as `.html`.
- Export current note as `.pdf`.

Future export options:

- Export workspace as ZIP.
- Export selected folder as ZIP.

## 5.12 Settings

Settings should include:

- Theme: light, dark, system.
- Font size.
- Font family.
- Auto-save delay.
- Default workspace.
- Line wrap on/off.
- Show/hide word count.
- Show/hide sidebar.

Settings should persist across app restarts.

---

## 6. Non-Functional Requirements

## 6.1 Performance

Requirements:

- App should launch quickly.
- Opening a note should feel instant for normal note sizes.
- Search should return results quickly for typical personal workspaces.
- App should handle at least 5,000 Markdown notes in one workspace.
- App should handle individual notes up to at least 5 MB.

Performance targets:

- App startup: under 3 seconds on a typical laptop.
- Note open time: under 300ms for normal notes.
- Search response: under 500ms for 5,000 notes after indexing.

## 6.2 Reliability

Requirements:

- Auto-save should not corrupt notes.
- Save operation should use safe write behavior where possible.
- App should recover gracefully after crash.
- App should not lose unsaved changes silently.
- File watcher should handle external file changes.

Safe write recommendation:

1. Write content to a temporary file.
2. Flush the write.
3. Rename temporary file to target file.

## 6.3 Security

Requirements:

- App should not execute scripts from Markdown preview.
- HTML rendered from Markdown should be sanitized.
- External links should open in browser, not inside privileged Electron context.
- Electron renderer should not have direct unrestricted Node.js access.
- Use context isolation.
- Disable remote module.
- Use a secure preload bridge.

Electron security requirements:

- `contextIsolation: true`
- `nodeIntegration: false`
- Validate all IPC inputs
- Restrict filesystem access to selected workspace
- Sanitize Markdown preview HTML

## 6.4 Privacy

Requirements:

- App should work without account creation.
- App should not collect analytics by default.
- Notes should remain local unless user explicitly enables sync in future versions.
- App should clearly explain where notes are stored.

## 6.5 Accessibility

Requirements:

- Keyboard navigation for core actions.
- Visible focus states.
- Sufficient color contrast.
- Screen-reader-friendly labels for buttons and controls.
- Font size should be adjustable.

---

## 7. Suggested Technical Architecture

## 7.1 High-Level Architecture

```text
+-----------------------------+
|        Electron App         |
+-----------------------------+
| Main Process                |
| - Window management         |
| - Filesystem access         |
| - Native dialogs            |
| - Export handling           |
+-----------------------------+
          ^
          | Secure IPC bridge
          v
+-----------------------------+
| Renderer Process            |
| - React UI                  |
| - Preview Editor            |
| - Sidebar                   |
| - Search UI                 |
+-----------------------------+
          ^
          | App services
          v
+-----------------------------+
| Local Application Services  |
| - Note service              |
| - Workspace service         |
| - Search index service      |
| - Settings service          |
| - Export service            |
+-----------------------------+
          ^
          | Local filesystem
          v
+-----------------------------+
| Workspace Folder            |
| - .md notes                 |
| - folders                   |
| - assets                    |
| - metadata                  |
+-----------------------------+
```

## 7.2 Recommended Project Structure

```text
markdown-notes/
  package.json
  electron.vite.config.ts
  src/
    main/
      index.ts
      ipc/
        noteIpc.ts
        workspaceIpc.ts
        settingsIpc.ts
      services/
        fileSystemService.ts
        exportService.ts
    preload/
      index.ts
    renderer/
      main.tsx
      App.tsx
      components/
        Sidebar/
        Editor/
        Preview/
        CommandPalette/
        SettingsModal/
      features/
        notes/
        workspace/
        search/
        settings/
        export/
      stores/
        noteStore.ts
        workspaceStore.ts
        settingsStore.ts
      utils/
        markdown.ts
        frontmatter.ts
        paths.ts
  tests/
    unit/
    e2e/
```

## 7.3 Main Process Responsibilities

The Electron main process should handle:

- Reading files.
- Writing files.
- Creating folders.
- Deleting files.
- Renaming files.
- Moving files.
- Opening native file dialogs.
- Managing application windows.
- Exporting PDF if using Electron print APIs.

## 7.4 Renderer Process Responsibilities

The renderer process should handle:

- UI rendering.
- Editor interactions.
- Markdown preview.
- Search input and result display.
- Settings UI.
- Command palette.
- State management.

## 7.5 IPC API Design

The renderer should communicate with the main process through a small, typed API exposed by the preload script.

Example API shape:

```ts
window.notesApi = {
  selectWorkspace(): Promise<WorkspaceInfo>;
  listNotes(workspacePath: string): Promise<NoteSummary[]>;
  readNote(notePath: string): Promise<NoteContent>;
  writeNote(notePath: string, content: string): Promise<void>;
  createNote(input: CreateNoteInput): Promise<NoteSummary>;
  renameNote(input: RenameNoteInput): Promise<void>;
  deleteNote(notePath: string): Promise<void>;
  createFolder(input: CreateFolderInput): Promise<void>;
  exportNote(input: ExportNoteInput): Promise<void>;
};
```

All IPC handlers should validate input before performing filesystem operations.

---

## 8. Data Model

## 8.1 NoteSummary

```ts
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
```

## 8.2 NoteContent

```ts
type NoteContent = {
  summary: NoteSummary;
  content: string;
  frontmatter?: Record<string, unknown>;
};
```

## 8.3 WorkspaceInfo

```ts
type WorkspaceInfo = {
  name: string;
  path: string;
  noteCount: number;
  lastOpenedAt: string;
};
```

## 8.4 AppSettings

```ts
type AppSettings = {
  theme: 'light' | 'dark' | 'system';
  defaultEditorMode: 'edit' | 'preview' | 'split';
  fontSize: number;
  fontFamily: string;
  autoSaveDelayMs: number;
  lastWorkspacePath?: string;
  showWordCount: boolean;
  lineWrap: boolean;
};
```

---

## 9. UI Layout

## 9.1 Main Layout

```text
+-------------------------------------------------------------+
| Top Bar: workspace, search, command palette, settings        |
+-------------+----------------------+------------------------+
| Folder Tree | Note List            |    Preview Editor      |
|             |                      |                        |
|             |                      |                        |
+-------------+----------------------+------------------------+
| Status Bar: save status, word count, cursor position         |
+-------------------------------------------------------------+
```

## 9.2 Main UI Areas

### Sidebar

Contains:

- Workspace switcher
- Folder tree
- New note button
- New folder button

### Note List

Contains:

- Notes in selected folder
- Search results when search is active
- Recent notes
- Pinned notes in future versions

### Editor Area

Contains:

- Markdown editor
- Preview pane
- Split view toggle
- Editor toolbar

### Status Bar

Contains:

- Save status
- Word count
- Character count
- Current mode
- Current file path

---

## 10. Keyboard Shortcuts

Required shortcuts:

| Action          | Shortcut                                   |
| --------------- | ------------------------------------------ |
| New note        | `Ctrl+N` / `Cmd+N`                     |
| Save note       | `Ctrl+S` / `Cmd+S`                     |
| Search notes    | `Ctrl+P` / `Cmd+P`                     |
| Find in note    | `Ctrl+F` / `Cmd+F`                     |
| Toggle preview  | `Ctrl+Shift+V` / `Cmd+Shift+V`         |
| Toggle sidebar  | `Ctrl+B` / `Cmd+B`                     |
| Command palette | `Ctrl+Shift+P` / `Cmd+Shift+P`         |
| Bold            | `Ctrl+B` / `Cmd+B` when editor focused |
| Italic          | `Ctrl+I` / `Cmd+I`                     |
| Insert link     | `Ctrl+K` / `Cmd+K`                     |

Note: shortcut conflicts should be handled carefully depending on focus context.

---

## 11. Markdown Rendering Rules

Requirements:

- Markdown should be converted to safe HTML.
- Raw HTML should either be disabled or sanitized.
- Code blocks should use syntax highlighting.
- Links should be sanitized.
- Images should support relative paths inside the workspace.
- Broken images should show a placeholder.

Recommended libraries:

- `remark`
- `rehype`
- `react-markdown`
- `rehype-sanitize`
- `remark-gfm`
- `highlight.js` or `shiki`

---

## 12. File Storage Rules

## 12.1 Workspace Folder

Example workspace:

```text
My Notes/
  Projects/
    markdown-editor.md
    system-design.md
  Study/
    database-indexing.md
  assets/
    image-001.png
  .markdown-notes/
    settings.json
    index.json
    trash/
```

## 12.2 File Naming

Requirements:

- New note filename should be generated from title.
- Invalid filename characters should be removed or replaced.
- Duplicate names should be handled by appending a number.

Example:

```text
Untitled.md
Untitled 2.md
System Design.md
System Design 2.md
```

## 12.3 Assets

Requirements:

- Images pasted into notes should be stored in an `assets/` folder.
- Image links should use relative paths.
- Asset filenames should avoid collisions.

Example:

```md
![Architecture diagram](../assets/architecture-diagram-2026-06-24.png)
```

---

## 13. Error Handling

The app should handle:

- Workspace folder missing.
- Note file deleted outside the app.
- Note modified outside the app.
- Permission denied while reading or writing.
- Invalid Markdown frontmatter.
- Failed export.
- Failed image paste.
- File name conflict.

User-facing errors should be clear and actionable.

Example messages:

- `This note was changed outside the app. Do you want to reload it or keep your version?`
- `The app does not have permission to save this file.`
- `Export failed. Please check the destination folder and try again.`

---

## 14. External File Changes

Requirements:

- App should watch the workspace for file changes.
- If a file changes externally and has no unsaved local edits, reload it automatically.
- If a file changes externally and the user has unsaved edits, show a conflict warning.
- If a file is deleted externally, mark it as missing and prompt the user.

---

## 15. Testing Plan

## 15.1 Unit Tests

Test:

- Markdown parsing.
- Frontmatter parsing.
- File name generation.
- Search indexing.
- Settings persistence.
- Note creation logic.
- Safe path validation.

## 15.2 Integration Tests

Test:

- Create note and save to filesystem.
- Rename note.
- Move note between folders.
- Delete note to trash.
- Restore note from trash.
- Import Markdown file.
- Export note to HTML/PDF.

## 15.3 E2E Tests

Recommended tool:

- Playwright

Test flows:

1. Open app and select workspace.
2. Create a new note.
3. Type Markdown content.
4. Verify live preview.
5. Search for the note.
6. Rename the note.
7. Export the note.
8. Delete and restore the note.

---

## 16. MVP Scope

The MVP should include:

1. Desktop app shell using Electron.
2. Workspace selection.
3. Folder tree.
4. Note list.
5. Create, edit, rename, delete notes.
6. Markdown editor.
7. Live preview.
8. Split view.
9. Auto-save.
10. Search by title and content.
11. Dark and light themes.
12. Export to HTML.
13. Export to PDF.
14. Basic settings persistence.
15. Safe Markdown rendering.

---

## 17. Version Roadmap

## 17.1 Version 0.1 — Basic Editor

- Electron app setup.
- Workspace selection.
- Create and edit `.md` notes.
- Auto-save.
- Basic Markdown preview.

## 17.2 Version 0.2 — Organization

- Folder tree.
- Note list.
- Rename and delete notes.
- Search by title and content.
- Settings persistence.

## 17.3 Version 0.3 — Better Writing Experience

- Markdown toolbar.
- Word count.
- Find and replace.
- Dark/light/system theme.

## 17.4 Version 0.4 — Export and Assets

- Export to HTML.
- Export to PDF.
- Paste image from clipboard.
- Drag-and-drop image support.

## 17.5 Version 0.5 — Power User Features

- Tags.
- Backlinks.
- Command palette.
- Mermaid diagrams.
- LaTeX math.

## 17.6 Future Versions

- Cloud sync.
- End-to-end encryption.
- Mobile app.
- Plugin system.
- AI assistant.
- Publishing.

---

## 18. Acceptance Criteria for MVP Release

The MVP is considered complete when:

1. A user can select a workspace folder.
2. A user can create a Markdown note.
3. A user can edit the note and see live preview.
4. The note is saved as a `.md` file locally.
5. A user can close and reopen the app without losing notes.
6. A user can search notes by title and content.
7. A user can organize notes using folders.
8. A user can export a note to HTML or PDF.
9. Dark and light themes work.
10. The app does not execute unsafe HTML from Markdown preview.
11. Basic E2E tests pass for create, edit, save, search, export, and delete flows.

---

## 19. Open Questions

1. Should the app support multiple workspaces at once or only one active workspace?
2. Should tags be stored in frontmatter or in a separate metadata file?
3. Should deleted notes go to OS trash or app-level trash?
4. Should the editor be CodeMirror or Monaco?
5. Should the app include WYSIWYG editing in the first version?
6. Should images be copied into the workspace automatically or linked from their original location?
7. Should Markdown raw HTML be fully disabled or sanitized?
8. Should search use simple indexing first or SQLite FTS from the beginning?

---

## 20. Recommended Initial Tech Stack

Recommended MVP stack:

- **Desktop shell:** Electron
- **Build tool:** Vite
- **Language:** TypeScript
- **UI:** React
- **Editor:** CodeMirror 6
- **Markdown rendering:** remark, rehype, react-markdown
- **Markdown extensions:** remark-gfm
- **HTML sanitization:** rehype-sanitize
- **State management:** Zustand or Redux Toolkit
- **Styling:** Tailwind CSS
- **Testing:** Vitest and Playwright
- **Packaging:** electron-builder

---

## 21. Development Principles

1. Local-first by default.
2. Plain files over proprietary storage.
3. Fast startup and fast editing.
4. Safe Markdown rendering.
5. Small, typed IPC surface.
6. Good keyboard support.
7. Simple MVP before advanced features.
8. Avoid vendor lock-in.
9. Respect user privacy.
10. Keep the app useful even without internet.
