import { _electron as electron, expect, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, toolbarButton } from "./fixtures";

test.use({ existingInstallation: false });
async function launch(info: TestInfo) {
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  const window = await app.firstWindow();
  await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toBeVisible();
  return { app, window };
}

test("first launch opens real local example notes and preserves edited content on restart", async ({}, info) => {
  let { app, window } = await launch(info);
  try {
    const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
    await expect(window.getByRole("tab")).toHaveCount(3);
    await expect(editor.locator("h1")).toHaveText("Ideas worth keeping");
    await expect(editor.locator(".katex")).toHaveCount(2);
    await expect(editor.locator("table tr")).toHaveCount(3);
    await expect(window.locator(".workspace-sidebar")).toContainText("Research");
    await window.getByRole("tab", { name: "Untitled", exact: true }).click();
    await expect(editor).toHaveText("");
    const settings = await window.evaluate(() => window.inknest.settings.get());
    expect(settings.ok).toBe(true);
    if (!settings.ok) throw new Error(settings.error.message);
    const file = path.join(settings.data.lastWorkspacePath!, "Notes", "Untitled.md");
    expect(await readFile(file, "utf8")).toBe("");
    await editor.click(); await editor.pressSequentially("My own note.");
    await expect.poll(() => readFile(file, "utf8")).toContain("My own note.");
    const deleted = await window.evaluate(() => window.inknest.notes.delete({ path: "Notes/Ideas worth keeping.md" }));
    expect(deleted.ok).toBe(true);
    await app.close();
    ({ app, window } = await launch(info));
    await expect(window.getByRole("tab")).toHaveCount(2);
    await window.getByRole("tab", { name: "Untitled", exact: true }).click();
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toHaveText("My own note.");
  } finally { await app.close(); }
});

test("reference layout renders both themes and inline find/replace without overlap", async ({}, info) => {
  const { app, window } = await launch(info);
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 1280, height: 900 }));
    const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
    for (const theme of ["light", "dark"] as const) {
      await window.evaluate(async (theme) => { await window.inknest.settings.save({ theme }); }, theme);
      await window.reload();
      await expect(editor.locator("h1")).toHaveText("Ideas worth keeping");
      await expect(window.getByRole("complementary", { name: "Heading minimap" })).toContainText("On this page");
      await expect(editor.locator("h1")).toHaveCSS("font-family", await editor.locator("p").first().evaluate((element) => getComputedStyle(element).fontFamily));
      const sidebar = (await window.locator(".workspace-sidebar").boundingBox())!;
      expect(sidebar.width).toBeGreaterThanOrEqual(210); expect(sidebar.width).toBeLessThanOrEqual(240);
      await expect(window.locator(".sidebar-ribbon")).toHaveCount(0);
      await window.screenshot({ path: info.outputPath(`inknest-${theme}.png`) });
    }
    await window.evaluate(() => window.inknest.settings.save({ theme: "light" }));
    await window.reload(); await expect(editor).toBeVisible();
    await editor.press("Control+h");
    const panel = window.getByRole("region", { name: "Find in note" });
    await panel.getByRole("textbox", { name: "Find in note", exact: true }).fill("ideas");
    await panel.getByRole("textbox", { name: "Replace with" }).fill("thoughts");
    await expect(editor.locator(".note-search-match")).not.toHaveCount(0);
    await expect(window.getByRole("complementary", { name: "Heading minimap" })).toBeVisible();
    const findBounds = (await panel.boundingBox())!, writing = (await window.locator(".note-writing-scroll").boundingBox())!;
    expect(writing.y).toBeGreaterThanOrEqual(findBounds.y + findBounds.height - 1);
    await window.screenshot({ path: info.outputPath("inknest-find-replace.png") });
    await panel.getByRole("button", { name: "Replace all", exact: true }).click();
    await expect(editor).toContainText("thoughts worth keeping");
    await panel.getByRole("button", { name: "Close find" }).click();
    await (await toolbarButton(window, "H3")).click();
    await expect(editor.locator("h3")).not.toHaveCount(0);
  } finally { await app.close(); }
});


test("floating heading panel resizes at its corner and sidebar shortcuts remain usable", async ({}, info) => {
  const { app, window } = await launch(info);
  try {
    const card = window.getByRole("complementary", { name: "Heading minimap" });
    const before = (await card.boundingBox())!;
    const grip = (await window.getByRole("separator", { name: "Resize heading panel", exact: true }).boundingBox())!;
    await window.mouse.move(grip.x + 6, grip.y + 6); await window.mouse.down();
    await window.mouse.move(grip.x + 31, grip.y + 66, { steps: 8 }); await window.mouse.up();
    await expect.poll(async () => (await card.boundingBox())!.width).toBeGreaterThan(before.width + 20);
    await expect.poll(async () => (await card.boundingBox())!.height).toBeGreaterThan(before.height + 40);
    await window.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    await expect(window.locator(".workspace-sidebar")).not.toBeVisible();
    await window.keyboard.press("Control+k");
    await expect(window.locator(".workspace-sidebar")).toBeVisible();
    await expect(window.getByRole("searchbox", { name: "Search notes" })).toBeFocused();
    await window.getByRole("searchbox", { name: "Search notes" }).fill("roadmap");
    await expect(window.locator(".note-open-area")).toHaveCount(1);
    await window.getByRole("button", { name: "Clear search" }).click();
    await window.locator(".tree-row").filter({ hasText: "Notes" }).first().hover();
    await window.getByRole("button", { name: "Create note in Notes", exact: true }).click();
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toHaveText("");
    await window.locator(".recent-workspace-row").filter({ hasText: "Research" }).click();
    await expect(window.getByRole("heading", { name: "No note selected" })).toBeVisible();
    await window.getByRole("button", { name: "Create new note", exact: true }).click();
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toHaveText("");
    const created = await window.evaluate(() => window.inknest.notes.read("Untitled.md"));
    expect(created).toMatchObject({ ok: true, data: { path: "Untitled.md", markdown: "" } });
  } finally { await app.close(); }
});
