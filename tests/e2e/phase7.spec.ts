import { test } from "./fixtures";
import { _electron as electron, expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const electronLaunchArgs = [
  ".",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-gpu-compositing",
  "--disable-accelerated-video-decode",
  "--disable-accelerated-video-encode",
  "--disable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE,VaapiVideoDecoder,VaapiVideoEncoder",
  "--ozone-platform=x11"
];

async function launchInkNest(userDataDir: string) {
  return electron.launch({
    args: electronLaunchArgs,
    env: {
      ...process.env,
      INKNEST_USER_DATA_DIR: userDataDir,
      ELECTRON_RUN_AS_NODE: undefined
    }
  });
}

function folderRow(window: Page, name: string) {
  return window.locator(".tree-row").filter({
    has: window.getByRole("button", { name: new RegExp(`^${name}\\b`) })
  });
}

test("phase 7 renders collapsible folders with hover actions and inline rename", async ({
}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  await mkdir(path.join(workspaceDir, "Projects", "Drafts"), {
    recursive: true
  });
  await writeFile(
    path.join(workspaceDir, "Projects", "Drafts", "outline.md"),
    "# Outline\n\nPhase 7 tree note.",
    "utf8"
  );

    const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    await window.evaluate((workspacePath) => {
      return window.inknest.workspace.select(workspacePath);
    }, workspaceDir);
    await window.reload();

    const workspaceRootName = path.basename(workspaceDir);
    const workspaceRootRow = folderRow(window, workspaceRootName);
    await expect(workspaceRootRow).toBeVisible();
    await expect(window.getByRole("button", { name: "Projects", exact: true })).toBeVisible();
    await expect(window.getByRole("button", { name: "Drafts", exact: true })).toBeHidden();

    await workspaceRootRow.hover();
    await workspaceRootRow.getByRole("button", { name: "Folder actions" }).click();
    const workspaceRootMenu = workspaceRootRow.getByRole("menu", {
      name: "Folder options"
    });
    await expect(
      workspaceRootMenu.getByRole("menuitem", { name: "New note" })
    ).toBeVisible();
    await expect(
      workspaceRootMenu.getByRole("menuitem", { name: "New folder" })
    ).toBeVisible();
    await expect(
      workspaceRootMenu.getByRole("menuitem", { name: "Rename" })
    ).toHaveCount(0);
    await expect(
      workspaceRootMenu.getByRole("menuitem", { name: "Delete" })
    ).toHaveCount(0);
    await window.locator("main").click({ position: { x: 700, y: 500 } });
    await expect(workspaceRootMenu).toBeHidden();

    await folderRow(window, "Projects")
      .getByRole("button", { name: "Expand folder" })
      .click();
    await expect(window.getByRole("button", { name: "Drafts", exact: true })).toBeVisible();

    const projectsRow = folderRow(window, "Projects");
    const projectsActions = projectsRow.locator(".context-menu-anchor");
    await window.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await window.mouse.move(1000, 100);
    await expect(projectsActions).toHaveCSS("opacity", "0");

    await projectsRow.hover();
    await expect(projectsActions).toHaveCSS("opacity", "1");

    await projectsRow.getByRole("button", { name: "Folder actions" }).click();
    const folderMenu = projectsRow.getByRole("menu", { name: "Folder options" });
    await expect(folderMenu).toBeVisible();
    await expect(folderMenu.getByRole("menuitem", { name: "New note" })).toBeVisible();
    await expect(folderMenu.getByRole("menuitem", { name: "New folder" })).toBeVisible();
    await expect(folderMenu.getByText("Move to")).toHaveCount(0);
    await window.locator("main").click({ position: { x: 700, y: 500 } });
    await expect(folderMenu).toBeHidden();

    await projectsRow.hover();
    await projectsRow.getByRole("button", { name: "Folder actions" }).click();
    await folderMenu.getByRole("menuitem", { name: "New folder" }).click();
    await expect(window.getByRole("button", { name: "New Folder", exact: true })).toBeVisible();
    await expect
      .poll(() => existsSync(path.join(workspaceDir, "Projects", "New Folder")))
      .toBe(true);

    await projectsRow.hover();
    await projectsRow.getByRole("button", { name: "Folder actions" }).click();
    await folderMenu.getByRole("menuitem", { name: "Rename" }).click();
    const folderNameInput = window.getByRole("textbox", { name: "Folder name" });
    await folderNameInput.fill("Research");
    await folderNameInput.press("Enter");

    await expect(window.getByRole("button", { name: "Research", exact: true })).toBeVisible();
    await expect(window.getByRole("button", { name: "Projects", exact: true })).toBeHidden();
    expect(existsSync(path.join(workspaceDir, "Research", "Drafts"))).toBe(true);
    expect(existsSync(path.join(workspaceDir, "Projects"))).toBe(false);

    const draftsRow = folderRow(window, "Drafts");
    await draftsRow.getByRole("button", { name: "Expand folder" }).click();
    const noteRow = window.locator(".note-row").filter({ hasText: "outline" });
    await noteRow.hover();
    await noteRow.getByRole("button", { name: "Note actions" }).click();
    const noteMenu = noteRow.getByRole("menu", { name: "Note options" });
    await expect(noteMenu.getByRole("menuitem", { name: "Rename" })).toBeVisible();
    await expect(noteMenu.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
    await expect(noteMenu.getByText("Move to")).toHaveCount(0);
    await noteMenu.getByRole("menuitem", { name: "Rename" }).click();
    const noteNameInput = window.getByRole("textbox", { name: "File name" });
    await expect(noteNameInput).toBeFocused();
    await noteNameInput.fill("outline-renamed");
    await noteNameInput.press("Enter");
    await expect
      .poll(() => existsSync(path.join(workspaceDir, "Research", "Drafts", "outline-renamed.md")))
      .toBe(true);
  } finally {
    await app.close();
  }
});

test("phase 7 moves folders through preload and rejects unsafe folder moves", async ({
}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  await mkdir(path.join(workspaceDir, "Projects", "Drafts"), {
    recursive: true
  });
  await mkdir(path.join(workspaceDir, "Archive"), { recursive: true });

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    await window.evaluate((workspacePath) => {
      return window.inknest.workspace.select(workspacePath);
    }, workspaceDir);

    const moved = await window.evaluate(() => {
      return window.inknest.folders.move({
        path: "Projects/Drafts",
        parentPath: "Archive"
      });
    });
    const unsafeMove = await window.evaluate(() => {
      return window.inknest.folders.move({
        path: "Archive",
        parentPath: "Archive/Drafts"
      });
    });
    const model = await window.evaluate(() => window.inknest.workspace.scan());

    expect(moved).toEqual({
      ok: true,
      data: {
        name: "Drafts",
        path: "Archive/Drafts"
      }
    });
    expect(unsafeMove).toEqual({
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Folder cannot be moved into itself."
      }
    });
    expect(model.ok ? model.data.folders.map((folder) => folder.path) : []).toEqual([
      "Archive",
      "Archive/Drafts",
      "Projects"
    ]);
    expect(existsSync(path.join(workspaceDir, "Archive", "Drafts"))).toBe(true);
    expect(existsSync(path.join(workspaceDir, "Projects", "Drafts"))).toBe(false);
  } finally {
    await app.close();
  }
});
