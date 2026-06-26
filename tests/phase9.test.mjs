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

test("phase 9 app info reports the toolbar editing milestone", async () => {
  const sharedIpc = await readText("src/shared/ipc.ts");
  const appHandlerSource = await readText("src/main/ipc/app.ts");

  assert.match(sharedIpc, /phase-9-toolbar-editing-commands/);
  assert.match(appHandlerSource, /phase-9-toolbar-editing-commands/);
});

test("phase 9 renderer exposes real toolbar commands", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    "type ToolbarCommand",
    "Markdown toolbar",
    "flex h-11 items-center gap-1 overflow-x-auto border-b border-ink-100 px-4",
    "runToolbarCommand",
    "onMouseDown={(event) => event.preventDefault()}",
    "VisualMarkdownEditorHandle",
    "editorHandleRef",
    "runCommand(command.id, options)",
    "heading-1",
    "heading-2",
    "heading-3",
    "heading-4",
    "heading-5",
    "heading-6",
    "unordered-list",
    "ordered-list",
    "task-list",
    "strikethrough",
    "inline-code",
    "code-block",
    "table",
    "divider",
    "Link URL",
    "Image URL or local path"
  ]);
  assertIncludesAll(stylesSource, [
    ".toolbar-button",
    ".toolbar-separator"
  ]);
  assert.doesNotMatch(appSource, /from "node:fs"|from "fs"|from "electron"/);
  assert.doesNotMatch(appSource, /ipcRenderer|showOpenDialog/);
});

test("phase 9 markdown editor helper applies formatting commands", async () => {
  const editorSource = await readText("src/renderer/src/markdown-editor.ts");

  assertIncludesAll(editorSource, [
    "MarkdownEditorCommand",
    "MarkdownEditorCommandOptions",
    "applyMarkdownEditorCommand",
    'command.startsWith("heading-")',
    'document.execCommand("formatBlock", false, `h${command.at(-1)}`)',
    'document.execCommand("bold")',
    'document.execCommand("strikeThrough")',
    'document.execCommand("insertUnorderedList")',
    'data-task="true"',
    "<table><tbody>",
    "insertHtmlAtSelection",
    "escapeAttribute"
  ]);
});

test("phase 9 architecture document describes toolbar commands", async () => {
  const archSource = await readText("ARCH.md");

  assertIncludesAll(archSource, [
    "Phase 9 Architecture: Toolbar And Editing Commands",
    "toolbarPlaceholders",
    "VisualMarkdownEditor.runCommand(command, options)",
    "applyMarkdownEditorCommand",
    "editorDomToMarkdown",
    "tests/phase9.test.mjs"
  ]);
});
