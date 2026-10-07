import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

async function createServiceHarness() {
  const root = new URL("../", import.meta.url);
  const outputRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase12-services-"));
  const files = [
    "src/main/ipc/errors.ts",
    "src/main/services/path-utils.ts",
    "src/main/services/folder-service.ts",
    "src/main/services/note-service.ts",
    "src/main/services/import-service.ts",
    "src/main/services/asset-service.ts"
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
    requireService(relativePath) {
      return import(pathToFileURL(path.join(outputRoot, relativePath)).href);
    },
    async cleanup() {
      await rm(outputRoot, { recursive: true, force: true });
    }
  };
}

test("phase 12 exposes import, asset, local-link, and placeholder contracts", async () => {
  const sources = await Promise.all([
    readText("src/shared/ipc.ts"),
    readText("src/shared/preload.ts"),
    readText("src/preload/index.ts"),
    readText("src/main/services/import-service.ts"),
    readText("src/main/services/asset-service.ts"),
    readText("src/main/ipc/links.ts"),
    readText("src/renderer/src/App.tsx"),
    readText("src/renderer/src/editor/create-editor.ts"),
    readText("src/renderer/src/editor/extensions/image-view.ts"),
    readText("src/renderer/src/editor/editor.css")
  ]);
  const combined = sources.join("\n");

  for (const expected of [
    "phase-12-import-assets-links",
    "ImportNotesPayload",
    "importMarkdownFiles",
    "importMarkdownFolder",
    "createAvailableAssetFileName",
    "saveImageAsset",
    "resolveLocal",
    "openExternal",
    "onImagePaste",
    "broken-image-placeholder",
    "data-markdown-src"
  ]) {
    assert.ok(combined.includes(expected), `Expected Phase 12 source to include ${expected}`);
  }
});

test("phase 12 imports Markdown and saves collision-safe relative assets", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase12-workspace-"));
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase12-source-"));

  try {
    await mkdir(path.join(sourceRoot, "Nested"), { recursive: true });
    await writeFile(path.join(sourceRoot, "Daily.md"), "# Daily\n", "utf8");
    await writeFile(path.join(sourceRoot, "Nested", "Plan.md"), "# Plan\n", "utf8");
    await writeFile(path.join(sourceRoot, "skip.txt"), "skip", "utf8");

    const { importMarkdownFiles, importMarkdownFolder } = await harness.requireService(
      "src/main/services/import-service.js"
    );
    const { createAvailableAssetFileName, saveImageAsset } = await harness.requireService(
      "src/main/services/asset-service.js"
    );

    const firstImport = await importMarkdownFiles(
      workspaceRoot,
      [path.join(sourceRoot, "Daily.md"), path.join(sourceRoot, "skip.txt")]
    );
    assert.deepEqual(firstImport.skipped, [path.join(sourceRoot, "skip.txt")]);
    assert.deepEqual(firstImport.imported.map((note) => note.path), ["Daily.md"]);

    const folderImport = await importMarkdownFolder(workspaceRoot, sourceRoot);
    assert.deepEqual(folderImport.imported.map((note) => note.path), [
      "Daily 2.md",
      "Nested/Plan.md"
    ]);

    const image = await saveImageAsset(
      workspaceRoot,
      [137, 80, 78, 71],
      "diagram.png",
      "image/png"
    );
    assert.equal(image.assetPath, "asset/diagram.png");
    assert.equal(await createAvailableAssetFileName(workspaceRoot, "diagram.png"), "diagram 2.png");
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(sourceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});
