import { test } from "./fixtures";
import { _electron as electron, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
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

test("clicking blank space in a new note focuses insertion and saves typing", async ({}, info) => {
  const { app, window, editor, workspace } = await launch(info);
  try {
    for (const [index, area] of [".note-writing-scroll", ".note-outline-slot"].entries()) {
      await window.getByRole("button", { name: "Create new note", exact: true }).click();
      await expect(editor).toHaveAttribute("contenteditable", "true");
      const file = path.join(workspace, index ? "Untitled 2.md" : "Untitled.md");
      const box = (await window.locator(area).boundingBox())!;
      // Click far below the paragraph and outside the editable text column.
      await window.mouse.click(box.x + 6, box.y + box.height - 24);
      await expect(editor).toBeFocused();
      expect(await readFile(file, "utf8")).toBe("");
      await window.keyboard.type("Written from blank space.");
      await expect(editor).toHaveText("Written from blank space.");
      await expect.poll(() => readFile(file, "utf8")).toContain("Written from blank space.");
      await window.getByRole("tab", { name: "Notes", exact: true }).click();
      await window.getByRole("tab", { name: index ? "Untitled 2" : "Untitled", exact: true }).click();
      await expect(editor).toHaveText("Written from blank space.");
    }
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

test("minimap is a floating card with animated opening, closing and a close button", async ({}, info) => {
  const { app, window, editor } = await launch(info);
  try {
    const card = window.locator(".note-heading-minimap");
    const slot = window.locator(".note-outline-slot");
    const column = window.locator(".note-editor-column");
    await expect(card).toHaveCSS("position", "absolute");
    await expect(card).toHaveCSS("border-radius", "7px");
    expect(await card.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe("none");
    expect((await card.boundingBox())!.height).toBeLessThan((await window.locator(".note-workspace").boundingBox())!.height - 32);
    const initialWidth = (await column.boundingBox())!.width;
    const toggle = window.getByRole("button", { name: "Show heading minimap", exact: true });
    await toggle.click();
    await expect(slot).toHaveAttribute("data-open", "false");
    expect(await card.evaluate((node) => node.getAnimations().length)).toBeGreaterThan(0);
    await expect(window.getByRole("complementary", { name: "Heading minimap" })).toHaveCount(0);
    await expect(card).toHaveCount(1);
    await expect(card).toHaveCSS("visibility", "hidden");
    await expect(card).toHaveCSS("opacity", "0");
    await expect.poll(async () => (await column.boundingBox())!.width).toBeGreaterThan(initialWidth + 200);
    await toggle.click();
    await expect(slot).toHaveAttribute("data-open", "true");
    await expect(card).toHaveCSS("opacity", "1");
    await expect.poll(async () => (await column.boundingBox())!.width).toBe(initialWidth);
    await window.getByRole("button", { name: "Close heading minimap" }).click();
    await expect(slot).toHaveAttribute("data-open", "false");
    await expect(editor).toBeFocused();
  } finally { await app.close(); }
});

test("minimap dragging remembers its width, adapts to a smaller window and resets", async ({}, info) => {
  const { app, window } = await launch(info);
  try {
    const handle = window.getByRole("separator", { name: "Resize heading minimap" });
    await expect(handle).toHaveAttribute("aria-valuenow", "232");
    const box = (await handle.boundingBox())!;
    await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await window.mouse.down();
    await expect(window.locator(".note-outline-slot")).toHaveAttribute("data-resizing", "true");
    await window.mouse.move(box.x + box.width / 2 - 88, box.y + box.height / 2, { steps: 8 });
    await expect(handle).toHaveAttribute("aria-valuenow", "320");
    expect(await window.evaluate(async () => (await window.inknest.settings.get()))).toMatchObject({ ok: true, data: { outlineWidth: 232 } });
    await window.mouse.up();
    await expect(window.locator(".note-outline-slot")).toHaveAttribute("data-resizing", "false");
    await expect.poll(() => window.evaluate(async () => (await window.inknest.settings.get()))).toMatchObject({ ok: true, data: { outlineWidth: 320 } });
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Notes" }).click();
    await expect(handle).toHaveAttribute("aria-valuenow", "320");
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 900, height: 700 }));
    await expect.poll(() => window.evaluate(() => innerWidth)).toBe(900);
    const available = (await window.locator(".note-workspace").boundingBox())!.width;
    await expect.poll(async () => Number(await handle.getAttribute("aria-valuemax"))).toBeLessThanOrEqual(available - 300);
    await expect(handle).toHaveAttribute("aria-valuenow", String(Math.min(320, Number(await handle.getAttribute("aria-valuemax")))));
    await expect.poll(async () => (await window.locator(".note-writing-scroll").boundingBox())!.width).toBeGreaterThanOrEqual(280);
    const card = (await window.locator(".note-heading-minimap").boundingBox())!;
    const workspace = (await window.locator(".note-workspace").boundingBox())!;
    expect(card.x + card.width).toBeLessThan(workspace.x + workspace.width);
    // The compact sidebar remains usable; the panel shrinks to protect writing space.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 760, height: 700 }));
    await expect.poll(async () => Number(await handle.getAttribute("aria-valuemax"))).toBeLessThan(320);
    await expect(handle).toHaveAttribute("aria-valuenow", (await handle.getAttribute("aria-valuemax"))!);
    await expect(window.locator(".workspace-sidebar")).toBeVisible();
    await expect.poll(async () => (await window.locator(".note-writing-scroll").boundingBox())!.width).toBeGreaterThanOrEqual(280);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 820 }));
    await expect(handle).toHaveAttribute("aria-valuenow", "320");
    await handle.dblclick();
    await expect(handle).toHaveAttribute("aria-valuenow", "232");
    await expect.poll(() => window.evaluate(async () => (await window.inknest.settings.get()))).toMatchObject({ ok: true, data: { outlineWidth: 232 } });
  } finally { await app.close(); }
});

test("minimap keyboard resize has bounds and a cancelled drag keeps its saved width", async ({}, info) => {
  const { app, window } = await launch(info);
  try {
    const handle = window.getByRole("separator", { name: "Resize heading minimap" });
    await handle.press("ArrowLeft");
    await expect(handle).toHaveAttribute("aria-valuenow", "248");
    await handle.press("Shift+ArrowRight");
    await expect(handle).toHaveAttribute("aria-valuenow", "208");
    await handle.press("Home");
    await expect(handle).toHaveAttribute("aria-valuenow", "180");
    await handle.press("ArrowRight");
    await expect(handle).toHaveAttribute("aria-valuenow", "180");
    await handle.press("End");
    await expect(handle).toHaveAttribute("aria-valuenow", "420");
    await handle.press("ArrowLeft");
    await expect(handle).toHaveAttribute("aria-valuenow", "420");
    await expect.poll(() => window.evaluate(async () => (await window.inknest.settings.get()))).toMatchObject({ ok: true, data: { outlineWidth: 420 } });
    const box = (await handle.boundingBox())!;
    await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await window.mouse.down();
    await window.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2);
    await expect(handle).toHaveAttribute("aria-valuenow", "330");
    await window.keyboard.press("Escape");
    await window.mouse.up();
    await expect(handle).toHaveAttribute("aria-valuenow", "420");
    for (const value of ["300", 179, 421, 200.5, null]) {
      const response = await window.evaluate((value) => window.inknest.settings.save({ outlineWidth: value } as any), value);
      expect(response.ok).toBe(false);
    }
    expect(await window.evaluate(async () => (await window.inknest.settings.get()))).toMatchObject({ ok: true, data: { outlineWidth: 420 } });
  } finally { await app.close(); }
});

test("dragging the minimap's visible left edge changes its rendered width at both corners", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info);
  try {
    const before = await readFile(notePath, "utf8");
    const card = window.getByRole("complementary", { name: "Heading minimap" });
    const handle = window.getByRole("separator", { name: "Resize heading minimap" });
    for (const edge of ["bottom", "top", "middle"] as const) {
      const box = (await card.boundingBox())!;
      const x = box.x + 1;
      const y = edge === "top" ? box.y + 6 : edge === "bottom" ? box.y + box.height - 6 : box.y + box.height / 2;
      await window.mouse.move(x, y);
      await window.mouse.down();
      await expect(window.locator(".note-outline-slot")).toHaveAttribute("data-resizing", "true");
      await window.mouse.move(x - 32, y + 2, { steps: 6 });
      await expect.poll(async () => (await card.boundingBox())!.width).toBeCloseTo(box.width + 32, 0);
      await window.mouse.up();
      await expect(window.locator(".note-outline-slot")).toHaveAttribute("data-resizing", "false");
      await expect.poll(() => window.evaluate(async () => (await window.inknest.settings.get()))).toMatchObject({
        ok: true, data: { outlineWidth: Math.round(box.width + 32) }
      });
    }
    const resizedWidth = (await card.boundingBox())!.width;
    await window.getByRole("button", { name: "Show heading minimap", exact: true }).click();
    await expect(card).toHaveCount(0);
    await window.getByRole("button", { name: "Show heading minimap", exact: true }).click();
    await expect(window.locator(".note-heading-minimap")).toHaveCSS("opacity", "1");
    await expect.poll(async () => (await card.boundingBox())!.width).toBeCloseTo(resizedWidth, 0);
    await expect(editor).toContainText("Alpha alpha ALPHA alphabet.");
    expect(await readFile(notePath, "utf8")).toBe(before);
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Notes" }).click();
    await expect.poll(async () => (await card.boundingBox())!.width).toBeCloseTo(resizedWidth, 0);
    await expect(handle).toHaveAttribute("aria-valuenow", String(Math.round(resizedWidth)));
  } finally { await app.close(); }
});

test("minimap respects reduced motion and custom scrollbars follow both themes", async ({}, info) => {
  const markdown = Array.from({ length: 45 }, (_, i) => `## Section ${i + 1}\n\n${"Content. ".repeat(15)}\n`).join("\n");
  const { app, window } = await launch(info, markdown);
  try {
    await window.emulateMedia({ reducedMotion: "reduce" });
    const card = window.locator(".note-heading-minimap");
    await expect(card).toHaveCSS("transition-duration", "0s");
    await window.getByRole("button", { name: "Show heading minimap", exact: true }).click();
    await expect(card).toHaveCSS("visibility", "hidden");
    await window.getByRole("button", { name: "Show heading minimap", exact: true }).click();
    await expect(card).toHaveCSS("opacity", "1");
    const scrollbar = (selector: string) => window.locator(selector).evaluate((node) => {
      const thumb = getComputedStyle(node, "::-webkit-scrollbar-thumb");
      return { radius: thumb.borderRadius, color: thumb.backgroundColor, clip: thumb.backgroundClip,
        width: getComputedStyle(node, "::-webkit-scrollbar").width, standard: getComputedStyle(node).scrollbarWidth };
    });
    await window.getByRole("button", { name: "Settings", exact: true }).click();
    await window.getByLabel("Theme", { exact: true }).selectOption("light");
    await expect(window.locator("html")).toHaveAttribute("data-theme", "light");
    await window.getByRole("button", { name: "Close settings" }).click();
    const light = await scrollbar(".note-outline-scroll");
    expect(light).toMatchObject({ radius: "999px", width: "8px", clip: "padding-box", standard: "auto" });
    expect((await scrollbar(".note-writing-scroll")).width).toBe("10px");
    await window.screenshot({ path: info.outputPath("floating-minimap-light.png") });
    await window.getByRole("button", { name: "Settings", exact: true }).click();
    await window.getByLabel("Theme", { exact: true }).selectOption("dark");
    await expect(window.locator("html")).toHaveAttribute("data-theme", "dark");
    await window.getByRole("button", { name: "Close settings" }).click();
    expect((await scrollbar(".note-outline-scroll")).color).not.toBe(light.color);
    await window.screenshot({ path: info.outputPath("floating-minimap-dark.png") });
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

test("search navigation reveals offscreen matches without moving visible matches or stealing find focus", async ({}, info) => {
  const filler = Array.from({ length: 35 }, (_, index) => `Paragraph ${index}. ${"Some ordinary writing. ".repeat(12)}\n`).join("\n");
  const { app, window, editor, notePath } = await launch(info, `# Notes\n\nneedle first\n\n${filler}\nneedle middle\n\nneedle nearby\n\n${filler}\nneedle last\n`);
  try {
    const before = await readFile(notePath, "utf8");
    await editor.press("Control+Home"); await editor.press("Control+f");
    await queryInput(window).fill("needle");
    const scroller = window.locator(".note-writing-scroll");
    const scrollTop = () => scroller.evaluate((element) => element.scrollTop);
    const visible = () => editor.locator(".note-search-current").evaluate((element) => {
      const viewport = element.closest(".note-writing-scroll")!;
      const match = element.getBoundingClientRect(), area = viewport.getBoundingClientRect();
      return match.top >= area.top && match.bottom <= area.top + viewport.clientHeight;
    });
    const count = panel(window).getByRole("status").first();
    await expect(count).toHaveText("1 of 4");
    await expect.poll(visible).toBe(true);
    const initial = await scrollTop();
    await panel(window).getByRole("button", { name: "Next match" }).click();
    await expect(count).toHaveText("2 of 4");
    await expect.poll(visible).toBe(true);
    expect(await scrollTop()).toBeGreaterThan(initial + 300);
    const middle = await scrollTop();
    await panel(window).getByRole("button", { name: "Next match" }).click();
    await expect(count).toHaveText("3 of 4");
    await expect.poll(visible).toBe(true);
    expect(await scrollTop()).toBeCloseTo(middle, 0);
    await queryInput(window).focus(); await queryInput(window).press("Enter");
    await expect(count).toHaveText("4 of 4");
    await expect.poll(visible).toBe(true);
    await expect(queryInput(window)).toBeFocused();
    expect(await scrollTop()).toBeGreaterThan(middle + 300);
    await queryInput(window).press("Shift+Enter");
    await expect(count).toHaveText("3 of 4");
    await expect.poll(visible).toBe(true);
    await queryInput(window).press("Shift+F3");
    await expect(count).toHaveText("2 of 4");
    await expect.poll(visible).toBe(true);
    await queryInput(window).press("F3");
    await expect(count).toHaveText("3 of 4");
    await queryInput(window).press("Enter");
    await panel(window).getByRole("button", { name: "Next match" }).click();
    await expect(count).toHaveText("1 of 4");
    await expect.poll(visible).toBe(true);
    await panel(window).getByRole("button", { name: "Previous match" }).click();
    await expect(count).toHaveText("4 of 4");
    await expect.poll(visible).toBe(true);
    await expect(panel(window)).toBeVisible();
    expect(await window.locator(".note-workspace").evaluate((element) => element.scrollTop)).toBe(0);
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
    await window.getByRole("button", { name: "Find in note", exact: true }).click();
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
    await editor.press("Control+f");
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
    await window.getByRole("button", { name: "Find in note" }).click();
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
    await window.getByRole("button", { name: "Find in note" }).click();
    await panel(window).getByRole("button", { name: "Use regular expression" }).click();
    await queryInput(window).fill("^");
    await expect(panel(window).getByRole("status").first()).toHaveText("1 of 2");
    await panel(window).getByRole("textbox", { name: "Replace with" }).fill("Prefix ");
    await panel(window).getByRole("button", { name: "Replace all" }).click();
    await expect(editor.locator("p")).toHaveText(["Prefix Alpha", "Prefix Beta"]);
    await expect(panel(window)).toContainText("Replaced 2 matches");
  } finally { await app.close(); }
});
