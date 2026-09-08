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
    await expect(window.getByText("0 words · 0 characters", { exact: true })).toBeVisible();
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
    await expect(window.getByRole("button", { name: "New note", exact: true })).toHaveCount(0);

    const metrics = await window.evaluate(() => {
      const editorHeader = document.querySelector<HTMLElement>(".app-editor-header")!;
      const headerCopy = document.querySelector<HTMLElement>(".app-editor-header-copy")!;
      const headerRect = editorHeader.getBoundingClientRect();

      return {
        headerHeight: headerRect.height,
        headerContainsCopy:
          headerCopy.getBoundingClientRect().left >= headerRect.left &&
          headerCopy.getBoundingClientRect().right <= headerRect.right,
        hasToolbar: Boolean(document.querySelector(".markdown-toolbar")),
        hasImportButton: Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
          .some((button) => button.textContent?.trim() === "Import")
      };
    });

    expect(metrics).toMatchObject({
      headerHeight: 56,
      headerContainsCopy: true,
      hasToolbar: false,
      hasImportButton: false,
    });
  } finally {
    await app.close();
  }
});
