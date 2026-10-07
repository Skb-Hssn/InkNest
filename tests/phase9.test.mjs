import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function assertIncludesAll(source, expectedValues) {
  for (const expectedValue of expectedValues) {
    assert.ok(source.includes(expectedValue), `Expected source to include: ${expectedValue}`);
  }
}

test("phase 9 app info reports the toolbar editing milestone", async () => {
  const sharedIpc = await readText("src/shared/ipc.ts");
  const appHandlerSource = await readText("src/main/ipc/app.ts");
  assert.match(sharedIpc, /phase-9-toolbar-editing-commands/);
  assert.match(appHandlerSource, /phase-9-toolbar-editing-commands/);
});

test("phase 9 renderer exposes the toolbar through a narrow editor handle", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const typesSource = await readText("src/renderer/src/editor/types.ts");
  const componentSource = await readText("src/renderer/src/editor/MarkdownEditor.tsx");

  assertIncludesAll(appSource, [
    "type ToolbarCommand", "Markdown toolbar", "toolbarPlaceholders",
    "toolbar-button-active", "LinkDialogState", "openLinkDialog",
    "submitLinkDialog", "removeLinkFromDialog", "activeToolbarCommands",
    "runToolbarCommand", "MarkdownEditorHandle", "editorHandleRef",
    "runCommand(command.id, options)", 'id: "bold"', 'id: "heading-1"',
    'id: "link"', 'id: "code-block"', 'id: "table"', 'id: "task-list"',
    'id: "clear-format"', 'id: "callout-note"'
  ]);
  assertIncludesAll(typesSource, [
    "MarkdownEditorCommand", "MarkdownEditorCommandOptions",
    "MarkdownEditorHandle", "runCommand", "getMarkdown"
  ]);
  assertIncludesAll(componentSource, [
    "useImperativeHandle", "runEditorCommand", "getEditorLinkDetails",
    "collectActiveEditorCommands"
  ]);
  assert.doesNotMatch(appSource, /from "node:fs"|from "fs"|from "electron"/);
  assert.doesNotMatch(appSource, /ipcRenderer|showOpenDialog/);
});

test("phase 9 editor commands dispatch schema transactions", async () => {
  const source = await readText("src/renderer/src/editor/editor-controller.ts");
  assertIncludesAll(source, [
    "runEditorCommand", "commandsCtx", "editorViewCtx", "runFormattingAction", "insertTableCommand",
    'runTableAction(view.state, view.dispatch, "add-row-after")',
    'runTableAction(view.state, view.dispatch, "add-column-after")',
    'runTableAction(view.state, view.dispatch, "delete-row")',
    'runTableAction(view.state, view.dispatch, "delete-column")', "replaceSelectionWithLink",
    "clear-format", "collectActiveEditorCommands", "getEditorMarkdown",
    "insertCodeIndent", "insertCodeLineBreak", "insertText(\"    \"",
    "const indentation = currentLine.match"
  ]);
  assert.doesNotMatch(source, /document\.execCommand|innerHTML\s*=/);
});

test("phase 9 extensions isolate slash commands and rich node behavior", async () => {
  const slash = await readText("src/renderer/src/editor/extensions/slash-command-plugin.ts");
  const callout = await readText("src/renderer/src/editor/extensions/callout-plugin.ts");
  const code = await readText("src/renderer/src/editor/extensions/code-block-view.ts");
  const highlight = await readText("src/renderer/src/editor/extensions/code-highlight-plugin.ts");
  const list = await readText("src/renderer/src/editor/extensions/list-item-view.ts");

  assertIncludesAll(slash, [
    "runSlashCommand", '"/heading"', '"/table"', '"/code"', '"/todo"',
    '"/note"', '"/warning"', "view.state.tr"
  ]);
  assertIncludesAll(callout, ["Decoration.node", "data-callout"]);
  assertIncludesAll(code, [
    "codeBlockView", "Code block language", "navigator.clipboard?.writeText",
    "setNodeMarkup"
  ]);
  assertIncludesAll(highlight, [
    "codeHighlightPlugin", "Decoration.inline", "syntax-keyword", "syntax-comment"
  ]);
  assertIncludesAll(list, ["listItemView", "dom.dataset.task", "setNodeMarkup"]);
});

test("phase 9 editor styling is scoped to the modular editor", async () => {
  const appStyles = await readText("src/renderer/src/styles.css");
  const editorStyles = await readText("src/renderer/src/editor/editor.css");
  assertIncludesAll(appStyles, [
    ".markdown-toolbar", ".toolbar-button-active", ".link-popover", ".toolbar-separator"
  ]);
  assertIncludesAll(editorStyles, [
    ".inknest-editor", "blockquote[data-callout=\"note\"]", ".syntax-keyword",
    ".syntax-string", ".syntax-number", ".syntax-comment", ".inknest-code-controls",
    ".inknest-editor table", "li[data-item-type=\"task\"]"
  ]);
  assert.doesNotMatch(appStyles + editorStyles, /\.visual-editor/);
});

test("phase 9 architecture document describes transactional toolbar commands", async () => {
  const archSource = await readText("ARCH.md");
  assertIncludesAll(archSource, [
    "Markdown Editor Rewrite: Transactional Architecture",
    "MarkdownEditor.runCommand(command, options)", "editor-controller.ts",
    "ProseMirror transactions", "tests/phase9.test.mjs"
  ]);
});

test("phase 9 e2e coverage exercises commands and saved Markdown", async () => {
  const source = await readText("tests/e2e/phase9.spec.ts");
  assertIncludesAll(source, [
    'name: "Visual Markdown editor"', 'name: "B", exact: true',
    'toolbarButton(window, "H3")', "toolbar-button-active",
    'name: "Code block", exact: true', 'name: "Code block language"',
    'await editor.press("Enter")', 'await editor.press("Tab")', "indented",
    'name: "Insert table", exact: true', 'toolbarButton(window, "Add table row")',
    'writeFile(notePath, "/todo\\n"', 'name: "Link", exact: true',
    "await link.dblclick()", 'name: "Save", exact: true',
    "readFile(notePath, \"utf8\")", "```typescript\\nconst value = 1;\\n    indented\\n    continued\\n```",
    "[Edited docs](https://example.com/edited)"
  ]);
});
