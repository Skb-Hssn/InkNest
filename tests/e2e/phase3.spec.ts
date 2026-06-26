import { _electron as electron, expect, test } from "@playwright/test";

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

async function launchInkNest() {
  return electron.launch({
    args: electronLaunchArgs,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined
    }
  });
}

test("phase 3 renders the static workspace, notes, editor, and status layout", async () => {
  const app = await launchInkNest();

  try {
    const window = await app.firstWindow();

    await expect(window).toHaveTitle("InkNest");
    await expect(window.getByRole("heading", { name: "InkNest" })).toBeVisible();
    await expect(
      window.getByRole("button", {
        name: "Choose workspace Local Markdown folder"
      })
    ).toBeVisible();
    await expect(window.getByRole("searchbox", { name: "Search notes" })).toBeVisible();
    await expect(window.getByRole("heading", { name: "Folders" })).toBeVisible();
    await expect(window.getByText("No workspace selected")).toBeVisible();
    await expect(window.getByText("No search results")).toBeVisible();
    await expect(window.getByText("Folder tree placeholder")).toBeVisible();

    await expect(window.getByRole("heading", { name: "Notes" })).toBeVisible();
    await expect(window.getByText("No folder selected")).toBeVisible();
    await expect(window.getByText("Note list placeholder")).toBeVisible();
    await expect(window.getByText("Meeting notes")).toBeVisible();

    await expect(window.getByRole("heading", { name: "Untitled note" })).toBeVisible();
    await expect(window.getByText("No file selected")).toBeVisible();
    await expect(window.getByText("Saved").first()).toBeVisible();
    await expect(window.getByRole("heading", { name: "No note selected" })).toBeVisible();
    await expect(
      window.getByText("Open or create a Markdown note to edit formatted content here.")
    ).toBeVisible();
    await expect(window.getByText("Open a local Markdown folder to begin")).toBeVisible();
    await expect(window.getByText("Saved - 0 words - 0 characters")).toBeVisible();
  } finally {
    await app.close();
  }
});

test("phase 3 exposes visible static controls for future interactions", async () => {
  const app = await launchInkNest();

  try {
    const window = await app.firstWindow();

    await expect(window.getByRole("button", { name: "Toggle sidebar" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Collapse notes list" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Filter folders" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Sort notes" })).toBeVisible();
    await expect(window.getByRole("button", { name: "More editor actions" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Settings" })).toBeVisible();

    await expect(window.getByRole("button", { name: "New note" }).first()).toBeVisible();
    await expect(window.getByRole("button", { name: "New folder" }).first()).toBeVisible();

    for (const action of ["H1", "B", "I", "List", "Link", "Image"]) {
      await expect(window.getByRole("button", { name: action })).toBeVisible();
    }
  } finally {
    await app.close();
  }
});

test("phase 3 renderer receives the static layout phase through preload", async () => {
  const app = await launchInkNest();

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
        phase: "phase-3-static-layout"
      }
    });
    expect(rendererNodeAccess).toEqual({
      hasRequire: false,
      hasProcess: false
    });
    await expect(window.getByText("phase-3-static-layout")).toBeVisible();
  } finally {
    await app.close();
  }
});
