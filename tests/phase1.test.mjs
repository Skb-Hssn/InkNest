import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

test("package scripts run the phase 1 Electron/Vite scaffold", async () => {
  const packageJson = await readJson("package.json");

  assert.match(packageJson.scripts.dev, /^electron-vite dev/);
  assert.match(packageJson.scripts.dev, /--noSandbox/);
  assert.match(packageJson.scripts.dev, /--disable-gpu/);
  assert.equal(packageJson.scripts.test, "node --test tests/*.test.mjs");
  assert.match(packageJson.scripts.check, /node scripts\/check-scaffold\.mjs/);
  assert.match(packageJson.scripts.check, /npm test/);
  assert.match(packageJson.scripts.check, /tsc --noEmit/);
  assert.equal(packageJson.scripts.build, "tsc --noEmit && electron-vite build");
});

test("package dependencies include the selected phase 1 stack", async () => {
  const packageJson = await readJson("package.json");

  for (const dependency of ["react", "react-dom", "lucide-react"]) {
    assert.ok(packageJson.dependencies[dependency], `${dependency} is installed`);
  }

  for (const dependency of [
    "electron",
    "electron-vite",
    "typescript",
    "vite",
    "@vitejs/plugin-react",
    "tailwindcss",
    "postcss",
    "autoprefixer"
  ]) {
    assert.ok(
      packageJson.devDependencies[dependency],
      `${dependency} is installed`
    );
  }
});

test("main process creates a secure InkNest browser window", async () => {
  const mainSource = await readText("src/main/index.ts");

  assert.match(mainSource, /title:\s*"InkNest"/);
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /Menu\.setApplicationMenu\(null\)/);
  assert.match(mainSource, /mainWindow\.setMenuBarVisibility\(false\)/);
  assert.match(mainSource, /loadURL\(process\.env\.ELECTRON_RENDERER_URL\)/);
  assert.match(mainSource, /loadFile\(path\.join\(__dirname,\s*"(\.\.\/)?renderer\/index\.html"\)\)/);
});

test("preload exposes only the narrow InkNest API", async () => {
  const preloadSource = await readText("src/preload/index.ts");
  const sharedSource = await readText("src/shared/preload.ts");
  const windowTypes = await readText("src/renderer/src/types/window.d.ts");

  assert.match(preloadSource, /contextBridge\.exposeInMainWorld\("inknest"/);
  assert.match(preloadSource, /ipcRenderer\.invoke\(ipcChannels\.app\.getInfo\)/);
  assert.doesNotMatch(preloadSource, /require\("fs"\)|from "node:fs"|from "fs"/);
  assert.match(sharedSource, /type InkNestApi/);
  assert.match(sharedSource, /getInfo:\s*\(\)\s*=>\s*Promise<IpcResult<AppInfo>>/);
  assert.match(windowTypes, /inknest:\s*InkNestApi/);
});

test("renderer starts with an app workspace shell, not a landing page", async () => {
  const html = await readText("src/renderer/index.html");
  const rendererMain = await readText("src/renderer/src/main.tsx");
  const appSource = await readText("src/renderer/src/App.tsx");

  assert.match(html, /<title>InkNest<\/title>/);
  assert.match(rendererMain, /ReactDOM\.createRoot/);
  assert.match(appSource, /Choose workspace/);
  assert.match(appSource, /Search notes/);
  assert.match(appSource, /Folders/);
  assert.match(appSource, /Notes/);
  assert.match(appSource, /Untitled note/);
  assert.match(appSource, /wordCount/);
  assert.doesNotMatch(appSource, /hero/i);
});

test("Tailwind and Vite configs point at the renderer app", async () => {
  const viteConfig = await readText("electron.vite.config.ts");
  const tailwindConfig = await readText("tailwind.config.ts");
  const rendererStyles = await readText("src/renderer/src/styles.css");

  assert.match(viteConfig, /defineConfig/);
  assert.match(viteConfig, /root:\s*resolve\("src\/renderer"\)/);
  assert.match(viteConfig, /react\(\)/);
  assert.match(tailwindConfig, /src\/renderer\/index\.html/);
  assert.match(tailwindConfig, /src\/renderer\/src\/\*\*\/\*\.\{ts,tsx\}/);
  assert.match(rendererStyles, /@tailwind base/);
  assert.match(rendererStyles, /@tailwind components/);
  assert.match(rendererStyles, /@tailwind utilities/);
});
