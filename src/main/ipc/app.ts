import { ipcChannels, type AppInfo } from "../../shared/ipc";
import { registerIpcHandler } from "./register";

export function registerAppHandlers() {
  registerIpcHandler<AppInfo>(ipcChannels.app.getInfo, () => ({
    name: "InkNest",
    // Previous milestone: phase-9-toolbar-editing-commands.
    phase: "phase-10-autosave-safe-writes"
  }));
}
