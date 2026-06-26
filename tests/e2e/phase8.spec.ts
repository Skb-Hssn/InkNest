import { _electron as electron, expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
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

test("phase 8 edits formatted markdown content and saves it back to disk", async ({
}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  const notePath = path.join(workspaceDir, "rich-note.md");
  const initialMarkdown = [
    "# Phase 8 Note",
    "",
    "Existing body.",
    "",
    "- First item",
    "- [x] Done item",
    "",
    "> Quoted line",
    "",
    "```ts",
    "const value = 1;",
    "```",
    "",
    "| Name | Value |",
    "| --- | --- |",
    "| Ink | Nest |",
    ""
  ].join("\n");

  await mkdir(workspaceDir, { recursive: true });
  await writeFile(notePath, initialMarkdown, "utf8");

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    await window.evaluate((workspacePath) => {
      return window.inknest.workspace.select(workspacePath);
    }, workspaceDir);
    await window.reload();

    await window.getByRole("button", { name: /Phase 8 Note/ }).click();

    const editor = window.getByRole("textbox", {
      name: "Visual Markdown editor"
    });

    await expect(editor).toBeVisible();
    await expect(editor.locator("h1")).toHaveText("Phase 8 Note");
    await expect(editor.locator("li").filter({ hasText: "First item" })).toBeVisible();
    await expect(editor.locator("input[type='checkbox']")).toBeChecked();
    await expect(editor.locator("blockquote")).toContainText("Quoted line");
    await expect(editor.locator("pre code")).toContainText("const value = 1;");
    await expect(editor.locator("table")).toContainText("Ink");

    await editor.evaluate((editableElement) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = "Added from e2e.";
      editableElement.appendChild(paragraph);
      editableElement.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: "Added from e2e.",
          inputType: "insertText"
        })
      );
    });

    await expect(window.getByText(/Unsaved changes/).first()).toBeVisible();
    await window.getByRole("button", { name: "Save", exact: true }).click();
    await expect(window.getByText(/Saved - Saved/).first()).toBeVisible();

    const savedMarkdown = await readFile(notePath, "utf8");
    expect(savedMarkdown).toContain("# Phase 8 Note");
    expect(savedMarkdown).toContain("- First item");
    expect(savedMarkdown).toContain("- [x] Done item");
    expect(savedMarkdown).toContain("> Quoted line");
    expect(savedMarkdown).toContain("```ts\nconst value = 1;\n```");
    expect(savedMarkdown).toContain("| Name | Value |");
    expect(savedMarkdown).toContain("Added from e2e.");
  } finally {
    await app.close();
  }
});

test("phase 8 save channel persists markdown and rejects unsafe paths", async ({
}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");

  await mkdir(workspaceDir, { recursive: true });

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    await window.evaluate((workspacePath) => {
      return window.inknest.workspace.select(workspacePath);
    }, workspaceDir);

    const created = await window.evaluate(() => {
      return window.inknest.notes.create({
        title: "Saved Through Preload",
        folderPath: "."
      });
    });
    const saved = await window.evaluate(() => {
      return window.inknest.notes.save({
        path: "Saved Through Preload.md",
        markdown: "# Saved Through Preload\n\nBody from phase 8 e2e.\n"
      });
    });
    const unsafeSave = await window.evaluate(() => {
      return window.inknest.notes.save({
        path: "../outside.md",
        markdown: "# Outside"
      });
    });
    const reopened = await window.evaluate(() => {
      return window.inknest.notes.read("Saved Through Preload.md");
    });

    expect(created).toEqual({
      ok: true,
      data: {
        path: "Saved Through Preload.md",
        markdown: "# Saved Through Preload\n\n"
      }
    });
    expect(saved).toEqual({
      ok: true,
      data: {
        path: "Saved Through Preload.md",
        markdown: "# Saved Through Preload\n\nBody from phase 8 e2e.\n"
      }
    });
    expect(unsafeSave).toEqual({
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Path is outside the active workspace."
      }
    });
    expect(reopened).toEqual(saved);
    expect(existsSync(path.join(workspaceDir, "Saved Through Preload.md"))).toBe(
      true
    );
    expect(existsSync(path.join(workspaceDir, "..", "outside.md"))).toBe(false);
  } finally {
    await app.close();
  }
});
