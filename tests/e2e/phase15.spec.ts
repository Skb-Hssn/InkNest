import { test } from "./fixtures";
import { _electron as electron, expect } from "@playwright/test";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

async function openWorkspaceNote(
  window: Awaited<ReturnType<Awaited<ReturnType<typeof launchInkNest>>["firstWindow"]>>,
  workspaceDir: string,
  title: string
) {
  await window.evaluate((workspacePath) => {
    return window.inknest.workspace.select(workspacePath);
  }, workspaceDir);
  await window.reload();
  await window.locator(".note-open-area").filter({ hasText: title }).click();
  return window.getByRole("textbox", { name: "Visual Markdown editor" });
}

test("phase 15 reloads clean external edits and protects local changes", async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  const notePath = path.join(workspaceDir, "watched.md");
  await mkdir(workspaceDir, { recursive: true });
  await writeFile(notePath, "# Watched Note\n\nOriginal body.\n", "utf8");

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    // Keep the local edit dirty until the competing external write arrives.
    await window.evaluate(() => window.inknest.settings.save({ autoSaveDelayMs: 5000 }));
    const editor = await openWorkspaceNote(window, workspaceDir, "watched");

    await writeFile(notePath, "# Watched Note\n\nExternal body.\n", "utf8");
    await expect(editor).toContainText("External body.");
    await expect(window.getByRole("alert")).not.toBeVisible();

    await editor.click();
    await editor.press("Control+End");
    await editor.press("Enter");
    await editor.pressSequentially("Local unsaved body.");
    await expect(window.getByRole("button", { name: "Save", exact: true })).toBeEnabled();

    await writeFile(notePath, "# Watched Note\n\nCompeting external body.\n", "utf8");
    const conflict = window.getByRole("alert");
    await expect(conflict).toContainText("changed outside InkNest");
    await expect(editor).toContainText("Local unsaved body.");

    await conflict.getByRole("button", { name: "Reload from disk" }).click();
    await expect(editor).toContainText("Competing external body.");
    await expect(editor).not.toContainText("Local unsaved body.");
  } finally {
    await app.close();
  }
});

test("phase 15 marks deleted notes and saves local content as a new note", async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  const notePath = path.join(workspaceDir, "deleted.md");
  await mkdir(workspaceDir, { recursive: true });
  await writeFile(notePath, "# Deleted Note\n\nKeep this body.\n", "utf8");

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    const editor = await openWorkspaceNote(window, workspaceDir, "deleted");
    await expect(editor).toContainText("Keep this body.");
    await rm(notePath);

    const conflict = window.getByRole("alert");
    await expect(conflict).toContainText("deleted outside InkNest");
    await conflict.getByRole("button", { name: "Save as new note" }).click();
    // Creation and writing the recovered content are separate asynchronous steps.
    let recoveredName: string | undefined;
    await expect.poll(async () => {
      recoveredName = (await readdir(workspaceDir)).find((entry) =>
        entry.startsWith("deleted Recovered")
      );
      return recoveredName;
    }).toBeTruthy();
    await expect.poll(() => readFile(path.join(workspaceDir, recoveredName!), "utf8"))
      .toContain("Keep this body.");
    await expect(conflict).not.toBeVisible();
  } finally {
    await app.close();
  }
});

test("phase 15 empties trash from the sidebar action menu after confirmation", async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  const notePath = path.join(workspaceDir, "trash-me.md");
  await mkdir(workspaceDir, { recursive: true });
  await writeFile(notePath, "# Trash me\n", "utf8");

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    await window.evaluate(async (workspacePath) => {
      await window.inknest.workspace.select(workspacePath);
      await window.inknest.notes.delete({ path: "trash-me.md" });
    }, workspaceDir);
    await window.reload();

    const trashSection = window.locator(".workspace-trash-section");
    await trashSection.getByRole("button", { name: "Trash", exact: true }).click();
    await expect(trashSection.getByText("trash-me")).toBeVisible();

    const trashActions = trashSection.getByRole("button", { name: "Trash actions" });
    await trashSection.getByRole("button", { name: "Trash", exact: true }).hover();
    await trashActions.click();
    await expect(
      trashSection.getByRole("menu", { name: "Trash options" })
    ).toBeVisible();
    await trashSection.getByRole("menuitem", { name: "Empty Trash" }).click();

    const confirmation = window.getByRole("dialog", { name: "Empty Trash?" });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Empty Trash" }).click();
    await expect(trashSection.getByText("Trash is empty.")).toBeVisible();
  } finally {
    await app.close();
  }
});
