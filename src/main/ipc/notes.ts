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
  scanMarkdownNotes,
  scanTrashNotes
} from "../services/note-service";
import { invalidPayload } from "./errors";
import {
  assertActiveWorkspace,
  assertPlainObject,
  assertString,
  type ActiveWorkspaceState
} from "./validation";
import { registerIpcHandler } from "./register";

export function registerNoteHandlers(activeWorkspace: ActiveWorkspaceState) {
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

  registerIpcHandler<NoteContent>(ipcChannels.notes.create, (payload = {}) => {
    assertPlainObject(payload);

    return createMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertOptionalString(payload.folderPath, "folderPath") ?? ".",
      assertOptionalString(payload.title, "title") ?? "Untitled"
    );
  });

  registerIpcHandler<NoteSummary>(ipcChannels.notes.rename, (payload) => {
    assertPlainObject(payload);

    return renameMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.title, "title")
    );
  });

  registerIpcHandler<NoteContent>(ipcChannels.notes.duplicate, (payload) => {
    assertPlainObject(payload);

    return duplicateMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path")
    );
  });

  registerIpcHandler<NoteSummary>(ipcChannels.notes.move, (payload) => {
    assertPlainObject(payload);

    return moveMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path"),
      assertString(payload.folderPath, "folderPath")
    );
  });

  registerIpcHandler<DeletedNoteSummary>(ipcChannels.notes.delete, (payload) => {
    assertPlainObject(payload);

    return moveMarkdownNoteToTrash(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.path, "path")
    );
  });

  registerIpcHandler<DeletedNoteSummary[]>(ipcChannels.notes.listTrash, () => {
    return scanTrashNotes(assertActiveWorkspace(activeWorkspace));
  });

  registerIpcHandler<NoteContent>(ipcChannels.notes.restore, (payload) => {
    assertPlainObject(payload);

    return restoreMarkdownNote(
      assertActiveWorkspace(activeWorkspace),
      assertString(payload.trashPath, "trashPath")
    );
  });

  registerIpcHandler<{ deleted: true; trashPath: string }>(
    ipcChannels.notes.permanentlyDelete,
    (payload) => {
      assertPlainObject(payload);

      if (payload.confirmed !== true) {
        throw invalidPayload("Permanent delete requires confirmation.");
      }

      return permanentlyDeleteMarkdownNote(
        assertActiveWorkspace(activeWorkspace),
        assertString(payload.trashPath, "trashPath")
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
