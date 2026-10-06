import { isSessionNotePath, normalizeWorkspaceSession, readWorkspaceSession, writeWorkspaceSession } from "../services/workspace-session-store";
import { exampleNotePaths, getExampleWorkspacePath, prepareFirstLaunchWorkspace } from "../services/example-workspace";
import { dialog } from "electron";
import path from "node:path";
import { ipcChannels, type WorkspaceFileModel, type WorkspaceInfo, type WorkspaceSession } from "../../shared/ipc";
import { readSettings, rememberWorkspace } from "../services/settings-store";
import {
  createWorkspaceInfo,
  inspectWorkspacePath,
  scanWorkspaceFileModel
} from "../services/workspace-service";
import { InMemorySearchIndex } from "../services/search-service";
import {
  assertActiveWorkspace,
  assertPlainObject,
  assertString,
  type ActiveWorkspaceState
} from "./validation";
import { invalidPayload } from "./errors";
import { registerIpcHandler } from "./register";
import type { WorkspaceWatcher } from "../services/workspace-watcher";

export function registerWorkspaceHandlers(
  activeWorkspace: ActiveWorkspaceState,
  searchIndex?: InMemorySearchIndex,
  workspaceWatcher?: WorkspaceWatcher
) {
  registerIpcHandler<WorkspaceSession | null>(ipcChannels.workspace.getSession, () =>
    readWorkspaceSession(assertActiveWorkspace(activeWorkspace)));
  registerIpcHandler<WorkspaceSession>(ipcChannels.workspace.saveSession, async (payload) => {
    assertPlainObject(payload);
    const root = assertActiveWorkspace(activeWorkspace);
    if (path.resolve(assertString(payload.workspacePath, "workspacePath")) !== path.resolve(root))
      throw invalidPayload("Session belongs to a different workspace.");
    if (!Array.isArray(payload.openNotePaths) || !payload.openNotePaths.every(isSessionNotePath) ||
        (payload.activeNotePath !== null && (typeof payload.activeNotePath !== "string" || !payload.openNotePaths.includes(payload.activeNotePath))))
      throw invalidPayload("Invalid note session.");
    const session = normalizeWorkspaceSession(payload)!;
    return writeWorkspaceSession(root, session);
  });

  registerIpcHandler<WorkspaceInfo>(ipcChannels.workspace.getActive, async () => {
    const settings = await readSettings();

    if (activeWorkspace.path) {
      const info = createWorkspaceInfo(activeWorkspace.path, settings, "ready", "Workspace is ready.");
      return activeWorkspace.path === getExampleWorkspacePath() ? { ...info, initialNotePaths: exampleNotePaths } : info;
    }

    return createWorkspaceInfo(
      null,
      settings,
      activeWorkspace.restoreStatus,
      activeWorkspace.restoreMessage
    );
  });

  registerIpcHandler<WorkspaceInfo>(ipcChannels.workspace.choose, async () => {
    const selection = await dialog.showOpenDialog({
      title: "Choose InkNest workspace",
      buttonLabel: "Use this folder",
      properties: ["openDirectory", "createDirectory"]
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      const settings = await readSettings();
      return createWorkspaceInfo(
        activeWorkspace.path,
        settings,
        activeWorkspace.path ? "ready" : activeWorkspace.restoreStatus,
        activeWorkspace.path
          ? "Workspace is ready."
          : activeWorkspace.restoreMessage
      );
    }

    return activateWorkspace(
      selection.filePaths[0],
      activeWorkspace,
      searchIndex,
      workspaceWatcher
    );
  });

  registerIpcHandler<WorkspaceInfo>(ipcChannels.workspace.select, async (payload) => {
    assertPlainObject(payload);
    const workspacePath = path.resolve(assertString(payload.path, "path"));

    return activateWorkspace(
      workspacePath,
      activeWorkspace,
      searchIndex,
      workspaceWatcher
    );
  });

  registerIpcHandler<WorkspaceFileModel>(ipcChannels.workspace.scan, async () => {
    const workspacePath = assertActiveWorkspace(activeWorkspace);
    const settings = await readSettings();
    await searchIndex?.ensureWorkspace(workspacePath);

    return scanWorkspaceFileModel(workspacePath, settings);
  });
}

export async function restoreLastWorkspace(activeWorkspace: ActiveWorkspaceState) {
  await prepareFirstLaunchWorkspace();
  const settings = await readSettings();

  if (!settings.lastWorkspacePath) {
    activeWorkspace.path = null;
    activeWorkspace.restoreStatus = "none";
    activeWorkspace.restoreMessage = "Choose a local Markdown folder to begin.";
    return;
  }

  const accessResult = await inspectWorkspacePath(settings.lastWorkspacePath);

  if (accessResult.status === "ready") {
    activeWorkspace.path = path.resolve(settings.lastWorkspacePath);
  } else {
    activeWorkspace.path = null;
  }

  activeWorkspace.restoreStatus = accessResult.status;
  activeWorkspace.restoreMessage = accessResult.message;
}

async function activateWorkspace(
  workspacePath: string,
  activeWorkspace: ActiveWorkspaceState,
  searchIndex?: InMemorySearchIndex,
  workspaceWatcher?: WorkspaceWatcher
) {
  const accessResult = await inspectWorkspacePath(workspacePath);

  if (accessResult.status !== "ready") {
    throw invalidPayload(accessResult.message);
  }

  const settings = await rememberWorkspace(workspacePath);
  const resolvedWorkspacePath = path.resolve(workspacePath);
  await scanWorkspaceFileModel(resolvedWorkspacePath, settings);
  await searchIndex?.rebuild(resolvedWorkspacePath);
  await workspaceWatcher?.watch(resolvedWorkspacePath).catch(() => undefined);
  activeWorkspace.path = resolvedWorkspacePath;
  activeWorkspace.restoreStatus = "ready";
  activeWorkspace.restoreMessage = accessResult.message;

  return createWorkspaceInfo(
    resolvedWorkspacePath,
    settings,
    "ready",
    accessResult.message
  );
}
