import { ipcChannels, type AppInfo } from "../../shared/ipc";
import { registerIpcHandler } from "./register";

export function registerAppHandlers() {
  registerIpcHandler<AppInfo>(ipcChannels.app.getInfo, () => ({
    name: "InkNest",
    phase: "phase-3-static-layout"
  }));
}
