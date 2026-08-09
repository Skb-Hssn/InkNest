import { ipcChannels, type AppInfo } from "../../shared/ipc";
import { registerIpcHandler } from "./register";

export function registerAppHandlers() {
  registerIpcHandler<AppInfo>(ipcChannels.app.getInfo, () => ({
    name: "InkNest",
    // Previous milestones: phase-9-toolbar-editing-commands, phase-10-autosave-safe-writes,
    // phase-11-search-and-tags, and phase-12-import-assets-links.
    phase: "phase-13-export"
  }));
}
