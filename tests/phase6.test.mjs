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
  const outputRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase6-services-"));
  const files = [
    "src/main/ipc/errors.ts",
    "src/main/services/path-utils.ts",
    "src/main/services/folder-service.ts",
    "src/main/services/note-service.ts"
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

test("phase 6 shared contract exposes note CRUD and trash channels", async () => {
  const sharedIpc = await readText("src/shared/ipc.ts");
  const sharedPreload = await readText("src/shared/preload.ts");
  const preloadSource = await readText("src/preload/index.ts");
  const appHandlerSource = await readText("src/main/ipc/app.ts");

  assertIncludesAll(sharedIpc, [
    "phase-6-note-crud",
    "NoteContent",
    "DeletedNoteSummary",
    "CreateNotePayload",
    "RenameNotePayload",
    "MoveNotePayload",
    "CreateFolderPayload",
    "RenameFolderPayload",
    "DeleteFolderPayload",
    "PermanentlyDeleteNotePayload",
    'create: "notes:create"',
    'rename: "notes:rename"',
    'duplicate: "notes:duplicate"',
    'move: "notes:move"',
    'delete: "notes:delete"',
    'listTrash: "notes:list-trash"',
    'restore: "notes:restore"',
    'permanentlyDelete: "notes:permanently-delete"',
    'create: "folders:create"',
    'rename: "folders:rename"',
    'delete: "folders:delete"'
  ]);
  assert.match(sharedPreload, /create:\s*\(payload\?: CreateNotePayload\)/);
  assert.match(sharedPreload, /permanentlyDelete:/);
  assert.match(sharedPreload, /folders:\s*\{/);
  assert.match(preloadSource, /ipcChannels\.notes\.permanentlyDelete/);
  assert.match(preloadSource, /ipcChannels\.folders\.create/);
  assert.match(preloadSource, /ipcChannels\.folders\.rename/);
  assert.match(preloadSource, /ipcChannels\.folders\.delete/);
  assert.match(appHandlerSource, /phase-6-note-crud/);
});

test("phase 6 IPC handlers validate note CRUD payloads", async () => {
  const notesHandlerSource = await readText("src/main/ipc/notes.ts");

  assertIncludesAll(notesHandlerSource, [
    "createMarkdownNote",
    "renameMarkdownNote",
    "duplicateMarkdownNote",
    "moveMarkdownNote",
    "moveMarkdownNoteToTrash",
    "scanTrashNotes",
    "restoreMarkdownNote",
    "permanentlyDeleteMarkdownNote",
    "assertOptionalString",
    "Permanent delete requires confirmation."
  ]);
  assert.match(notesHandlerSource, /assertActiveWorkspace\(activeWorkspace\)/);
  assert.match(notesHandlerSource, /payload\.confirmed !== true/);
});

test("phase 6 renderer exposes note actions without direct filesystem access", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    "createNote",
    "createFolder",
    "renameFolder",
    "deleteFolder",
    "openNote",
    "renameNote",
    "duplicateNote",
    "moveNote",
    "deleteNote",
    "restoreNote",
    "permanentlyDeleteNote",
    "window.inknest.notes.create",
    "window.inknest.folders.create",
    "window.inknest.folders.rename",
    "window.inknest.folders.delete",
    "window.inknest.notes.rename",
    "window.inknest.notes.duplicate",
    "window.inknest.notes.move",
    "window.inknest.notes.delete",
    "window.inknest.notes.listTrash",
    "window.inknest.notes.restore",
    "window.inknest.notes.permanentlyDelete",
    "Trash is empty.",
    "Note title",
    "note-title-input",
    "note-actions",
    "note-action-button",
    "move-menu",
    "Move note to folder",
    "Rename folder",
    "Delete folder",
    "folder-actions",
    "event.key === \"Enter\"",
    "note-preview"
  ]);
  assert.doesNotMatch(appSource, /New note title/);
  assert.doesNotMatch(appSource, /Rename note/);
  assert.doesNotMatch(appSource, /Move note to folder path/);
  assert.doesNotMatch(appSource, />Rename</);
  assert.match(stylesSource, /\.trash-row/);
  assert.match(stylesSource, /\.note-title-input/);
  assert.match(stylesSource, /\.note-actions/);
  assert.match(stylesSource, /group-hover:opacity-100/);
  assert.match(stylesSource, /\.move-menu/);
  assert.match(stylesSource, /\.folder-actions/);
  assert.match(stylesSource, /\.folder-action-button/);
  assert.doesNotMatch(appSource, /from "node:fs"|from "fs"|from "electron"/);
  assert.doesNotMatch(appSource, /ipcRenderer|showOpenDialog/);
});

test("phase 6 note service performs create, rename, duplicate, move, trash, restore, and permanent delete", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase6-workspace-"));

  try {
    await mkdir(path.join(workspaceRoot, ".inknest", "trash"), { recursive: true });
    await mkdir(path.join(workspaceRoot, "Archive"), { recursive: true });

    const {
      createMarkdownNote,
      duplicateMarkdownNote,
      moveMarkdownNote,
      moveMarkdownNoteToTrash,
      permanentlyDeleteMarkdownNote,
      readMarkdownNote,
      renameMarkdownNote,
      restoreMarkdownNote,
      scanMarkdownNotes,
      scanTrashNotes
    } = await harness.requireService("src/main/services/note-service.js");

    const created = await createMarkdownNote(workspaceRoot, ".", "Daily Notes");
    assert.equal(created.path, "Daily Notes.md");
    assert.equal(created.markdown, "# Daily Notes\n\n");
    assert.equal(existsSync(path.join(workspaceRoot, "Daily Notes.md")), true);

    const renamed = await renameMarkdownNote(
      workspaceRoot,
      created.path,
      "Renamed"
    );
    assert.equal(renamed.path, "Renamed.md");
    assert.equal(existsSync(path.join(workspaceRoot, "Daily Notes.md")), false);
    assert.equal(existsSync(path.join(workspaceRoot, "Renamed.md")), true);

    const duplicate = await duplicateMarkdownNote(workspaceRoot, renamed.path);
    assert.equal(duplicate.path, "Renamed Copy.md");

    const moved = await moveMarkdownNote(
      workspaceRoot,
      duplicate.path,
      "Archive"
    );
    assert.equal(moved.path, "Archive/Renamed Copy.md");
    assert.equal(moved.folderPath, "Archive");
    assert.equal(existsSync(path.join(workspaceRoot, "Archive", "Renamed Copy.md")), true);

    const deleted = await moveMarkdownNoteToTrash(workspaceRoot, renamed.path);
    assert.equal(deleted.originalPath, "Renamed.md");
    assert.equal(deleted.trashPath, ".inknest/trash/Renamed.md");
    assert.equal(existsSync(path.join(workspaceRoot, "Renamed.md")), false);

    const trash = await scanTrashNotes(workspaceRoot);
    assert.deepEqual(trash.map((note) => note.trashPath), [
      ".inknest/trash/Renamed.md"
    ]);

    const restored = await restoreMarkdownNote(workspaceRoot, deleted.trashPath);
    assert.equal(restored.path, "Renamed.md");
    assert.match((await readMarkdownNote(workspaceRoot, restored.path)).markdown, /Daily Notes/);

    const deletedAgain = await moveMarkdownNoteToTrash(workspaceRoot, restored.path);
    const permanentlyDeleted = await permanentlyDeleteMarkdownNote(
      workspaceRoot,
      deletedAgain.trashPath
    );
    assert.deepEqual(permanentlyDeleted, {
      deleted: true,
      trashPath: ".inknest/trash/Renamed.md"
    });
    assert.equal(existsSync(path.join(workspaceRoot, ".inknest", "trash", "Renamed.md")), false);

    const activeNotes = await scanMarkdownNotes(workspaceRoot);
    assert.deepEqual(activeNotes.map((note) => note.path), [
      "Archive/Renamed Copy.md"
    ]);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});

test("phase 6 folder service performs create, rename, and delete safely", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase6-folders-"));

  try {
    const {
      createWorkspaceFolder,
      deleteWorkspaceFolder,
      renameWorkspaceFolder,
      scanWorkspaceFolders
    } = await harness.requireService("src/main/services/folder-service.js");

    const created = await createWorkspaceFolder(workspaceRoot, ".", "Projects");
    const duplicate = await createWorkspaceFolder(workspaceRoot, ".", "Projects");
    const nested = await createWorkspaceFolder(
      workspaceRoot,
      duplicate.path,
      "Drafts"
    );

    assert.deepEqual(created, {
      name: "Projects",
      path: "Projects"
    });
    assert.deepEqual(duplicate, {
      name: "Projects 2",
      path: "Projects 2"
    });
    assert.deepEqual(nested, {
      name: "Drafts",
      path: "Projects 2/Drafts"
    });

    const renamed = await renameWorkspaceFolder(
      workspaceRoot,
      "Projects 2",
      "Archive"
    );
    assert.deepEqual(renamed, {
      name: "Archive",
      path: "Archive"
    });
    assert.equal(existsSync(path.join(workspaceRoot, "Archive", "Drafts")), true);

    await assert.rejects(
      () => renameWorkspaceFolder(workspaceRoot, ".", "Nope"),
      /Workspace root cannot be renamed or deleted/
    );

    const deleted = await deleteWorkspaceFolder(workspaceRoot, "Archive");
    assert.deepEqual(deleted, {
      deleted: true,
      path: "Archive"
    });
    assert.equal(existsSync(path.join(workspaceRoot, "Archive")), false);

    assert.deepEqual(
      (await scanWorkspaceFolders(workspaceRoot)).map((folder) => folder.path),
      ["Projects"]
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});

test("phase 6 architecture document describes note CRUD", async () => {
  const archSource = await readText("ARCH.md");

  assertIncludesAll(archSource, [
    "Phase 6 Architecture: Note CRUD",
    "window.inknest.notes.create(payload)",
    "notes:create",
    "moveMarkdownNoteToTrash",
    "Permanent deletion requires",
    "tests/phase6.test.mjs"
  ]);
});
