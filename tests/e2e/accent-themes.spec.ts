import { _electron as electron, expect, test, type TestInfo, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { accentColors } from "../../src/shared/accent-colors";

let errors: string[] = [];
test.beforeEach(() => { errors = []; });
test.afterEach(() => expect(errors).toEqual([]));

async function launch(info: TestInfo) {
  const workspace = info.outputPath("workspace");
  await mkdir(workspace, { recursive: true });
  await writeFile(path.join(workspace, "Colors.md"), "# Color themes\n\nAlpha [example link](https://example.com).\n\n## Details\n\n- [ ] Task\n\n");
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--disable-gpu-compositing", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  const window = await app.firstWindow();
  window.on("pageerror", (error) => errors.push(error.message));
  await window.evaluate((folder) => window.inknest.workspace.select(folder), workspace);
  await window.reload();
  await window.locator(".note-open-area").filter({ hasText: "Colors" }).click();
  await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toBeVisible();
  return { app, window };
}

async function openSettings(window: Page) {
  await window.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = window.getByRole("dialog", { name: "Settings", exact: true });
  await expect(settings).toBeVisible();
  return settings;
}
const rgb = (channels: readonly number[]) => `rgb(${channels.join(", ")})`;
async function settleAppearance(window: Page) {
  await expect.poll(() => window.evaluate(() => document.getAnimations().filter((animation) =>
    animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity
  ).length)).toBe(0);
}

test("all eight accents update visible controls and links in light and dark appearances", async ({}, info) => {
  const { app, window } = await launch(info);
  try {
    const settings = await openSettings(window);
    const accents = settings.getByRole("group", { name: "Accent color" });
    await expect(accents.getByRole("radio")).toHaveCount(8);
    for (const theme of ["light", "dark"] as const) {
      await settings.getByLabel("Theme", { exact: true }).selectOption(theme);
      await expect(window.locator("html")).toHaveAttribute("data-theme", theme);
      for (const color of accentColors) {
        await accents.getByRole("radio", { name: color.name, exact: true }).check();
        await expect(accents.getByRole("radio", { name: color.name, exact: true })).toBeChecked();
        await expect(window.locator("html")).toHaveAttribute("data-accent", color.id);
        const expected = rgb(color[theme]);
        const text = rgb(theme === "light" ? color.solid : color.dark);
        await expect(window.locator(".note-tab[data-active=true]")).toHaveCSS("border-bottom-color", expected);
        await expect(window.locator(".sidebar-ribbon-button-active").first()).toHaveCSS("color", text);
        await expect(window.locator(".sidebar-ribbon-brand")).toHaveCSS("background-color", rgb(color.solid));
        await expect(window.locator(".inknest-editor a")).toHaveCSS("color", text);
        await expect.poll(() => window.evaluate(async () => window.inknest.settings.get())).toMatchObject({ ok: true, data: { accentColor: color.id, theme } });
      }
    }
  } finally { await app.close(); }
});

test("accent applies to editor tools, outline and checkboxes without editing the note", async ({}, info) => {
  const { app, window } = await launch(info);
  try {
    const notePath = info.outputPath("workspace", "Colors.md");
    const before = await readFile(notePath, "utf8");
    const settings = await openSettings(window);
    await settings.getByLabel("Theme", { exact: true }).selectOption("light");
    await settings.getByRole("radio", { name: "Violet", exact: true }).check();
    await expect(window.locator("html")).toHaveAttribute("data-accent", "violet");
    await settings.getByRole("button", { name: "Close settings" }).click();
    const violet = accentColors.find((color) => color.id === "violet")!;
    await expect(window.locator('.inknest-editor input[type="checkbox"]')).toHaveCSS("accent-color", rgb(violet.solid));
    await expect(window.locator('.note-outline-heading[aria-current="location"]')).toHaveCSS("box-shadow", `${rgb(violet.light)} 2px 0px 0px 0px inset`);
    await window.getByRole("button", { name: "Link", exact: true }).click();
    const apply = window.getByRole("button", { name: "Apply", exact: true });
    await expect(apply).toHaveCSS("background-color", rgb(violet.solid));
    await expect(apply).toHaveCSS("color", "rgb(255, 255, 255)");
    await window.getByRole("button", { name: "Cancel", exact: true }).click();
    await window.getByRole("button", { name: "Find in note", exact: true }).click();
    const find = window.getByRole("region", { name: "Find in note", exact: true });
    await find.getByRole("textbox", { name: "Find in note", exact: true }).fill("Alpha");
    await expect(find.locator(".note-find-input").first()).toHaveCSS("border-color", rgb(violet.light));
    await find.getByRole("button", { name: "Match case", exact: true }).click();
    await expect(find.getByRole("button", { name: "Match case", exact: true })).toHaveCSS("border-color", rgb(violet.light));
    await find.getByRole("button", { name: "Close find" }).click();
    await openSettings(window);
    await settleAppearance(window);
    await window.screenshot({ path: info.outputPath("accent-violet-light.png") });
    await window.getByLabel("Theme", { exact: true }).selectOption("dark");
    await expect(window.locator("html")).toHaveAttribute("data-theme", "dark");
    await settleAppearance(window);
    await window.screenshot({ path: info.outputPath("accent-violet-dark.png") });
    expect(await readFile(notePath, "utf8")).toBe(before);
  } finally { await app.close(); }
});

test("accent survives an app restart and preserves other preferences", async ({}, info) => {
  let { app, window } = await launch(info);
  try {
    const settings = await openSettings(window);
    await settings.getByLabel("Theme", { exact: true }).selectOption("dark");
    await settings.getByLabel("Font size", { exact: true }).selectOption("18");
    await settings.getByLabel("Full width notes", { exact: true }).check();
    await settings.getByRole("radio", { name: "Blue", exact: true }).check();
    await expect.poll(() => window.evaluate(async () => window.inknest.settings.get())).toMatchObject({ ok: true, data: { accentColor: "blue", theme: "dark", fontSize: 18, fullWidth: true } });
    expect(JSON.parse(await readFile(info.outputPath("user-data", "settings.json"), "utf8"))).toMatchObject({ accentColor: "blue", theme: "dark", fontSize: 18, fullWidth: true });
    await app.close();
    ({ app, window } = await launch(info));
    await expect(window.locator("html")).toHaveAttribute("data-accent", "blue");
    await expect(window.locator("html")).toHaveAttribute("data-theme", "dark");
    const restored = await openSettings(window);
    await expect(restored.getByRole("radio", { name: "Blue", exact: true })).toBeChecked();
    await expect(restored.getByLabel("Font size", { exact: true })).toHaveValue("18");
    await expect(restored.getByLabel("Full width notes", { exact: true })).toBeChecked();
  } finally { await app.close(); }
});

test("system appearance adapts the accent when the OS color scheme changes", async ({}, info) => {
  const { app, window } = await launch(info);
  try {
    const settings = await openSettings(window);
    await settings.getByLabel("Theme", { exact: true }).selectOption("system");
    await settings.getByRole("radio", { name: "Rose", exact: true }).check();
    await expect(window.locator("html")).toHaveAttribute("data-accent", "rose");
    const rose = accentColors.find((color) => color.id === "rose")!;
    for (const appearance of ["light", "dark", "light"] as const) {
      await window.emulateMedia({ colorScheme: appearance });
      await expect(window.locator(".note-tab[data-active=true]")).toHaveCSS("border-bottom-color", rgb(rose[appearance]));
      await expect(window.locator("html")).toHaveAttribute("data-theme", "system");
      await expect(settings.getByRole("radio", { name: "Rose", exact: true })).toBeChecked();
    }
  } finally { await app.close(); }
});

test("keyboard selection wraps and invalid accent settings are rejected", async ({}, info) => {
  const { app, window } = await launch(info);
  try {
    const settings = await openSettings(window);
    const forest = settings.getByRole("radio", { name: "Forest", exact: true });
    await forest.focus();
    await forest.press("ArrowRight");
    await expect(settings.getByRole("radio", { name: "Teal", exact: true })).toBeChecked();
    await expect(settings.getByRole("radio", { name: "Teal", exact: true })).toBeFocused();
    await window.keyboard.press("ArrowLeft");
    await expect(forest).toBeChecked();
    await window.keyboard.press("ArrowLeft");
    await expect(settings.getByRole("radio", { name: "Graphite", exact: true })).toBeChecked();
    await expect.poll(() => window.evaluate(async () => window.inknest.settings.get())).toMatchObject({ ok: true, data: { accentColor: "graphite" } });
    for (const invalid of [null, 42, "BLUE", " blue ", "rainbow", "#00ff00", {}, []]) {
      const response = await window.evaluate((value) => window.inknest.settings.save({ accentColor: value } as any), invalid);
      expect(response.ok).toBe(false);
      if (!response.ok) expect(response.error.message).toContain("accentColor");
    }
    expect(await window.evaluate(async () => window.inknest.settings.get())).toMatchObject({ ok: true, data: { accentColor: "graphite" } });
    await expect(window.locator("html")).toHaveAttribute("data-accent", "graphite");
  } finally { await app.close(); }
});
