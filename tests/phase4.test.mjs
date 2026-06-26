import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function assertIncludesAll(source, expectedValues) {
  for (const expectedValue of expectedValues) {
    assert.ok(
      source.includes(expectedValue),
      `Expected source to include: ${expectedValue}`
    );
  }
}

test("phase 4 shared contract exposes workspace restore state and folder picker", async () => {
  const sharedIpc = await readText("src/shared/ipc.ts");
  const sharedPreload = await readText("src/shared/preload.ts");
  const preloadSource = await readText("src/preload/index.ts");

  assertIncludesAll(sharedIpc, [
    "WorkspaceStatus",
    '"none"',
    '"ready"',
    '"missing"',
    '"permission-denied"',
    "recentWorkspaces: string[]",
    "lastWorkspacePath: string | null",
    'choose: "workspace:choose"'
  ]);
  assert.match(sharedPreload, /choose:\s*\(\)\s*=>\s*Promise<IpcResult<WorkspaceInfo>>/);
  assert.match(preloadSource, /ipcChannels\.workspace\.choose/);
});

test("phase 4 persists settings and recent workspaces in the main process", async () => {
  const settingsStoreSource = await readText("src/main/services/settings-store.ts");
  const settingsHandlerSource = await readText("src/main/ipc/settings.ts");

  assertIncludesAll(settingsStoreSource, [
    'settingsFileName = "settings.json"',
    'app.getPath("userData")',
    "lastWorkspacePath",
    "recentWorkspaces",
    "maxRecentWorkspaces",
    "rememberWorkspace",
    "writeFile"
  ]);
  assert.match(settingsHandlerSource, /readSettings\(\)/);
  assert.match(settingsHandlerSource, /updateSettings/);
  assert.match(settingsHandlerSource, /assertTheme\(payload\.theme\)/);
});

test("phase 4 restores and validates one active workspace on startup", async () => {
  const ipcIndexSource = await readText("src/main/ipc/index.ts");
  const workspaceSource = await readText("src/main/ipc/workspace.ts");
  const workspaceServiceSource = await readText("src/main/services/workspace-service.ts");

  assert.match(ipcIndexSource, /await restoreLastWorkspace\(activeWorkspace\)/);
  assert.match(ipcIndexSource, /restoreStatus:\s*"none"/);
  assert.match(workspaceSource, /dialog\.showOpenDialog/);
  assert.match(workspaceSource, /properties:\s*\["openDirectory",\s*"createDirectory"\]/);
  assert.match(workspaceSource, /activateWorkspace/);
  assert.match(workspaceSource, /rememberWorkspace/);
  assertIncludesAll(workspaceServiceSource, [
    "inspectWorkspacePath",
    "workspaceStats.isDirectory()",
    "constants.R_OK | constants.W_OK",
    "permission-denied",
    "The previous workspace could not be found",
    "createWorkspaceInfo"
  ]);
});

test("phase 4 renderer shows workspace prompts, recent workspaces, and no direct filesystem access", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    "workspace.getActive()",
    "workspace.choose()",
    "workspace.select(workspacePath)",
    "Previous workspace missing",
    "Workspace access needed",
    "Recent workspaces",
    "Choose workspace",
    "Local Markdown folder",
    "Open a local Markdown folder to begin"
  ]);
  assert.match(stylesSource, /\.recent-workspace-row/);
  assert.doesNotMatch(appSource, /from "node:fs"|from "fs"|from "electron"/);
  assert.doesNotMatch(appSource, /ipcRenderer|showOpenDialog/);
});

test("phase 4 architecture document describes workspace selection and restore", async () => {
  const archSource = await readText("ARCH.md");

  assertIncludesAll(archSource, [
    "Phase 4 Architecture: Workspace Selection And Startup Restore",
    "workspace.choose()",
    "workspace:get-active",
    "workspace:choose",
    "workspace:select",
    "settings.json",
    "recentWorkspaces",
    "phase-7-folder-organization"
  ]);
});

test("phase 4 e2e coverage exercises selection, restore, and missing workspace states", async () => {
  const phase4E2eSource = await readText("tests/e2e/phase4.spec.ts");

  assertIncludesAll(phase4E2eSource, [
    "phase 4 selects a workspace and persists it in settings",
    "phase 4 restores the last workspace after restart",
    "phase 4 shows a clear missing-workspace state on startup",
    "window.inknest.workspace.select(workspacePath)",
    "window.inknest.workspace.getActive()",
    "window.inknest.settings.get()",
    'path.join(userDataDir, "settings.json")',
    "Previous workspace missing",
    "INKNEST_USER_DATA_DIR"
  ]);
});
