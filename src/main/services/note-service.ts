import {
  access,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { DeletedNoteSummary, NoteContent, NoteSummary } from "../../shared/ipc";
import { invalidPayload, saveFailed } from "../ipc/errors";
import {
  normalizeWorkspacePath,
  resolveInsideWorkspace,
  sanitizeFileName,
  toWorkspaceRelativePath
} from "./path-utils";
import {
  workspaceAssetsFolderName,
  workspaceMetadataFolderName,
  workspaceTrashFolderName
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

      notes.push(await createNoteSummary(root, entryPath));
    }
  }

  await walk(root);

  return notes.sort((first, second) => first.path.localeCompare(second.path));
}

export async function readMarkdownNote(
  workspaceRoot: string,
  notePath: string
): Promise<NoteContent> {
  const resolvedPath = resolveMarkdownNotePath(workspaceRoot, notePath, "read");

  return {
    path: toWorkspaceRelativePath(workspaceRoot, resolvedPath),
    markdown: await readFile(resolvedPath, "utf8")
  };
}

export async function createMarkdownNote(
  workspaceRoot: string,
  folderPath = ".",
  title = "Untitled"
): Promise<NoteContent> {
  const folder = await resolveWritableFolder(workspaceRoot, folderPath);
  const fileName = await createAvailableMarkdownFileName(
    workspaceRoot,
    folderPath,
    title
  );
  const notePath = path.join(folder, fileName);
  const noteTitle = sanitizeFileName(title);
  const markdown = `# ${noteTitle}\n\n`;

  await writeFile(notePath, markdown, { encoding: "utf8", flag: "wx" });

  return {
    path: toWorkspaceRelativePath(workspaceRoot, notePath),
    markdown
  };
}

export async function renameMarkdownNote(
  workspaceRoot: string,
  notePath: string,
  title: string
): Promise<NoteSummary> {
  const sourcePath = resolveMarkdownNotePath(workspaceRoot, notePath, "rename");
  const folderPath = getFolderPath(toWorkspaceRelativePath(workspaceRoot, sourcePath));
  const targetName = await createAvailableMarkdownFileNameExcluding(
    workspaceRoot,
    folderPath,
    title,
    sourcePath
  );
  const targetPath = path.join(path.dirname(sourcePath), targetName);

  if (path.resolve(targetPath) !== path.resolve(sourcePath)) {
    await rename(sourcePath, targetPath);
  }

  return createNoteSummary(workspaceRoot, targetPath);
}

export async function duplicateMarkdownNote(
  workspaceRoot: string,
  notePath: string
): Promise<NoteContent> {
  const sourcePath = resolveMarkdownNotePath(workspaceRoot, notePath, "duplicate");
  const markdown = await readFile(sourcePath, "utf8");
  const folderPath = getFolderPath(toWorkspaceRelativePath(workspaceRoot, sourcePath));
  const sourceTitle = path.basename(sourcePath, markdownExtension);
  const targetName = await createAvailableMarkdownFileName(
    workspaceRoot,
    folderPath,
    `${sourceTitle} Copy`
  );
  const targetPath = path.join(path.dirname(sourcePath), targetName);

  await writeFile(targetPath, markdown, { encoding: "utf8", flag: "wx" });

  return {
    path: toWorkspaceRelativePath(workspaceRoot, targetPath),
    markdown
  };
}

export async function moveMarkdownNote(
  workspaceRoot: string,
  notePath: string,
  folderPath: string
): Promise<NoteSummary> {
  const sourcePath = resolveMarkdownNotePath(workspaceRoot, notePath, "move");
  const targetFolder = await resolveWritableFolder(workspaceRoot, folderPath);
  const targetName = await createAvailableMarkdownFileNameExcluding(
    workspaceRoot,
    folderPath,
    path.basename(sourcePath, markdownExtension),
    sourcePath
  );
  const targetPath = path.join(targetFolder, targetName);

  if (path.resolve(targetPath) !== path.resolve(sourcePath)) {
    await rename(sourcePath, targetPath);
  }

  return createNoteSummary(workspaceRoot, targetPath);
}

export async function saveMarkdownNote(
  workspaceRoot: string,
  notePath: string,
  markdown: string
): Promise<NoteContent> {
  if (typeof markdown !== "string") {
    throw invalidPayload("Markdown content must be a string.");
  }

  const resolvedPath = resolveMarkdownNotePath(workspaceRoot, notePath, "save");

  try {
    await writeMarkdownNoteSafely(resolvedPath, markdown);
  } catch (error) {
    throw saveFailed(getSaveFailureMessage(error));
  }

  return {
    path: toWorkspaceRelativePath(workspaceRoot, resolvedPath),
    markdown
  };
}

async function writeMarkdownNoteSafely(notePath: string, markdown: string) {
  const temporaryPath = path.join(
    path.dirname(notePath),
    `.${path.basename(notePath)}.${randomUUID()}.tmp`
  );
  let temporaryFile: Awaited<ReturnType<typeof open>> | null = null;
  let movedIntoPlace = false;
  let fileMode = 0o666;

  try {
    fileMode = (await stat(notePath)).mode & 0o777;
  } catch {
    // A new target can still be created by the save contract.
  }

  try {
    temporaryFile = await open(temporaryPath, "w", fileMode);
    await temporaryFile.writeFile(markdown, "utf8");
    await temporaryFile.sync();
    await temporaryFile.close();
    temporaryFile = null;

    await rename(temporaryPath, notePath);
    movedIntoPlace = true;
    await flushDirectory(path.dirname(notePath));
  } finally {
    if (temporaryFile) {
      await temporaryFile.close().catch(() => undefined);
    }

    if (!movedIntoPlace) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

async function flushDirectory(directoryPath: string) {
  if (process.platform === "win32") {
    return;
  }

  let directory: Awaited<ReturnType<typeof open>> | null = null;

  try {
    directory = await open(directoryPath, "r");
    await directory.sync();
  } catch {
    // Directory fsync is not supported by every platform/filesystem. The
    // temporary file itself has already been flushed before the rename.
  } finally {
    await directory?.close().catch(() => undefined);
  }
}

function getSaveFailureMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  if (code === "EACCES" || code === "EPERM") {
    return "Permission denied while saving the note. Check the file and workspace permissions.";
  }

  if (code === "ENOSPC") {
    return "Not enough disk space to save the note.";
  }

  if (code === "EROFS") {
    return "The workspace is read-only. Choose a writable workspace to save the note.";
  }

  const detail = error instanceof Error ? error.message : "The file could not be written.";
  return `Could not save the note: ${detail}`;
}

export async function moveMarkdownNoteToTrash(
  workspaceRoot: string,
  notePath: string
): Promise<DeletedNoteSummary> {
  const sourcePath = resolveMarkdownNotePath(workspaceRoot, notePath, "delete");
  const relativeSourcePath = toWorkspaceRelativePath(workspaceRoot, sourcePath);
  const trashRoot = getTrashRoot(workspaceRoot);
  const trashFolderPath = path.dirname(relativeSourcePath);
  const trashFolder = path.join(trashRoot, trashFolderPath);
  const trashName = await createAvailableMarkdownFileName(
    trashRoot,
    trashFolderPath,
    path.basename(sourcePath, markdownExtension)
  );
  const targetPath = path.join(trashFolder, trashName);

  await mkdir(trashFolder, { recursive: true });
  await rename(sourcePath, targetPath);

  return createDeletedNoteSummary(workspaceRoot, targetPath);
}

export async function scanTrashNotes(
  workspaceRoot: string
): Promise<DeletedNoteSummary[]> {
  const trashRoot = getTrashRoot(workspaceRoot);
  const deletedNotes: DeletedNoteSummary[] = [];

  if (!(await fileExists(trashRoot))) {
    return deletedNotes;
  }

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }

      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== markdownExtension) {
        continue;
      }

      deletedNotes.push(await createDeletedNoteSummary(workspaceRoot, entryPath));
    }
  }

  await walk(trashRoot);

  return deletedNotes.sort((first, second) =>
    first.trashPath.localeCompare(second.trashPath)
  );
}

export async function restoreMarkdownNote(
  workspaceRoot: string,
  trashPath: string
): Promise<NoteContent> {
  const sourcePath = resolveTrashNotePath(workspaceRoot, trashPath);
  const originalPath = getOriginalPathFromTrash(workspaceRoot, sourcePath);
  const originalFolderPath = getFolderPath(originalPath);
  const targetFolder = resolveInsideWorkspace(workspaceRoot, originalFolderPath);
  const targetName = await createAvailableMarkdownFileName(
    workspaceRoot,
    originalFolderPath,
    path.basename(originalPath, markdownExtension)
  );
  const targetPath = path.join(targetFolder, targetName);

  await mkdir(targetFolder, { recursive: true });
  await rename(sourcePath, targetPath);

  return readMarkdownNote(workspaceRoot, toWorkspaceRelativePath(workspaceRoot, targetPath));
}

export async function permanentlyDeleteMarkdownNote(
  workspaceRoot: string,
  trashPath: string
) {
  const sourcePath = resolveTrashNotePath(workspaceRoot, trashPath);

  await rm(sourcePath, { force: false });

  return {
    deleted: true as const,
    trashPath: toWorkspaceRelativePath(workspaceRoot, sourcePath)
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

async function createAvailableMarkdownFileNameExcluding(
  workspaceRoot: string,
  folderPath: string,
  title: string,
  excludedPath: string
) {
  const folder = resolveInsideWorkspace(workspaceRoot, folderPath);
  const baseName = sanitizeFileName(title);
  let candidateName = `${baseName}${markdownExtension}`;
  let counter = 2;

  while (true) {
    const candidatePath = path.join(folder, candidateName);

    if (
      path.resolve(candidatePath) === path.resolve(excludedPath) ||
      !(await fileExists(candidatePath))
    ) {
      return candidateName;
    }

    candidateName = `${baseName} ${counter}${markdownExtension}`;
    counter += 1;
  }
}

async function resolveWritableFolder(workspaceRoot: string, folderPath: string) {
  const folder = resolveInsideWorkspace(workspaceRoot, folderPath);
  const folderStats = await stat(folder);

  if (!folderStats.isDirectory()) {
    throw invalidPayload("Target folder must be inside the active workspace.");
  }

  return folder;
}

function resolveMarkdownNotePath(
  workspaceRoot: string,
  notePath: string,
  action: string
) {
  const resolvedPath = resolveInsideWorkspace(workspaceRoot, notePath);
  assertMarkdownFile(resolvedPath, action);
  return resolvedPath;
}

function resolveTrashNotePath(workspaceRoot: string, trashPath: string) {
  const resolvedPath = resolveMarkdownNotePath(workspaceRoot, trashPath, "restore");
  const trashRoot = getTrashRoot(workspaceRoot);

  if (!resolvedPath.startsWith(`${trashRoot}${path.sep}`)) {
    throw invalidPayload("Trash item must be inside the workspace trash.");
  }

  return resolvedPath;
}

async function createNoteSummary(
  workspaceRoot: string,
  notePath: string
): Promise<NoteSummary> {
  const relativePath = toWorkspaceRelativePath(workspaceRoot, notePath);
  const markdown = await readFile(notePath, "utf8");

  return {
    id: relativePath,
    title: extractNoteTitle(markdown, path.basename(notePath)),
    path: relativePath,
    folderPath: getFolderPath(relativePath),
    tags: extractFrontmatterTags(markdown)
  };
}

async function createDeletedNoteSummary(
  workspaceRoot: string,
  notePath: string
): Promise<DeletedNoteSummary> {
  const trashPath = toWorkspaceRelativePath(workspaceRoot, notePath);
  const markdown = await readFile(notePath, "utf8");

  return {
    id: trashPath,
    title: extractNoteTitle(markdown, path.basename(notePath)),
    originalPath: getOriginalPathFromTrash(workspaceRoot, notePath),
    trashPath
  };
}

function getOriginalPathFromTrash(workspaceRoot: string, notePath: string) {
  const relativeToTrash = path.relative(getTrashRoot(workspaceRoot), notePath);

  return normalizeWorkspacePath(relativeToTrash);
}

function getTrashRoot(workspaceRoot: string) {
  return resolveInsideWorkspace(
    workspaceRoot,
    path.join(workspaceMetadataFolderName, workspaceTrashFolderName)
  );
}

function assertMarkdownFile(candidatePath: string, action: string) {
  if (path.extname(candidatePath).toLowerCase() !== markdownExtension) {
    const actionText = action === "read" ? "read" : `${action}d`;
    throw invalidPayload(`Only Markdown files can be ${actionText} as notes.`);
  }
}

function extractNoteTitle(markdown: string, fileName: string) {
  const heading = markdown.match(/^#\s+(.+)$/m);

  if (heading) {
    return heading[1].trim();
  }

  return path.basename(fileName, path.extname(fileName));
}

type FrontmatterValue = string | string[];

/**
 * Parse the small frontmatter subset InkNest needs without making the
 * renderer or the main process depend on a permissive YAML evaluator.
 * Unknown keys are retained as scalar or list values for future metadata.
 */
export function parseFrontmatter(markdown: string): Record<string, FrontmatterValue> {
  const match = markdown.match(
    /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/
  );

  if (!match) {
    return {};
  }

  const values: Record<string, FrontmatterValue> = {};
  let listKey: string | null = null;

  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s*-\s+(.+)\s*$/);

    if (listItem && listKey) {
      const currentValue = values[listKey];
      const list = Array.isArray(currentValue)
        ? currentValue
        : currentValue
          ? [currentValue]
          : [];
      list.push(unquoteFrontmatterValue(listItem[1]));
      values[listKey] = list;
      continue;
    }

    const property = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);

    if (!property) {
      continue;
    }

    const key = property[1];
    const rawValue = property[2];
    listKey = null;

    if (!rawValue || rawValue === "null" || rawValue === "~") {
      values[key] = [];
      listKey = key;
      continue;
    }

    values[key] = parseFrontmatterValue(rawValue, key);
  }

  return values;
}

export function extractFrontmatterTags(markdown: string): string[] {
  const frontmatter = parseFrontmatter(markdown);
  const rawTags =
    Object.entries(frontmatter).find(([key]) => key.toLocaleLowerCase() === "tags")?.[1] ??
    [];
  const candidates = Array.isArray(rawTags) ? rawTags : [rawTags];
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const candidate of candidates) {
    const tag = candidate.trim();

    if (!tag || seen.has(tag.toLocaleLowerCase())) {
      continue;
    }

    seen.add(tag.toLocaleLowerCase());
    tags.push(tag);
  }

  return tags;
}

// Alias kept explicit because callers commonly ask for the tags parser rather
// than the complete frontmatter object.
export const parseFrontmatterTags = extractFrontmatterTags;

function parseFrontmatterValue(rawValue: string, key: string): FrontmatterValue {
  if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
    return rawValue
      .slice(1, -1)
      .split(",")
      .map((value) => unquoteFrontmatterValue(value))
      .filter(Boolean);
  }

  if (key.toLocaleLowerCase() === "tags" && rawValue.includes(",")) {
    return rawValue
      .split(",")
      .map((value) => unquoteFrontmatterValue(value))
      .filter(Boolean);
  }

  return unquoteFrontmatterValue(rawValue);
}

function unquoteFrontmatterValue(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
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
