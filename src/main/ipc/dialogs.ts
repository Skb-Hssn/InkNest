import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dialog } from "electron";
import {
  ipcChannels,
  type SavedImageAsset,
  type SelectImageResult
} from "../../shared/ipc";
import {
  createAvailableAssetFileName,
  saveImageAsset
} from "../services/asset-service";
import {
  resolveInsideWorkspace,
  toWorkspaceRelativePath
} from "../services/path-utils";
import { invalidPayload } from "./errors";
import { registerIpcHandler } from "./register";
import {
  assertActiveWorkspace,
  assertPlainObject,
  assertString,
  type ActiveWorkspaceState
} from "./validation";

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

      const assetFileName = await createAvailableAssetFileName(
        workspaceRoot,
        path.basename(selectedPath)
      );
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

  registerIpcHandler<SavedImageAsset>(
    ipcChannels.dialogs.saveImage,
    async (payload) => {
      assertPlainObject(payload);

      return saveImageAsset(
        assertActiveWorkspace(activeWorkspace),
        assertImageBytes(payload.bytes),
        assertOptionalString(payload.fileName, "fileName"),
        assertOptionalString(payload.mimeType, "mimeType")
      );
    }
  );
}

function assertImageBytes(value: unknown) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (byte) =>
        typeof byte !== "number" ||
        !Number.isInteger(byte) ||
        byte < 0 ||
        byte > 255
    )
  ) {
    throw invalidPayload("Image data must be a non-empty byte array.");
  }

  return value;
}

function assertOptionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  return assertString(value, fieldName);
}
