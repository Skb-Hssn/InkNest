import { readFile } from "node:fs/promises";
import path from "node:path";
import { dialog } from "electron";
import { ipcChannels, type SelectImageResult } from "../../shared/ipc";
import { registerIpcHandler } from "./register";

export function registerDialogHandlers() {
  registerIpcHandler<SelectImageResult>(
    ipcChannels.dialogs.selectImage,
    async () => {
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
          dataUrl: null
        };
      }

      const selectedPath = selection.filePaths[0];
      const imageBytes = await readFile(selectedPath);
      const mimeType = getImageMimeType(selectedPath);

      return {
        canceled: false,
        path: selectedPath,
        dataUrl: `data:${mimeType};base64,${imageBytes.toString("base64")}`
      };
    }
  );
}

function getImageMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".gif") {
    return "image/gif";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".svg") {
    return "image/svg+xml";
  }

  if (extension === ".bmp") {
    return "image/bmp";
  }

  return "image/png";
}
