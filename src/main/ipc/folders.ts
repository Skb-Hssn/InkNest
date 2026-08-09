import { ipcChannels, type FolderSummary } from "../../shared/ipc";
import {
  createWorkspaceFolder,
  deleteWorkspaceFolder,
  moveWorkspaceFolder,
  renameWorkspaceFolder
} from "../services/folder-service";
import { InMemorySearchIndex } from "../services/search-service";
import { invalidPayload } from "./errors";
import {
  assertActiveWorkspace,
  assertPlainObject,
  assertString,
  type ActiveWorkspaceState
} from "./validation";
import { registerIpcHandler } from "./register";

export function registerFolderHandlers(
  activeWorkspace: ActiveWorkspaceState,
  searchIndex?: InMemorySearchIndex
) {
  registerIpcHandler<FolderSummary>(ipcChannels.folders.create, (payload = {}) => {
    assertPlainObject(payload);

    return createWorkspaceFolder(
      assertActiveWorkspace(activeWorkspace),
      assertOptionalString(payload.parentPath, "parentPath") ?? ".",
      assertOptionalString(payload.name, "name") ?? "New Folder"
    );
  });

  registerIpcHandler<FolderSummary>(ipcChannels.folders.rename, async (payload) => {
    assertPlainObject(payload);

    const result = await renameWorkspaceFolder(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.name, "name")
    );

    await searchIndex?.rebuild(assertActiveWorkspace(activeWorkspace));
    return result;
  });

  registerIpcHandler<FolderSummary>(ipcChannels.folders.move, async (payload) => {
    assertPlainObject(payload);

    const result = await moveWorkspaceFolder(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.parentPath, "parentPath")
    );

    await searchIndex?.rebuild(assertActiveWorkspace(activeWorkspace));
    return result;
  });

  registerIpcHandler<{ deleted: true; path: string }>(
    ipcChannels.folders.delete,
    async (payload) => {
      assertPlainObject(payload);

      if (payload.confirmed !== true) {
        throw invalidPayload("Folder delete requires confirmation.");
      }

      const result = await deleteWorkspaceFolder(
        assertActiveWorkspace(activeWorkspace),
        assertString(payload.path, "path")
      );

      await searchIndex?.rebuild(assertActiveWorkspace(activeWorkspace));
      return result;
    }
  );
}

function assertOptionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  return assertString(value, fieldName);
}
