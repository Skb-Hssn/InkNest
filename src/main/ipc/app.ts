import { ipcChannels, type AppInfo } from "../../shared/ipc";
import { registerIpcHandler } from "./register";

export function registerAppHandlers() {
  registerIpcHandler<AppInfo>(ipcChannels.app.getInfo, () => ({
    name: "InkNest",
    // Previous milestones: phase-9-toolbar-editing-commands, phase-10-autosave-safe-writes,
    // phase-11-search-and-tags, phase-12-import-assets-links, phase-13-export,
    // phase-14-settings-and-themes, phase-15-reliability-and-external-changes,
    // and phase-16-accessibility-and-ui-polish.
    phase: "phase-17-release-validation"
  }));
}
