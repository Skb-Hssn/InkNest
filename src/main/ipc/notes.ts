import { ipcChannels, type NoteSummary } from "../../shared/ipc";
import {
  readMarkdownNote,
  scanMarkdownNotes
} from "../services/note-service";
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

  registerIpcHandler<{ path: string; markdown: string }>(
    ipcChannels.notes.read,
    (payload) => {
      assertPlainObject(payload);

      return readMarkdownNote(
        assertActiveWorkspace(activeWorkspace),
        assertString(payload.path, "path")
      );
    }
  );
}
