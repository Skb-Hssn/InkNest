import { _electron as electron, expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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
