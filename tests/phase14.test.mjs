import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

async function createSettingsHarness() {
  const root = new URL("../", import.meta.url);
  const outputRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase14-settings-"));
  const source = await readFile(
    new URL("src/main/services/settings-store.ts", root),
    "utf8"
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const outputPath = path.join(outputRoot, "src/main/services/settings-store.js");

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  const accentSource = await readFile(new URL("src/shared/accent-colors.ts", root), "utf8");
  const accentOutput = ts.transpileModule(accentSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const accentPath = path.join(outputRoot, "src/shared/accent-colors.js");
  await mkdir(path.dirname(accentPath), { recursive: true });
  await writeFile(accentPath, accentOutput, "utf8");

  const userDataPath = path.join(outputRoot, "user-data");
  const electronStubPath = path.join(outputRoot, "node_modules", "electron", "index.js");
  await mkdir(path.dirname(electronStubPath), { recursive: true });
  await writeFile(
    electronStubPath,
    `exports.app = { getPath: () => ${JSON.stringify(userDataPath)} };\n`,
    "utf8"
  );

  return {
    userDataPath,
    requireService() {
      return import(pathToFileURL(outputPath).href);
    },
    requireAccents() {
      return import(pathToFileURL(accentPath).href);
    },
    async cleanup() {
      await rm(outputRoot, { recursive: true, force: true });
    }
  };
}

test("phase 14 exposes the settings contract and renderer controls", async () => {
  const sources = await Promise.all([
    readText("src/shared/ipc.ts"),
    readText("src/main/services/settings-store.ts"),
    readText("src/main/ipc/settings.ts"),
    readText("src/main/ipc/validation.ts"),
    readText("src/renderer/src/App.tsx"),
    readText("src/renderer/src/styles.css"),
    readText("ARCH.md")
  ]);
  const combined = sources.join("\n");

  for (const expected of [
    "phase-14-settings-and-themes",
    "fontSize",
    "fontFamily",
    "autoSaveDelayMs",
    "lineWrap",
    "showWordCount",
    "sidebarVisible",
    "assertFontSize",
    "assertFontFamily",
    "assertAutoSaveDelay",
    "settings:get",
    "Settings",
    "Theme",
    "Font size",
    "Font family",
    "Auto-save delay",
    "data-theme",
    "prefers-color-scheme",
    "sidebar-hidden",
    "Phase 14 Architecture: Settings And Themes"
  ]) {
    assert.ok(combined.includes(expected), `Expected Phase 14 source to include ${expected}`);
  }
});

test("phase 14 normalizes invalid settings and persists valid updates", async () => {
  const harness = await createSettingsHarness();

  try {
    await mkdir(harness.userDataPath, { recursive: true });
    await writeFile(
      path.join(harness.userDataPath, "settings.json"),
      `${JSON.stringify({
        theme: "midnight",
        accentColor: "rainbow",
        fontSize: 48,
        fontFamily: "comic-sans",
        autoSaveDelayMs: 100,
        lineWrap: "yes",
        outlineWidth: 999,
        showWordCount: false,
        sidebarVisible: true,
        lastWorkspacePath: "",
        recentWorkspaces: ["/workspace/one", "/workspace/one"]
      })}\n`,
      "utf8"
    );

    const { readSettings, updateSettings } = await harness.requireService();
    const normalized = await readSettings();

    assert.deepEqual(normalized, {
      theme: "system",
      accentColor: "forest",
      fontSize: 16,
      fontFamily: "system",
      autoSaveDelayMs: 750,
      lineWrap: true,
      fullWidth: false,
      showOutline: true,
      outlineWidth: 232,
      showWordCount: false,
      sidebarVisible: true,
      lockedNoteKeys: [],
      lastWorkspacePath: null,
      recentWorkspaces: [path.resolve("/workspace/one")]
    });

    const updated = await updateSettings((settings) => ({
      ...settings,
      theme: "dark",
      accentColor: "violet",
      fontSize: 20,
      lineWrap: false,
      outlineWidth: 360
    }));

    assert.equal(updated.theme, "dark");
    assert.equal(updated.accentColor, "violet");
    assert.equal((await readSettings()).accentColor, "violet");
    assert.equal(updated.fontSize, 20);
    assert.equal(updated.lineWrap, false);
    assert.equal(updated.outlineWidth, 360);
    assert.equal((await readSettings()).outlineWidth, 360);
    assert.equal(JSON.parse(await readFile(path.join(harness.userDataPath, "settings.json"))).fontFamily, "system");
  } finally {
    await harness.cleanup();
  }
});

test("legacy settings keep their appearance and gain the default accent", async () => {
  const harness = await createSettingsHarness();
  try {
    await mkdir(harness.userDataPath, { recursive: true });
    await writeFile(path.join(harness.userDataPath, "settings.json"), JSON.stringify({ theme: "dark", fontSize: 18, showOutline: false }));
    const { readSettings } = await harness.requireService();
    const settings = await readSettings();
    assert.equal(settings.accentColor, "forest");
    assert.equal(settings.theme, "dark");
    assert.equal(settings.fontSize, 18);
    assert.equal(settings.showOutline, false);
  } finally { await harness.cleanup(); }
});

test("every accent persists and its text and solid buttons have readable contrast", async () => {
  const harness = await createSettingsHarness();
  const luminance = (rgb) => rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
  const contrast = (first, second) => {
    const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (high + 0.05) / (low + 0.05);
  };
  try {
    const { accentColors, isAccentColor } = await harness.requireAccents();
    const { updateSettings, readSettings } = await harness.requireService();
    assert.equal(new Set(accentColors.map((color) => color.id)).size, 8);
    for (const color of accentColors) {
      assert.ok(isAccentColor(color.id));
      assert.ok(contrast(color.light, [255, 255, 255]) >= 4.5, `${color.name} light text contrast`);
      assert.ok(contrast(color.dark, [21, 27, 23]) >= 4.5, `${color.name} dark text contrast`);
      assert.ok(contrast(color.solid, [255, 255, 255]) >= 4.5, `${color.name} button contrast`);
      const lightTint = color.light.map((channel) => Math.round(channel * 0.09 + 255 * 0.91));
      const darkTint = color.dark.map((channel, index) => Math.round(channel * 0.1 + [21, 27, 23][index] * 0.9));
      assert.ok(contrast(color.solid, lightTint) >= 4.5, `${color.name} text on light tinted surfaces`);
      assert.ok(contrast(color.dark, darkTint) >= 4.5, `${color.name} text on dark tinted surfaces`);
      await updateSettings((settings) => ({ ...settings, accentColor: color.id }));
      assert.equal((await readSettings()).accentColor, color.id);
    }
    for (const invalid of [null, {}, 42, "BLUE", " blue ", "#000000", "rainbow"]) assert.equal(isAccentColor(invalid), false);
  } finally { await harness.cleanup(); }
});
