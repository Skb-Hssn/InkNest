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

  assert.match(appHandlerSource, /phase-5-workspace-file-model/);
});

test("phase 3 renderer defines the permanent three-column app layout", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");

  assertIncludesAll(appSource, [
    "grid-rows-[56px_minmax(0,1fr)_34px]",
    "grid-cols-[300px_minmax(320px,400px)_minmax(0,1fr)]",
    "workspacePath",
    "folderPlaceholders",
    "toolbarPlaceholders",
    "NotePlaceholder",
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
    "No search results",
    "Choose a local Markdown folder to begin.",
    "Search results will appear here after a workspace is indexed.",
    "Folder tree placeholder",
    "Folder tree preview",
    "Inbox",
    "Projects",
    "Archive"
  ]);
});

test("phase 3 notes sidebar contains note-list controls and placeholders", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");

  assertIncludesAll(appSource, [
    "Notes",
    "No folder selected",
    "Collapse notes list",
    "Sort notes",
    "Select a folder to list its Markdown notes.",
    "Note list placeholder",
    "Note list preview",
    "Untitled note",
    "Meeting notes",
    "Reading list",
    "Preview text will appear after notes are scanned.",
    "Markdown"
  ]);

  assert.match(appSource, /PanelRightClose/);
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
    "More editor actions",
    "No note selected",
    "Open or create a Markdown note to edit formatted content here.",
    "Open a local Markdown folder to begin",
    "Saved - 0 words - 0 characters"
  ]);
});

test("phase 3 renderer stays static and uses the preload boundary only", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const sharedIpcSource = await readText("src/shared/ipc.ts");

  assert.match(appSource, /window\.inknest\.app\.getInfo\(\)/);
  assert.match(appSource, /window\.inknest\.workspace\.getActive\(\)/);
  assert.doesNotMatch(appSource, /from "node:fs"|from "fs"|from "electron"/);
  assert.doesNotMatch(appSource, /window\.inknest\.(notes|settings|links|dialogs|export)\./);
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
    "note list column",
    "editor area",
    "status bar",
    "phase-5-workspace-file-model",
    "tests/phase3.test.mjs"
  ]);
});
