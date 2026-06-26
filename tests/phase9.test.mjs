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
    "toolbar-button-color-selected",
    "toolbar-shell",
    "toolbar-popover",
    "commonColors",
    "defaultColorSelections",
    "highlight: null",
    '"text-color": null',
    '"background-color": null',
    "colorSelections",
    "colorPopoverPosition",
    "getToolbarButtonStyle",
    "LinkDialogState",
    "linkDialog",
    "openLinkDialog",
    "submitLinkDialog",
    "removeLinkFromDialog",
    "getLinkDetails",
    "onLinkDialogRequest",
    "activeColorCommand",
    "activeToolbarCommands",
    "tableActionIcon",
    "TableRowsSplit",
    "TableColumnsSplit",
    "TableProperties",
    "CirclePlus",
    "CircleMinus",
    "toolbar-composite-icon",
    "toolbar-composite-badge",
    "color-palette",
    "color-swatch-grid",
    "color-swatch",
    "color-reset-button",
    "applyPaletteColor",
    "resetPaletteColor",
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
    "Insert table",
    "table-add-row",
    "table-delete-row",
    "table-add-column",
    "table-delete-column",
    "table-align-left",
    "table-align-center",
    "table-align-right",
    'id: "link"',
    "link-popover",
    "link-popover-field",
    "link-popover-primary",
    "link-popover-remove",
    "window.inknest.dialogs.selectImage",
    "divider",
    "LaTeX math"
  ]);
  assertIncludesAll(stylesSource, [
    ".markdown-toolbar",
    ".toolbar-group",
    ".toolbar-button",
    ".toolbar-button-active",
    ".toolbar-composite-icon",
    ".toolbar-composite-badge",
    ".toolbar-button-color-selected",
    ".toolbar-shell",
    ".toolbar-popover",
    ".color-palette",
    ".color-swatch-grid",
    ".color-swatch",
    ".color-reset-button",
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
  assert.doesNotMatch(appSource, /from "node:fs"|from "fs"|from "electron"/);
  assert.doesNotMatch(appSource, /ipcRenderer|showOpenDialog/);
});

test("phase 9 markdown editor helper applies formatting commands", async () => {
  const editorSource = await readText("src/renderer/src/markdown-editor.ts");

  assertIncludesAll(editorSource, [
    "MarkdownEditorCommand",
    "MarkdownEditorCommandOptions",
    "reset?: boolean",
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
    "removeInlineStyleAtSelection",
    "unwrapElement",
    '"background-color", options.color ?? "#fef08a", "mark"',
    '"color", options.color ?? "#0f766e"',
    '"background-color", options.color ?? "#dbeafe"',
    'document.execCommand("justifyCenter")',
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
    "alignTableColumnAtSelection",
    "insertTableAtSelection",
    "currentTable.insertAdjacentElement(\"afterend\", table)",
    "template.content",
    "tableAlignmentSeparator",
    "parseTableAlignment",
    "listMarkdownToHtml",
    "blockquoteMarkdownToHtml",
    "data-callout",
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
    "<table><tbody>",
    "htmlAlignedBlockToHtml",
    "restoreLimitedInlineHtml",
    "sanitizeInlineColorStyle",
    "rgb\\(",
    "mark style",
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
    "target.closest(\"a\")",
    "linkTarget.href",
    "event.ctrlKey || event.metaKey",
    "handleDoubleClick",
    "onDoubleClick={handleDoubleClick}",
    "range.selectNodeContents(link)",
    "link.getAttribute(\"href\")",
    "target instanceof HTMLImageElement",
    "options.src = result.data.dataUrl",
    "selectImageForResize(target)",
    "syncImageResizeFrames",
    "image-resize-frame",
    "target.closest(\"[data-math]\")",
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
    'target.dataset.codeCopy === "true"',
    "navigator.clipboard?.writeText(code)"
  ]);
  assertIncludesAll(editorSource, [
    "codeBlockToHtml",
    "code,[data-math-display='inline'],mark,span[style]",
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
