import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppSettings } from "../../shared/ipc";

const settingsFileName = "settings.json";
const maxRecentWorkspaces = 5;

const defaultSettings: AppSettings = {
  theme: "system",
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
  const currentSettings = await readSettings();
  return writeSettings(normalizeSettings(update(currentSettings)));
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
