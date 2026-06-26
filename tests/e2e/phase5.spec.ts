import { _electron as electron, expect, test } from "@playwright/test";
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

test("phase 5 scans workspace folders, markdown notes, metadata, and content", async ({
}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  await mkdir(path.join(workspaceDir, "Projects", "Nested"), {
    recursive: true
  });
  await mkdir(path.join(workspaceDir, ".inknest", "scratch"), {
    recursive: true
  });
  await mkdir(path.join(workspaceDir, "assets"), { recursive: true });
  await writeFile(
    path.join(workspaceDir, "Projects", "Nested", "unicode.md"),
    "# ঢাকা Notes\n\nUnicode body stays intact.",
    "utf8"
  );
  await writeFile(path.join(workspaceDir, "loose.md"), "No heading here", "utf8");
  await writeFile(
    path.join(workspaceDir, ".inknest", "scratch", "hidden.md"),
    "# Hidden",
    "utf8"
  );
  await writeFile(
    path.join(workspaceDir, "assets", "asset-note.md"),
    "# Asset",
    "utf8"
  );

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    const selectedWorkspace = await window.evaluate((workspacePath) => {
      return window.inknest.workspace.select(workspacePath);
    }, workspaceDir);
    const fileModel = await window.evaluate(() => {
      return window.inknest.workspace.scan();
    });
    const notes = await window.evaluate(() => {
      return window.inknest.notes.list();
    });
    const note = await window.evaluate(() => {
      return window.inknest.notes.read("Projects/Nested/unicode.md");
    });

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
    expect(existsSync(path.join(workspaceDir, ".inknest", "trash"))).toBe(true);
    expect(existsSync(path.join(workspaceDir, "assets"))).toBe(true);
    expect(fileModel).toEqual({
      ok: true,
      data: {
        workspace: selectedWorkspace.data,
        folders: [
          { name: "Projects", path: "Projects" },
          { name: "Nested", path: "Projects/Nested" }
        ],
        notes: [
          {
            id: "loose.md",
            title: "loose",
            path: "loose.md",
            folderPath: "."
          },
          {
            id: "Projects/Nested/unicode.md",
            title: "ঢাকা Notes",
            path: "Projects/Nested/unicode.md",
            folderPath: "Projects/Nested"
          }
        ],
        metadata: {
          metadataPath: ".inknest",
          assetsPath: "assets",
          trashPath: ".inknest/trash"
        }
      }
    });
    expect(notes).toEqual({
      ok: true,
      data: fileModel.ok ? fileModel.data.notes : []
    });
    expect(note).toEqual({
      ok: true,
      data: {
        path: "Projects/Nested/unicode.md",
        markdown: "# ঢাকা Notes\n\nUnicode body stays intact."
      }
    });
  } finally {
    await app.close();
  }
});

test("phase 5 rejects unsafe note reads through the preload API", async ({
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
    const outsideRead = await window.evaluate(() => {
      return window.inknest.notes.read("../outside.md");
    });
    const nonMarkdownRead = await window.evaluate(() => {
      return window.inknest.notes.read("not-markdown.txt");
    });

    expect(outsideRead).toEqual({
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Path is outside the active workspace."
      }
    });
    expect(nonMarkdownRead).toEqual({
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Only Markdown files can be read as notes."
      }
    });
  } finally {
    await app.close();
  }
});
