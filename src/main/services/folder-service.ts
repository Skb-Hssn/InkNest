import { access, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { FolderSummary, WorkspaceMetadata } from "../../shared/ipc";
import { invalidPayload } from "../ipc/errors";
import {
  normalizeWorkspacePath,
  resolveInsideWorkspace,
  sanitizeFileName,
  toWorkspaceRelativePath
} from "./path-utils";

export const workspaceMetadataFolderName = ".inknest";
export const workspaceAssetsFolderName = "assets";
export const workspaceTrashFolderName = "trash";

const skippedFolderNames = new Set([
  workspaceMetadataFolderName,
  workspaceAssetsFolderName
]);

export function getWorkspaceMetadata(workspaceRoot: string): WorkspaceMetadata {
  return {
    metadataPath: workspaceMetadataFolderName,
    assetsPath: workspaceAssetsFolderName,
    trashPath: normalizeWorkspacePath(
      path.join(workspaceMetadataFolderName, workspaceTrashFolderName)
    )
  };
}

export async function ensureWorkspaceStructure(workspaceRoot: string) {
  const root = resolveInsideWorkspace(workspaceRoot);
  const metadata = getWorkspaceMetadata(root);

  await mkdir(path.join(root, metadata.metadataPath), { recursive: true });
  await mkdir(path.join(root, metadata.assetsPath), { recursive: true });
  await mkdir(path.join(root, metadata.trashPath), { recursive: true });

  return metadata;
}

export async function scanWorkspaceFolders(
  workspaceRoot: string
): Promise<FolderSummary[]> {
  const root = resolveInsideWorkspace(workspaceRoot);
  const folders: FolderSummary[] = [];

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || skippedFolderNames.has(entry.name)) {
        continue;
      }

      const folderPath = path.join(currentPath, entry.name);
      folders.push({
        name: entry.name,
        path: toWorkspaceRelativePath(root, folderPath)
      });

      await walk(folderPath);
    }
  }

  await walk(root);

  return folders.sort((first, second) => first.path.localeCompare(second.path));
}

export async function createWorkspaceFolder(
  workspaceRoot: string,
  parentPath = ".",
  name = "New Folder"
): Promise<FolderSummary> {
  const root = resolveInsideWorkspace(workspaceRoot);
  const parent = resolveInsideWorkspace(root, parentPath);
  const parentStats = await stat(parent);

  if (!parentStats.isDirectory()) {
    throw invalidPayload("Parent path must be a workspace folder.");
  }

  const relativeParentPath = toWorkspaceRelativePath(root, parent);

  if (isAppOwnedFolderPath(relativeParentPath)) {
    throw invalidPayload("Folders cannot be created inside app-owned folders.");
  }

  const folderName = await createAvailableFolderName(root, relativeParentPath, name);
  const folderPath = path.join(parent, folderName);

  await mkdir(folderPath);

  return {
    name: folderName,
    path: toWorkspaceRelativePath(root, folderPath)
  };
}

export async function renameWorkspaceFolder(
  workspaceRoot: string,
  folderPath: string,
  name: string
): Promise<FolderSummary> {
  const root = resolveInsideWorkspace(workspaceRoot);
  const sourcePath = await resolveUserFolderPath(root, folderPath);
  const relativeFolderPath = toWorkspaceRelativePath(root, sourcePath);
  const parentPath = path.dirname(relativeFolderPath);
  const targetName = await createAvailableFolderNameExcluding(
    root,
    parentPath,
    name,
    sourcePath
  );
  const targetPath = path.join(path.dirname(sourcePath), targetName);

  if (path.resolve(targetPath) !== path.resolve(sourcePath)) {
    await rename(sourcePath, targetPath);
  }

  return {
    name: targetName,
    path: toWorkspaceRelativePath(root, targetPath)
  };
}

export async function deleteWorkspaceFolder(
  workspaceRoot: string,
  folderPath: string
) {
  const root = resolveInsideWorkspace(workspaceRoot);
  const targetPath = await resolveUserFolderPath(root, folderPath);
  const relativePath = toWorkspaceRelativePath(root, targetPath);

  await rm(targetPath, { recursive: true, force: false });

  return {
    deleted: true as const,
    path: relativePath
  };
}

async function createAvailableFolderName(
  workspaceRoot: string,
  parentPath: string,
  name: string
) {
  const parent = resolveInsideWorkspace(workspaceRoot, parentPath);
  const baseName = sanitizeFileName(name);
  let candidateName = baseName;
  let counter = 2;

  while (await folderExists(path.join(parent, candidateName))) {
    candidateName = `${baseName} ${counter}`;
    counter += 1;
  }

  return candidateName;
}

async function createAvailableFolderNameExcluding(
  workspaceRoot: string,
  parentPath: string,
  name: string,
  excludedPath: string
) {
  const parent = resolveInsideWorkspace(workspaceRoot, parentPath);
  const baseName = sanitizeFileName(name);
  let candidateName = baseName;
  let counter = 2;

  while (true) {
    const candidatePath = path.join(parent, candidateName);

    if (
      path.resolve(candidatePath) === path.resolve(excludedPath) ||
      !(await folderExists(candidatePath))
    ) {
      return candidateName;
    }

    candidateName = `${baseName} ${counter}`;
    counter += 1;
  }
}

async function resolveUserFolderPath(workspaceRoot: string, folderPath: string) {
  const folder = resolveInsideWorkspace(workspaceRoot, folderPath);
  const relativePath = toWorkspaceRelativePath(workspaceRoot, folder);

  if (relativePath === ".") {
    throw invalidPayload("Workspace root cannot be renamed or deleted.");
  }

  if (isAppOwnedFolderPath(relativePath)) {
    throw invalidPayload("App-owned folders cannot be renamed or deleted.");
  }

  const folderStats = await stat(folder);

  if (!folderStats.isDirectory()) {
    throw invalidPayload("Path must be a workspace folder.");
  }

  return folder;
}

function isAppOwnedFolderPath(folderPath: string) {
  return (
    folderPath === workspaceMetadataFolderName ||
    folderPath.startsWith(`${workspaceMetadataFolderName}/`) ||
    folderPath === workspaceAssetsFolderName ||
    folderPath.startsWith(`${workspaceAssetsFolderName}/`)
  );
}

async function folderExists(candidatePath: string) {
  try {
    await access(candidatePath);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }

    throw error;
  }
}
