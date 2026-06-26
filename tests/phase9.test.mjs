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
    "markdown-toolbar",
    "toolbar-group",
    "toolbar-button-active",
    "commonColors",
    "activeColorCommand",
    "activeToolbarCommands",
    "color-palette",
    "color-swatch",
    "applyPaletteColor",
    "getToolbarGroups",
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
    "callout-note",
    "callout-warning",
    "callout-info",
    "callout-success",
    "unordered-list",
    "ordered-list",
    "task-list",
    "strikethrough",
    "inline-code",
    "clear-format",
    "highlight",
    "text-color",
    "background-color",
    "align-left",
    "align-center",
    "align-right",
    "code-block",
    "table",
    "table-add-row",
    "table-delete-row",
    "table-add-column",
    "table-delete-column",
    "table-align-left",
    "table-align-center",
    "table-align-right",
    "link-edit",
    "link-remove",
    "image-resize",
    "inline-math",
    "block-math",
    "math-edit",
    "divider",
    "Link URL",
    "Image URL or local path",
    "New link URL",
    "Image width in pixels",
    "LaTeX math"
  ]);
  assertIncludesAll(stylesSource, [
    ".markdown-toolbar",
    ".toolbar-group",
    ".toolbar-button",
    ".toolbar-button-active",
    ".color-palette",
    ".color-swatch",
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
    "applySlashCommandAtSelection",
    '"/heading": "heading-1"',
    '"/table": "table"',
    '"/code": "code-block"',
    '"/todo": "task-list"',
    '"/note": "callout-note"',
    '"/warning": "callout-warning"',
    '"/info": "callout-info"',
    '"/success": "callout-success"',
    '"/math": "block-math"',
    'command.startsWith("heading-")',
    'document.execCommand("formatBlock", false, `h${command.at(-1)}`)',
    'document.execCommand("bold")',
    'document.execCommand("strikeThrough")',
    "applyInlineStyleAtSelection",
    '"background-color", options.color ?? "#fef08a", "mark"',
    '"color", options.color ?? "#0f766e"',
    '"background-color", options.color ?? "#dbeafe"',
    'document.execCommand("justifyCenter")',
    'document.execCommand("insertUnorderedList")',
    'document.execCommand(shiftKey ? "outdent" : "indent")',
    'document.execCommand("removeFormat")',
    'document.execCommand("unlink")',
    'data-task="true"',
    "normalizeEmptyBlockAtSelection",
    "handleListKeyAtSelection",
    "moveTableSelection",
    "addTableRowAtSelection",
    "deleteTableRowAtSelection",
    "addTableColumnAtSelection",
    "deleteTableColumnAtSelection",
    "alignTableColumnAtSelection",
    "tableAlignmentSeparator",
    "parseTableAlignment",
    "listMarkdownToHtml",
    "blockquoteMarkdownToHtml",
    "data-callout",
    "codeBlockToHtml",
    "data-code-copy",
    "highlightCode",
    "data-language",
    "language-",
    "syntax-keyword",
    "isSelectionInsideCodeBlock",
    "insertCodeIndentAtSelection",
    "exitCurrentEditorBlock",
    "exitEditorBlockFromElement",
    "<table><tbody>",
    "htmlAlignedBlockToHtml",
    "restoreLimitedInlineHtml",
    "mark style",
    "restoreLimitedImageHtml",
    "editLinkAtSelection",
    "removeLinkAtSelection",
    "resizeImageAtSelection",
    "editMathAtSelection",
    "mathToHtml",
    "validateMath",
    "renderMathExpression",
    "math-invalid",
    "removeFormattingAtSelection",
    "insertHtmlAtSelection",
    "escapeAttribute"
  ]);
});

test("phase 9 editor styles cover highlighted and aligned text", async () => {
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(stylesSource, [
    ".visual-editor mark",
    "[style*=\"text-align: left\"]",
    "[style*=\"text-align: center\"]",
    "[style*=\"text-align: right\"]"
  ]);
});

test("phase 9 editor supports callouts, nested quotes, code language, and block escape", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    'event.key === "Enter"',
    "event.ctrlKey || event.metaKey",
    "exitCurrentEditorBlock()",
    "exitEditorBlockFromElement(target)",
    "event.altKey",
    'id: "code-block"'
  ]);
  assertIncludesAll(stylesSource, [
    ".visual-editor blockquote blockquote",
    "blockquote[data-callout=\"note\"]",
    "blockquote[data-callout=\"warning\"]",
    "blockquote[data-callout=\"info\"]",
    "blockquote[data-callout=\"success\"]",
    "code[data-language]:not([data-language=\"\"])::before",
    ".syntax-keyword",
    ".syntax-string",
    ".syntax-number"
  ]);
});

test("phase 9 editor supports list keyboard behavior and table editing", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    "savedSelectionRange",
    "rememberEditorSelection",
    "restoreEditorSelection",
    "onSelectionFormatChange",
    "collectActiveCommands",
    'event.key === "Backspace"',
    "normalizeEmptyBlockAtSelection()",
    'event.key === "Tab"',
    "moveTableSelection(!event.shiftKey)",
    "handleListKeyAtSelection(event.key, event.shiftKey)",
    "target instanceof HTMLInputElement",
    'target.type !== "checkbox"',
    "syncMarkdownFromEditor(editorRef.current)"
  ]);
  assertIncludesAll(stylesSource, [
    ".visual-editor li > ul",
    ".visual-editor li > ol",
    "th[data-align=\"center\"]",
    "td[data-align=\"right\"]"
  ]);
});

test("phase 9 editor supports links, images, and math while editing", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const editorSource = await readText("src/renderer/src/markdown-editor.ts");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    "window.inknest.links.openExternal",
    "target instanceof HTMLAnchorElement",
    "event.ctrlKey || event.metaKey",
    "target instanceof HTMLImageElement",
    "target.dataset.math",
    "x^2 + y^2 = z^2"
  ]);
  assertIncludesAll(editorSource, [
    "$$",
    "$${node.dataset.math}",
    "$${node.dataset.math}$",
    "data-math",
    "data-math-display",
    "width=\"${width}\"",
    "\\\\frac",
    "\\\\sqrt",
    "mathSymbols"
  ]);
  assertIncludesAll(stylesSource, [
    ".visual-editor img[width]",
    ".visual-editor .math-node",
    ".visual-editor .math-invalid",
    ".visual-editor .math-frac",
    ".visual-editor .math-sqrt::before"
  ]);
});

test("phase 9 editor supports code-friendly behavior and clearing formatting", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const editorSource = await readText("src/renderer/src/markdown-editor.ts");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    "insertCodeIndentAtSelection()",
    "isSelectionInsideCodeBlock()",
    'target.dataset.codeCopy === "true"',
    "navigator.clipboard?.writeText(code)"
  ]);
  assertIncludesAll(editorSource, [
    "codeBlockToHtml",
    "<pre><button",
    "contenteditable=\"false\"",
    "data-code-copy=\"true\"",
    "codeText.replace(/\\n$/, \"\")",
    "insertPlainTextAtSelection(\"  \")",
    "removeFormattingAtSelection"
  ]);
  assertIncludesAll(stylesSource, [
    ".visual-editor .code-copy-button",
    "white-space: pre",
    "tab-size: 2"
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
