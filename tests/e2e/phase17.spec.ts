import { _electron as electron, expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
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

test("phase 17 release smoke flow covers the core MVP acceptance path", async ({}, testInfo) => {
  test.setTimeout(60_000);

  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  const exportPath = path.join(workspaceDir, "Release Renamed Export.md");
  await mkdir(workspaceDir, { recursive: true });

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    await expect(window.getByRole("heading", { name: "InkNest", exact: true })).toBeVisible();

    const appInfo = await window.evaluate(() => window.inknest.app.getInfo());
    expect(appInfo).toEqual({
      ok: true,
      data: {
        name: "InkNest",
        phase: "phase-17-release-validation"
      }
    });

    await window.evaluate((workspacePath) => window.inknest.workspace.select(workspacePath), workspaceDir);
    await window.reload();

    await expect(window.getByRole("heading", { name: "InkNest", exact: true })).toBeVisible();
    await window.getByRole("button", { name: "New note", exact: true }).first().click();

    const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
    await expect(editor).toBeVisible();
    const title = window.getByRole("textbox", { name: "Note title" });
    await title.fill("Release Smoke");
    await title.press("Enter");
    await expect(window.getByText("Release Smoke.md").first()).toBeVisible();

    const renamedEditor = window.getByRole("textbox", { name: "Visual Markdown editor" });

    await renamedEditor.click();
    await renamedEditor.press("Control+End");
    await renamedEditor.press("Enter");
    await renamedEditor.pressSequentially("Release validation content.");

    const saveButton = window.getByRole("button", { name: "Save", exact: true });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(window.getByText("Saved", { exact: true }).first()).toBeVisible();

    const notePath = path.join(workspaceDir, "Release Smoke.md");
    await expect
      .poll(() => readFile(notePath, "utf8"), { timeout: 4000 })
      .toContain("Release validation content.");

    const search = window.getByRole("searchbox", { name: "Search notes" });
    await search.fill("Release validation content");
    const searchResult = window.locator(".note-open-area").first();
    await expect(searchResult).toBeVisible();
    await searchResult.click();

    await title.fill("Release Renamed");
    await title.press("Enter");
    await expect(window.getByText("Release Renamed.md").first()).toBeVisible();

    const exported = await window.evaluate(
      ({ sourcePath, destinationPath }) =>
        window.inknest.export.note({
          path: sourcePath,
          format: "markdown",
          destinationPath
        }),
      {
        sourcePath: "Release Renamed.md",
        destinationPath: exportPath
      }
    );
    expect(exported).toEqual({
      ok: true,
      data: {
        exported: true,
        format: "markdown",
        path: exportPath
      }
    });
    await expect
      .poll(() => readFile(exportPath, "utf8"))
      .toContain("Release validation content.");

    const noteRow = window.locator(".note-row").first();
    window.once("dialog", (dialog) => dialog.accept());
    await noteRow.getByRole("button", { name: "Delete" }).click();
    await expect(window.getByText("Release Renamed", { exact: true }).last()).toBeVisible();
    await expect(window.getByRole("button", { name: "Restore note" })).toBeVisible();

    await window.getByRole("button", { name: "Restore note" }).click();
    await expect(window.locator(".note-open-area").first()).toBeVisible();
  } finally {
    await app.close();
  }
});
