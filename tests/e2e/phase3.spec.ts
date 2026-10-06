import { test } from "./fixtures";
import { _electron as electron, expect } from "@playwright/test";

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

async function launchInkNest(userDataDir) {
  return electron.launch({
    args: electronLaunchArgs,
    env: {
      ...process.env,
      INKNEST_USER_DATA_DIR: userDataDir,
      ELECTRON_RUN_AS_NODE: undefined
    }
  });
}

test("phase 3 renders the static workspace, notes, editor, and status layout", async ({
}, testInfo) => {
  const app = await launchInkNest(testInfo.outputPath("user-data"));

  try {
    const window = await app.firstWindow();

    await expect(window).toHaveTitle("InkNest");
    await expect(
      window.getByRole("heading", { name: "InkNest", exact: true })
    ).toBeVisible();
    await expect(window.getByRole("button", { name: "Minimize window" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Maximize window" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Close window" })).toBeVisible();
    await expect(
      window.getByRole("button", { name: "No workspace", exact: true })
    ).toBeVisible();
    await expect(
      window.getByRole("heading", { name: "Folders", exact: true })
    ).toBeVisible();
    await expect(window.getByText("No workspace selected")).toBeVisible();
    await expect(
      window.locator('[aria-label="Folder tree"] .tree-open-area').first()
    ).toHaveText(/Workspace/);
    await expect(
      window.locator('[aria-label="Folder tree"] .tree-open-area').first()
    ).toBeVisible();
    await expect(window.getByRole("searchbox", { name: "Search notes" })).toBeVisible();
    await window.getByRole("button", { name: "Trash", exact: true }).click();
    await expect(window.getByText("Trash is empty.")).toBeVisible();

    await expect(window.getByRole("heading", { name: "Editor" })).toBeVisible();
    await expect(window.getByRole("heading", { name: "No note selected" })).toBeVisible();
    await expect(
      window.getByText("Select a note from the list or create a new one to start writing.")
    ).toBeVisible();
    await expect(window.getByText("Open a local Markdown folder to begin")).toBeVisible();
    await expect(window.getByText("Workspace overview")).toBeVisible();
    await expect(window.getByText("0 words · 0 characters")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("phase 3 exposes visible static controls for future interactions", async ({
}, testInfo) => {
  const app = await launchInkNest(testInfo.outputPath("user-data"));

  try {
    const window = await app.firstWindow();

    await expect(window.getByRole("button", { name: "Toggle sidebar" })).toBeVisible();
    const foldersHeading = window.getByRole("heading", { name: "Folders", exact: true });
    const foldersHeader = foldersHeading.locator("..");
    await expect(foldersHeader.getByRole("button", { name: "Expand folders" })).toHaveCount(0);
    await expect(foldersHeader.getByRole("button", { name: "Collapse folders" })).toBeVisible();
    await expect(foldersHeader.getByRole("button", { name: "Filter folders" })).toHaveCount(0);
    await expect(foldersHeader.locator('summary[aria-label="Sort notes"]')).toHaveCount(0);
    await expect(foldersHeader.getByRole("button", { name: "New note" })).toHaveCount(0);
    await expect(window.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Open command palette" })).toHaveCount(0);
    await expect(window.getByRole("button", { name: "New note", exact: true })).toHaveCount(0);
    await expect(window.getByRole("button", { name: "New folder", exact: true })).toHaveCount(0);
    await expect(window.getByRole("button", { name: "Import options" })).toHaveCount(0);

    await expect(window.locator(".markdown-toolbar")).not.toBeVisible();
  } finally {
    await app.close();
  }
});

test("phase 3 controls the frameless window from the in-app title bar", async ({}, testInfo) => {
  const app = await launchInkNest(testInfo.outputPath("user-data"));

  try {
    const window = await app.firstWindow();
    const maximize = window.getByRole("button", { name: "Maximize window" });
    await maximize.click();
    await expect(window.getByRole("button", { name: "Restore window" })).toBeVisible();
    await window.getByRole("button", { name: "Restore window" }).click();
    await expect(window.getByRole("button", { name: "Maximize window" })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("phase 3 renderer receives the static layout phase through preload", async ({
}, testInfo) => {
  const app = await launchInkNest(testInfo.outputPath("user-data"));

  try {
    const window = await app.firstWindow();
    const appInfo = await window.evaluate(() => window.inknest.app.getInfo());
    const rendererNodeAccess = await window.evaluate(() => ({
      hasRequire: "require" in window,
      hasProcess: "process" in window
    }));

    expect(appInfo).toEqual({
      ok: true,
      data: {
        name: "InkNest",
        phase: "phase-17-release-validation"
      }
    });
    expect(rendererNodeAccess).toEqual({
      hasRequire: false,
      hasProcess: false
    });
    await expect(
      window.locator('main.app-shell[data-build-phase="phase-17-release-validation"]')
    ).toBeVisible();
  } finally {
    await app.close();
  }
});

test("phase 3 resizes the workspace sidebar with the drag handle", async ({}, testInfo) => {
  const app = await launchInkNest(testInfo.outputPath("user-data"));

  try {
    const window = await app.firstWindow();
    const handle = window.getByRole("separator", { name: "Resize workspace sidebar" });
    const box = await handle.boundingBox();

    expect(box).not.toBeNull();
    if (!box) {
      return;
    }

    const initialWidth = Number(await handle.getAttribute("aria-valuenow"));
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await window.mouse.move(x, y);
    await window.mouse.down();
    await window.mouse.move(x + 80, y, { steps: 4 });
    await window.mouse.up();

    await expect.poll(() => handle.getAttribute("aria-valuenow")).toBe(String(initialWidth + 80));
    await expect.poll(() =>
      window.evaluate(
        () => getComputedStyle(document.querySelector('[data-layout="app-layout-columns"]')!).gridTemplateColumns
      )
    ).toContain(`${initialWidth + 80}px`);
  } finally {
    await app.close();
  }
});
