import { dialog } from "electron";
import path from "node:path";
import {
  ipcChannels,
  type ExportNoteResult
} from "../../shared/ipc";
import {
  assertExportFormat,
  exportMarkdownNote,
  getDefaultExportPath,
  getExportExtension
} from "../services/export-service";
import { registerIpcHandler } from "./register";
import {
  assertActiveWorkspace,
  assertPlainObject,
  assertString,
  assertWorkspacePath,
  type ActiveWorkspaceState
} from "./validation";

type LegacyExportResult = {
  queued: false;
  path: string;
};

export function registerExportHandlers(activeWorkspace: ActiveWorkspaceState) {
  registerIpcHandler<ExportNoteResult | LegacyExportResult>(
    ipcChannels.export.note,
    async (payload) => {
      assertPlainObject(payload);

      const workspaceRoot = assertActiveWorkspace(activeWorkspace);
      const requestedNotePath = assertString(payload.path, "path");
      const noteAbsolutePath = assertWorkspacePath(
        requestedNotePath,
        activeWorkspace
      );

      if (payload.format === undefined) {
        return {
          queued: false,
          path: noteAbsolutePath
        };
      }

      const format = assertExportFormat(payload.format);
      const relativeNotePath = path.relative(workspaceRoot, noteAbsolutePath);
      const requestedDestination = assertOptionalString(
        payload.destinationPath,
        "destinationPath"
      );
      let destinationPath = requestedDestination;

      if (!destinationPath) {
        const selection = await dialog.showSaveDialog({
          title: `Export note as ${getExportExtension(format)}`,
          defaultPath: getDefaultExportPath(
            workspaceRoot,
            relativeNotePath,
            format
          ),
          filters: [
            {
              name: format === "markdown" ? "Markdown" : format.toUpperCase(),
              extensions: [getExportExtension(format).slice(1)]
            }
          ]
        });

        if (selection.canceled || !selection.filePath) {
          return {
            exported: false,
            canceled: true
          };
        }

        destinationPath = selection.filePath;
      }

      return exportMarkdownNote(
        workspaceRoot,
        relativeNotePath,
        format,
        destinationPath
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
