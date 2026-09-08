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

test("phase 14 persists editor preferences across restarts", async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const firstApp = await launchInkNest(userDataDir);

  try {
    const window = await firstApp.firstWindow();
    await window.getByRole("button", { name: "Settings" }).click();

    const settings = window.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await settings.getByRole("combobox", { name: "Theme" }).selectOption("dark");
    await settings.getByRole("combobox", { name: "Font size" }).selectOption("20");
    await settings.getByRole("combobox", { name: "Font family" }).selectOption("mono");
    await settings
      .getByRole("combobox", { name: "Auto-save delay" })
      .selectOption("1000");
    await settings.getByRole("checkbox", { name: "Wrap editor lines" }).uncheck();
    await settings.getByRole("checkbox", { name: "Show word count" }).uncheck();
    await settings.getByRole("checkbox", { name: "Show sidebar" }).uncheck();

    await expect.poll(() =>
      window.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        fontSize: getComputedStyle(document.querySelector("main")!).getPropertyValue(
          "--app-font-size"
        ),
        layout: document.querySelector("main section")?.className,
        sidebar: document.querySelector("main section")?.getAttribute("data-workspace-sidebar")
      }))
    ).toEqual({
      theme: "dark",
      fontSize: "20px",
      layout: "app-layout-columns grid min-h-0 grid-cols-[300px_minmax(0,1fr)]",
      sidebar: "hidden"
    });
    await expect(window.getByText("0 characters", { exact: true })).toBeVisible();
  } finally {
    await firstApp.close();
  }

  const secondApp = await launchInkNest(userDataDir);

  try {
    const window = await secondApp.firstWindow();
    await window.locator(".sidebar-collapsed-controls").getByRole("button", { name: "Settings" }).click();

    const settings = window.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole("combobox", { name: "Theme" })).toHaveValue("dark");
    await expect(settings.getByRole("combobox", { name: "Font size" })).toHaveValue("20");
    await expect(settings.getByRole("combobox", { name: "Font family" })).toHaveValue("mono");
    await expect(settings.getByRole("combobox", { name: "Auto-save delay" })).toHaveValue(
      "1000"
    );
    await expect(settings.getByRole("checkbox", { name: "Wrap editor lines" })).not.toBeChecked();
    await expect(settings.getByRole("checkbox", { name: "Show word count" })).not.toBeChecked();
    await expect(settings.getByRole("checkbox", { name: "Show sidebar" })).not.toBeChecked();
    await expect(window.getByText("0 characters", { exact: true })).toBeVisible();
  } finally {
    await secondApp.close();
  }
});
