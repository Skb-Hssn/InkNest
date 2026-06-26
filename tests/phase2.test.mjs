import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function extractChannelNames(source) {
  return Array.from(source.matchAll(/"([a-z-]+:[a-z-]+)"/g), ([, channel]) => channel);
}

test("phase 2 registers grouped main-process IPC handlers", async () => {
  const mainSource = await readText("src/main/index.ts");
  const indexSource = await readText("src/main/ipc/index.ts");
  const registerSource = await readText("src/main/ipc/register.ts");

  assert.match(mainSource, /registerIpcHandlers\(\)/);
  assert.match(indexSource, /registerWorkspaceHandlers/);
  assert.match(indexSource, /registerNoteHandlers/);
  assert.match(indexSource, /registerSettingsHandlers/);
  assert.match(indexSource, /registerLinkHandlers/);
  assert.match(indexSource, /registerDialogHandlers/);
  assert.match(indexSource, /registerExportHandlers/);
  assert.match(registerSource, /ipcMain\.handle/);
  assert.match(registerSource, /IpcResult<T>/);
  assert.match(registerSource, /INVALID_PAYLOAD|INTERNAL_ERROR/);
});

test("phase 2 shared contract declares the expected narrow channels", async () => {
  const sharedIpc = await readText("src/shared/ipc.ts");
  const sharedPreload = await readText("src/shared/preload.ts");
  const preloadSource = await readText("src/preload/index.ts");
  const channels = extractChannelNames(sharedIpc);

  assert.deepEqual(channels.sort(), [
    "app:get-info",
    "dialogs:select-image",
    "export:note",
    "links:open-external",
    "notes:list",
    "notes:read",
    "settings:get",
    "settings:save",
    "workspace:choose",
    "workspace:get-active",
    "workspace:scan",
    "workspace:select"
  ].sort());

  for (const group of [
    "app",
    "workspace",
    "notes",
    "settings",
    "links",
    "dialogs",
    "export"
  ]) {
    assert.match(sharedIpc, new RegExp(`${group}:`));
    assert.match(sharedPreload, new RegExp(`${group}:\\s*\\{`));
    assert.match(preloadSource, new RegExp(`${group}:\\s*\\{`));
  }

  assert.doesNotMatch(preloadSource, /from "node:fs"|from "fs"|process\./);
  assert.doesNotMatch(sharedPreload, /any/);
});

test("phase 2 preload only invokes approved channels", async () => {
  const preloadSource = await readText("src/preload/index.ts");

  assert.match(preloadSource, /contextBridge\.exposeInMainWorld\("inknest"/);
  assert.match(preloadSource, /ipcRenderer\.invoke/);
  assert.doesNotMatch(preloadSource, /ipcRenderer\.send/);
  assert.doesNotMatch(preloadSource, /ipcRenderer\.on/);
  assert.doesNotMatch(preloadSource, /ipcRenderer\.once/);
  assert.doesNotMatch(preloadSource, /exposeInMainWorld\("[^"]*ipc/i);
  assert.doesNotMatch(preloadSource, /shell\.openExternal/);
});

test("phase 2 validates payloads, URLs, and workspace paths", async () => {
  const validationSource = await readText("src/main/ipc/validation.ts");
  const linksSource = await readText("src/main/ipc/links.ts");
  const notesSource = await readText("src/main/ipc/notes.ts");

  assert.match(validationSource, /assertPlainObject/);
  assert.match(validationSource, /assertSafeExternalUrl/);
  assert.match(validationSource, /url\.protocol !== "https:"/);
  assert.match(validationSource, /url\.protocol !== "http:"/);
  assert.match(validationSource, /Path is outside the active workspace/);
  assert.match(validationSource, /path\.relative\(workspaceRoot, resolvedPath\)/);
  assert.match(linksSource, /shell\.openExternal/);
  assert.match(notesSource, /assertActiveWorkspace/);
});

test("phase 2 handlers reject invalid payloads through result envelopes", async () => {
  const errorsSource = await readText("src/main/ipc/errors.ts");
  const registerSource = await readText("src/main/ipc/register.ts");
  const settingsSource = await readText("src/main/ipc/settings.ts");
  const linksSource = await readText("src/main/ipc/links.ts");
  const workspaceSource = await readText("src/main/ipc/workspace.ts");

  assert.match(errorsSource, /class IpcRequestError extends Error/);
  assert.match(errorsSource, /INVALID_PAYLOAD/);
  assert.match(registerSource, /ok:\s*false/);
  assert.match(registerSource, /error:\s*\{/);
  assert.match(registerSource, /code:\s*error\.code/);
  assert.match(registerSource, /message:\s*error\.message/);
  assert.match(registerSource, /message:\s*"The request could not be completed\."/);
  assert.match(settingsSource, /assertPlainObject\(payload\)/);
  assert.match(settingsSource, /assertTheme\(payload\.theme\)/);
  assert.match(linksSource, /assertPlainObject\(payload\)/);
  assert.match(linksSource, /assertSafeExternalUrl\(payload\.url\)/);
  assert.match(workspaceSource, /assertPlainObject\(payload\)/);
  assert.match(workspaceSource, /assertString\(payload\.path,\s*"path"\)/);
});

test("phase 2 keeps filesystem and native behavior in the main process", async () => {
  const preloadSource = await readText("src/preload/index.ts");
  const rendererSource = await readText("src/renderer/src/App.tsx");
  const mainIndexSource = await readText("src/main/index.ts");
  const linksSource = await readText("src/main/ipc/links.ts");
  const exportSource = await readText("src/main/ipc/export.ts");

  assert.match(mainIndexSource, /contextIsolation:\s*true/);
  assert.match(mainIndexSource, /nodeIntegration:\s*false/);
  assert.match(mainIndexSource, /sandbox:\s*true/);
  assert.doesNotMatch(preloadSource, /from "node:fs"|from "fs"|from "node:path"|from "path"/);
  assert.doesNotMatch(rendererSource, /from "node:fs"|from "fs"|from "electron"/);
  assert.match(linksSource, /import \{ shell \} from "electron"/);
  assert.match(exportSource, /assertWorkspacePath/);
});
