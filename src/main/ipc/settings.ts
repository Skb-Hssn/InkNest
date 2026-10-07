import { ipcChannels, type AppSettings } from "../../shared/ipc";
import {
  clearRecentWorkspaces,
  readSettings,
  updateSettings
} from "../services/settings-store";
import {
  assertAccentColor,
  assertAutoSaveDelay,
  assertBoolean,
  assertFontFamily,
  assertFontSize,
  assertOutlineWidth,
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
    if (payload.favoriteNoteKeys !== undefined &&
        (!Array.isArray(payload.favoriteNoteKeys) || payload.favoriteNoteKeys.some((key) => typeof key !== "string"))) {
      throw new Error("favoriteNoteKeys must be an array of strings.");
    }

    if (payload.lockedNoteKeys !== undefined &&
        (!Array.isArray(payload.lockedNoteKeys) || payload.lockedNoteKeys.some((key) => typeof key !== "string"))) {
      throw new Error("lockedNoteKeys must be an array of strings.");
    }

    return updateSettings((settings) => {
      const nextSettings = {
        ...settings
      };
      if (payload.favoriteNoteKeys !== undefined) {
        nextSettings.favoriteNoteKeys = [...new Set(payload.favoriteNoteKeys as string[])];
      }

      if (payload.lockedNoteKeys !== undefined) {
        nextSettings.lockedNoteKeys = [...new Set(payload.lockedNoteKeys as string[])];
      }

      if (payload.theme !== undefined) {
        nextSettings.theme = assertTheme(payload.theme);
      }

      if (payload.accentColor !== undefined) {
        nextSettings.accentColor = assertAccentColor(payload.accentColor);
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
      if (payload.outlineWidth !== undefined) {
        nextSettings.outlineWidth = assertOutlineWidth(payload.outlineWidth);
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
