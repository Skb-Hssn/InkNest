import { _electron as electron, expect, type Page, test } from "@playwright/test";
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

    await expect(window.getByRole("button", { name: /Workspace root/ })).toBeVisible();
    await expect(window.getByRole("button", { name: /Projects/ })).toBeVisible();
    await expect(window.getByRole("button", { name: /Drafts/ })).toBeHidden();

    await folderRow(window, "Projects")
      .getByRole("button", { name: "Expand folder" })
      .click();
    await expect(window.getByRole("button", { name: /Drafts/ })).toBeVisible();

    const projectsRow = folderRow(window, "Projects");
    const projectsActions = projectsRow.locator(".folder-actions");
    await window.mouse.move(900, 420);
    await expect(projectsActions).toHaveCSS("opacity", "0");

    await projectsRow.hover();
    await expect(projectsActions).toHaveCSS("opacity", "1");

    await projectsRow.getByRole("button", { name: "Rename folder" }).click();
    await window.getByRole("textbox", { name: "Folder name" }).fill("Research");
    await window.getByRole("button", { name: "Save folder name" }).click();

    await expect(window.getByRole("button", { name: /Research/ })).toBeVisible();
    await expect(window.getByRole("button", { name: /Projects/ })).toBeHidden();
    expect(existsSync(path.join(workspaceDir, "Research", "Drafts"))).toBe(true);
    expect(existsSync(path.join(workspaceDir, "Projects"))).toBe(false);
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
