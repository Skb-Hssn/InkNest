import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function assertIncludesAll(source, expectedValues) {
  for (const expectedValue of expectedValues) {
    assert.ok(
      source.includes(expectedValue),
      `Expected source to include: ${expectedValue}`
    );
  }
}

test("phase 3 app info reports the static layout milestone", async () => {
  const appHandlerSource = await readText("src/main/ipc/app.ts");

  assert.match(appHandlerSource, /phase-9-toolbar-editing-commands/);
});

test("phase 3 renderer defines the workspace-sidebar and editor layout", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");

  assertIncludesAll(appSource, [
    "grid-rows-[56px_minmax(0,1fr)_34px]",
    "grid-cols-[300px_minmax(0,1fr)]",
    "workspacePath",
    "rootFolder",
    "toolbarPlaceholders",
    "NoteRow",
    "EmptyState"
  ]);
});

test("phase 3 top bar exposes global app controls", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");

  assertIncludesAll(appSource, [
    "InkNest",
    "No workspace",
    "Toggle sidebar",
    "New note",
    "New folder",
    "Settings"
  ]);
});

test("phase 3 workspace sidebar contains workspace, search, folders, and empty states", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");

  assertIncludesAll(appSource, [
    "Choose workspace",
    "Local Markdown folder",
    "Search notes",
    "Folders",
    "Filter folders",
    "No workspace selected",
    "Choose a local Markdown folder to begin.",
    "Folder tree",
    "Workspace root"
  ]);
});

test("phase 3 workspace sidebar contains folders and nested note controls", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");

  assertIncludesAll(appSource, [
    "Notes",
    "Sort notes",
    "No matching notes",
    "Untitled note",
    "Trash",
    "Trash is empty."
  ]);

  assert.match(appSource, /folder-notes|renderNote/);
  assert.match(appSource, /hasExpandableContent = hasChildren \|\| node\.notes\.length > 0/);
  assert.match(appSource, /onSelect\(node\.path\);[\s\S]*onToggle\(node\.path\)/);
  assert.doesNotMatch(appSource, /title="No notes here"/);
  assert.doesNotMatch(appSource, /"Workspace root"\s*\}/);
  assert.doesNotMatch(appSource, /notes-sidebar|data-notes-sidebar|isNotesListVisible/);
});

test("phase 3 editor area contains file, toolbar, note, and status placeholders", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");

  assertIncludesAll(appSource, [
    "Untitled note",
    "No file selected",
    "Saved",
    "H1",
    "B",
    "I",
    "List",
    "Link",
    "Image",
    "Note title",
    "event.key === \"Enter\"",
    "Duplicate",
    "Move",
    "Delete",
    "No note selected",
    "Open or create a Markdown note to inspect its saved content here.",
    "Open a local Markdown folder to begin",
    "{saveStatusLabel} - {wordCount} words - {characterCount} characters"
  ]);
});

test("phase 3 renderer uses the preload boundary only", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const editorSource = await readText("src/renderer/src/editor/create-editor.ts");
  const sharedIpcSource = await readText("src/shared/ipc.ts");

  assert.match(appSource, /window\.inknest\.app\.getInfo\(\)/);
  assert.match(appSource, /window\.inknest\.workspace\.getActive\(\)/);
  assert.match(appSource, /window\.inknest\.notes\.read/);
  assert.match(editorSource, /window\.inknest\.links\.openExternal/);
  assert.match(appSource, /window\.inknest\.export\.note/);
  assert.doesNotMatch(appSource, /from "node:fs"|from "fs"|from "electron"/);
  assert.match(appSource, /window\.inknest\.settings\.get\(\)/);
  assert.doesNotMatch(appSource, /ipcRenderer|shell\.openExternal/);
  assert.doesNotMatch(sharedIpcSource, /phase-3/);
});

test("phase 3 styles define reusable controls with stable dimensions", async () => {
  const stylesSource = await readText("src/renderer/src/styles.css");
  const appSource = await readText("src/renderer/src/App.tsx");

  assertIncludesAll(stylesSource, [
    ".secondary-button",
    ".tree-row",
    ".recent-workspace-row",
    ".note-row",
    ".toolbar-button",
    ".status-pill",
    "h-8",
    "min-w-8",
    "h-7",
    "shrink-0"
  ]);
  assert.match(appSource, /truncate/);
});

test("phase 3 architecture document describes the static layout layer", async () => {
  const archSource = await readText("ARCH.md");

  assertIncludesAll(archSource, [
    "Phase 3 Architecture: Static Application Layout",
    "top bar",
    "left sidebar",
    "Notes are nested under their folders",
    "editor area",
    "status bar",
    "phase-9-toolbar-editing-commands",
    "tests/phase3.test.mjs"
  ]);
});
