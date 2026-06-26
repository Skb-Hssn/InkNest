import { ipcChannels, type NoteSummary } from "../../shared/ipc";
import { assertPlainObject, assertString, assertWorkspacePath, type ActiveWorkspaceState } from "./validation";
import { registerIpcHandler } from "./register";

export function registerNoteHandlers(activeWorkspace: ActiveWorkspaceState) {
  registerIpcHandler<NoteSummary[]>(ipcChannels.notes.list, () => []);

  registerIpcHandler<{ path: string; markdown: string }>(
    ipcChannels.notes.read,
    (payload) => {
      assertPlainObject(payload);

      return {
        path: assertWorkspacePath(assertString(payload.path, "path"), activeWorkspace),
        markdown: ""
      };
    }
  );
}
