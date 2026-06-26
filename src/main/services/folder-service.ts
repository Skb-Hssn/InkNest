import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import type { FolderSummary, WorkspaceMetadata } from "../../shared/ipc";
import {
  normalizeWorkspacePath,
  resolveInsideWorkspace,
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
