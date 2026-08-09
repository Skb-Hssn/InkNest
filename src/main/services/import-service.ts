import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { ImportNotesResult } from "../../shared/ipc";
import { invalidPayload } from "../ipc/errors";
import {
  normalizeWorkspacePath,
  resolveInsideWorkspace,
  sanitizeFileName,
  toWorkspaceRelativePath
} from "./path-utils";
import { scanMarkdownNotes } from "./note-service";
import {
  ensureWorkspaceStructure,
  workspaceAssetsFolderName
} from "./folder-service";

const markdownExtension = ".md";

export async function importMarkdownFiles(
  workspaceRoot: string,
  sourcePaths: string[],
  folderPath = "."
): Promise<ImportNotesResult> {
  const root = resolveInsideWorkspace(workspaceRoot);
  await ensureWorkspaceStructure(root);
  const targetFolder = resolveInsideWorkspace(root, folderPath);
  assertWritableNoteFolder(root, targetFolder);
  await ensureTargetFolder(targetFolder);

  const importedPaths: string[] = [];
  const skipped: string[] = [];

  for (const sourcePath of sourcePaths) {
    if (path.extname(sourcePath).toLowerCase() !== markdownExtension) {
      skipped.push(sourcePath);
      continue;
    }

    try {
      const sourceStats = await stat(sourcePath);

      if (!sourceStats.isFile()) {
        skipped.push(sourcePath);
        continue;
      }

      const fileName = await createAvailableMarkdownFileName(
        targetFolder,
        path.basename(sourcePath, markdownExtension)
      );
      const destinationPath = path.join(targetFolder, fileName);
      await copyFile(sourcePath, destinationPath);
      importedPaths.push(toWorkspaceRelativePath(root, destinationPath));
    } catch {
      skipped.push(sourcePath);
    }
  }

  if (importedPaths.length === 0 && skipped.length === 0) {
    throw invalidPayload("Select at least one Markdown file to import.");
  }

  return createImportResult(root, importedPaths, skipped);
}

export async function importMarkdownFolder(
  workspaceRoot: string,
  sourceFolderPath: string,
  folderPath = "."
): Promise<ImportNotesResult> {
  const root = resolveInsideWorkspace(workspaceRoot);
  await ensureWorkspaceStructure(root);
  const targetFolder = resolveInsideWorkspace(root, folderPath);
  assertWritableNoteFolder(root, targetFolder);
  const sourceStats = await stat(sourceFolderPath);

  if (!sourceStats.isDirectory()) {
    throw invalidPayload("The selected import path is not a folder.");
  }

  await ensureTargetFolder(targetFolder);
  const sourceFiles = await collectMarkdownFiles(sourceFolderPath);
  const importedPaths: string[] = [];
  const skipped: string[] = [];

  for (const sourceFile of sourceFiles) {
    const relativeSourcePath = path.relative(sourceFolderPath, sourceFile);
    const relativeDirectory = path.dirname(relativeSourcePath);
    const destinationDirectory = resolveInsideWorkspace(
      root,
      normalizeWorkspacePath(path.join(folderPath, relativeDirectory))
    );

    try {
      await mkdir(destinationDirectory, { recursive: true });
      const fileName = await createAvailableMarkdownFileName(
        destinationDirectory,
        path.basename(sourceFile, markdownExtension)
      );
      const destinationPath = path.join(destinationDirectory, fileName);
      await copyFile(sourceFile, destinationPath);
      importedPaths.push(toWorkspaceRelativePath(root, destinationPath));
    } catch {
      skipped.push(sourceFile);
    }
  }

  if (sourceFiles.length === 0) {
    throw invalidPayload("The selected folder does not contain Markdown files.");
  }

  return createImportResult(root, importedPaths, skipped);
}

async function collectMarkdownFiles(folderPath: string) {
  const files: string[] = [];
  const entries = await readdir(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === markdownExtension) {
      files.push(entryPath);
    }
  }

  return files.sort((first, second) => first.localeCompare(second));
}

async function createAvailableMarkdownFileName(
  destinationDirectory: string,
  title: string
) {
  const baseName = sanitizeFileName(title);
  let candidate = `${baseName}${markdownExtension}`;
  let counter = 2;

  while (await pathExists(path.join(destinationDirectory, candidate))) {
    candidate = `${baseName} ${counter}${markdownExtension}`;
    counter += 1;
  }

  return candidate;
}

async function ensureTargetFolder(targetFolder: string) {
  const folderStats = await stat(targetFolder).catch(() => null);

  if (folderStats && !folderStats.isDirectory()) {
    throw invalidPayload("Import destination must be a folder.");
  }

  await mkdir(targetFolder, { recursive: true });
}

function assertWritableNoteFolder(workspaceRoot: string, targetFolder: string) {
  const relativePath = toWorkspaceRelativePath(workspaceRoot, targetFolder);

  if (
    relativePath === ".inknest" ||
    relativePath.startsWith(".inknest/") ||
    relativePath === workspaceAssetsFolderName ||
    relativePath.startsWith(`${workspaceAssetsFolderName}/`)
  ) {
    throw invalidPayload("Notes cannot be imported into an app-owned folder.");
  }
}

async function createImportResult(
  workspaceRoot: string,
  importedPaths: string[],
  skipped: string[]
): Promise<ImportNotesResult> {
  const notes = await scanMarkdownNotes(workspaceRoot);
  const imported = notes.filter((note) => importedPaths.includes(note.path));

  return {
    imported,
    skipped
  };
}

async function pathExists(candidatePath: string) {
  try {
    await stat(candidatePath);
    return true;
  } catch {
    return false;
  }
}
