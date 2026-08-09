import {
  ipcChannels,
  type DeletedNoteSummary,
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
import { InMemorySearchIndex } from "../services/search-service";
import { invalidPayload } from "./errors";
import {
  assertActiveWorkspace,
  assertPlainObject,
  assertString,
  type ActiveWorkspaceState
} from "./validation";
import { registerIpcHandler } from "./register";

export function registerNoteHandlers(
  activeWorkspace: ActiveWorkspaceState,
  searchIndex?: InMemorySearchIndex
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

    await refreshSearchIndex(searchIndex, assertActiveWorkspace(activeWorkspace));
    return result;
  });

  registerIpcHandler<NoteSummary>(ipcChannels.notes.rename, async (payload) => {
    assertPlainObject(payload);

    const result = await renameMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.title, "title")
    );

    await refreshSearchIndex(searchIndex, assertActiveWorkspace(activeWorkspace));
    return result;
  });

  registerIpcHandler<NoteContent>(ipcChannels.notes.duplicate, async (payload) => {
    assertPlainObject(payload);

    const result = await duplicateMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path")
    );

    await refreshSearchIndex(searchIndex, assertActiveWorkspace(activeWorkspace));
    return result;
  });

  registerIpcHandler<NoteSummary>(ipcChannels.notes.move, async (payload) => {
    assertPlainObject(payload);

    const result = await moveMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.folderPath, "folderPath")
    );

    await refreshSearchIndex(searchIndex, assertActiveWorkspace(activeWorkspace));
    return result;
  });

  registerIpcHandler<NoteContent>(ipcChannels.notes.save, async (payload) => {
    assertPlainObject(payload);

    const result = await saveMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.markdown, "markdown")
    );

    await refreshSearchIndex(searchIndex, assertActiveWorkspace(activeWorkspace));
    return result;
  });

  registerIpcHandler<DeletedNoteSummary>(ipcChannels.notes.delete, async (payload) => {
    assertPlainObject(payload);

    const result = await moveMarkdownNoteToTrash(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path")
    );

    await refreshSearchIndex(searchIndex, assertActiveWorkspace(activeWorkspace));
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

    await refreshSearchIndex(searchIndex, assertActiveWorkspace(activeWorkspace));
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

      await refreshSearchIndex(searchIndex, assertActiveWorkspace(activeWorkspace));
      return result;
    }
  );
}

async function refreshSearchIndex(
  searchIndex: InMemorySearchIndex | undefined,
  workspaceRoot: string
) {
  await searchIndex?.rebuild(workspaceRoot);
}

function assertOptionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  return assertString(value, fieldName);
}
