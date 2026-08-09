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
        fontSize: 48,
        fontFamily: "comic-sans",
        autoSaveDelayMs: 100,
        lineWrap: "yes",
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
      fontSize: 16,
      fontFamily: "system",
      autoSaveDelayMs: 750,
      lineWrap: true,
      showWordCount: false,
      sidebarVisible: true,
      lastWorkspacePath: null,
      recentWorkspaces: [path.resolve("/workspace/one")]
    });

    const updated = await updateSettings((settings) => ({
      ...settings,
      theme: "dark",
      fontSize: 20,
      lineWrap: false
    }));

    assert.equal(updated.theme, "dark");
    assert.equal(updated.fontSize, 20);
    assert.equal(updated.lineWrap, false);
    assert.equal(JSON.parse(await readFile(path.join(harness.userDataPath, "settings.json"))).fontFamily, "system");
  } finally {
    await harness.cleanup();
  }
});
