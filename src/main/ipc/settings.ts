import { ipcChannels, type AppSettings } from "../../shared/ipc";
import {
  clearRecentWorkspaces,
  readSettings,
  updateSettings
} from "../services/settings-store";
import {
  assertAutoSaveDelay,
  assertBoolean,
  assertFontFamily,
  assertFontSize,
  assertPlainObject,
  assertTheme
} from "./validation";
import { registerIpcHandler } from "./register";

export function registerSettingsHandlers() {
  registerIpcHandler<AppSettings>(ipcChannels.settings.get, () => readSettings());
  registerIpcHandler<AppSettings>(
    ipcChannels.settings.clearRecentWorkspaces,
    () => clearRecentWorkspaces()
  );

  registerIpcHandler<AppSettings>(ipcChannels.settings.save, (payload) => {
    assertPlainObject(payload);

    return updateSettings((settings) => {
      const nextSettings = {
        ...settings
      };

      if (payload.theme !== undefined) {
        nextSettings.theme = assertTheme(payload.theme);
      }

      if (payload.fontSize !== undefined) {
        nextSettings.fontSize = assertFontSize(payload.fontSize);
      }

      if (payload.fontFamily !== undefined) {
        nextSettings.fontFamily = assertFontFamily(payload.fontFamily);
      }

      if (payload.autoSaveDelayMs !== undefined) {
        nextSettings.autoSaveDelayMs = assertAutoSaveDelay(payload.autoSaveDelayMs);
      }

      if (payload.lineWrap !== undefined) {
        nextSettings.lineWrap = assertBoolean(payload.lineWrap, "lineWrap");
      }

      if (payload.fullWidth !== undefined) {
        nextSettings.fullWidth = assertBoolean(payload.fullWidth, "fullWidth");
      }
      if (payload.showOutline !== undefined) {
        nextSettings.showOutline = assertBoolean(payload.showOutline, "showOutline");
      }

      if (payload.showWordCount !== undefined) {
        nextSettings.showWordCount = assertBoolean(
          payload.showWordCount,
          "showWordCount"
        );
      }

      if (payload.sidebarVisible !== undefined) {
        nextSettings.sidebarVisible = assertBoolean(
          payload.sidebarVisible,
          "sidebarVisible"
        );
      }

      return nextSettings;
    });
  });
}
