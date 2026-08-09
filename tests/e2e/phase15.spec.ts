import { _electron as electron, expect, test } from "@playwright/test";
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
    const editor = await openWorkspaceNote(window, workspaceDir, "Watched Note");

    await writeFile(notePath, "# Watched Note\n\nExternal body.\n", "utf8");
    await expect(editor).toContainText("External body.");
    await expect(window.getByRole("alert")).not.toBeVisible();

    await editor.evaluate((editableElement) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = "Local unsaved body.";
      editableElement.appendChild(paragraph);
      editableElement.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: "Local unsaved body.",
          inputType: "insertText"
        })
      );
    });
    await expect(window.getByText(/Unsaved changes/).first()).toBeVisible();

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
    await openWorkspaceNote(window, workspaceDir, "Deleted Note");
    await rm(notePath);

    const conflict = window.getByRole("alert");
    await expect(conflict).toContainText("deleted outside InkNest");
    await conflict.getByRole("button", { name: "Save as new note" }).click();
    await expect(window.getByText(/Saved local version as new note/).first()).toBeVisible();

    const workspaceEntries = await readdir(workspaceDir);
    const recoveredName = workspaceEntries.find((entry) =>
      entry.startsWith("deleted Recovered")
    );
    expect(recoveredName).toBeTruthy();
    expect(await readFile(path.join(workspaceDir, recoveredName!), "utf8")).toContain(
      "Keep this body."
    );
  } finally {
    await app.close();
  }
});
