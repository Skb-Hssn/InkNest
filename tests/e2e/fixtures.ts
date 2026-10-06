import { test as base, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Existing feature tests start with an explicit installation configuration.
// The first-launch suite opts out to exercise the automatic example workspace.
export const test = base.extend<{ existingInstallation: boolean; installationSettings: void }>({
  existingInstallation: [true, { option: true }],
  installationSettings: [async ({ existingInstallation }, use, info) => {
    if (existingInstallation) {
      const root = info.outputPath("user-data");
      await mkdir(root, { recursive: true });
      await writeFile(path.join(root, "settings.json"), JSON.stringify({ lastWorkspacePath: null, recentWorkspaces: [] }), { flag: "wx" });
    }
    await use();
  }, { auto: true }]
});

export async function toolbarButton(window: Page, label: string) {
  const button = window.getByRole("button", { name: label, exact: true });
  if (!(await button.isVisible())) {
    await window.getByRole("button", { name: /^H[1-6]$/.test(label) ? "Heading level" : "More formatting", exact: true }).click();
  }
  return button;
}
