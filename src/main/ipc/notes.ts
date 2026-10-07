import { dialog } from "electron";
import {
  ipcChannels,
  type DeletedNoteSummary,
  type ImportNotesResult,
  type NoteContent,
  type NoteSummary
} from "../../shared/ipc";
import {
  createMarkdownNote,
  duplicateMarkdownNote,
  moveMarkdownNote,
  moveMarkdownNoteToTrash,
  permanentlyDeleteMarkdownNote,
  readMarkdownNote,
  renameMarkdownNote,
  restoreMarkdownNote,
  saveMarkdownNote,
  scanMarkdownNotes,
  scanTrashNotes
} from "../services/note-service";
import {
  importMarkdownFiles,
  importMarkdownFolder
} from "../services/import-service";
import { InMemorySearchIndex } from "../services/search-service";
import { invalidPayload } from "./errors";
import {
  assertActiveWorkspace,
  assertPlainObject,
  assertString,
  type ActiveWorkspaceState
} from "./validation";
import { registerIpcHandler } from "./register";
import type { WorkspaceWatcher } from "../services/workspace-watcher";

export function registerNoteHandlers(
  activeWorkspace: ActiveWorkspaceState,
  searchIndex?: InMemorySearchIndex,
  workspaceWatcher?: WorkspaceWatcher
) {
  registerIpcHandler<NoteSummary[]>(ipcChannels.notes.list, () => {
    return scanMarkdownNotes(assertActiveWorkspace(activeWorkspace));
  });

  registerIpcHandler<NoteContent>(ipcChannels.notes.read, (payload) => {
    assertPlainObject(payload);

    return readMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path")
    );
  });

  registerIpcHandler<NoteContent>(ipcChannels.notes.create, async (payload = {}) => {
    assertPlainObject(payload);

    const result = await createMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertOptionalString(payload.folderPath, "folderPath") ?? ".",
      assertOptionalString(payload.title, "title") ?? "Untitled"
    );

    await refreshWorkspaceState(
      searchIndex,
      workspaceWatcher,
      assertActiveWorkspace(activeWorkspace)
    );
    return result;
  });

  registerIpcHandler<ImportNotesResult>(
    ipcChannels.notes.importFiles,
    async (payload = {}) => {
      assertPlainObject(payload);
      const selection = await dialog.showOpenDialog({
        title: "Import Markdown notes",
        buttonLabel: "Import notes",
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "Markdown", extensions: ["md"] }]
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        return { imported: [], skipped: [] };
      }

      const workspaceRoot = assertActiveWorkspace(activeWorkspace);
      const result = await importMarkdownFiles(
        workspaceRoot,
        selection.filePaths,
        assertOptionalString(payload.folderPath, "folderPath") ?? "."
      );

      await refreshWorkspaceState(searchIndex, workspaceWatcher, workspaceRoot);
      return result;
    }
  );

  registerIpcHandler<ImportNotesResult>(
    ipcChannels.notes.importFolder,
    async (payload = {}) => {
      assertPlainObject(payload);
      const selection = await dialog.showOpenDialog({
        title: "Import Markdown folder",
        buttonLabel: "Import folder",
        properties: ["openDirectory"]
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        return { imported: [], skipped: [] };
      }

      const workspaceRoot = assertActiveWorkspace(activeWorkspace);
      const result = await importMarkdownFolder(
        workspaceRoot,
        selection.filePaths[0],
        assertOptionalString(payload.folderPath, "folderPath") ?? "."
      );

      await refreshWorkspaceState(searchIndex, workspaceWatcher, workspaceRoot);
      return result;
    }
  );

  registerIpcHandler<NoteSummary>(ipcChannels.notes.rename, async (payload) => {
    assertPlainObject(payload);

    const result = await renameMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.title, "title")
    );

    await refreshWorkspaceState(
      searchIndex,
      workspaceWatcher,
      assertActiveWorkspace(activeWorkspace)
    );
    return result;
  });

  registerIpcHandler<NoteContent>(ipcChannels.notes.duplicate, async (payload) => {
    assertPlainObject(payload);

    const result = await duplicateMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path")
    );

    await refreshWorkspaceState(
      searchIndex,
      workspaceWatcher,
      assertActiveWorkspace(activeWorkspace)
    );
    return result;
  });

  registerIpcHandler<NoteSummary>(ipcChannels.notes.move, async (payload) => {
    assertPlainObject(payload);

    const result = await moveMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.folderPath, "folderPath")
    );

    await refreshWorkspaceState(
      searchIndex,
      workspaceWatcher,
      assertActiveWorkspace(activeWorkspace)
    );
    return result;
  });

  registerIpcHandler<NoteContent>(ipcChannels.notes.save, async (payload) => {
    assertPlainObject(payload);
    if (typeof payload.markdown !== "string") {
      throw invalidPayload("markdown must be a string.");
    }

    const result = await saveMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      payload.markdown
    );

    await refreshWorkspaceState(
      searchIndex,
      workspaceWatcher,
      assertActiveWorkspace(activeWorkspace)
    );
    return result;
  });

  registerIpcHandler<DeletedNoteSummary>(ipcChannels.notes.delete, async (payload) => {
    assertPlainObject(payload);

    const result = await moveMarkdownNoteToTrash(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path")
    );

    await refreshWorkspaceState(
      searchIndex,
      workspaceWatcher,
      assertActiveWorkspace(activeWorkspace)
    );
    return result;
  });

  registerIpcHandler<DeletedNoteSummary[]>(ipcChannels.notes.listTrash, () => {
    return scanTrashNotes(assertActiveWorkspace(activeWorkspace));
  });

  registerIpcHandler<NoteContent>(ipcChannels.notes.restore, async (payload) => {
    assertPlainObject(payload);

    const result = await restoreMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.trashPath, "trashPath")
    );

    await refreshWorkspaceState(
      searchIndex,
      workspaceWatcher,
      assertActiveWorkspace(activeWorkspace)
    );
    return result;
  });

  registerIpcHandler<{ deleted: true; trashPath: string }>(
    ipcChannels.notes.permanentlyDelete,
    async (payload) => {
      assertPlainObject(payload);

      if (payload.confirmed !== true) {
        throw invalidPayload("Permanent delete requires confirmation.");
      }

      const result = await permanentlyDeleteMarkdownNote(
        assertActiveWorkspace(activeWorkspace),
        assertString(payload.trashPath, "trashPath")
      );

      await refreshWorkspaceState(
        searchIndex,
        workspaceWatcher,
        assertActiveWorkspace(activeWorkspace)
      );
      return result;
    }
  );
}

async function refreshWorkspaceState(
  searchIndex: InMemorySearchIndex | undefined,
  workspaceWatcher: WorkspaceWatcher | undefined,
  workspaceRoot: string
) {
  await searchIndex?.rebuild(workspaceRoot);
  await workspaceWatcher?.sync();
}

function assertOptionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  return assertString(value, fieldName);
}
