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

test("phase 1 opens an InkNest renderer window with the workspace shell", async ({
}, testInfo) => {
  const app = await electron.launch({
    args: electronLaunchArgs,
    env: {
      ...process.env,
      INKNEST_USER_DATA_DIR: testInfo.outputPath("user-data"),
      ELECTRON_RUN_AS_NODE: undefined
    }
  });

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
    await expect(
      window.getByRole("heading", { name: "Notes", exact: true })
    ).toBeVisible();
    await expect(window.getByRole("heading", { name: "Untitled note" })).toBeVisible();
    await expect(window.getByRole("heading", { name: "No note selected" })).toBeVisible();
    await expect(window.getByText("No search results")).toBeVisible();
    await expect(window.getByText("No note - 0 words - 0 characters")).toBeVisible();

    await expect(window.locator("#root")).toHaveJSProperty("childElementCount", 1);
  } finally {
    await app.close();
  }
});

test("phase 2 exposes the narrow async preload API in the renderer", async ({
}, testInfo) => {
  const app = await electron.launch({
    args: electronLaunchArgs,
    env: {
      ...process.env,
      INKNEST_USER_DATA_DIR: testInfo.outputPath("user-data"),
      ELECTRON_RUN_AS_NODE: undefined
    }
  });

  try {
    const window = await app.firstWindow();

    const appInfo = await window.evaluate(() => window.inknest.app.getInfo());
    const activeWorkspace = await window.evaluate(() =>
      window.inknest.workspace.getActive()
    );
    const invalidSettings = await window.evaluate(() =>
      window.inknest.settings.save({ theme: "midnight" as never })
    );
    const unsafeLink = await window.evaluate(() =>
      window.inknest.links.openExternal({ url: "file:///tmp/example.md" })
    );
    const rendererNodeAccess = await window.evaluate(() => ({
      hasRequire: "require" in window,
      hasProcess: "process" in window
    }));

    expect(appInfo).toEqual({
      ok: true,
      data: {
        name: "InkNest",
        phase: "phase-8-visual-markdown-editor"
      }
    });
    expect(activeWorkspace).toEqual({
      ok: true,
      data: {
        path: null,
        name: null,
        status: "none",
        message: "Choose a local Markdown folder to begin.",
        recentWorkspaces: [],
        lastWorkspacePath: null
      }
    });
    expect(invalidSettings).toEqual({
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "theme must be system, light, or dark."
      }
    });
    expect(unsafeLink).toEqual({
      ok: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Only http and https links can be opened."
      }
    });
    expect(rendererNodeAccess).toEqual({
      hasRequire: false,
      hasProcess: false
    });
  } finally {
    await app.close();
  }
});
