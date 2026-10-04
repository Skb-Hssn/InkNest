import { _electron as electron, expect, test, type Locator, type TestInfo, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

let pageErrors: string[] = [];
test.beforeEach(() => { pageErrors = []; });
test.afterEach(() => { expect(pageErrors).toEqual([]); });

async function launchNote(testInfo: TestInfo, markdown = "Alpha text\n\nBeta text\n\nGamma text\n") {
  const workspace = testInfo.outputPath("workspace");
  await mkdir(workspace, { recursive: true });
  const notePath = path.join(workspace, "Formatting.md");
  await writeFile(notePath, markdown);
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu", "--disable-gpu-compositing", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: testInfo.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined }
  });
  const window = await app.firstWindow();
  window.on("pageerror", (error) => pageErrors.push(error.message));
  await window.evaluate((workspacePath) => window.inknest.workspace.select(workspacePath), workspace);
  await window.reload();
  await window.locator(".note-open-area").filter({ hasText: "Formatting" }).click();
  const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
  await expect(editor).toBeVisible();
  return { app, window, editor, notePath };
}

async function selectRange(start: Locator, from = 0, end = start, to?: number) {
  const endHandle = await end.elementHandle();
  await start.evaluate((element, { last, from, to }) => {
    const point = (root: Element, offset: number) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (offset <= (node.textContent?.length ?? 0)) return { node, offset };
        offset -= node.textContent?.length ?? 0;
        node = walker.nextNode();
      }
      return { node: root, offset: root.childNodes.length };
    };
    (element.closest('[contenteditable="true"]') as HTMLElement)?.focus();
    const first = point(element, from);
    const final = point(last as Element, to ?? (last as Element).textContent?.length ?? 0);
    const range = document.createRange();
    range.setStart(first.node, first.offset);
    range.setEnd(final.node, final.offset);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  }, { last: endHandle, from, to });
  await endHandle?.dispose();
}

async function toolbar(window: Page, label: string) {
  await window.getByRole("button", { name: label, exact: true }).click();
}

for (const [label, selector] of [["B", "strong"], ["I", "em"], ["Strikethrough", "del"], ["Code", "code"]]) {
  test(`${label}: apply and remove on selected text`, async ({}, testInfo) => {
    const { app, window, editor } = await launchNote(testInfo);
    try {
      await selectRange(editor.locator("p").first(), 0, editor.locator("p").first(), 5);
      await toolbar(window, label);
      await expect(editor.locator(selector)).toHaveText("Alpha");
      await toolbar(window, label);
      await expect(editor.locator(selector)).toHaveCount(0);
      await expect(editor.locator("p").first()).toHaveText("Alpha text");
    } finally { await app.close(); }
  });
}

test("inline code can be enabled at the caret before typing", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo);
  try {
    await editor.locator("p").first().click();
    await editor.press("End");
    await toolbar(window, "Code");
    await editor.pressSequentially(" code");
    await expect(editor.locator("code")).toHaveText(" code");
  } finally { await app.close(); }
});

test("clicking an active heading restores a paragraph", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo);
  try {
    await editor.locator("p").first().click();
    await toolbar(window, "H3");
    await expect(editor.locator("h3")).toHaveText("Alpha text");
    await toolbar(window, "H3");
    await expect(editor.locator("h3")).toHaveCount(0);
    await expect(editor.locator("p").first()).toHaveText("Alpha text");
  } finally { await app.close(); }
});

test("a list across two paragraphs creates two items and toggles off", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo);
  try {
    await selectRange(editor.locator("p").nth(0), 0, editor.locator("p").nth(1));
    await toolbar(window, "List");
    await expect(editor.locator("ul > li")).toHaveCount(2);
    await toolbar(window, "List");
    await expect(editor.locator("ul")).toHaveCount(0);
    await expect(editor.locator("p").nth(0)).toHaveText("Alpha text");
    await expect(editor.locator("p").nth(1)).toHaveText("Beta text");
  } finally { await app.close(); }
});

test("task list applies to every selected paragraph", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo);
  try {
    await selectRange(editor.locator("p").nth(0), 0, editor.locator("p").nth(1));
    await toolbar(window, "Task list");
    await expect(editor.getByRole("checkbox")).toHaveCount(2);
  } finally { await app.close(); }
});

test("a callout preserves the text being formatted", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo);
  try {
    await selectRange(editor.locator("p").first());
    await toolbar(window, "Note callout");
    await expect(editor.locator('blockquote[data-callout="note"]')).toContainText("Alpha text");
  } finally { await app.close(); }
});

test("clear formatting removes heading formatting as well as inline marks", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo, "### **Alpha text**\n\nBeta text\n");
  try {
    await selectRange(editor.locator("h3"));
    await toolbar(window, "Clear formatting");
    await expect(editor.locator("h3, strong")).toHaveCount(0);
    await expect(editor.locator("p").first()).toHaveText("Alpha text");
  } finally { await app.close(); }
});

for (const [label, selector, key] of [["B", "strong", "Control+b"], ["I", "em", "Control+i"], ["Strikethrough", "del", "Control+Shift+x"], ["Code", "code", "Control+e"]]) {
  test(`${label}: caret typing, active button, keyboard toggle, and undo`, async ({}, testInfo) => {
    const { app, window, editor } = await launchNote(testInfo);
    try {
      await selectRange(editor.locator("p").first(), 10, editor.locator("p").first(), 10);
      await toolbar(window, label);
      await expect(window.getByRole("button", { name: label, exact: true })).toHaveClass(/toolbar-button-active/);
      await editor.pressSequentially(" added");
      await expect(editor.locator(selector)).toHaveText(" added");
      await editor.press(key);
      await editor.pressSequentially(" plain");
      await expect(editor.locator(selector)).toHaveText(" added");
      await selectRange(editor.locator("p").first(), 0, editor.locator("p").first(), 5);
      await editor.press(key);
      await expect(editor.locator(selector).first()).toHaveText("Alpha");
      await expect(window.getByRole("button", { name: label, exact: true })).toHaveClass(/toolbar-button-active/);
      await editor.press("Control+z");
      await expect(window.getByRole("button", { name: label, exact: true })).not.toHaveClass(/toolbar-button-active/);
      await expect(editor.locator(selector)).toHaveText(" added");
    } finally { await app.close(); }
  });
}

for (const [label, selector, markdown] of [["B", "strong", "**Alpha** text"], ["I", "em", "*Alpha* text"], ["Strikethrough", "del", "~~Alpha~~ text"], ["Code", "code", "`Alpha` text"]]) {
  test(`${label}: mixed selection becomes uniformly formatted`, async ({}, testInfo) => {
    const { app, window, editor } = await launchNote(testInfo, `${markdown}\n\nBeta text\n`);
    try {
      await selectRange(editor.locator("p").first());
      await expect(window.getByRole("button", { name: label, exact: true })).not.toHaveClass(/toolbar-button-active/);
      await toolbar(window, label);
      await expect(editor.locator(selector)).toHaveText("Alpha text");
      await toolbar(window, label);
      await expect(editor.locator(selector)).toHaveCount(0);
    } finally { await app.close(); }
  });
}

for (const level of [1, 2, 3, 4, 5, 6]) {
  test(`H${level}: format multiple blocks, preserve inline marks, save and reopen`, async ({}, testInfo) => {
    const { app, window, editor, notePath } = await launchNote(testInfo, "**Alpha** text\n\nBeta text\n\nGamma text\n");
    try {
      await selectRange(editor.locator("p").nth(0), 0, editor.locator("p").nth(1));
      await toolbar(window, `H${level}`);
      await expect(editor.locator(`h${level}`)).toHaveCount(2);
      await expect(editor.locator("strong")).toHaveText("Alpha");
      await toolbar(window, "Save");
      await expect.poll(() => readFile(notePath, "utf8")).toContain(`${"#".repeat(level)} **Alpha** text`);
      await window.reload();
      await window.locator(".note-open-area").filter({ hasText: "Formatting" }).click();
      await expect(editor.locator(`h${level}`)).toHaveCount(2);
      await selectRange(editor.locator(`h${level}`).first());
      await toolbar(window, `H${level}`);
      await expect(editor.locator(`h${level}`)).toHaveCount(1);
      await expect(editor.locator("p").first()).toContainText("Alpha text");
    } finally { await app.close(); }
  });
}

for (const [label, selector] of [["List", "ul"], ["Numbered list", "ol"], ["Task list", "ul"]]) {
  test(`${label}: create, convert, toggle, undo and redo`, async ({}, testInfo) => {
    const { app, window, editor } = await launchNote(testInfo);
    try {
      await selectRange(editor.locator("p").nth(0), 0, editor.locator("p").nth(1));
      await toolbar(window, label);
      await expect(editor.locator(`${selector} > li`)).toHaveCount(2);
      await editor.press("Control+z");
      await expect(editor.locator("li")).toHaveCount(0);
      await editor.press("Control+Shift+z");
      await expect(editor.locator(`${selector} > li`)).toHaveCount(2);
      const next = label === "Numbered list" ? "Task list" : "Numbered list";
      await toolbar(window, next);
      await expect(editor.locator(next === "Task list" ? "input[type=checkbox]" : "ol > li")).toHaveCount(2);
      await toolbar(window, next);
      await expect(editor.locator("li")).toHaveCount(0);
      await expect(editor.locator("p").nth(2)).toHaveText("Gamma text");
    } finally { await app.close(); }
  });
}

test("converting only the middle list item leaves surrounding items untouched", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo, "- Alpha text\n- Beta text\n- Gamma text\n");
  try {
    await selectRange(editor.locator("li p").nth(1));
    await toolbar(window, "Task list");
    await expect(editor.getByRole("checkbox")).toHaveCount(1);
    await expect(editor.locator("li")).toHaveCount(3);
    await editor.getByRole("checkbox").check();
    await expect(editor.getByRole("checkbox")).toBeChecked();
    await toolbar(window, "Save");
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Formatting" }).click();
    await expect(editor.getByRole("checkbox")).toBeChecked();
    await selectRange(editor.locator("li p").nth(1));
    await toolbar(window, "Task list");
    await expect(editor.getByRole("checkbox")).toHaveCount(0);
    await expect(editor.locator("li")).toHaveCount(2);
    await expect(editor.locator(":scope > p").first()).toHaveText("Beta text");
  } finally { await app.close(); }
});

for (const kind of ["Note", "Warning", "Info", "Success"]) {
  test(`${kind} callout: preserve multiple blocks, change type, toggle, and undo`, async ({}, testInfo) => {
    const { app, window, editor } = await launchNote(testInfo);
    try {
      await selectRange(editor.locator("p").nth(0), 0, editor.locator("p").nth(1));
      await toolbar(window, `${kind} callout`);
      await expect(editor.locator(`blockquote[data-callout="${kind.toLowerCase()}"]`)).toContainText("Alpha text");
      await expect(editor.locator("blockquote p")).toHaveCount(2);
      await expect(window.getByRole("button", { name: `${kind} callout`, exact: true })).toHaveClass(/toolbar-button-active/);
      await toolbar(window, "Quote");
      await expect(editor.locator("blockquote")).toHaveCount(1);
      await expect(editor.locator("blockquote")).not.toHaveAttribute("data-callout");
      await toolbar(window, `${kind} callout`);
      await toolbar(window, `${kind} callout`);
      await expect(editor.locator("blockquote")).toHaveCount(0);
      await expect(editor.locator("p").first()).toHaveText("Alpha text");
      await editor.press("Control+z");
      await expect(editor.locator(`blockquote[data-callout="${kind.toLowerCase()}"]`)).toBeVisible();
    } finally { await app.close(); }
  });
}

test("quote toggles without nesting or losing selected text", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo);
  try {
    await selectRange(editor.locator("p").first());
    await toolbar(window, "Quote");
    await expect(editor.locator("blockquote")).toHaveText("Alpha text");
    await toolbar(window, "Quote");
    await expect(editor.locator("blockquote")).toHaveCount(0);
  } finally { await app.close(); }
});

test("code block preserves content, language, indentation and toggles back", async ({}, testInfo) => {
  const { app, window, editor, notePath } = await launchNote(testInfo);
  try {
    await selectRange(editor.locator("p").first());
    await toolbar(window, "Code block");
    await expect(editor.locator("pre code")).toHaveText("Alpha text");
    await editor.getByRole("combobox", { name: "Code block language" }).selectOption("typescript");
    await editor.locator("pre code").click();
    await editor.press("End");
    await editor.press("Enter");
    await editor.press("Tab");
    await editor.pressSequentially("const value = 1;");
    await editor.press("Enter");
    await editor.pressSequentially("continued");
    await expect(editor.locator("pre code")).toHaveText("Alpha text\n    const value = 1;\n    continued");
    await toolbar(window, "Save");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("```typescript\nAlpha text\n    const value = 1;\n    continued\n```");
    await toolbar(window, "Code block");
    await expect(editor.locator("pre")).toHaveCount(0);
    await expect(editor.locator("p").first()).toContainText("Alpha text");
  } finally { await app.close(); }
});

for (const markdown of ["- **Alpha** text\n- Beta text\n", "> [!NOTE] **Alpha** text\n> Beta text\n", "```js\nAlpha text\n```\n"]) {
  test(`clear formatting unwraps ${markdown.slice(0, 10)} without deleting content`, async ({}, testInfo) => {
    const { app, window, editor } = await launchNote(testInfo, markdown);
    try {
      const blocks = editor.locator("p, pre code");
      await selectRange(blocks.first(), markdown.startsWith(">") ? 8 : 0, blocks.last());
      await toolbar(window, "Clear formatting");
      await expect(editor.locator("ul, ol, blockquote, pre, strong")).toHaveCount(0);
      await expect(editor).toContainText("Alpha text");
      await expect(editor).not.toContainText("[!NOTE]");
    } finally { await app.close(); }
  });
}

test("links preserve formatting when inserted, edited and removed", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo, "**Alpha** *text*\n\nBeta text\n");
  try {
    await selectRange(editor.locator("p").first());
    await toolbar(window, "Link");
    await window.locator(".link-popover").getByLabel("Link", { exact: true }).fill("https://example.com");
    await window.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(editor.locator("strong a")).toHaveText("Alpha");
    await expect(editor.locator("em a")).toHaveText("text");
    await selectRange(editor.locator("strong"), 2, editor.locator("strong"), 2);
    await toolbar(window, "Link");
    await expect(window.locator(".link-popover").getByLabel("Text", { exact: true })).toHaveValue("Alpha text");
    await window.locator(".link-popover").getByLabel("Link", { exact: true }).fill("https://example.com/edited");
    await window.getByRole("button", { name: "Apply", exact: true }).click();
    await expect.poll(() => editor.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual(["https://example.com/edited", "https://example.com/edited", "https://example.com/edited"]);
    await expect(editor.locator("strong a")).toHaveText("Alpha");
    await toolbar(window, "Link");
    await window.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(editor.locator("a")).toHaveCount(0);
    await expect(editor.locator("strong")).toHaveText("Alpha");
    await expect(editor.locator("em")).toHaveText("text");
  } finally { await app.close(); }
});

test("clear a mixed block selection, undo, and preserve unselected content", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo, "**Before**\n\n## **Heading**\n\n- Alpha\n- Beta\n\n> [!NOTE] Gamma\n\n*End*\n");
  try {
    await selectRange(editor.locator("h2"), 0, editor.locator(":scope > p").last());
    await toolbar(window, "Clear formatting");
    await expect(editor.locator("h2, ul, blockquote, em")).toHaveCount(0);
    await expect(editor.locator("strong")).toHaveText("Before");
    await expect(editor).toContainText("Gamma");
    await editor.press("Control+z");
    await expect(editor.locator("h2")).toHaveText("Heading");
    await expect(editor.locator("li")).toHaveCount(2);
    await expect(editor.locator('blockquote[data-callout="note"]')).toContainText("Gamma");
  } finally { await app.close(); }
});

test("nested lists support indent, outdent and conversion to headings", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo, "- Outer\n- Alpha\n- Beta\n");
  try {
    await selectRange(editor.locator("li p").nth(1), 0, editor.locator("li p").nth(1), 0);
    await editor.press("Tab");
    await expect(editor.locator("ul ul li")).toHaveText("Alpha");
    await editor.press("Shift+Tab");
    await expect(editor.locator("ul ul")).toHaveCount(0);
    await editor.press("Tab");
    await toolbar(window, "H2");
    await expect(editor.locator("h2")).toHaveText("Alpha");
    await expect(editor.locator("li")).toHaveCount(2);
    await expect(editor).toContainText("Outer");
    await expect(editor).toContainText("Beta");
  } finally { await app.close(); }
});

test("new tasks continue unchecked and empty tasks exit the list", async ({}, testInfo) => {
  const { app, editor } = await launchNote(testInfo, "- [x] Alpha text\n");
  try {
    await selectRange(editor.locator("li p").first(), 10, editor.locator("li p").first(), 10);
    await editor.press("Enter");
    await expect(editor.getByRole("checkbox")).toHaveCount(2);
    await expect(editor.getByRole("checkbox").nth(0)).toBeChecked();
    await expect(editor.getByRole("checkbox").nth(1)).not.toBeChecked();
    await editor.press("Enter");
    await expect(editor.getByRole("checkbox")).toHaveCount(1);
    await expect(editor.locator(":scope > p").first()).toHaveText("");
  } finally { await app.close(); }
});

for (const [key, selector] of [["Control+Alt+2", "h2"], ["Control+Alt+7", "ol"], ["Control+Alt+8", "ul"], ["Control+Shift+b", "blockquote"], ["Control+Alt+c", "pre"]]) {
  test(`${key}: block keyboard shortcut matches toolbar toggle`, async ({}, testInfo) => {
    const { app, editor } = await launchNote(testInfo);
    try {
      await selectRange(editor.locator("p").first());
      await editor.press(key);
      await expect(editor.locator(selector)).toHaveCount(1);
      await editor.press(key);
      await expect(editor.locator(selector)).toHaveCount(0);
      await expect(editor.locator("p").first()).toHaveText("Alpha text");
    } finally { await app.close(); }
  });
}

test("code Shift+Tab removes indentation and copy uses only code text", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo, "```typescript\n    first\n    second\n```\n");
  try {
    await window.evaluate(() => {
      (window as any).__copiedCode = "";
      Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async (value: string) => { (window as any).__copiedCode = value; } });
    });
    await selectRange(editor.locator("pre code"));
    await editor.press("Tab");
    await expect(editor.locator("pre code")).toHaveText("        first\n        second");
    await editor.press("Shift+Tab");
    await editor.press("Shift+Tab");
    await expect(editor.locator("pre code")).toHaveText("first\nsecond");
    await editor.getByRole("button", { name: "Copy", exact: true }).click();
    await expect.poll(() => window.evaluate(() => (window as any).__copiedCode)).toBe("first\nsecond");
    await expect(editor.locator("pre")).toHaveAttribute("data-language", "typescript");
  } finally { await app.close(); }
});

test("link rename, mixed link selection, validation, cancel and undo", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo, "**[Alpha](https://example.com)** plain\n");
  try {
    await selectRange(editor.locator("strong"), 2, editor.locator("strong"), 2);
    await toolbar(window, "Link");
    await window.locator(".link-popover").getByLabel("Text", { exact: true }).fill("Renamed");
    await window.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(editor.locator("strong a")).toHaveText("Renamed");
    await editor.press("Control+z");
    await expect(editor.locator("strong a")).toHaveText("Alpha");
    await selectRange(editor.locator("p").first());
    await toolbar(window, "Link");
    await expect(window.getByRole("button", { name: "Remove", exact: true })).toHaveCount(0);
    await window.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(window.locator(".link-popover-error")).toBeVisible();
    await window.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(editor.locator("p")).toHaveText("Alpha plain");
    await toolbar(window, "Link");
    await window.locator(".link-popover").getByLabel("Link", { exact: true }).fill("https://example.com/new");
    await window.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(editor.locator("strong a")).toHaveText("Alpha");
    await expect(editor.locator("a").last()).toHaveText(" plain");
  } finally { await app.close(); }
});

test("combined inline marks and Unicode survive save and reopen", async ({}, testInfo) => {
  const { app, window, editor, notePath } = await launchNote(testInfo, "---\r\ntitle: Unicode\r\n---\r\n\r\nবাংলা 😀 café\r\n");
  try {
    await selectRange(editor.locator("p").first());
    for (const label of ["B", "I", "Strikethrough"]) await toolbar(window, label);
    await expect(editor.locator("strong")).toHaveText("বাংলা 😀 café");
    await expect(editor.locator("em")).toHaveText("বাংলা 😀 café");
    await expect(editor.locator("del")).toHaveText("বাংলা 😀 café");
    await toolbar(window, "Save");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("title: Unicode\r\n");
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Formatting" }).click();
    for (const selector of ["strong", "em", "del"]) await expect(editor.locator(selector)).toHaveText("বাংলা 😀 café");
    await selectRange(editor.locator("p").first());
    await toolbar(window, "Clear formatting");
    await expect(editor.locator("strong, em, del")).toHaveCount(0);
  } finally { await app.close(); }
});

test("divider inserts an editable boundary and supports undo and save", async ({}, testInfo) => {
  const { app, window, editor, notePath } = await launchNote(testInfo);
  try {
    await selectRange(editor.locator("p").first(), 10, editor.locator("p").first(), 10);
    await toolbar(window, "Divider");
    await expect(editor.locator("hr")).toHaveCount(1);
    await expect(editor).toContainText("Alpha text");
    await editor.press("Control+z");
    await expect(editor.locator("hr")).toHaveCount(0);
    await editor.press("Control+Shift+z");
    await expect(editor.locator("hr")).toHaveCount(1);
    await toolbar(window, "Save");
    await expect.poll(() => readFile(notePath, "utf8")).toMatch(/(?:---|\*\*\*|___)/);
  } finally { await app.close(); }
});

for (const [source, selector, expected] of [["**bold**", "strong", "bold"], ["*italic*", "em", "italic"], ["~~strike~~", "del", "strike"], ["`code`", "code", "code"], ["## ", "h2", ""], ["- ", "ul > li", ""], ["1. ", "ol > li", ""], ["> ", "blockquote", ""]]) {
  test(`Markdown typing: ${source}`, async ({}, testInfo) => {
    const { app, editor } = await launchNote(testInfo, "\n");
    try {
      await editor.click();
      await editor.pressSequentially(source);
      await expect(editor.locator(selector)).toHaveText(expected);
    } finally { await app.close(); }
  });
}

for (const [source, selector] of [["/heading", "h1"], ["/code", "pre"], ["/todo", "input[type=checkbox]"], ["/note", 'blockquote[data-callout="note"]'], ["/warning", 'blockquote[data-callout="warning"]'], ["/info", 'blockquote[data-callout="info"]'], ["/success", 'blockquote[data-callout="success"]']]) {
  test(`slash formatting: ${source} preserves following text`, async ({}, testInfo) => {
    const { app, editor } = await launchNote(testInfo, `${source}\n\nFollowing text\n`);
    try {
      await selectRange(editor.locator("p").first(), source.length, editor.locator("p").first(), source.length);
      await editor.press("Enter");
      await expect(editor.locator(selector)).toHaveCount(1);
      await editor.pressSequentially(" new text");
      await expect(editor).toContainText("new text");
      await expect(editor.locator("p").last()).toHaveText("Following text");
    } finally { await app.close(); }
  });
}

test("callouts around headings change type and toggle without leaving empty quotes", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo, "## Alpha text\n\nBeta text\n");
  try {
    await selectRange(editor.locator("h2"));
    await toolbar(window, "Note callout");
    await expect(editor.locator('blockquote[data-callout="note"] h2')).toHaveText("Alpha text");
    await toolbar(window, "Warning callout");
    await expect(editor.locator('blockquote[data-callout="warning"] h2')).toHaveText("Alpha text");
    await toolbar(window, "Warning callout");
    await expect(editor.locator("blockquote")).toHaveCount(0);
    await expect(editor.locator("h2")).toHaveText("Alpha text");
  } finally { await app.close(); }
});

test("inline code combined with bold round trips and clear-at-caret resets typing", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo);
  try {
    await selectRange(editor.locator("p").first(), 0, editor.locator("p").first(), 5);
    await toolbar(window, "B");
    await toolbar(window, "Code");
    await expect(editor.locator("strong code, code strong")).toHaveText("Alpha");
    await toolbar(window, "Save");
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Formatting" }).click();
    await expect(editor.locator("strong code, code strong")).toHaveText("Alpha");
    await selectRange(editor.locator("code"), 2, editor.locator("code"), 2);
    await toolbar(window, "Clear formatting");
    await expect(window.getByRole("button", { name: "B", exact: true })).not.toHaveClass(/toolbar-button-active/);
    await editor.pressSequentially("plain");
    await expect(editor.locator("p").first()).toHaveText("Alplainpha text");
    await expect(editor.locator("strong").filter({ hasText: "plain" })).toHaveCount(0);
    await expect(editor.locator("code").filter({ hasText: "plain" })).toHaveCount(0);
  } finally { await app.close(); }
});

for (const [label, selector] of [["List", "ul > li"], ["Numbered list", "ol > li"], ["Task list", "input[type=checkbox]"]]) {
  test(`${label}: mixed paragraphs and list items flatten without losing text`, async ({}, testInfo) => {
    const { app, window, editor } = await launchNote(testInfo, "Before\n\n- Alpha\n- Beta\n\nAfter\n");
    try {
      await selectRange(editor.locator("p").first(), 0, editor.locator("p").last());
      await toolbar(window, label);
      await expect(editor.locator(selector)).toHaveCount(4);
      await expect(editor.locator("li li")).toHaveCount(0);
      await expect(editor.locator("li p")).toHaveText(["Before", "Alpha", "Beta", "After"]);
    } finally { await app.close(); }
  });
}

test("table cells support inline formatting and safely reject incompatible block types", async ({}, testInfo) => {
  const { app, window, editor } = await launchNote(testInfo, "| Header | Next |\n| --- | --- |\n| Alpha | Beta |\n");
  try {
    await selectRange(editor.locator("td p").first());
    await toolbar(window, "B");
    await expect(editor.locator("td strong")).toHaveText("Alpha");
    for (const label of ["H2", "Code block", "Quote", "Task list"]) {
      await toolbar(window, label);
      await expect(editor.locator("h2, pre, blockquote, li")).toHaveCount(0);
      await expect(editor.locator("td")).toHaveText(["Alpha", "Beta"]);
    }
    await toolbar(window, "Clear formatting");
    await expect(editor.locator("strong")).toHaveCount(0);
    await expect(editor.locator("table")).toHaveCount(1);
  } finally { await app.close(); }
});

test("an existing custom code language is displayed and survives edits", async ({}, testInfo) => {
  const { app, window, editor, notePath } = await launchNote(testInfo, "```rust\nlet value = 1;\n```\n");
  try {
    await expect(editor.getByRole("combobox", { name: "Code block language" })).toHaveValue("rust");
    await selectRange(editor.locator("pre code"), 14, editor.locator("pre code"), 14);
    await editor.pressSequentially(" // edited");
    await toolbar(window, "Save");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("```rust");
    await expect(editor.getByRole("combobox", { name: "Code block language" })).toHaveValue("rust");
  } finally { await app.close(); }
});

test("Shift+Enter inserts a hard line break without splitting the paragraph", async ({}, testInfo) => {
  const { app, window, editor, notePath } = await launchNote(testInfo, "Alpha text\n");
  try {
    await selectRange(editor.locator("p").first(), 5, editor.locator("p").first(), 5);
    await editor.press("Shift+Enter");
    await expect(editor.locator("br:not(.ProseMirror-trailingBreak)")).toHaveCount(1);
    await expect(editor.locator("p")).toHaveCount(1);
    await toolbar(window, "Save");
    await expect.poll(() => readFile(notePath, "utf8")).toMatch(/Alpha(?:\\| {2})\n(?: |&#x20;)text/);
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Formatting" }).click();
    await expect(editor.locator("br:not(.ProseMirror-trailingBreak)")).toHaveCount(1);
    await expect(editor.locator("p")).toHaveText("Alpha text");
  } finally { await app.close(); }
});
