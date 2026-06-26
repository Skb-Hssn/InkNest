import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function assertIncludesAll(source, expectedValues) {
  for (const expectedValue of expectedValues) {
    assert.ok(
      source.includes(expectedValue),
      `Expected source to include: ${expectedValue}`
    );
  }
}

test("phase 5 shared contract exposes the workspace file model", async () => {
  const sharedIpc = await readText("src/shared/ipc.ts");
  const sharedPreload = await readText("src/shared/preload.ts");
  const preloadSource = await readText("src/preload/index.ts");
  const appHandlerSource = await readText("src/main/ipc/app.ts");

  assertIncludesAll(sharedIpc, [
    "phase-5-workspace-file-model",
    "FolderSummary",
    "WorkspaceMetadata",
    "WorkspaceFileModel",
    "folderPath: string",
    'scan: "workspace:scan"'
  ]);
  assert.match(sharedPreload, /scan:\s*\(\)\s*=>\s*Promise<IpcResult<WorkspaceFileModel>>/);
  assert.match(preloadSource, /ipcChannels\.workspace\.scan/);
  assert.match(appHandlerSource, /phase-5-workspace-file-model/);
});

test("phase 5 path utilities prevent traversal and sanitize filenames", async () => {
  const pathUtilsSource = await readText("src/main/services/path-utils.ts");
  const validationSource = await readText("src/main/ipc/validation.ts");

  assertIncludesAll(pathUtilsSource, [
    "resolveInsideWorkspace",
    "isInsideWorkspace",
    "toWorkspaceRelativePath",
    "normalizeWorkspacePath",
    "sanitizeFileName",
    "Path is outside the active workspace",
    "replace(/[<>"
  ]);
  assert.match(pathUtilsSource, /path\.relative\(root,\s*resolvedPath\)/);
  assert.match(validationSource, /assertActiveWorkspace/);
});

test("phase 5 folder service creates metadata, assets, and trash conventions", async () => {
  const folderServiceSource = await readText("src/main/services/folder-service.ts");

  assertIncludesAll(folderServiceSource, [
    'workspaceMetadataFolderName = ".inknest"',
    'workspaceAssetsFolderName = "assets"',
    'workspaceTrashFolderName = "trash"',
    "ensureWorkspaceStructure",
    "scanWorkspaceFolders",
    "metadataPath",
    "assetsPath",
    "trashPath",
    "withFileTypes: true"
  ]);
  assert.match(folderServiceSource, /mkdir\(path\.join\(root,\s*metadata\.trashPath\),\s*\{\s*recursive:\s*true\s*\}\)/);
});

test("phase 5 note service scans and reads markdown safely", async () => {
  const noteServiceSource = await readText("src/main/services/note-service.ts");
  const notesHandlerSource = await readText("src/main/ipc/notes.ts");

  assertIncludesAll(noteServiceSource, [
    "scanMarkdownNotes",
    "readMarkdownNote",
    "createSafeMarkdownFileName",
    "createAvailableMarkdownFileName",
    "extractNoteTitle",
    "folderPath",
    'readFile(entryPath, "utf8")',
    'readFile(resolvedPath, "utf8")',
    "Only Markdown files can be read as notes"
  ]);
  assert.match(noteServiceSource, /path\.extname\(entry\.name\)\.toLowerCase\(\)\s*!==\s*markdownExtension/);
  assert.match(noteServiceSource, /candidateName = `\$\{baseName\} \$\{counter\}\$\{markdownExtension\}`/);
  assert.match(notesHandlerSource, /scanMarkdownNotes\(assertActiveWorkspace\(activeWorkspace\)\)/);
  assert.match(notesHandlerSource, /readMarkdownNote\(/);
});

test("phase 5 workspace scan wires services behind main-process IPC", async () => {
  const workspaceServiceSource = await readText("src/main/services/workspace-service.ts");
  const workspaceHandlerSource = await readText("src/main/ipc/workspace.ts");
  const archSource = await readText("ARCH.md");

  assertIncludesAll(workspaceServiceSource, [
    "scanWorkspaceFileModel",
    "ensureWorkspaceStructure",
    "scanWorkspaceFolders",
    "scanMarkdownNotes",
    "Workspace is ready."
  ]);
  assert.match(workspaceHandlerSource, /registerIpcHandler<WorkspaceFileModel>\(ipcChannels\.workspace\.scan/);
  assert.match(workspaceHandlerSource, /await scanWorkspaceFileModel\(resolvedWorkspacePath,\s*settings\)/);
  assertIncludesAll(archSource, [
    "Phase 5 Architecture: Workspace File Model",
    "workspace.scan()",
    "workspace:scan",
    ".inknest",
    "assets/",
    ".inknest/trash",
    "workspace-relative",
    "tests/phase5.test.mjs"
  ]);
});
