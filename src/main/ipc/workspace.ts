import path from "node:path";
import { ipcChannels, type WorkspaceInfo } from "../../shared/ipc";
import { assertPlainObject, assertString, type ActiveWorkspaceState } from "./validation";
import { registerIpcHandler } from "./register";

export function registerWorkspaceHandlers(activeWorkspace: ActiveWorkspaceState) {
  registerIpcHandler<WorkspaceInfo>(ipcChannels.workspace.getActive, () => {
    if (!activeWorkspace.path) {
      return {
        path: null,
        name: null
      };
    }

    return {
      path: activeWorkspace.path,
      name: path.basename(activeWorkspace.path)
    };
  });

  registerIpcHandler<WorkspaceInfo>(ipcChannels.workspace.select, (payload) => {
    assertPlainObject(payload);
    const workspacePath = path.resolve(assertString(payload.path, "path"));
    activeWorkspace.path = workspacePath;

    return {
      path: workspacePath,
      name: path.basename(workspacePath)
    };
  });
}
