import path from "node:path";
import { invalidPayload, workspaceRequired } from "./errors";
import { isAccentColor } from "../../shared/accent-colors";

export type ActiveWorkspaceState = {
  path: string | null;
  restoreStatus: "none" | "ready" | "missing" | "permission-denied";
  restoreMessage: string;
};

export function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw invalidPayload();
  }
}

export function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidPayload(`${fieldName} must be a non-empty string.`);
  }

  return value;
}

export function assertTheme(value: unknown): "system" | "light" | "dark" {
  if (value === "system" || value === "light" || value === "dark") {
    return value;
  }

  throw invalidPayload("theme must be system, light, or dark.");
}

export function assertAccentColor(value: unknown) {
  if (isAccentColor(value)) return value;
  throw invalidPayload("accentColor must be forest, teal, blue, violet, rose, orange, amber, or graphite.");
}

export function assertFontSize(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 12 ||
    value > 24
  ) {
    throw invalidPayload("fontSize must be an integer between 12 and 24.");
  }

  return value;
}

export function assertFontFamily(value: unknown): "system" | "serif" | "mono" {
  if (value === "system" || value === "serif" || value === "mono") {
    return value;
  }

  throw invalidPayload("fontFamily must be system, serif, or mono.");
}

export function assertAutoSaveDelay(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 500 ||
    value > 5000
  ) {
    throw invalidPayload("autoSaveDelayMs must be an integer between 500 and 5000.");
  }

  return value;
}

export function assertBoolean(value: unknown, fieldName: string) {
  if (typeof value !== "boolean") {
    throw invalidPayload(`${fieldName} must be a boolean.`);
  }

  return value;
}

export function assertOutlineWidth(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 180 || value > 420) {
    throw invalidPayload("outlineWidth must be an integer between 180 and 420.");
  }
  return value;
}

export function assertWorkspacePath(
  candidatePath: string,
  activeWorkspace: ActiveWorkspaceState
) {
  const workspaceRoot = assertActiveWorkspace(activeWorkspace);
  const resolvedPath = path.resolve(workspaceRoot, candidatePath);
  const relativePath = path.relative(workspaceRoot, resolvedPath);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw invalidPayload("Path is outside the active workspace.");
  }

  return resolvedPath;
}

export function assertActiveWorkspace(activeWorkspace: ActiveWorkspaceState) {
  if (!activeWorkspace.path) {
    throw workspaceRequired();
  }

  return path.resolve(activeWorkspace.path);
}

export function assertSafeExternalUrl(value: unknown) {
  const urlText = assertString(value, "url");

  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    throw invalidPayload("url must be a valid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw invalidPayload("Only http and https links can be opened.");
  }

  return url.toString();
}
