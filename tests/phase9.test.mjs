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
    "toolbar-shell",
    "LinkDialogState",
    "linkDialog",
    "openLinkDialog",
    "submitLinkDialog",
    "removeLinkFromDialog",
    "getLinkDetails",
    "onLinkDialogRequest",
    "activeToolbarCommands",
    "tableActionIcon",
    "TableRowsSplit",
    "TableColumnsSplit",
    "TableProperties",
    "CirclePlus",
    "CircleMinus",
    "toolbar-composite-icon",
    "toolbar-composite-badge",
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
    "code-block",
    "table",
    "Insert table",
    "table-add-row",
    "table-delete-row",
    "table-add-column",
    "table-delete-column",
    'id: "link"',
    "link-popover",
    "link-popover-field",
    "link-popover-primary",
    "link-popover-remove",
    "window.inknest.dialogs.selectImage",
    "divider",
    "LaTeX math"
  ]);
  assert.ok(
    appSource.indexOf('id: "bold"') < appSource.indexOf('id: "heading-1"'),
    "Expected common inline formatting tools to appear before headings"
  );
  assert.ok(
    appSource.indexOf('id: "link"') < appSource.indexOf('id: "code-block"'),
    "Expected link and media tools to appear before code and table tools"
  );
  assert.ok(
    appSource.indexOf('id: "code-block"') < appSource.indexOf('id: "callout-note"'),
    "Expected code and table tools to appear before callout tools"
  );
  assertIncludesAll(stylesSource, [
    ".markdown-toolbar",
    ".toolbar-group",
    ".toolbar-button",
    ".toolbar-button-active",
    ".toolbar-composite-icon",
    ".toolbar-composite-badge",
    ".toolbar-shell",
    ".link-popover",
    ".link-popover-field",
    ".link-popover-actions",
    ".link-popover-primary",
    ".link-popover-secondary",
    ".link-popover-remove",
    ".code-language-select",
    ".toolbar-separator"
  ]);
  assert.doesNotMatch(appSource, /label: "Edit link"|label: "Remove link"/);
  assert.doesNotMatch(
    appSource,
    /highlight|text-color|background-color|activeColorCommand|colorSelections|color-palette/
  );
  assert.doesNotMatch(
    stylesSource,
    /toolbar-button-color-selected|color-palette|color-swatch|color-reset-button/
  );
  assert.doesNotMatch(
    appSource,
    /align-left|align-center|align-right|table-align-left|table-align-center|table-align-right|AlignLeft|AlignCenter|AlignRight/
  );
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
    "unwrapElement",
    'document.execCommand("insertUnorderedList")',
    'document.execCommand(shiftKey ? "outdent" : "indent")',
    "stripFormattingFromFragment",
    "range.extractContents()",
    "fragment.prepend(startMarker)",
    'data-task="true"',
    "insertTaskListItemAfter",
    "exitEmptyListItem",
    "normalizeOrderedListStarts",
    "normalizeEmptyBlockAtSelection",
    "handleListKeyAtSelection",
    "moveTableSelection",
    "addTableRowAtSelection",
    "deleteTableRowAtSelection",
    "addTableColumnAtSelection",
    "deleteTableColumnAtSelection",
    "insertTableAtSelection",
    "currentTable.insertAdjacentElement(\"afterend\", table)",
    "template.content",
    "listMarkdownToHtml",
    "blockquoteMarkdownToHtml",
    "data-callout",
    "calloutElementToMarkdown",
    "quoteMarkdownLines",
    "blockElementChildrenToMarkdown",
    "<p><br></p>",
    "quoteLines.slice(1)",
    'body ? markdownToHtml(body, options) : "<p><br></p>"',
    "codeBlockToHtml",
    "codeBlockLanguages",
    "codeLanguageSelectToHtml",
    "Code block language",
    "updateCodeBlockLanguageFromSelect",
    "data-code-copy",
    "data-code-language",
    "highlightCode",
    "data-language",
    "language-",
    "syntax-keyword",
    "syntax-comment",
    "syntax-attribute",
    "isSelectionInsideCodeBlock",
    "insertCodeIndentAtSelection",
    "exitInlineAtomAtSelection",
    "exitCurrentEditorBlock",
    "exitEditorBlockFromElement",
    'if (tagName === "blockquote")',
    'if (tagName === "table")',
    "return calloutElementToMarkdown(node, calloutType)",
    "return tableElementToMarkdown(node)",
    "<table><tbody>",
    'const separator = header.map(() => "---")',
    "tableCellToMarkdown",
    "escapeTableCellMarkdown",
    ".replace(/(?<!\\\\)\\|/g, \"\\\\|\")",
    "Array.from({ length: columnCount }",
    "restoreLimitedImageHtml",
    "editLinkAtSelection",
    "removeLinkAtSelection",
    "editMathAtSelection",
    "insertHtmlAtSelection(`${mathToHtml(nextEquation, false)} `)",
    "mathToHtml",
    "validateMath",
    "renderMathExpression",
    "math-invalid",
    "removeFormattingAtSelection",
    "insertHtmlAtSelection",
    "escapeAttribute"
  ]);
  assert.doesNotMatch(
    editorSource,
    /"highlight"|"text-color"|"background-color"|applyInlineStyleAtSelection|removeInlineStyleAtSelection|restoreLimitedInlineHtml|sanitizeInlineColorStyle|options\.color|reset\?: boolean/
  );
  assert.doesNotMatch(
    editorSource,
    /"align-left"|"align-center"|"align-right"|"table-align-left"|"table-align-center"|"table-align-right"|justifyLeft|justifyCenter|justifyRight|alignTableColumnAtSelection|htmlAlignedBlockToHtml|blockWithAlignment|parseTableAlignment|tableAlignmentSeparator|data-align|text-align/
  );
  assert.doesNotMatch(editorSource, /\[!\$\{type\.toUpperCase\(\)\}\] Callout/);
});

test("phase 9 editor styles omit text and table alignment support", async () => {
  const stylesSource = await readText("src/renderer/src/styles.css");

  assert.doesNotMatch(stylesSource, /\.visual-editor mark/);
  assert.doesNotMatch(stylesSource, /text-align|data-align/);
});

test("phase 9 editor supports callouts, nested quotes, code language, and block escape", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    'event.key === "Enter"',
    "event.ctrlKey || event.metaKey",
    "const didExitInlineAtom = exitInlineAtomAtSelection()",
    "exitCurrentEditorBlock()",
    "exitEditorBlockFromElement(target)",
    "event.altKey",
    'id: "code-block"',
    "updateCodeBlockLanguageFromSelect(target)"
  ]);
  assertIncludesAll(stylesSource, [
    ".visual-editor blockquote blockquote",
    "blockquote[data-callout=\"note\"]",
    "blockquote[data-callout=\"warning\"]",
    "blockquote[data-callout=\"info\"]",
    "blockquote[data-callout=\"success\"]",
    ".visual-editor pre .code-language-select",
    ".syntax-keyword",
    ".syntax-string",
    ".syntax-number",
    ".syntax-comment",
    ".syntax-attribute"
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
    ".visual-editor ul ul",
    ".visual-editor ul ul ul",
    ".visual-editor ul li",
    "leading-6",
    ".visual-editor li[data-task=\"true\"]",
    "list-style: none",
    ".visual-editor th",
    ".visual-editor td",
    "@apply border border-neutral-400 px-3 py-2 text-left align-top"
  ]);
});

test("phase 9 editor supports links, images, and math while editing", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const editorSource = await readText("src/renderer/src/markdown-editor.ts");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    "window.inknest.links.openExternal",
    "target.closest(\"a\")",
    "linkTarget.href",
    "event.ctrlKey || event.metaKey",
    "handleDoubleClick",
    "onDoubleClick={handleDoubleClick}",
    "range.selectNodeContents(link)",
    "link.getAttribute(\"href\")",
    "target instanceof HTMLImageElement",
    "options.src = result.data.assetPath",
    "options.previewSrc = result.data.displaySrc",
    "selectImageForResize(target)",
    "syncImageResizeFrames",
    "image-resize-frame",
    "workspacePath={workspace.path}",
    "target.closest(\"[data-math]\")",
    "x^2 + y^2 = z^2"
  ]);
  assertIncludesAll(editorSource, [
    "$$",
    "$${node.dataset.math}",
    "$${node.dataset.math}$",
    "data-math",
    "data-math-display",
    "data-markdown-src",
    "node.dataset.markdownSrc",
    "imageToHtml",
    "resolveImageDisplaySrc",
    "workspacePathToFileUrl",
    "width=\"${width}\"",
    "\\\\frac",
    "\\\\sqrt",
    "\\\\(sin|cos|tan|log|ln|lim|max|min)",
    "mathSymbols",
    "rightarrow",
    "emptyset"
  ]);
  assertIncludesAll(stylesSource, [
    ".visual-editor img[width]",
    ".visual-editor .image-resize-frame",
    ".visual-editor .image-resize-frame-active",
    "resize: both",
    ".visual-editor .math-node",
    ".visual-editor .math-invalid",
    ".visual-editor .math-frac",
    ".visual-editor .math-sqrt::before",
    ".visual-editor .math-fn"
  ]);
});

test("phase 9 editor supports code-friendly behavior and clearing formatting", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const editorSource = await readText("src/renderer/src/markdown-editor.ts");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    "insertCodeIndentAtSelection()",
    'event.key === "ArrowRight"',
    "exitInlineAtomAtSelection()",
    "isSelectionInsideCodeBlock()",
    "copyTextToClipboard",
    "target.closest(\"[data-code-copy='true']\")",
    "navigator.clipboard?.writeText(text)",
    "document.execCommand(\"copy\")"
  ]);
  assertIncludesAll(editorSource, [
    "codeBlockToHtml",
    "codeBlockElementToMarkdown",
    'if (tagName === "pre")',
    "return codeBlockElementToMarkdown(node)",
    "code,[data-math-display='inline']",
    "<pre>${codeLanguageSelectToHtml(language)}<button",
    "contenteditable=\"false\"",
    "data-code-copy=\"true\"",
    "codeText.replace(/\\n$/, \"\")",
    "normalizedLanguage",
    "insertPlainTextAtSelection(\"  \")",
    "removeFormattingAtSelection"
  ]);
  assertIncludesAll(stylesSource, [
    ".visual-editor .code-copy-button",
    "cursor-pointer",
    "bg-neutral-100",
    "text-ink-900",
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

test("phase 9 e2e coverage exercises toolbar commands and saved Markdown", async () => {
  const e2eSource = await readText("tests/e2e/phase9.spec.ts");

  assertIncludesAll(e2eSource, [
    'name: "Visual Markdown editor"',
    'name: "B", exact: true',
    'name: "H3", exact: true',
    "toolbar-button-active",
    'name: "Code block", exact: true',
    'name: "Code block language"',
    'selectOption(\n      "typescript"',
    ".syntax-keyword",
    'name: "Insert table", exact: true',
    'name: "Add table row", exact: true',
    'name: "Add table column", exact: true',
    'writeFile(notePath, "/todo\\n"',
    'name: "Link", exact: true',
    "await link.dblclick()",
    'name: "Save", exact: true',
    "readFile(notePath, \"utf8\")",
    "```typescript\\nconst value = 1;\\n```",
    "[Edited docs](https://example.com/edited)"
  ]);
});
