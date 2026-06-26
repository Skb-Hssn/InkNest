import { ipcChannels, type AppSettings } from "../../shared/ipc";
import { readSettings, updateSettings } from "../services/settings-store";
import { assertPlainObject, assertTheme } from "./validation";
import { registerIpcHandler } from "./register";

export function registerSettingsHandlers() {
  registerIpcHandler<AppSettings>(ipcChannels.settings.get, () => readSettings());

  registerIpcHandler<AppSettings>(ipcChannels.settings.save, (payload) => {
    assertPlainObject(payload);

    return updateSettings((settings) => ({
      ...settings,
      theme: assertTheme(payload.theme)
    }));
  });
}
