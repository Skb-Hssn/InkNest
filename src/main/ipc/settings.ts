import { ipcChannels, type AppSettings } from "../../shared/ipc";
import { assertPlainObject, assertTheme } from "./validation";
import { registerIpcHandler } from "./register";

let settings: AppSettings = {
  theme: "system"
};

export function registerSettingsHandlers() {
  registerIpcHandler<AppSettings>(ipcChannels.settings.get, () => settings);

  registerIpcHandler<AppSettings>(ipcChannels.settings.save, (payload) => {
    assertPlainObject(payload);
    settings = {
      theme: assertTheme(payload.theme)
    };

    return settings;
  });
}
