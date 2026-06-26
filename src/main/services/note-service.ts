import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { NoteSummary } from "../../shared/ipc";
import { invalidPayload } from "../ipc/errors";
import {
  normalizeWorkspacePath,
  resolveInsideWorkspace,
  sanitizeFileName,
  toWorkspaceRelativePath
} from "./path-utils";
import {
  workspaceAssetsFolderName,
  workspaceMetadataFolderName
} from "./folder-service";

const markdownExtension = ".md";
const skippedFolderNames = new Set([
  workspaceMetadataFolderName,
  workspaceAssetsFolderName
]);

export async function scanMarkdownNotes(
  workspaceRoot: string
): Promise<NoteSummary[]> {
  const root = resolveInsideWorkspace(workspaceRoot);
  const notes: NoteSummary[] = [];

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (!skippedFolderNames.has(entry.name)) {
          await walk(entryPath);
        }

        continue;
      }

      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== markdownExtension) {
        continue;
      }

      const relativePath = toWorkspaceRelativePath(root, entryPath);
      const markdown = await readFile(entryPath, "utf8");

      notes.push({
        id: relativePath,
        title: extractNoteTitle(markdown, entry.name),
        path: relativePath,
        folderPath: getFolderPath(relativePath)
      });
    }
  }

  await walk(root);

  return notes.sort((first, second) => first.path.localeCompare(second.path));
}

export async function readMarkdownNote(
  workspaceRoot: string,
  notePath: string
) {
  const resolvedPath = resolveInsideWorkspace(workspaceRoot, notePath);

  if (path.extname(resolvedPath).toLowerCase() !== markdownExtension) {
    throw invalidPayload("Only Markdown files can be read as notes.");
  }

  return {
    path: toWorkspaceRelativePath(workspaceRoot, resolvedPath),
    markdown: await readFile(resolvedPath, "utf8")
  };
}

export function createSafeMarkdownFileName(title: string) {
  return `${sanitizeFileName(title)}${markdownExtension}`;
}

export async function createAvailableMarkdownFileName(
  workspaceRoot: string,
  folderPath: string,
  title: string
) {
  const folder = resolveInsideWorkspace(workspaceRoot, folderPath);
  const baseName = sanitizeFileName(title);
  let candidateName = `${baseName}${markdownExtension}`;
  let counter = 2;

  while (await fileExists(path.join(folder, candidateName))) {
    candidateName = `${baseName} ${counter}${markdownExtension}`;
    counter += 1;
  }

  return candidateName;
}

function extractNoteTitle(markdown: string, fileName: string) {
  const heading = markdown.match(/^#\s+(.+)$/m);

  if (heading) {
    return heading[1].trim();
  }

  return path.basename(fileName, path.extname(fileName));
}

function getFolderPath(relativeNotePath: string) {
  const folderPath = path.dirname(relativeNotePath);
  return folderPath === "." ? "." : normalizeWorkspacePath(folderPath);
}

async function fileExists(candidatePath: string) {
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
