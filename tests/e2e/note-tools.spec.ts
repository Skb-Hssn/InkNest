import { _electron as electron, expect, test, type Page, type Locator, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
let errors: string[] = [];
test.beforeEach(() => { errors = []; });
test.afterEach(() => expect(errors).toEqual([]));
async function launch(testInfo: TestInfo, markdown = "# Notes\n\nAlpha alpha ALPHA alphabet.\n\n**Alpha** and *alpha*.\n\n## Details\n\nAlpha again.\n") {
  const workspace = testInfo.outputPath("workspace");
  await mkdir(workspace, { recursive: true });
  const notePath = path.join(workspace, "Notes.md");
  await writeFile(notePath, markdown);
  await writeFile(path.join(workspace, "Other.md"), "# Other\n\nUnrelated text.\n");
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--disable-gpu-compositing", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: testInfo.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  const window = await app.firstWindow();
  window.on("pageerror", (error) => errors.push(error.message));
  await window.evaluate((folder) => window.inknest.workspace.select(folder), workspace);
  await window.reload();
  await window.locator(".note-open-area").filter({ hasText: "Notes" }).click();
  const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
  await expect(editor).toBeVisible();
  return { app, window, editor, workspace, notePath };
}
const panel = (window: Page) => window.getByRole("region", { name: "Find in note", exact: true });
const queryInput = (window: Page) => panel(window).getByRole("textbox", { name: "Find in note", exact: true });
async function selectText(element: Locator, start = 0, end?: number) {
  await element.evaluate((root, { start, end }) => {
    (root.closest('[contenteditable="true"]') as HTMLElement).focus();
    const points = (offset: number) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (offset <= node.textContent!.length) return { node, offset };
        offset -= node.textContent!.length;
        node = walker.nextNode();
      }
      return { node: root, offset: root.childNodes.length };
    };
    const from = points(start), to = points(end ?? root.textContent!.length);
    const range = document.createRange();
    range.setStart(from.node, from.offset); range.setEnd(to.node, to.offset);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  }, { start, end });
}

test("new notes are empty on disk and in the editor, including after reopening", async ({}, info) => {
  const { app, window, editor, workspace } = await launch(info);
  try {
    await window.getByRole("button", { name: "Create new note", exact: true }).click();
    await expect(window.getByRole("tab", { name: "Untitled", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(editor).toHaveText("");
    expect(await readFile(path.join(workspace, "Untitled.md"), "utf8")).toBe("");
    await window.getByRole("tab", { name: "Notes", exact: true }).click();
    await window.getByRole("tab", { name: "Untitled", exact: true }).click();
    await expect(editor).toHaveText("");
    expect(await readFile(path.join(workspace, "Untitled.md"), "utf8")).toBe("");
    await expect(window.getByRole("complementary", { name: "Heading minimap" })).toContainText("Add headings");
  } finally { await app.close(); }
});

test("full width and minimap toggles persist and update layout", async ({}, info) => {
  const { app, window, editor } = await launch(info);
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 1700, height: 1000 }));
    const width = async () => (await editor.boundingBox())!.width;
    const narrow = await width();
    await window.getByRole("button", { name: "Full width", exact: true }).click();
    await expect.poll(width).toBeGreaterThan(narrow + 100);
    await expect(window.getByRole("button", { name: "Full width", exact: true })).toHaveAttribute("aria-pressed", "true");
    await window.getByRole("button", { name: "Show heading minimap", exact: true }).click();
    await expect(window.getByRole("complementary", { name: "Heading minimap" })).toHaveCount(0);
    await expect.poll(() => window.evaluate(async () => (await window.inknest.settings.get()))).toMatchObject({ ok: true, data: { fullWidth: true, showOutline: false } });
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Notes" }).click();
    await expect(window.getByRole("button", { name: "Full width", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(window.getByRole("complementary", { name: "Heading minimap" })).toHaveCount(0);
    await window.getByRole("button", { name: "Full width", exact: true }).click();
    await expect.poll(width).toBeLessThan(narrow + 5);
  } finally { await app.close(); }
});

test("heading minimap shows hierarchy, scrolls independently and follows edits and tabs", async ({}, info) => {
  const markdown = Array.from({ length: 45 }, (_, i) => `${"#".repeat(i % 6 + 1)} Section ${i + 1}\n\n${"Content for this section. ".repeat(10)}\n`).join("\n");
  const { app, window, editor } = await launch(info, markdown);
  try {
    const outline = window.getByRole("navigation", { name: "Note headings" });
    await expect(outline.getByRole("button")).toHaveCount(45);
    await expect(outline.getByRole("button").nth(5)).toHaveAttribute("data-level", "6");
    const firstIndent = await outline.getByRole("button").nth(0).evaluate((button) => getComputedStyle(button).paddingLeft);
    const sixthIndent = await outline.getByRole("button").nth(5).evaluate((button) => getComputedStyle(button).paddingLeft);
    expect(parseFloat(sixthIndent)).toBeGreaterThan(parseFloat(firstIndent));
    await expect.poll(() => outline.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await outline.getByRole("button").last().click();
    await expect(outline.getByRole("button").last()).toHaveAttribute("aria-current", "location");
    await expect.poll(() => window.locator(".note-writing-scroll").evaluate((node) => node.scrollTop)).toBeGreaterThan(1000);
    await editor.press("End"); await editor.pressSequentially(" edited");
    await expect(outline.getByRole("button").last()).toContainText("edited");
    await window.locator(".note-open-area").filter({ hasText: "Other" }).click();
    await expect(outline.getByRole("button")).toHaveCount(1);
    await expect(outline.getByRole("button")).toContainText("Other");
  } finally { await app.close(); }
});

test("Ctrl+F opens find, highlights results, navigates and closes without editing", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info);
  try {
    const before = await readFile(notePath, "utf8");
    await editor.click(); await editor.press("Control+Home"); await editor.press("Control+f");
    await expect(queryInput(window)).toBeFocused();
    await queryInput(window).fill("alpha");
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 7");
    await expect(editor.locator(".note-search-match")).toHaveCount(7);
    await queryInput(window).press("Enter");
    await expect(panel(window).getByRole("status").first()).toHaveText("2 of 7");
    await expect(queryInput(window)).toBeFocused();
    await queryInput(window).press("Shift+Enter");
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 7");
    await panel(window).getByRole("button", { name: "Previous match" }).click();
    await expect(panel(window).getByRole("status").first()).toHaveText("7 of 7");
    await queryInput(window).press("Escape");
    await expect(panel(window)).toHaveCount(0);
    await expect(editor.locator(".note-search-match")).toHaveCount(0);
    await expect(editor).toBeFocused();
    expect(await readFile(notePath, "utf8")).toBe(before);
  } finally { await app.close(); }
});

test("match case, whole words, regex errors, no results and clearing work", async ({}, info) => {
  const { app, window } = await launch(info);
  try {
    await window.getByRole("button", { name: "Find in note", exact: true }).click();
    await queryInput(window).fill("Alpha");
    await panel(window).getByRole("button", { name: "Match case", exact: true }).click();
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 3");
    await panel(window).getByRole("button", { name: "Match case", exact: true }).click();
    await panel(window).getByRole("button", { name: "Match whole word", exact: true }).click();
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 6");
    await panel(window).getByRole("button", { name: "Use regular expression", exact: true }).click();
    await queryInput(window).fill("[");
    await expect(panel(window)).toContainText("Invalid regular expression");
    await queryInput(window).fill("Zebra");
    await expect(panel(window)).toContainText("No results");
    await queryInput(window).fill("");
    await expect(panel(window)).not.toContainText("Invalid regular expression");
    await expect(panel(window).getByRole("button", { name: "Next match" })).toBeDisabled();
  } finally { await app.close(); }
});

test("Ctrl+H replaces one/all with formatting preserved, undo/redo and saved content", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info);
  try {
    await editor.click(); await editor.press("Control+Home"); await editor.press("Control+h");
    await queryInput(window).fill("alpha");
    await panel(window).getByRole("textbox", { name: "Replace with" }).fill("Beta");
    await window.screenshot({ path: info.outputPath("note-tools.png") });
    await panel(window).getByRole("button", { name: "Replace", exact: true }).click();
    await expect(panel(window)).toContainText("Replaced 1 match");
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 6");
    await panel(window).getByRole("button", { name: "Replace all", exact: true }).click();
    await expect(panel(window)).toContainText("Replaced 6 matches");
    await expect(editor.locator("strong")).toHaveText("Beta");
    await expect(editor.locator("em")).toHaveText("Beta");
    await expect(editor).toContainText("Betabet");
    await queryInput(window).press("Escape");
    await editor.press("Control+z");
    await expect(editor.locator("strong")).toHaveText("Alpha");
    await expect(editor.locator("p").first()).toContainText("Beta alpha ALPHA alphabet");
    await editor.press("Control+Shift+z");
    await window.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => readFile(notePath, "utf8")).toContain("**Beta**");
    await window.reload(); await window.locator(".note-open-area").filter({ hasText: "Notes" }).click();
    await expect(editor.locator("strong")).toHaveText("Beta");
  } finally { await app.close(); }
});

test("regex capture replacement, preserve case, and empty replacement", async ({}, info) => {
  const { app, window, editor } = await launch(info, "alpha Alpha ALPHA\n\nItem-12 Item-34\n");
  try {
    await window.getByRole("button", { name: "Find and replace", exact: true }).click();
    await queryInput(window).fill("alpha");
    await panel(window).getByRole("textbox", { name: "Replace with" }).fill("beta");
    await panel(window).getByRole("button", { name: "Preserve case" }).click();
    await panel(window).getByRole("button", { name: "Replace all" }).click();
    await expect(editor.locator("p").first()).toHaveText("beta Beta BETA");
    await panel(window).getByRole("button", { name: "Preserve case" }).click();
    await panel(window).getByRole("button", { name: "Use regular expression" }).click();
    await queryInput(window).fill("Item-(\\d+)");
    await panel(window).getByRole("textbox", { name: "Replace with" }).fill("Number $1");
    await panel(window).getByRole("button", { name: "Replace all" }).click();
    await expect(editor.locator("p").nth(1)).toHaveText("Number 12 Number 34");
    await queryInput(window).fill("Beta");
    await panel(window).getByRole("textbox", { name: "Replace with" }).fill("");
    await panel(window).getByRole("button", { name: "Replace all" }).click();
    await expect(editor.locator("p").first()).toHaveText("  ");
  } finally { await app.close(); }
});

test("selected text seeds find, selection-only replacement leaves other matches intact", async ({}, info) => {
  const { app, window, editor } = await launch(info, "Alpha outside\n\n**Alpha** Alpha inside\n\nAlpha after\n");
  try {
    await selectText(editor.locator("p").nth(1));
    await editor.press("Control+h");
    await expect(queryInput(window)).toHaveValue("Alpha Alpha inside");
    await queryInput(window).fill("Alpha");
    await panel(window).getByRole("button", { name: "Find in selection" }).click();
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 2");
    await panel(window).getByRole("textbox", { name: "Replace with" }).fill("B");
    await panel(window).getByRole("button", { name: "Replace all" }).click();
    await expect(editor.locator("p")).toHaveText(["Alpha outside", "B B inside", "Alpha after"]);
    await expect(editor.locator("strong")).toHaveText("B");
    await queryInput(window).fill("B");
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 2");
  } finally { await app.close(); }
});

test("switching notes clears find UI and highlights", async ({}, info) => {
  const { app, window, editor } = await launch(info);
  try {
    await window.getByRole("button", { name: "Find in note", exact: true }).click();
    await queryInput(window).fill("Alpha");
    await expect(editor.locator(".note-search-match")).toHaveCount(7);
    await window.locator(".note-open-area").filter({ hasText: "Other" }).click();
    await expect(panel(window)).toHaveCount(0);
    await expect(editor.locator(".note-search-match")).toHaveCount(0);
    await expect(editor).toContainText("Unrelated text");
  } finally { await app.close(); }
});

test("F3 navigation reopens the query and follows the editor caret", async ({}, info) => {
  const { app, window, editor } = await launch(info);
  try {
    await selectText(editor.locator("p").first(), 0, 0);
    await editor.press("Control+f");
    await queryInput(window).fill("alpha");
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 7");
    await queryInput(window).press("Escape");
    await editor.press("F3");
    await expect(queryInput(window)).toHaveValue("alpha");
    await expect(panel(window).getByRole("status").first()).toHaveText("2 of 7");
    await queryInput(window).press("Shift+F3");
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 7");
    await selectText(editor.locator("p").last(), 0, 0);
    await editor.press("F3");
    await expect(panel(window).getByRole("status").first()).toHaveText("7 of 7");
    await editor.press("Escape");
    await expect(panel(window)).toHaveCount(0);
  } finally { await app.close(); }
});

test("find stays live while editing and keyboard buttons retain their actions", async ({}, info) => {
  const { app, window, editor } = await launch(info);
  try {
    await window.getByRole("button", { name: "Find in note", exact: true }).click();
    await queryInput(window).fill("alpha");
    await panel(window).getByRole("button", { name: "Toggle replace" }).focus();
    await panel(window).getByRole("button", { name: "Toggle replace" }).press("Enter");
    await expect(panel(window).getByRole("textbox", { name: "Replace with" })).toBeVisible();
    await selectText(editor.locator("p").last(), 12, 12);
    await editor.pressSequentially(" Alpha");
    await expect(editor.locator(".note-search-match")).toHaveCount(8);
    await expect(panel(window).getByRole("status").first()).toContainText("of 8");
    await panel(window).getByRole("button", { name: "Close find" }).focus();
    await panel(window).getByRole("button", { name: "Close find" }).press("Enter");
    await expect(panel(window)).toHaveCount(0);
  } finally { await app.close(); }
});

test("replacing code, links, table cells and callout text preserves their structure", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "> [!NOTE] Alpha\n\n[Alpha](https://example.com) and `Alpha`\n\n```js\nAlpha\n```\n\n| Alpha | Header |\n| --- | --- |\n| Alpha | Cell |\n");
  try {
    await window.getByRole("button", { name: "Find and replace" }).click();
    await queryInput(window).fill("Alpha");
    await expect(editor.locator(".note-search-match")).toHaveCount(6);
    await panel(window).getByRole("textbox", { name: "Replace with" }).fill("Beta");
    await panel(window).getByRole("button", { name: "Replace all" }).click();
    await expect(editor.locator('blockquote[data-callout="note"]')).toContainText("Beta");
    await expect(editor.locator("a")).toHaveText("Beta");
    await expect(editor.locator("a")).toHaveAttribute("href", "https://example.com");
    await expect(editor.locator("p code")).toHaveText("Beta");
    await expect(editor.locator("pre code")).toHaveText("Beta");
    await expect(editor.locator("table")).toHaveCount(1);
    await expect(editor.locator("td")).toHaveText(["Beta", "Cell"]);
    await queryInput(window).press("Escape");
    await window.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(() => readFile(notePath, "utf8")).toContain("[Beta](https://example.com)");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("[!NOTE] Beta");
  } finally { await app.close(); }
});

test("zero-width regex replacements terminate and invalid settings are rejected", async ({}, info) => {
  const { app, window, editor } = await launch(info, "Alpha\n\nBeta\n");
  try {
    for (const key of ["fullWidth", "showOutline"]) {
      const response = await window.evaluate((key) => window.inknest.settings.save({ [key]: "wrong" } as any), key);
      expect(response.ok).toBe(false);
    }
    await window.getByRole("button", { name: "Find and replace" }).click();
    await panel(window).getByRole("button", { name: "Use regular expression" }).click();
    await queryInput(window).fill("^");
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 2");
    await panel(window).getByRole("textbox", { name: "Replace with" }).fill("Prefix ");
    await panel(window).getByRole("button", { name: "Replace all" }).click();
    await expect(editor.locator("p")).toHaveText(["Prefix Alpha", "Prefix Beta"]);
    await expect(panel(window)).toContainText("Replaced 2 matches");
  } finally { await app.close(); }
});
