import { _electron as electron, expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

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

test("phase 16 opens the command palette and routes keyboard actions", async ({}, testInfo) => {
  const app = await launchInkNest(testInfo.outputPath("user-data"));

  try {
    const window = await app.firstWindow();
    await expect(window.getByRole("heading", { name: "InkNest", exact: true })).toBeVisible();

    await window.keyboard.press("Control+k");
    const palette = window.getByRole("dialog", { name: "Command palette" });
    const input = window.getByRole("combobox", { name: "Command palette search" });

    await expect(palette).toBeVisible();
    await expect(input).toBeFocused();
    await input.fill("settings");
    await input.press("Enter");

    await expect(window.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await window.keyboard.press("Escape");
    await expect(window.getByRole("dialog", { name: "Settings" })).not.toBeVisible();

    await window.keyboard.press("/");
    await expect(window.getByRole("searchbox", { name: "Search notes" })).toBeFocused();
    await expect(window.getByText("Workspace overview")).toBeVisible();
    await expect(window.getByText("No note - 0 words - 0 characters")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("phase 16 runs workspace actions from the command palette and adapts its layout", async ({}, testInfo) => {
  const workspaceDir = testInfo.outputPath("workspace");
  await mkdir(workspaceDir, { recursive: true });
  const app = await launchInkNest(testInfo.outputPath("user-data"));

  try {
    const window = await app.firstWindow();
    await window.evaluate((workspacePath) => window.inknest.workspace.select(workspacePath), workspaceDir);
    await window.reload();
    await expect(window.getByRole("heading", { name: "InkNest", exact: true })).toBeVisible();

    await window.keyboard.press("Control+k");
    const input = window.getByRole("combobox", { name: "Command palette search" });
    await input.fill("create new note");
    await input.press("Enter");
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toBeVisible();

    await window.setViewportSize({ width: 800, height: 600 });
    await expect.poll(() =>
      window.evaluate(() => getComputedStyle(document.querySelector('[data-layout="app-layout-columns"]')!).gridTemplateColumns)
    ).not.toContain("300px");

    await window.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() =>
      window.evaluate(() => getComputedStyle(document.querySelector('[data-layout="app-layout-columns"]')!).gridTemplateColumns)
    ).toContain("300px");
  } finally {
    await app.close();
  }
});

test("phase 16 keeps the default dark desktop layout compact and readable", async ({}, testInfo) => {
  const workspaceDir = testInfo.outputPath("workspace");
  await mkdir(workspaceDir, { recursive: true });
  const app = await launchInkNest(testInfo.outputPath("user-data"));

  try {
    const window = await app.firstWindow();
    await window.evaluate((workspacePath) => window.inknest.workspace.select(workspacePath), workspaceDir);
    await window.evaluate(() => window.inknest.settings.save({ theme: "dark" }));
    await window.reload();
    await window.setViewportSize({ width: 1280, height: 800 });
    await expect(window.getByRole("heading", { name: "No note selected" })).toBeVisible();
    await expect(window.getByRole("button", { name: "New note", exact: true }).first()).toBeEnabled();

    const metrics = await window.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>(".markdown-toolbar")!;
      const toolbarGroup = document.querySelector<HTMLElement>(".toolbar-group")!;
      const editorHeader = document.querySelector<HTMLElement>(".app-editor-header")!;
      const headerCopy = document.querySelector<HTMLElement>(".app-editor-header-copy")!;
      const headerActions = document.querySelector<HTMLElement>(".app-editor-header-actions")!;
      const importFolder = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.trim() === "Import folder")!;
      const copyRect = headerCopy.getBoundingClientRect();
      const actionsRect = headerActions.getBoundingClientRect();
      const headerRect = editorHeader.getBoundingClientRect();

      return {
        toolbarHeight: toolbar.getBoundingClientRect().height,
        toolbarFlexWrap: getComputedStyle(toolbar).flexWrap,
        toolbarOverflowX: getComputedStyle(toolbar).overflowX,
        toolbarGroupBackground: getComputedStyle(toolbarGroup).backgroundColor,
        importFolderWhiteSpace: getComputedStyle(importFolder).whiteSpace,
        headerContainsChildren:
          copyRect.left >= headerRect.left &&
          actionsRect.right <= headerRect.right &&
          actionsRect.bottom <= headerRect.bottom,
        headerRowsDoNotOverlap: copyRect.bottom <= actionsRect.top
      };
    });

    expect(metrics.toolbarHeight).toBeLessThanOrEqual(66);
    expect(metrics).toMatchObject({
      toolbarFlexWrap: "nowrap",
      toolbarOverflowX: "auto",
      toolbarGroupBackground: "rgb(27, 34, 30)",
      importFolderWhiteSpace: "nowrap",
      headerContainsChildren: true,
      headerRowsDoNotOverlap: true
    });
  } finally {
    await app.close();
  }
});
