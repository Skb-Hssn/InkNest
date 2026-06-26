import path from "node:path";
import { invalidPayload, workspaceRequired } from "./errors";

export type ActiveWorkspaceState = {
  path: string | null;
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

export function assertWorkspacePath(
  candidatePath: string,
  activeWorkspace: ActiveWorkspaceState
) {
  if (!activeWorkspace.path) {
    throw workspaceRequired();
  }

  const workspaceRoot = path.resolve(activeWorkspace.path);
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
