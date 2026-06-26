import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dialog } from "electron";
import { ipcChannels, type SelectImageResult } from "../../shared/ipc";
import {
  resolveInsideWorkspace,
  sanitizeFileName,
  toWorkspaceRelativePath
} from "../services/path-utils";
import { registerIpcHandler } from "./register";
import { assertActiveWorkspace, type ActiveWorkspaceState } from "./validation";

const workspaceImageAssetFolderName = "asset";

export function registerDialogHandlers(activeWorkspace: ActiveWorkspaceState) {
  registerIpcHandler<SelectImageResult>(
    ipcChannels.dialogs.selectImage,
    async () => {
      const workspaceRoot = assertActiveWorkspace(activeWorkspace);
      const selection = await dialog.showOpenDialog({
        title: "Select image",
        properties: ["openFile"],
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]
          }
        ]
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        return {
          canceled: true,
          path: null,
          assetPath: null,
          displaySrc: null
        };
      }

      const selectedPath = selection.filePaths[0];
      const assetDirectory = resolveInsideWorkspace(
        workspaceRoot,
        workspaceImageAssetFolderName
      );
      await mkdir(assetDirectory, { recursive: true });

      const assetFileName = `${Date.now()}-${sanitizeFileName(path.basename(selectedPath))}`;
      const assetPath = path.join(assetDirectory, assetFileName);
      await copyFile(selectedPath, assetPath);
      const relativeAssetPath = toWorkspaceRelativePath(workspaceRoot, assetPath);

      return {
        canceled: false,
        path: selectedPath,
        assetPath: relativeAssetPath,
        displaySrc: pathToFileURL(assetPath).toString()
      };
    }
  );
}
