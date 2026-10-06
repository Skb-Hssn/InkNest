import { test } from "./fixtures";
import { _electron as electron, expect } from "@playwright/test";
import { mkdir, rm, writeFile } from "node:fs/promises";
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

test("phase 4 selects a workspace and persists it in settings", async ({
}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  await mkdir(workspaceDir, { recursive: true });

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    const selectedWorkspace = await window.evaluate((workspacePath) => {
      return window.inknest.workspace.select(workspacePath);
    }, workspaceDir);
    const settings = await window.evaluate(() => window.inknest.settings.get());
    const activeWorkspace = await window.evaluate(() =>
      window.inknest.workspace.getActive()
    );

    expect(selectedWorkspace).toEqual({
      ok: true,
      data: {
        path: workspaceDir,
        name: path.basename(workspaceDir),
        status: "ready",
        message: "Workspace is ready.",
        recentWorkspaces: [workspaceDir],
        lastWorkspacePath: workspaceDir
      }
    });
    expect(settings).toEqual({
      ok: true,
      data: {
        theme: "system",
        accentColor: "forest",
        fullWidth: false,
        showOutline: true,
        outlineWidth: 232,
        fontSize: 16,
        fontFamily: "system",
        autoSaveDelayMs: 750,
        lineWrap: true,
        showWordCount: true,
        sidebarVisible: true,
        lastWorkspacePath: workspaceDir,
        recentWorkspaces: [workspaceDir]
      }
    });
    expect(activeWorkspace).toEqual(selectedWorkspace);

    const recentWorkspaces = window.locator("details.collapsible-section").filter({
      hasText: "Recent workspaces"
    });
    const recentWorkspaceSection = recentWorkspaces.locator("..");
    await expect(recentWorkspaces).toBeVisible();
    await expect(recentWorkspaces).toHaveAttribute("open", "");
    const recentWorkspaceActions = recentWorkspaceSection.getByRole("button", {
      name: "Recent workspaces actions"
    });
    await recentWorkspaces.locator("summary").hover();
    await recentWorkspaceActions.click();
    await expect(
      recentWorkspaceSection.getByRole("menu", { name: "Recent workspaces options" })
    ).toBeVisible();
    await recentWorkspaceSection
      .getByRole("menuitem", { name: "Clear recent workspaces" })
      .click();
    await expect(recentWorkspaces).toHaveCount(0);

    const clearedWorkspace = await window.evaluate(() =>
      window.inknest.workspace.getActive()
    );
    expect(clearedWorkspace).toMatchObject({
      ok: true,
      data: { recentWorkspaces: [] }
    });
  } finally {
    await app.close();
  }
});

test("phase 4 restores the last workspace after restart", async ({
}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  await mkdir(workspaceDir, { recursive: true });

  const firstApp = await launchInkNest(userDataDir);

  try {
    const firstWindow = await firstApp.firstWindow();
    await firstWindow.evaluate((workspacePath) => {
      return window.inknest.workspace.select(workspacePath);
    }, workspaceDir);
  } finally {
    await firstApp.close();
  }

  const secondApp = await launchInkNest(userDataDir);

  try {
    const secondWindow = await secondApp.firstWindow();
    const restoredWorkspace = await secondWindow.evaluate(() => {
      return window.inknest.workspace.getActive();
    });

    expect(restoredWorkspace).toEqual({
      ok: true,
      data: {
        path: workspaceDir,
        name: path.basename(workspaceDir),
        status: "ready",
        message: "Workspace is ready.",
        recentWorkspaces: [workspaceDir],
        lastWorkspacePath: workspaceDir
      }
    });
    await expect(secondWindow.locator(".status-bar-path")).toHaveText(workspaceDir);
  } finally {
    await secondApp.close();
  }
});

test("phase 4 shows a clear missing-workspace state on startup", async ({
}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const missingWorkspace = testInfo.outputPath("missing-workspace");
  await mkdir(userDataDir, { recursive: true });
  await writeFile(
    path.join(userDataDir, "settings.json"),
    `${JSON.stringify(
      {
        theme: "system",
        lastWorkspacePath: missingWorkspace,
        recentWorkspaces: [missingWorkspace]
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await rm(missingWorkspace, { force: true, recursive: true });

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    const activeWorkspace = await window.evaluate(() => {
      return window.inknest.workspace.getActive();
    });

    expect(activeWorkspace).toEqual({
      ok: true,
      data: {
        path: null,
        name: null,
        status: "missing",
        message:
          "The previous workspace could not be found. Choose a local Markdown folder to continue.",
        recentWorkspaces: [missingWorkspace],
        lastWorkspacePath: missingWorkspace
      }
    });
    await expect(window.getByText("Previous workspace missing")).toBeVisible();
    await window
      .locator("details.collapsible-section")
      .filter({ hasText: "Recent workspaces" })
      .locator("summary")
      .click();
    await expect(window.locator(".recent-workspace-row")).toHaveAttribute("title", missingWorkspace);
  } finally {
    await app.close();
  }
});
