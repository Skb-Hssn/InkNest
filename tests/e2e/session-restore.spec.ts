import { _electron as electron, expect, type TestInfo, type Page } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "./fixtures";

async function launch(info: TestInfo) {
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  const window = await app.firstWindow();
  return { app, window };
}
async function workspace(info: TestInfo, name = "workspace") {
  const root = info.outputPath(name);
  await mkdir(root, { recursive: true });
  for (const note of ["Alpha", "Beta", "Gamma"]) await writeFile(path.join(root, `${note}.md`), `# ${note}\n\n${note} content.\n`);
  return root;
}
async function selectWorkspace(window: Page, root: string) {
  await window.evaluate((root) => window.inknest.workspace.select(root), root);
  await window.reload();
  await expect(window.locator(".note-open-area").filter({ hasText: "Alpha" })).toBeVisible();
}
async function open(window: Page, name: string) {
  await window.locator(".note-open-area").filter({ hasText: name }).click();
  await expect(window.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toHaveAttribute("contenteditable", "true");
}

test("restart restores tab order and active note and flushes immediate edits", async ({}, info) => {
  const root = await workspace(info);
  let { app, window } = await launch(info);
  try {
    await window.evaluate(() => window.inknest.settings.save({ autoSaveDelayMs: 5000 }));
    await selectWorkspace(window, root);
    for (const name of ["Beta", "Alpha", "Gamma", "Alpha"]) await open(window, name);
    const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
    await editor.click(); await editor.press("Control+End"); await editor.press("Enter");
    await editor.pressSequentially("Saved immediately on close.");
    await app.close();
    ({ app, window } = await launch(info));
    await expect(window.getByRole("tab")).toHaveText(["Beta", "Alpha", "Gamma"]);
    await expect(window.getByRole("tab", { name: "Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toContainText("Saved immediately on close.");
    expect(await readFile(path.join(root, "Alpha.md"), "utf8")).toContain("Saved immediately on close.");
  } finally { await app.close(); }
});

test("closed tabs stay closed and unavailable active files fall back to a surviving tab", async ({}, info) => {
  const root = await workspace(info);
  let { app, window } = await launch(info);
  try {
    await selectWorkspace(window, root);
    for (const name of ["Alpha", "Beta", "Gamma"]) await open(window, name);
    await window.getByRole("button", { name: "Close Beta tab" }).click();
    await expect(window.getByRole("tab")).toHaveCount(2);
    await app.close();
    await rm(path.join(root, "Gamma.md"));
    ({ app, window } = await launch(info));
    await expect(window.getByRole("tab")).toHaveText(["Alpha"]);
    await expect(window.getByRole("tab", { name: "Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await window.getByRole("button", { name: "Close Alpha tab" }).click();
    await expect(window.getByRole("tab")).toHaveCount(0);
    await app.close();
    ({ app, window } = await launch(info));
    await expect(window.getByRole("heading", { name: "No note selected" })).toBeVisible();
    await expect(window.getByRole("tab")).toHaveCount(0);
  } finally { await app.close(); }
});

test("each workspace restores its own session when switching or restarting", async ({}, info) => {
  const a = await workspace(info, "Workspace A"), b = await workspace(info, "Workspace B");
  let { app, window } = await launch(info);
  try {
    await selectWorkspace(window, a); await open(window, "Beta"); await open(window, "Alpha");
    // Replace only the native folder picker; exercise the actual UI switch.
    await app.evaluate(({ dialog }, root) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [root] }); }, b);
    await window.locator(".workspace-button").click();
    await open(window, "Gamma");
    await window.locator(".recent-workspace-row").filter({ hasText: "Workspace A" }).click();
    await expect(window.getByRole("tab")).toHaveText(["Beta", "Alpha"]);
    await expect(window.getByRole("tab", { name: "Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await window.locator(".recent-workspace-row").filter({ hasText: "Workspace B" }).click();
    await expect(window.getByRole("tab")).toHaveText(["Gamma"]);
    await app.close();
    ({ app, window } = await launch(info));
    await expect(window.getByRole("tab")).toHaveText(["Gamma"]);
  } finally { await app.close(); }
});

test("renamed notes restore under their new path and unsafe session paths are rejected", async ({}, info) => {
  const root = await workspace(info);
  let { app, window } = await launch(info);
  try {
    await selectWorkspace(window, root); await open(window, "Alpha");
    const row = window.locator(".note-row").filter({ hasText: "Alpha" });
    await row.hover(); await row.getByRole("button", { name: "Note actions" }).click();
    await row.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await window.getByRole("textbox", { name: "File name" }).fill("Renamed");
    await window.getByRole("textbox", { name: "File name" }).press("Enter");
    await expect(window.getByRole("tab", { name: "Renamed", exact: true })).toHaveAttribute("aria-disabled", "false");
    const invalid = await window.evaluate((root) => window.inknest.workspace.saveSession({ workspacePath: root, openNotePaths: ["../outside.md"], activeNotePath: "../outside.md" }), root);
    expect(invalid.ok).toBe(false);
    await app.close();
    ({ app, window } = await launch(info));
    await expect(window.getByRole("tab")).toHaveText(["Renamed"]);
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toContainText("Alpha content.");
  } finally { await app.close(); }
});

test("folder renames and a canceled workspace picker preserve the current session", async ({}, info) => {
  const root = await workspace(info);
  await mkdir(path.join(root, "Project"));
  await writeFile(path.join(root, "Project", "Nested.md"), "# Nested\n\nNested body.\n");
  let { app, window } = await launch(info);
  try {
    await selectWorkspace(window, root); await open(window, "Alpha");
    const folder = window.locator(".tree-row").filter({ hasText: "Project" }).first();
    await folder.getByRole("button", { name: "Expand folder", exact: true }).click();
    await open(window, "Nested");
    await folder.hover(); await folder.getByRole("button", { name: "Folder actions" }).click();
    await folder.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await window.getByRole("textbox", { name: "Folder name" }).fill("Renamed folder");
    await window.getByRole("textbox", { name: "Folder name" }).press("Enter");
    await expect.poll(() => window.evaluate(() => window.inknest.workspace.getSession())).toMatchObject({ ok: true,
      data: { openNotePaths: ["Alpha.md", "Renamed folder/Nested.md"], activeNotePath: "Renamed folder/Nested.md" } });
    await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }); });
    await window.locator(".workspace-button").click();
    await expect(window.getByRole("tab")).toHaveText(["Alpha", "Nested"]);
    await expect(window.getByRole("tab", { name: "Nested", exact: true })).toHaveAttribute("aria-selected", "true");
    await app.close();
    ({ app, window } = await launch(info));
    await expect(window.getByRole("tab")).toHaveText(["Alpha", "Nested"]);
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toContainText("Nested body.");
  } finally { await app.close(); }
});

test("own-save notifications do not block saving later edits on close", async ({}, info) => {
  const root = await workspace(info);
  let { app, window } = await launch(info);
  try {
    await window.evaluate(() => window.inknest.settings.save({ autoSaveDelayMs: 5000 }));
    await selectWorkspace(window, root); await open(window, "Alpha");
    const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
    await editor.click(); await editor.press("Control+End"); await editor.press("Enter");
    await editor.pressSequentially("Keep these newer edits.");
    // The disk still matches the saved baseline while the local edits are dirty.
    // Deliver the same notification the filesystem watcher uses for an own save.
    await app.evaluate(({ BrowserWindow }, root) => BrowserWindow.getAllWindows()[0].webContents.send("workspace:changed", {
      workspacePath: root, createdPaths: [], changedPaths: ["Alpha.md"], deletedPaths: [], workspaceStatus: "ready"
    }), root);
    await app.close();
    ({ app, window } = await launch(info));
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toContainText("Keep these newer edits.");
    expect(await readFile(path.join(root, "Alpha.md"), "utf8")).toContain("Keep these newer edits.");
  } finally { await app.close(); }
});

test.describe("first-launch example", () => {
  test.use({ existingInstallation: false });
  test("closing every example tab stays closed on restart", async ({}, info) => {
    let { app, window } = await launch(info);
    try {
      await expect(window.getByRole("tab")).toHaveCount(3);
      for (const name of ["Ideas worth keeping", "Reading list", "Untitled"]) {
        await window.getByRole("button", { name: `Close ${name} tab` }).click();
      }
      await expect(window.getByRole("tab")).toHaveCount(0);
      await app.close();
      ({ app, window } = await launch(info));
      await expect(window.getByRole("heading", { name: "No note selected" })).toBeVisible();
      await expect(window.getByRole("tab")).toHaveCount(0);
    } finally { await app.close(); }
  });
});
