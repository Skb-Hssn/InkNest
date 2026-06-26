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

test("phase 1 opens an InkNest renderer window with the workspace shell", async () => {
  const app = await electron.launch({
    args: electronLaunchArgs,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined
    }
  });

  try {
    const window = await app.firstWindow();

    await expect(window).toHaveTitle("InkNest");
    await expect(window.getByRole("heading", { name: "InkNest" })).toBeVisible();
    await expect(
      window.getByRole("button", { name: "Choose workspace Local Markdown folder" })
    ).toBeVisible();
    await expect(window.getByRole("searchbox", { name: "Search notes" })).toBeVisible();
    await expect(window.getByRole("heading", { name: "Folders" })).toBeVisible();
    await expect(window.getByRole("heading", { name: "Notes" })).toBeVisible();
    await expect(window.getByRole("heading", { name: "Untitled note" })).toBeVisible();
    await expect(window.getByText("The editor is ready for local Markdown notes.")).toBeVisible();
    await expect(window.getByText("0 words")).toBeVisible();

    await expect(window.locator("#root")).toHaveJSProperty("childElementCount", 1);
  } finally {
    await app.close();
  }
});

test("phase 2 exposes the narrow async preload API in the renderer", async () => {
  const app = await electron.launch({
    args: electronLaunchArgs,
    env: {
      ...process.env,
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
        phase: "phase-2-secure-boundary"
      }
    });
    expect(activeWorkspace).toEqual({
      ok: true,
      data: {
        path: null,
        name: null
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
