import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("phase 3 app info reports the static layout milestone", async () => {
  const appHandlerSource = await readText("src/main/ipc/app.ts");

  assert.match(appHandlerSource, /phase-3-static-layout/);
});

test("phase 3 renderer contains the permanent note-taking layout regions", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");

  for (const expectedText of [
    "Choose workspace",
    "Search notes",
    "New note",
    "New folder",
    "Folders",
    "No workspace selected",
    "No folder selected",
    "No note selected",
    "No search results",
    "Collapse notes list",
    "Untitled note",
    "Saved - 0 words - 0 characters"
  ]) {
    assert.match(appSource, new RegExp(expectedText));
  }

  assert.match(appSource, /toolbarPlaceholders/);
  assert.match(appSource, /workspacePath/);
  assert.match(appSource, /NotePlaceholder/);
  assert.doesNotMatch(appSource, /from "node:fs"|from "fs"|from "electron"/);
});

test("phase 3 styles define reusable controls for the static shell", async () => {
  const stylesSource = await readText("src/renderer/src/styles.css");

  for (const className of [
    ".secondary-button",
    ".tree-row",
    ".note-row",
    ".toolbar-button",
    ".status-pill"
  ]) {
    assert.match(stylesSource, new RegExp(className.replace(".", "\\.")));
  }
});
