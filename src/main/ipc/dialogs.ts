import { ipcChannels } from "../../shared/ipc";
import { registerIpcHandler } from "./register";

export function registerDialogHandlers() {
  registerIpcHandler<{ canceled: true; path: null }>(
    ipcChannels.dialogs.selectImage,
    () => ({
      canceled: true,
      path: null
    })
  );
}
