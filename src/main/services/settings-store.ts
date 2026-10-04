import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppSettings } from "../../shared/ipc";

const settingsFileName = "settings.json";
const maxRecentWorkspaces = 5;
let settingsUpdateQueue: Promise<unknown> = Promise.resolve();

export const defaultSettings: AppSettings = {
  theme: "system",
  fontSize: 16,
  fontFamily: "system",
  autoSaveDelayMs: 750,
  lineWrap: true,
  fullWidth: false,
  showOutline: true,
  showWordCount: true,
  sidebarVisible: true,
  lastWorkspacePath: null,
  recentWorkspaces: []
};

function getSettingsPath() {
  return path.join(app.getPath("userData"), settingsFileName);
}

function normalizeSettings(value: unknown): AppSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return defaultSettings;
  }

  const candidate = value as Partial<AppSettings>;
  const theme =
    candidate.theme === "light" ||
    candidate.theme === "dark" ||
    candidate.theme === "system"
      ? candidate.theme
      : defaultSettings.theme;
  const fontSize =
    typeof candidate.fontSize === "number" &&
    Number.isInteger(candidate.fontSize) &&
    candidate.fontSize >= 12 &&
    candidate.fontSize <= 24
      ? candidate.fontSize
      : defaultSettings.fontSize;
  const fontFamily =
    candidate.fontFamily === "system" ||
    candidate.fontFamily === "serif" ||
    candidate.fontFamily === "mono"
      ? candidate.fontFamily
      : defaultSettings.fontFamily;
  const autoSaveDelayMs =
    typeof candidate.autoSaveDelayMs === "number" &&
    Number.isInteger(candidate.autoSaveDelayMs) &&
    candidate.autoSaveDelayMs >= 500 &&
    candidate.autoSaveDelayMs <= 5000
      ? candidate.autoSaveDelayMs
      : defaultSettings.autoSaveDelayMs;
  const lineWrap =
    typeof candidate.lineWrap === "boolean"
      ? candidate.lineWrap
      : defaultSettings.lineWrap;
  const showWordCount =
    typeof candidate.showWordCount === "boolean"
      ? candidate.showWordCount
      : defaultSettings.showWordCount;
  const sidebarVisible =
    typeof candidate.sidebarVisible === "boolean"
      ? candidate.sidebarVisible
      : defaultSettings.sidebarVisible;
  const lastWorkspacePath =
    typeof candidate.lastWorkspacePath === "string" &&
    candidate.lastWorkspacePath.trim().length > 0
      ? path.resolve(candidate.lastWorkspacePath)
      : null;
  const recentWorkspaces = Array.isArray(candidate.recentWorkspaces)
    ? candidate.recentWorkspaces
        .filter((workspacePath): workspacePath is string => {
          return typeof workspacePath === "string" && workspacePath.trim().length > 0;
        })
        .map((workspacePath) => path.resolve(workspacePath))
    : [];

  return {
    theme,
    fontSize,
    fontFamily,
    autoSaveDelayMs,
    lineWrap,
    fullWidth: typeof candidate.fullWidth === "boolean" ? candidate.fullWidth : defaultSettings.fullWidth,
    showOutline: typeof candidate.showOutline === "boolean" ? candidate.showOutline : defaultSettings.showOutline,
    showWordCount,
    sidebarVisible,
    lastWorkspacePath,
    recentWorkspaces: Array.from(new Set(recentWorkspaces)).slice(
      0,
      maxRecentWorkspaces
    )
  };
}

export async function readSettings(): Promise<AppSettings> {
  try {
    const settingsText = await readFile(getSettingsPath(), "utf8");
    return normalizeSettings(JSON.parse(settingsText));
  } catch {
    return defaultSettings;
  }
}

export async function writeSettings(settings: AppSettings) {
  const settingsPath = getSettingsPath();
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return settings;
}

export async function updateSettings(
  update: (settings: AppSettings) => AppSettings
) {
  const queuedUpdate = settingsUpdateQueue.then(async () => {
    const currentSettings = await readSettings();
    return writeSettings(normalizeSettings(update(currentSettings)));
  });

  settingsUpdateQueue = queuedUpdate.then(
    () => undefined,
    () => undefined
  );

  return queuedUpdate;
}

export async function rememberWorkspace(workspacePath: string) {
  const resolvedWorkspacePath = path.resolve(workspacePath);

  return updateSettings((settings) => ({
    ...settings,
    lastWorkspacePath: resolvedWorkspacePath,
    recentWorkspaces: [
      resolvedWorkspacePath,
      ...settings.recentWorkspaces.filter(
        (recentPath) => recentPath !== resolvedWorkspacePath
      )
    ].slice(0, maxRecentWorkspaces)
  }));
}

export async function clearRecentWorkspaces() {
  return updateSettings((settings) => ({
    ...settings,
    recentWorkspaces: []
  }));
}
