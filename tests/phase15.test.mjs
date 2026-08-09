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
  const outputRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase15-services-"));
  const files = [
    "src/main/ipc/errors.ts",
    "src/main/services/path-utils.ts",
    "src/main/services/folder-service.ts",
    "src/main/services/note-service.ts",
    "src/main/services/workspace-watcher.ts"
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

async function waitFor(predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.fail("Timed out waiting for workspace watcher event.");
}

test("phase 15 exposes external-change contracts and conflict actions", async () => {
  const sources = await Promise.all([
    readText("src/shared/ipc.ts"),
    readText("src/shared/preload.ts"),
    readText("src/preload/index.ts"),
    readText("src/main/services/workspace-watcher.ts"),
    readText("src/main/ipc/index.ts"),
    readText("src/main/ipc/workspace.ts"),
    readText("src/renderer/src/App.tsx"),
    readText("src/renderer/src/styles.css"),
    readText("ARCH.md")
  ]);
  const combined = sources.join("\n");

  for (const expected of [
    "phase-15-reliability-and-external-changes",
    "WorkspaceChangeEvent",
    "onChanged",
    "WorkspaceWatcher",
    "createdPaths",
    "changedPaths",
    "deletedPaths",
    "Reload from disk",
    "Keep my version",
    "Save as new note",
    "External change needs review",
    "invalid frontmatter",
    "Phase 15 Architecture: Reliability, Trash, And External Changes"
  ]) {
    assert.ok(combined.includes(expected), `Expected Phase 15 source to include ${expected}`);
  }
});

test("phase 15 watcher reports file creation, edits, and deletion", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase15-workspace-"));
  const events = [];
  const { WorkspaceWatcher } = await harness.requireService(
    "src/main/services/workspace-watcher.js"
  );
  const watcher = new WorkspaceWatcher((event) => events.push(event));

  try {
    const notePath = path.join(workspaceRoot, "note.md");
    await writeFile(notePath, "# Note\n\nOriginal.\n", "utf8");
    await watcher.watch(workspaceRoot);

    await writeFile(notePath, "# Note\n\nChanged externally.\n", "utf8");
    await waitFor(() => events.some((event) => event.changedPaths.includes("note.md")));

    await mkdir(path.join(workspaceRoot, "Projects"));
    await writeFile(path.join(workspaceRoot, "Projects", "new.md"), "# New\n", "utf8");
    await waitFor(() =>
      events.some((event) => event.createdPaths.includes("Projects/new.md"))
    );

    await rm(notePath);
    await waitFor(() => events.some((event) => event.deletedPaths.includes("note.md")));
  } finally {
    await watcher.stop();
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});

test("phase 15 keeps notes readable when frontmatter is malformed", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase15-frontmatter-"));

  try {
    const malformedMarkdown = [
      "---",
      "title: \"Unclosed",
      "tags: [one, two",
      "not metadata",
      "---",
      "# Readable Note",
      "",
      "The body remains available."
    ].join("\n");
    await writeFile(path.join(workspaceRoot, "malformed.md"), malformedMarkdown, "utf8");

    const { parseFrontmatter, scanMarkdownNotes, readMarkdownNote } =
      await harness.requireService("src/main/services/note-service.js");
    const parsed = parseFrontmatter(malformedMarkdown);
    const notes = await scanMarkdownNotes(workspaceRoot);
    const content = await readMarkdownNote(workspaceRoot, "malformed.md");

    assert.deepEqual(parsed, {
      title: '"Unclosed',
      tags: ["[one", "two"]
    });
    assert.deepEqual(notes.map((note) => note.path), ["malformed.md"]);
    assert.equal(content.markdown, malformedMarkdown);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});
