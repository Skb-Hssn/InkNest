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
    await expect(
      window.getByRole("button", { name: /No workspace Local Markdown/ })
    ).toBeVisible();
    await expect(window.getByRole("searchbox", { name: "Search notes" })).toBeVisible();
    await expect(
      window.getByRole("heading", { name: "Folders", exact: true })
    ).toBeVisible();
    await expect(window.getByText("No workspace selected")).toBeVisible();
    await expect(window.getByText("No search results")).toBeVisible();
    await expect(window.getByRole("button", { name: "Workspace root" })).toBeVisible();

    await expect(
      window.getByRole("heading", { name: "Notes", exact: true })
    ).toBeVisible();
    await expect(window.getByRole("button", { name: "Workspace root" })).toBeVisible();
    await expect(window.getByText("No notes here")).toBeVisible();
    await expect(window.getByText("Trash is empty.")).toBeVisible();

    await expect(window.getByRole("heading", { name: "Untitled note" })).toBeVisible();
    await expect(window.getByText("No file selected")).toBeVisible();
    await expect(window.getByText("Saved").first()).toBeVisible();
    await expect(window.getByRole("heading", { name: "No note selected" })).toBeVisible();
    await expect(
      window.getByText("Open or create a Markdown note to inspect its saved content here.")
    ).toBeVisible();
    await expect(window.getByText("Open a local Markdown folder to begin")).toBeVisible();
    await expect(window.getByText("Saved - 0 words - 0 characters")).toBeVisible();
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
    await expect(window.getByRole("button", { name: "Collapse notes list" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Filter folders" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Sort notes" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Settings" })).toBeVisible();

    await expect(
      window.getByRole("button", { name: "New note", exact: true }).first()
    ).toBeVisible();
    await expect(
      window.getByRole("button", { name: "New folder", exact: true }).first()
    ).toBeVisible();

    for (const action of ["H1", "B", "I", "List", "Link", "Image"]) {
      await expect(
        window.getByRole("button", { name: action, exact: true })
      ).toBeVisible();
    }
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
        phase: "phase-6-note-crud"
      }
    });
    expect(rendererNodeAccess).toEqual({
      hasRequire: false,
      hasProcess: false
    });
    await expect(window.getByText("phase-6-note-crud")).toBeVisible();
  } finally {
    await app.close();
  }
});
