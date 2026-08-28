import { _electron as electron, expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

test("phase 10 autosaves edits before the app closes", async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  const notePath = path.join(workspaceDir, "autosave.md");

  await mkdir(workspaceDir, { recursive: true });
  await writeFile(notePath, "# Autosave\n\nInitial content.\n", "utf8");

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    await window.evaluate((workspacePath) => {
      return window.inknest.workspace.select(workspacePath);
    }, workspaceDir);
    await window.reload();

    await window
      .locator(".note-open-area")
      .filter({ hasText: "Autosave" })
      .click();

    const editor = window.getByRole("textbox", {
      name: "Visual Markdown editor"
    });

    await editor.click();
    await editor.press("Control+End");
    await editor.press("Enter");
    await editor.pressSequentially("Saved by autosave.");

    await expect(window.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    await expect
      .poll(() => readFile(notePath, "utf8"), { timeout: 4000 })
      .toContain("Saved by autosave.");
    await expect(window.getByText("Saved", { exact: true }).first()).toBeVisible();
  } finally {
    await app.close();
  }
});
