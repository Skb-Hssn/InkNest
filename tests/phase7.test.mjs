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
  const outputRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase7-services-"));
  const files = [
    "src/main/ipc/errors.ts",
    "src/main/services/path-utils.ts",
    "src/main/services/folder-service.ts"
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

test("phase 7 shared contract exposes folder move and current app phase", async () => {
  const sharedIpc = await readText("src/shared/ipc.ts");
  const sharedPreload = await readText("src/shared/preload.ts");
  const preloadSource = await readText("src/preload/index.ts");
  const foldersHandlerSource = await readText("src/main/ipc/folders.ts");
  const appHandlerSource = await readText("src/main/ipc/app.ts");

  assertIncludesAll(sharedIpc, [
    "phase-7-folder-organization",
    "MoveFolderPayload",
    "parentPath: string",
    'move: "folders:move"'
  ]);
  assert.match(sharedPreload, /move:\s*\(payload: MoveFolderPayload\)/);
  assert.match(preloadSource, /ipcChannels\.folders\.move/);
  assert.match(foldersHandlerSource, /moveWorkspaceFolder/);
  assert.match(foldersHandlerSource, /assertString\(payload\.parentPath, "parentPath"\)/);
  assert.match(appHandlerSource, /phase-7-folder-organization/);
});

test("phase 7 folder service moves folders safely", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase7-folders-"));

  try {
    const {
      createWorkspaceFolder,
      moveWorkspaceFolder,
      scanWorkspaceFolders
    } = await harness.requireService("src/main/services/folder-service.js");

    const projects = await createWorkspaceFolder(workspaceRoot, ".", "Projects");
    const drafts = await createWorkspaceFolder(workspaceRoot, projects.path, "Drafts");
    const archive = await createWorkspaceFolder(workspaceRoot, ".", "Archive");

    const moved = await moveWorkspaceFolder(
      workspaceRoot,
      drafts.path,
      archive.path
    );

    assert.deepEqual(moved, {
      name: "Drafts",
      path: "Archive/Drafts"
    });
    assert.equal(existsSync(path.join(workspaceRoot, "Archive", "Drafts")), true);
    assert.equal(existsSync(path.join(workspaceRoot, "Projects", "Drafts")), false);

    await assert.rejects(
      () => moveWorkspaceFolder(workspaceRoot, "Archive", "Archive/Drafts"),
      /Folder cannot be moved into itself/
    );
    await assert.rejects(
      () => moveWorkspaceFolder(workspaceRoot, ".", "Archive"),
      /Workspace root cannot be renamed or deleted/
    );
    await assert.rejects(
      () => moveWorkspaceFolder(workspaceRoot, "Archive", ".inknest"),
      /Folders cannot be moved into app-owned folders/
    );

    assert.deepEqual(
      (await scanWorkspaceFolders(workspaceRoot)).map((folder) => folder.path),
      ["Archive", "Archive/Drafts", "Projects"]
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});

test("phase 7 renderer exposes a collapsible folder tree and move menu", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    "expandedFolderPaths",
    "activeMoveFolderPath",
    "buildFolderTree",
    "FolderTree",
    "FolderTreeRow",
    "toggleFolder",
    "moveFolder",
    "window.inknest.folders.move",
    "Move folder",
    "Move folder to parent",
    "isFolderMoveTarget",
    "getAncestorFolderPaths"
  ]);
  assertIncludesAll(stylesSource, [
    ".tree-toggle-button",
    ".tree-count",
    ".folder-move-menu",
    "--folder-depth"
  ]);
  assert.doesNotMatch(appSource, /from "node:fs"|from "fs"|from "electron"/);
  assert.doesNotMatch(appSource, /ipcRenderer|showOpenDialog/);
});

test("phase 7 architecture document describes folder organization", async () => {
  const archSource = await readText("ARCH.md");

  assertIncludesAll(archSource, [
    "Phase 7 Architecture: Folder Organization",
    "window.inknest.folders.move(payload)",
    "folders:move",
    "moveWorkspaceFolder",
    "collapsible folder tree",
    "tests/phase7.test.mjs"
  ]);
});
