import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
  const outputRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase10-services-"));
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
    requireService(relativePath) {
      return import(pathToFileURL(path.join(outputRoot, relativePath)).href);
    },
    async cleanup() {
      await rm(outputRoot, { recursive: true, force: true });
    }
  };
}

test("phase 10 exposes autosave states, manual save, and close handling", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const mainSource = await readText("src/main/index.ts");
  const noteSource = await readText("src/main/services/note-service.ts");
  const errorSource = await readText("src/main/ipc/errors.ts");
  const archSource = await readText("ARCH.md");

  for (const expected of [
    'type SaveState = "saved" | "unsaved" | "saving" | "failed"',
    "const autoSaveDelayMs = 750",
    "setTimeout",
    "Unsaved changes",
    "Saving",
    "Save failed",
    "event.ctrlKey || event.metaKey",
    'event.key.toLowerCase() === "s"',
    "onPrepareToClose",
    "closeReady",
    "closeCanceled"
  ]) {
    assert.ok(appSource.includes(expected), `Expected renderer source to include ${expected}`);
  }

  for (const expected of ["event.preventDefault()", "prepareToClose", "mainWindow.close()"])
    assert.ok(mainSource.includes(expected), `Expected main source to include ${expected}`);

  for (const expected of ["writeMarkdownNoteSafely", "temporary", "sync()", "rename("])
    assert.ok(noteSource.includes(expected), `Expected note service to include ${expected}`);
  assert.ok(errorSource.includes('"SAVE_FAILED"'));

  assert.ok(archSource.includes("Phase 10 Architecture: Auto-Save And Safe Writes"));
});

test("phase 10 safe write flushes content and removes its temporary file", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase10-workspace-"));

  try {
    const { createMarkdownNote, readMarkdownNote, saveMarkdownNote } =
      await harness.requireService("src/main/services/note-service.js");
    const created = await createMarkdownNote(workspaceRoot, ".", "Safe Write");
    const markdown = "# Safe Write\n\nSaved atomically.\n";

    assert.deepEqual(
      await saveMarkdownNote(workspaceRoot, created.path, markdown),
      { path: created.path, markdown }
    );
    assert.deepEqual(await readMarkdownNote(workspaceRoot, created.path), {
      path: created.path,
      markdown
    });

    const entries = await readdir(workspaceRoot);
    assert.equal(entries.some((entry) => entry.endsWith(".tmp")), false);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});
