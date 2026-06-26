import { dialog } from "electron";
import path from "node:path";
import { ipcChannels, type WorkspaceInfo } from "../../shared/ipc";
import { readSettings, rememberWorkspace } from "../services/settings-store";
import {
  createWorkspaceInfo,
  inspectWorkspacePath
} from "../services/workspace-service";
import { assertPlainObject, assertString, type ActiveWorkspaceState } from "./validation";
import { invalidPayload } from "./errors";
import { registerIpcHandler } from "./register";

export function registerWorkspaceHandlers(activeWorkspace: ActiveWorkspaceState) {
  registerIpcHandler<WorkspaceInfo>(ipcChannels.workspace.getActive, async () => {
    const settings = await readSettings();

    if (activeWorkspace.path) {
      return createWorkspaceInfo(
        activeWorkspace.path,
        settings,
        "ready",
        "Workspace is ready."
      );
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

    return activateWorkspace(selection.filePaths[0], activeWorkspace);
  });

  registerIpcHandler<WorkspaceInfo>(ipcChannels.workspace.select, async (payload) => {
    assertPlainObject(payload);
    const workspacePath = path.resolve(assertString(payload.path, "path"));

    return activateWorkspace(workspacePath, activeWorkspace);
  });
}

export async function restoreLastWorkspace(activeWorkspace: ActiveWorkspaceState) {
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
  activeWorkspace: ActiveWorkspaceState
) {
  const accessResult = await inspectWorkspacePath(workspacePath);

  if (accessResult.status !== "ready") {
    throw invalidPayload(accessResult.message);
  }

  const settings = await rememberWorkspace(workspacePath);
  const resolvedWorkspacePath = path.resolve(workspacePath);
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
