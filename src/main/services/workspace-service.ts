import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { WorkspaceInfo, WorkspaceStatus } from "../../shared/ipc";
import type { AppSettings } from "../../shared/ipc";

type WorkspaceAccess = {
  status: WorkspaceStatus;
  message: string;
};

export async function inspectWorkspacePath(
  workspacePath: string
): Promise<WorkspaceAccess> {
  const resolvedPath = path.resolve(workspacePath);

  try {
    const workspaceStats = await stat(resolvedPath);

    if (!workspaceStats.isDirectory()) {
      return {
        status: "missing",
        message: "The saved workspace path is not a folder."
      };
    }

    await access(resolvedPath, constants.R_OK | constants.W_OK);

    return {
      status: "ready",
      message: "Workspace is ready."
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "EACCES" || error.code === "EPERM")
    ) {
      return {
        status: "permission-denied",
        message:
          "InkNest cannot access the previous workspace. Choose it again or select another folder."
      };
    }

    return {
      status: "missing",
      message:
        "The previous workspace could not be found. Choose a local Markdown folder to continue."
    };
  }
}

export function createWorkspaceInfo(
  activeWorkspacePath: string | null,
  settings: AppSettings,
  status: WorkspaceStatus,
  message: string
): WorkspaceInfo {
  return {
    path: activeWorkspacePath,
    name: activeWorkspacePath ? path.basename(activeWorkspacePath) : null,
    status,
    message,
    recentWorkspaces: settings.recentWorkspaces,
    lastWorkspacePath: settings.lastWorkspacePath
  };
}
