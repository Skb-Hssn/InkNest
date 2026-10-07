import { _electron as electron, expect, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "./fixtures";

async function launch(info: TestInfo) {
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  const window = await app.firstWindow();
  return { app, window };
}
async function setup(info: TestInfo) {
  const root = info.outputPath("workspace");
  await mkdir(path.join(root, "Folder"), { recursive: true });
  await writeFile(path.join(root, "Alpha.md"), "# Alpha\n\nAlpha body.\n");
  await writeFile(path.join(root, "Beta.md"), "# Beta\n\nBeta body.\n");
  await writeFile(path.join(root, "Folder/Gamma.md"), "# Gamma\n\nGamma body.\n");
  const result = await launch(info);
  await result.window.evaluate(root => window.inknest.workspace.select(root), root);
  await result.window.reload();
  return { ...result, root };
}

test("toolbar favorites persist, quick access reuses tabs, collapse works, and removing keeps the file", async ({}, info) => {
  let { app, window, root } = await setup(info);
  try {
    await window.locator(".note-open-area").filter({ hasText: "Alpha" }).click();
    await window.getByRole("button", { name: "Add to favorites", exact: true }).click();
    await expect(window.getByRole("button", { name: "Remove from favorites", exact: true })).toBeEnabled();
    const favorites = window.getByRole("region", { name: "Favorite notes" });
    await expect(favorites.getByRole("button", { name: "Open favorite Alpha" })).toBeVisible();
    await favorites.getByRole("button", { name: "Collapse favorites" }).click();
    await expect(favorites.getByRole("button", { name: "Open favorite Alpha" })).toHaveCount(0);
    await favorites.getByRole("button", { name: "Expand favorites" }).click();
    await window.locator(".note-open-area").filter({ hasText: "Beta" }).click();
    await favorites.getByRole("button", { name: "Open favorite Alpha" }).click();
    await expect(window.getByRole("tab")).toHaveText(["Alpha", "Beta"]);
    await expect(window.getByRole("tab", { name: "Alpha", exact: true })).toHaveAttribute("aria-selected", "true");
    await app.close();
    ({ app, window } = await launch(info));
    const reopened = window.getByRole("region", { name: "Favorite notes" });
    await expect(reopened.getByRole("button", { name: "Open favorite Alpha" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Remove from favorites", exact: true })).toHaveAttribute("aria-pressed", "true");
    await reopened.hover();
    await reopened.getByRole("button", { name: "Remove Alpha from favorites" }).click();
    await expect(reopened).toHaveCount(0);
    await expect(window.getByRole("button", { name: "Add to favorites", exact: true })).toBeEnabled();
    expect(await readFile(path.join(root, "Alpha.md"), "utf8")).toBe("# Alpha\n\nAlpha body.\n");
  } finally { await app.close(); }
});

test("file menus favorite unopened notes, respect search filtering and keep workspaces independent", async ({}, info) => {
  const { app, window, root } = await setup(info);
  try {
    const row = window.locator(".note-row").filter({ hasText: "Beta" });
    await row.hover(); await row.getByRole("button", { name: "Note actions" }).click();
    await row.getByRole("menuitem", { name: "Add to favorites", exact: true }).click();
    const favorites = window.getByRole("region", { name: "Favorite notes" });
    await expect(favorites.getByRole("button", { name: "Open favorite Beta" })).toBeVisible();
    await expect(window.getByRole("tab")).toHaveCount(0);
    const search = window.getByRole("searchbox", { name: "Search notes" });
    await search.fill("Alpha");
    await expect(favorites).toHaveCount(0);
    await expect(window.locator(".note-open-area span[title]")).toHaveText(["Alpha"]);
    await window.getByRole("button", { name: "Clear search" }).click();
    await favorites.getByRole("button", { name: "Open favorite Beta" }).click();
    const other = info.outputPath("other");
    await mkdir(other); await writeFile(path.join(other, "Beta.md"), "# Other Beta\n");
    await window.evaluate(root => window.inknest.workspace.select(root), other);
    await window.reload();
    await expect(window.getByRole("region", { name: "Favorite notes" })).toHaveCount(0);
    await window.locator(".note-open-area").filter({ hasText: "Beta" }).click();
    await expect(window.getByRole("button", { name: "Add to favorites", exact: true })).toBeVisible();
    await window.evaluate(root => window.inknest.workspace.select(root), root);
    await window.reload();
    await expect(window.getByRole("region", { name: "Favorite notes" }).getByRole("button", { name: "Open favorite Beta" })).toBeVisible();
  } finally { await app.close(); }
});

test("favorites follow file and folder renames and work for locked notes", async ({}, info) => {
  const { app, window } = await setup(info);
  try {
    const folder = window.locator(".tree-row").filter({ has: window.locator('.tree-open-area span[title="Folder"]') });
    await folder.getByRole("button", { name: "Expand folder", exact: true }).click();
    await window.locator(".note-open-area").filter({ hasText: "Gamma" }).click();
    await window.getByRole("button", { name: "Lock note", exact: true }).click();
    await expect(window.getByRole("button", { name: "Unlock note", exact: true })).toBeEnabled();
    await window.getByRole("button", { name: "Add to favorites", exact: true }).click();
    await expect(window.getByRole("button", { name: "Remove from favorites", exact: true })).toBeEnabled();
    const row = window.locator(".note-row").filter({ hasText: "Gamma" });
    await row.hover(); await row.getByRole("button", { name: "Note actions" }).click();
    await row.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await window.getByRole("textbox", { name: "File name" }).fill("Renamed");
    await window.getByRole("textbox", { name: "File name" }).press("Enter");
    const favorites = window.getByRole("region", { name: "Favorite notes" });
    await expect(favorites.getByRole("button", { name: "Open favorite Renamed" })).toHaveAttribute("title", "Folder/Renamed.md");
    await expect(window.getByRole("button", { name: "Unlock note", exact: true })).toBeEnabled();
    await folder.hover(); await folder.getByRole("button", { name: "Folder actions" }).click();
    await folder.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await window.getByRole("textbox", { name: "Folder name" }).fill("New Folder");
    await window.getByRole("textbox", { name: "Folder name" }).press("Enter");
    await expect(favorites.getByRole("button", { name: "Open favorite Renamed" })).toHaveAttribute("title", "New Folder/Renamed.md");
    await favorites.getByRole("button", { name: "Open favorite Renamed" }).click();
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toHaveAttribute("contenteditable", "false");
  } finally { await app.close(); }
});

test("trashing a favorite hides it and restoring the note brings it back", async ({}, info) => {
  const { app, window } = await setup(info);
  try {
    await window.locator(".note-open-area").filter({ hasText: "Alpha" }).click();
    await window.getByRole("button", { name: "Add to favorites", exact: true }).click();
    await expect(window.getByRole("button", { name: "Remove from favorites", exact: true })).toBeEnabled();
    const row = window.locator(".note-row").filter({ hasText: "Alpha" });
    await row.hover(); await row.getByRole("button", { name: "Note actions" }).click();
    window.once("dialog", dialog => dialog.accept());
    await row.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await expect(window.getByRole("region", { name: "Favorite notes" })).toHaveCount(0);
    const trash = await window.evaluate(() => window.inknest.notes.listTrash());
    expect(trash.ok).toBe(true);
    if (!trash.ok) throw new Error(trash.error.message);
    await window.evaluate(trashPath => window.inknest.notes.restore({ trashPath }), trash.data[0].trashPath);
    await window.reload();
    await expect(window.getByRole("region", { name: "Favorite notes" }).getByRole("button", { name: "Open favorite Alpha" })).toBeVisible();
  } finally { await app.close(); }
});
