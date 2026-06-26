import { ipcChannels } from "../../shared/ipc";
import { assertPlainObject, assertString, assertWorkspacePath, type ActiveWorkspaceState } from "./validation";
import { registerIpcHandler } from "./register";

export function registerExportHandlers(activeWorkspace: ActiveWorkspaceState) {
  registerIpcHandler<{ queued: false; path: string }>(
    ipcChannels.export.note,
    (payload) => {
      assertPlainObject(payload);

      return {
        queued: false,
        path: assertWorkspacePath(assertString(payload.path, "path"), activeWorkspace)
      };
    }
  );
}
