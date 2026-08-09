# InkNest MVP Release Checklist

Phase 17 is the release-validation gate for the local-first Markdown MVP.

## Automated gate

Run the complete release check from the repository root:

```sh
npm ci
npm run release-check
```

The command runs:

- `npm run check` for the scaffold, unit, and TypeScript checks.
- `npm run package` for the production Electron/Vite build.
- `npm run test:e2e` for the Electron acceptance suite.

The E2E suite covers startup, workspace selection and restore, note creation,
editing, saving, searching, renaming, importing, exporting, deleting,
restoring, external changes, settings, keyboard access, and responsive layout.

## MVP acceptance criteria

- [x] Notes remain plain Markdown files in the selected local workspace.
- [x] Renderer filesystem access is restricted to the typed preload bridge.
- [x] Workspace and note paths are validated inside the active workspace.
- [x] Safe writes, autosave, and close handling preserve pending note changes.
- [x] Search covers note titles, content, and frontmatter tags.
- [x] Local images, links, Markdown, HTML, and PDF export have safe handling.
- [x] Settings persist across restarts and support light, dark, and system themes.
- [x] External edits, deletion, missing workspaces, and trash recovery have
      actionable UI states.
- [x] Core actions are keyboard reachable with visible focus treatment.
- [x] The app remains usable at narrow and wide desktop window sizes.

## Manual smoke checks

Before packaging a user-facing build, verify on the target desktop environment:

1. Start the app with `npm run dev` and select a new empty workspace.
2. Switch between light, dark, and system themes.
3. Create and edit a note, wait for autosave, then restart the app.
4. Open an external `http`/`https` link and confirm it uses the system browser.
5. Insert a workspace image and confirm the portable asset is stored under
   `asset/`.
6. Export Markdown, HTML, and PDF and open each generated file.
7. Edit or delete the open Markdown file outside InkNest and verify the
   conflict actions preserve local content.
