import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

async function createServiceHarness() {
  const root = new URL("../", import.meta.url);
  const outputRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase5-services-"));
  const files = [
    "src/main/ipc/errors.ts",
    "src/main/services/path-utils.ts",
    "src/main/services/folder-service.ts",
    "src/main/services/note-service.ts",
    "src/main/services/workspace-service.ts"
  ];

  await Promise.all(
    files.map(async (relativePath) => {
      const source = await readFile(new URL(relativePath, root), "utf8");
      const output = ts.transpileModule(source, {
        compilerOptions: {
          esModuleInterop: true,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022
        }
      }).outputText;
      const outputPath = path.join(outputRoot, relativePath).replace(/\.ts$/, ".js");

      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, output, "utf8");
    })
  );

  return {
    outputRoot,
    requireService(relativePath) {
      return import(pathToFileURL(path.join(outputRoot, relativePath)).href);
    },
    async cleanup() {
      await rm(outputRoot, { recursive: true, force: true });
    }
  };
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

test("phase 5 services scan a real workspace and preserve markdown content", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase5-workspace-"));

  try {
    await mkdir(path.join(workspaceRoot, "Projects", "Nested"), {
      recursive: true
    });
    await mkdir(path.join(workspaceRoot, ".inknest", "scratch"), {
      recursive: true
    });
    await mkdir(path.join(workspaceRoot, "assets"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "Projects", "Nested", "unicode.md"),
      "# ঢাকা Notes\n\nUnicode body stays intact.",
      "utf8"
    );
    await writeFile(
      path.join(workspaceRoot, "loose.md"),
      "No heading here",
      "utf8"
    );
    await writeFile(
      path.join(workspaceRoot, ".inknest", "scratch", "hidden.md"),
      "# Hidden",
      "utf8"
    );
    await writeFile(
      path.join(workspaceRoot, "assets", "asset-note.md"),
      "# Asset",
      "utf8"
    );

    const { scanWorkspaceFileModel } = await harness.requireService(
      "src/main/services/workspace-service.js"
    );
    const { readMarkdownNote } = await harness.requireService(
      "src/main/services/note-service.js"
    );

    const fileModel = await scanWorkspaceFileModel(workspaceRoot, {
      theme: "system",
      lastWorkspacePath: workspaceRoot,
      recentWorkspaces: [workspaceRoot]
    });

    assert.deepEqual(fileModel.metadata, {
      metadataPath: ".inknest",
      assetsPath: "assets",
      trashPath: ".inknest/trash"
    });
    assert.equal(existsSync(path.join(workspaceRoot, ".inknest", "trash")), true);
    assert.equal(existsSync(path.join(workspaceRoot, "assets")), true);
    assert.deepEqual(
      fileModel.folders.map((folder) => folder.path),
      ["Projects", "Projects/Nested"]
    );
    assert.deepEqual(
      fileModel.notes.map((note) => [note.title, note.path, note.folderPath]),
      [
        ["loose", "loose.md", "."],
        ["ঢাকা Notes", "Projects/Nested/unicode.md", "Projects/Nested"]
      ]
    );

    const note = await readMarkdownNote(
      workspaceRoot,
      "Projects/Nested/unicode.md"
    );
    assert.equal(note.path, "Projects/Nested/unicode.md");
    assert.match(note.markdown, /Unicode body stays intact/);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});

test("phase 5 services reject unsafe paths and generate duplicate-safe filenames", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase5-paths-"));

  try {
    await writeFile(path.join(workspaceRoot, "Untitled.md"), "# One", "utf8");
    await writeFile(path.join(workspaceRoot, "Untitled 2.md"), "# Two", "utf8");

    const {
      createAvailableMarkdownFileName,
      createSafeMarkdownFileName,
      readMarkdownNote
    } = await harness.requireService("src/main/services/note-service.js");
    const {
      resolveInsideWorkspace,
      sanitizeFileName
    } = await harness.requireService("src/main/services/path-utils.js");

    assert.equal(createSafeMarkdownFileName('Bad: / Name? *'), "Bad Name.md");
    assert.equal(sanitizeFileName("   ...   "), "Untitled");
    assert.equal(
      await createAvailableMarkdownFileName(workspaceRoot, ".", "Untitled"),
      "Untitled 3.md"
    );

    assert.throws(
      () => resolveInsideWorkspace(workspaceRoot, "../outside.md"),
      /Path is outside the active workspace/
    );
    await assert.rejects(
      () => readMarkdownNote(workspaceRoot, "../outside.md"),
      /Path is outside the active workspace/
    );
    await assert.rejects(
      () => readMarkdownNote(workspaceRoot, "not-markdown.txt"),
      /Only Markdown files can be read as notes/
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});
