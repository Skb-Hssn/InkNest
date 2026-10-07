import { test } from "./fixtures";
import { _electron as electron, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function tabOptions(window: Page, name: string) {
  await window.getByRole("tab", { name, exact: true }).click({ button: "right" });
  const menu = window.getByRole("menu", { name: "Tab options" });
  await expect(menu).toBeVisible();
  return menu;
}

for (const [action, target, remaining, active] of [
  ["Close Tab", "Alpha", ["Beta", "Untitled"], "Untitled"],
  ["Close Tab", "Untitled", ["Alpha", "Beta"], "Beta"],
  ["Close Other Tabs", "Alpha", ["Alpha"], "Alpha"],
  ["Close All Tabs", "Beta", [], null],
  ["Close Tabs to the Right", "Beta", ["Alpha", "Beta"], "Beta"],
  ["Close Tabs to the Right", "Alpha", ["Alpha"], "Alpha"]
] as const) {
  test(`tab menu ${action} on ${target} preserves files and saves closing edits`, async ({}, info) => {
    const root = info.outputPath("workspace");
    const { app, window } = await launchWorkspace(info.outputPath("user-data"), root);
    let closed = false;
    try {
      await window.evaluate(() => window.inknest.settings.save({ autoSaveDelayMs: 5000 }));
      await openNote(window, "Alpha"); await openNote(window, "Beta");
      await window.getByRole("button", { name: "Create new note", exact: true }).click();
      const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
      await expect(editor).toHaveAttribute("contenteditable", "true");
      await editor.click(); await editor.pressSequentially("Preserve this pending edit.");
      const menu = await tabOptions(window, target);
      await expect(menu.getByRole("menuitem")).toHaveText(["Rename", "Close Tab", "Close Other Tabs", "Close All Tabs", "Close Tabs to the Right"]);
      // Right-clicking another tab must not switch away from the active note.
      await expect(window.getByRole("tab", { name: "Untitled", exact: true })).toHaveAttribute("aria-selected", "true");
      await menu.getByRole("menuitem", { name: action, exact: true }).click();
      await expect(window.getByRole("tab")).toHaveText([...remaining]);
      if (active) await expect(window.getByRole("tab", { name: active, exact: true })).toHaveAttribute("aria-selected", "true");
      else await expect(window.getByRole("heading", { name: "No note selected" })).toBeVisible();
      await app.close();
      closed = true;
      expect(await readFile(path.join(root, "Untitled.md"), "utf8")).toContain("Preserve this pending edit.");
      expect(await readFile(path.join(root, "Alpha.md"), "utf8")).toContain("Alpha content.");
      expect(await readFile(path.join(root, "Beta.md"), "utf8")).toContain("Beta content.");
      const restored = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
        env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
      try {
        const reopened = await restored.firstWindow();
        await expect(reopened.getByRole("tab")).toHaveText([...remaining]);
        if (active) await expect(reopened.getByRole("tab", { name: active, exact: true })).toHaveAttribute("aria-selected", "true");
        else await expect(reopened.getByRole("heading", { name: "No note selected" })).toBeVisible();
      } finally { await restored.close(); }
    } finally { if (!closed) await app.close(); }
  });
}

test("tab menu renames inactive notes inline and supports keyboard dismissal and edge actions", async ({}, info) => {
  const { app, window } = await launchWorkspace(info.outputPath("user-data"), info.outputPath("workspace"));
  try {
    await openNote(window, "Alpha"); await openNote(window, "Beta");
    let menu = await tabOptions(window, "Alpha");
    await menu.getByRole("menuitem", { name: "Rename", exact: true }).click();
    const input = window.getByRole("textbox", { name: "Tab name" });
    await expect(input).toBeFocused();
    await input.fill("Renamed Alpha"); await input.press("Enter");
    await expect(window.getByRole("tab", { name: "Renamed Alpha", exact: true })).toBeVisible();
    await expect(window.getByRole("tab", { name: "Beta", exact: true })).toHaveAttribute("aria-selected", "true");
    menu = await tabOptions(window, "Renamed Alpha");
    await menu.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await input.fill(""); await input.press("Enter");
    await expect(input).toBeVisible();
    await input.press("Escape");
    const tab = window.getByRole("tab", { name: "Renamed Alpha", exact: true });
    await expect(tab).toBeFocused();
    await tab.press("Shift+F10");
    menu = window.getByRole("menu", { name: "Tab options" });
    await expect(menu.getByRole("menuitem", { name: "Rename", exact: true })).toBeFocused();
    await window.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Close Tab", exact: true })).toBeFocused();
    await window.keyboard.press("Escape"); await expect(menu).toHaveCount(0);
    await expect(tab).toBeFocused();
    menu = await tabOptions(window, "Beta");
    await expect(menu.getByRole("menuitem", { name: "Close Tabs to the Right", exact: true })).toBeDisabled();
    await window.locator(".note-writing-scroll").click({ position: { x: 20, y: 400 } });
    await expect(menu).toHaveCount(0);
    menu = await tabOptions(window, "Beta");
    await menu.getByRole("menuitem", { name: "Close Other Tabs", exact: true }).click();
    menu = await tabOptions(window, "Beta");
    await expect(menu.getByRole("menuitem", { name: "Close Other Tabs", exact: true })).toBeDisabled();
    await expect(menu.getByRole("menuitem", { name: "Close Tabs to the Right", exact: true })).toBeDisabled();
  } finally { await app.close(); }
});

test("bulk close keeps every tab when the active note has an unresolved save conflict", async ({}, info) => {
  const root = info.outputPath("workspace");
  const { app, window } = await launchWorkspace(info.outputPath("user-data"), root);
  try {
    await window.evaluate(() => window.inknest.settings.save({ autoSaveDelayMs: 5000 }));
    await openNote(window, "Alpha"); await openNote(window, "Beta");
    const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
    await editor.click(); await editor.press("Control+End"); await editor.press("Enter");
    await editor.pressSequentially("Keep unsaved changes.");
    await writeFile(path.join(root, "Beta.md"), "# Beta\n\nExternal change.\n");
    await expect(window.getByRole("alert")).toContainText("changed outside InkNest");
    const menu = await tabOptions(window, "Alpha");
    await menu.getByRole("menuitem", { name: "Close All Tabs", exact: true }).click();
    await expect(window.getByRole("tab")).toHaveText(["Alpha", "Beta"]);
    await expect(editor).toContainText("Keep unsaved changes.");
    await window.getByRole("alert").getByRole("button", { name: "Reload from disk" }).click();
    await expect(editor).toContainText("External change.");
  } finally { await app.close(); }
});

async function launchWorkspace(userDataDir: string, workspaceDir: string) {
  await mkdir(path.join(workspaceDir, "Folder"), { recursive: true });
  await writeFile(path.join(workspaceDir, "Alpha.md"), "# Alpha\n\nAlpha content.\n");
  await writeFile(path.join(workspaceDir, "Beta.md"), "# Beta\n\nBeta content.\n");
  await writeFile(path.join(workspaceDir, "Folder", "Gamma.md"), "# Gamma\n");
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu", "--disable-gpu-compositing", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: userDataDir, ELECTRON_RUN_AS_NODE: undefined }
  });
  const window = await app.firstWindow();
  await window.evaluate((workspacePath) => window.inknest.workspace.select(workspacePath), workspaceDir);
  await window.reload();
  await expect(window.locator(".note-open-area").filter({ hasText: "Alpha" })).toBeVisible();
  return { app, window };
}

async function openNote(window: Page, name: string) {
  await window.locator(".note-open-area").filter({ hasText: name }).click();
  await expect(window.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(window.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-disabled", "false");
}

async function renameNote(window: Page, name: string, newName: string) {
  const row = window.locator(".note-row").filter({ hasText: name });
  await row.hover();
  await row.getByRole("button", { name: "Note actions" }).click();
  await row.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const input = window.getByRole("textbox", { name: "File name" });
  await input.fill(newName);
  await input.press("Enter");
  await expect(window.getByRole("tab", { name: newName, exact: true })).toBeVisible();
  await expect(window.getByRole("tab", { name: newName, exact: true })).toHaveAttribute("aria-disabled", "false");
}

test("note tabs switch, save edits, reuse open tabs, and close without deleting notes", async ({}, testInfo) => {
  const workspaceDir = testInfo.outputPath("workspace");
  const { app, window } = await launchWorkspace(testInfo.outputPath("user-data"), workspaceDir);
  try {
    await openNote(window, "Alpha");
    await openNote(window, "Beta");
    await expect(window.getByRole("tab")).toHaveCount(2);
    await window.screenshot({ path: testInfo.outputPath("note-tabs.png") });
    await openNote(window, "Alpha");
    await expect(window.getByRole("tab")).toHaveCount(2);

    const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
    await editor.click();
    await editor.press("Control+End");
    await editor.press("Enter");
    await editor.pressSequentially("Edits kept when switching tabs.");
    await window.getByRole("tab", { name: "Beta", exact: true }).click();
    await expect(editor).toContainText("Beta content.");
    await expect.poll(() => readFile(path.join(workspaceDir, "Alpha.md"), "utf8")).toContain("Edits kept when switching tabs.");
    await window.getByRole("tab", { name: "Alpha", exact: true }).click();
    await expect(editor).toContainText("Edits kept when switching tabs.");

    await window.getByRole("tab", { name: "Alpha", exact: true }).press("ArrowRight");
    await expect(window.getByRole("tab", { name: "Beta", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(window.getByRole("tab", { name: "Beta", exact: true })).toBeFocused();
    await window.getByRole("button", { name: "Close Alpha tab", exact: true }).click();
    await expect(window.getByRole("tab")).toHaveCount(1);
    await expect(editor).toContainText("Beta content.");

    await editor.click();
    await editor.press("Control+End");
    await editor.press("Enter");
    await editor.pressSequentially("Edits kept when closing tabs.");
    await window.getByRole("button", { name: "Close Beta tab", exact: true }).click();
    await expect(window.getByRole("tab")).toHaveCount(0);
    await expect(window.getByRole("heading", { name: "No note selected" })).toBeVisible();
    expect(await readFile(path.join(workspaceDir, "Beta.md"), "utf8")).toContain("Edits kept when closing tabs.");
    await openNote(window, "Alpha");
    await openNote(window, "Beta");
    await window.getByRole("button", { name: "Close Beta tab", exact: true }).click();
    await expect(window.getByRole("tab", { name: "Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(editor).toContainText("Edits kept when switching tabs.");
  } finally {
    await app.close();
  }
});

test("the tab bar plus creates unique unnamed notes, even after all tabs close", async ({}, testInfo) => {
  const workspaceDir = testInfo.outputPath("workspace");
  const { app, window } = await launchWorkspace(testInfo.outputPath("user-data"), workspaceDir);
  try {
    const plus = window.getByRole("button", { name: "Create new note", exact: true });
    await plus.click();
    await expect(window.getByRole("tab", { name: "Untitled", exact: true })).toHaveAttribute("aria-selected", "true");
    await plus.click();
    await expect(window.getByRole("tab", { name: "Untitled 2", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(window.getByRole("tab")).toHaveCount(2);
    await window.getByRole("button", { name: "Close Untitled 2 tab" }).click();
    await window.getByRole("button", { name: "Close Untitled tab" }).click();
    await expect(window.getByRole("tab")).toHaveCount(0);
    await plus.click();
    await expect(window.getByRole("tab", { name: "Untitled 3", exact: true })).toHaveAttribute("aria-selected", "true");
    expect(await readFile(path.join(workspaceDir, "Untitled.md"), "utf8")).toBe("");
    expect(await readFile(path.join(workspaceDir, "Untitled 2.md"), "utf8")).toBe("");
  } finally {
    await app.close();
  }
});

test("renaming and trashing notes keeps active and inactive tabs in sync", async ({}, testInfo) => {
  const { app, window } = await launchWorkspace(testInfo.outputPath("user-data"), testInfo.outputPath("workspace"));
  try {
    await openNote(window, "Alpha");
    await openNote(window, "Beta");
    await renameNote(window, "Alpha", "Renamed Alpha");
    await expect(window.getByRole("tab", { name: "Beta", exact: true })).toHaveAttribute("aria-selected", "true");
    await renameNote(window, "Beta", "Renamed Beta");
    await expect(window.getByRole("tab")).toHaveCount(2);
    await expect(window.getByRole("tab", { name: "Renamed Beta", exact: true })).toHaveAttribute("aria-selected", "true");
    const row = window.locator(".note-row").filter({ hasText: "Renamed Beta" });
    await row.hover();
    await row.getByRole("button", { name: "Note actions" }).click();
    window.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await expect(window.getByRole("tab")).toHaveCount(1);
    await expect(window.getByRole("tab", { name: "Renamed Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toContainText("Alpha content.");
  } finally {
    await app.close();
  }
});

test("folder renames preserve open tabs and folder deletion selects a remaining note", async ({}, testInfo) => {
  const workspaceDir = testInfo.outputPath("workspace");
  const { app, window } = await launchWorkspace(testInfo.outputPath("user-data"), workspaceDir);
  try {
    await openNote(window, "Alpha");
    const folderRow = window.locator(".tree-row").filter({ has: window.locator('.tree-open-area span[title="Folder"]') });
    await folderRow.getByRole("button", { name: "Expand folder", exact: true }).click();
    await openNote(window, "Gamma");
    await folderRow.hover();
    await folderRow.getByRole("button", { name: "Folder actions" }).click();
    await folderRow.getByRole("menuitem", { name: "Rename", exact: true }).click();
    const input = window.getByRole("textbox", { name: "Folder name" });
    await input.fill("Renamed Folder");
    await input.press("Enter");
    await expect(window.getByRole("tab", { name: "Gamma", exact: true })).toHaveAttribute("title", "Renamed Folder/Gamma.md");
    await expect(window.getByRole("tab", { name: "Gamma", exact: true })).toHaveAttribute("aria-disabled", "false");
    await expect(window.getByRole("tab")).toHaveCount(2);
    const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
    await editor.click();
    await editor.press("Control+End");
    await editor.press("Enter");
    await editor.pressSequentially("Saved after folder rename.");
    await window.getByRole("tab", { name: "Alpha", exact: true }).click();
    expect(await readFile(path.join(workspaceDir, "Renamed Folder", "Gamma.md"), "utf8")).toContain("Saved after folder rename.");
    await window.getByRole("tab", { name: "Gamma", exact: true }).click();
    const renamedFolderRow = window.locator(".tree-row").filter({ has: window.locator('.tree-open-area span[title="Renamed Folder"]') });
    await renamedFolderRow.hover();
    await renamedFolderRow.getByRole("button", { name: "Folder actions" }).click();
    window.once("dialog", (dialog) => dialog.accept());
    await renamedFolderRow.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await expect(window.getByRole("tab")).toHaveCount(1);
    await expect(window.getByRole("tab", { name: "Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(editor).toContainText("Alpha content.");
  } finally {
    await app.close();
  }
});
