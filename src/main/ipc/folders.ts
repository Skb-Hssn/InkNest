import { ipcChannels, type FolderSummary } from "../../shared/ipc";
import { createWorkspaceFolder } from "../services/folder-service";
import {
  assertActiveWorkspace,
  assertPlainObject,
  assertString,
  type ActiveWorkspaceState
} from "./validation";
import { registerIpcHandler } from "./register";

export function registerFolderHandlers(activeWorkspace: ActiveWorkspaceState) {
  registerIpcHandler<FolderSummary>(ipcChannels.folders.create, (payload = {}) => {
    assertPlainObject(payload);

    return createWorkspaceFolder(
      assertActiveWorkspace(activeWorkspace),
      assertOptionalString(payload.parentPath, "parentPath") ?? ".",
      assertOptionalString(payload.name, "name") ?? "New Folder"
    );
  });
}

function assertOptionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  return assertString(value, fieldName);
}
