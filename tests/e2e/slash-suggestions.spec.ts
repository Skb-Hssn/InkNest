import { _electron as electron, expect, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "./fixtures";

async function launch(info: TestInfo, body = "") {
  const root = info.outputPath("workspace");
  await mkdir(root, { recursive: true });
  const notePath = path.join(root, "Commands.md");
  await writeFile(notePath, body);
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  const window = await app.firstWindow();
  await window.evaluate(root => window.inknest.workspace.select(root), root);
  await window.reload();
  await window.locator(".note-open-area").filter({ hasText: "Commands" }).click();
  const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
  await expect(editor).toHaveAttribute("contenteditable", "true");
  return { app, window, editor, notePath };
}

test("slash shows all formatting options and keyboard selection saves and reopens a heading", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info);
  const errors: string[] = [];
  window.on("pageerror", error => errors.push(error.message));
  try {
    await editor.click(); await editor.pressSequentially("/");
    const menu = window.getByRole("listbox", { name: "Formatting suggestions" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("option")).toHaveCount(31);
    await expect(menu.getByRole("option", { name: "Delete table", exact: true })).toBeDisabled();
    await expect(menu.getByRole("option", { name: "Heading 1", exact: true })).toHaveAttribute("aria-selected", "true");
    await editor.press("ArrowDown"); await editor.press("Enter");
    await expect(menu).not.toBeVisible();
    await editor.pressSequentially("A heading");
    await expect(editor.locator("h2")).toHaveText("A heading");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("## A heading");
    await window.getByRole("button", { name: "Close Commands tab" }).click();
    await window.locator(".note-open-area").filter({ hasText: "Commands" }).click();
    await expect(editor.locator("h2")).toHaveText("A heading");
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});

test("slash filters names and aliases, supports Tab selection, and leaves ordinary slashes alone", async ({}, info) => {
  const { app, window, editor } = await launch(info);
  try {
    const menu = window.getByRole("listbox", { name: "Formatting suggestions" });
    await editor.click(); await editor.pressSequentially("/numbered");
    await expect(menu.getByRole("option")).toHaveCount(1);
    await editor.press("Tab"); await editor.pressSequentially("First item");
    await expect(editor.locator("ol li")).toContainText("First item");
    await editor.press("Enter"); await editor.press("Enter");
    await editor.pressSequentially("https://example.com/a/b");
    await expect(menu).not.toBeVisible();
    await editor.press("Enter"); await editor.pressSequentially("/unknown-formatting");
    await expect(window.locator(".inknest-slash-heading")).toContainText("No matching formatting options");
    await editor.press("Escape"); await editor.press("Enter");
    await expect(editor).toContainText("/unknown-formatting");
    await expect(menu).not.toBeVisible();
  } finally { await app.close(); }
});

test("mouse selection preserves preceding text and routes link insertion to its dialog", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info);
  try {
    const menu = window.getByRole("listbox", { name: "Formatting suggestions" });
    await editor.click(); await editor.pressSequentially("Prefix /italic");
    await menu.getByRole("option", { name: "Italic", exact: true }).click();
    await editor.pressSequentially("styled");
    await expect(editor.locator("em")).toHaveText("styled");
    await expect(editor).toContainText("Prefix styled");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("*styled*");
    await editor.press("Enter"); await editor.pressSequentially("/link");
    await menu.getByRole("option", { name: "Link", exact: true }).click();
    await expect(window.locator(".link-popover")).toBeVisible();
    await expect(editor).not.toContainText("/link");
    await window.locator(".link-popover").getByRole("button", { name: "Cancel", exact: true }).click();
  } finally { await app.close(); }
});

test("Escape preserves exact slash text and code or locked notes cannot open suggestions", async ({}, info) => {
  const { app, window, editor } = await launch(info);
  try {
    const menu = window.getByRole("listbox", { name: "Formatting suggestions" });
    await editor.click(); await editor.pressSequentially("/heading");
    await expect(menu).toBeVisible();
    await editor.press("Escape"); await editor.press("Enter");
    await expect(editor.locator("h1")).toHaveCount(0);
    await expect(editor).toContainText("/heading");
    await editor.pressSequentially("/code");
    await editor.press("Enter");
    await expect(editor.locator("pre")).toHaveCount(1);
    await editor.pressSequentially("/table");
    await expect(menu).not.toBeVisible();
    await window.getByRole("button", { name: "Lock note", exact: true }).click();
    await expect(window.getByRole("button", { name: "Unlock note", exact: true })).toBeEnabled();
    await editor.focus(); await editor.pressSequentially("/");
    await expect(menu).not.toBeVisible();
    await window.getByRole("button", { name: "Close Commands tab" }).click();
    await expect(window.locator(".inknest-slash-menu")).toHaveCount(0);
  } finally { await app.close(); }
});

test("table actions are enabled only inside tables and mouse selection deletes the selected table", async ({}, info) => {
  const { app, window, editor } = await launch(info, "| A | B |\n| --- | --- |\n| 1 | 2 |\n");
  try {
    await editor.locator("th p").first().click();
    await editor.press("End"); await editor.pressSequentially(" /");
    const menu = window.getByRole("listbox", { name: "Formatting suggestions" });
    await expect(menu.getByRole("option", { name: "Add table row", exact: true })).toBeEnabled();
    await expect(menu.getByRole("option", { name: "Display math", exact: true })).toBeDisabled();
    await menu.getByRole("option", { name: "Delete table", exact: true }).click();
    await expect(editor.locator("table")).toHaveCount(0);
    await expect(menu).not.toBeVisible();
  } finally { await app.close(); }
});

test("suggestions stay within the window, dismiss outside, and reopen after retyping slash", async ({}, info) => {
  const { app, window, editor } = await launch(info, "Paragraph.\n\n".repeat(40));
  try {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 900, height: 600 }));
    await editor.click(); await editor.press("Control+End"); await editor.press("Enter");
    await editor.pressSequentially("/");
    const menu = window.getByRole("listbox", { name: "Formatting suggestions" });
    await expect(menu).toBeVisible();
    await editor.press("End");
    await expect(menu.getByRole("option", { name: "Divider", exact: true })).toHaveAttribute("aria-selected", "true");
    const popup = (await window.locator(".inknest-slash-menu").boundingBox())!;
    const viewport = await window.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(popup.x).toBeGreaterThanOrEqual(8);
    expect(popup.y).toBeGreaterThanOrEqual(8);
    expect(popup.x + popup.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(popup.y + popup.height).toBeLessThanOrEqual(viewport.height - 8);
    await window.screenshot({ path: info.outputPath("slash-menu.png") });
    await window.getByRole("searchbox", { name: "Search notes" }).click();
    await expect(menu).not.toBeVisible();
    await editor.locator("p").last().click(); await editor.press("End"); await editor.press("Backspace");
    await editor.pressSequentially("/");
    await expect(menu).toBeVisible();
    await editor.press("Escape"); await expect(menu).not.toBeVisible();
  } finally { await app.close(); }
});
