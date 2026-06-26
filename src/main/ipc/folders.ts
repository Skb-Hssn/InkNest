import { ipcChannels, type FolderSummary } from "../../shared/ipc";
import {
  createWorkspaceFolder,
  deleteWorkspaceFolder,
  moveWorkspaceFolder,
  renameWorkspaceFolder
} from "../services/folder-service";
import { invalidPayload } from "./errors";
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

  registerIpcHandler<FolderSummary>(ipcChannels.folders.rename, (payload) => {
    assertPlainObject(payload);

    return renameWorkspaceFolder(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.name, "name")
    );
  });

  registerIpcHandler<FolderSummary>(ipcChannels.folders.move, (payload) => {
    assertPlainObject(payload);

    return moveWorkspaceFolder(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.parentPath, "parentPath")
    );
  });

  registerIpcHandler<{ deleted: true; path: string }>(
    ipcChannels.folders.delete,
    (payload) => {
      assertPlainObject(payload);

      if (payload.confirmed !== true) {
        throw invalidPayload("Folder delete requires confirmation.");
      }

      return deleteWorkspaceFolder(
        assertActiveWorkspace(activeWorkspace),
        assertString(payload.path, "path")
      );
    }
  );
}

function assertOptionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  return assertString(value, fieldName);
}
