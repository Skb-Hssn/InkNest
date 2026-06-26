import path from "node:path";
import { invalidPayload } from "../ipc/errors";

export function resolveInsideWorkspace(
  workspaceRoot: string,
  candidatePath = "."
) {
  const root = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(root, candidatePath);

  if (!isInsideWorkspace(root, resolvedPath)) {
    throw invalidPayload("Path is outside the active workspace.");
  }

  return resolvedPath;
}

export function isInsideWorkspace(workspaceRoot: string, candidatePath: string) {
  const root = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(candidatePath);
  const relativePath = path.relative(root, resolvedPath);

  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

export function toWorkspaceRelativePath(
  workspaceRoot: string,
  candidatePath: string
) {
  const root = path.resolve(workspaceRoot);
  const resolvedPath = resolveInsideWorkspace(root, candidatePath);
  const relativePath = path.relative(root, resolvedPath);

  return relativePath === "" ? "." : normalizeWorkspacePath(relativePath);
}

export function normalizeWorkspacePath(candidatePath: string) {
  return candidatePath.split(path.sep).join("/");
}

export function sanitizeFileName(value: string) {
  const sanitized = value
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return sanitized.length > 0 ? sanitized : "Untitled";
}
