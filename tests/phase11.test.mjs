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
  const outputRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase11-services-"));
  const files = [
    "src/main/ipc/errors.ts",
    "src/main/services/path-utils.ts",
    "src/main/services/folder-service.ts",
    "src/main/services/note-service.ts",
    "src/main/services/search-service.ts"
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

test("phase 11 exposes search, tag, and current milestone contracts", async () => {
  const sharedIpc = await readText("src/shared/ipc.ts");
  const sharedPreload = await readText("src/shared/preload.ts");
  const preload = await readText("src/preload/index.ts");
  const searchHandler = await readText("src/main/ipc/search.ts");
  const noteService = await readText("src/main/services/note-service.ts");
  const app = await readText("src/renderer/src/App.tsx");

  for (const expected of [
    "phase-11-search-and-tags",
    "SearchNotesPayload",
    "SearchResult",
    "TagSummary",
    "searchQueryChannel",
    "searchListTagsChannel",
    "listTags",
    "InMemorySearchIndex",
    "searchIndex.ensureWorkspace",
    "extractFrontmatterTags"
  ]) {
    assert.ok(
      [sharedIpc, sharedPreload, preload, searchHandler, noteService, app].some((source) =>
        source.includes(expected)
      ),
      `Expected Phase 11 source to include ${expected}`
    );
  }

  for (const expected of [
    "value={searchQuery}",
    "window.inknest.search.query",
    "selectedTag",
    "Filter notes by tag",
    "No matching files or folders",
    "snippet"
  ]) {
    assert.ok(app.includes(expected), `Expected renderer source to include ${expected}`);
  }
});

test("phase 11 indexes frontmatter tags and searches title, body, path, and tags", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase11-workspace-"));

  try {
    await mkdir(path.join(workspaceRoot, "Projects"), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, "Projects", "Database.md"),
      [
        "---",
        "tags: [system-design, Database]",
        "---",
        "# Storage Notes",
        "",
        "Database indexing keeps lookups fast."
      ].join("\n"),
      "utf8"
    );
    await writeFile(
      path.join(workspaceRoot, "Daily.md"),
      "# Daily\n\nA short writing note.",
      "utf8"
    );

    const { buildSearchIndex } = await harness.requireService(
      "src/main/services/search-service.js"
    );
    const index = await buildSearchIndex(workspaceRoot);

    assert.deepEqual(index.listTags(), [
      { tag: "Database", count: 1 },
      { tag: "system-design", count: 1 }
    ]);
    assert.equal(index.search("storage")[0].title, "Storage Notes");
    assert.equal(index.search("DATABASE")[0].path, "Projects/Database.md");
    assert.equal(index.search("system-design")[0].title, "Storage Notes");
    assert.equal(index.search("", "database")[0].title, "Storage Notes");
    assert.match(index.search("storage")[0].snippet, /Database indexing/);
    assert.deepEqual(index.search("storage", undefined, "name"), []);
    assert.deepEqual(index.search("indexing", undefined, "name"), []);
    assert.deepEqual(index.search("Projects", undefined, "name"), []);
    assert.deepEqual(index.search("system-design", undefined, "name"), []);
    assert.deepEqual(index.search(".md", undefined, "name"), []);
    const namedResult = index.search(" DATAbaSE ", undefined, "name");
    assert.equal(namedResult.length, 1);
    assert.equal(namedResult[0].path, "Projects/Database.md");
    assert.equal(namedResult[0].title, "Database");
    assert.equal(namedResult[0].snippet, "");
    assert.equal(index.search("data", "database", "name").length, 1);
    assert.deepEqual(index.search("data", "unknown-tag", "name"), []);

    await writeFile(
      path.join(workspaceRoot, "Daily.md"),
      "---\ntags:\n  - journal\n---\n# Daily\n\nA writing note.",
      "utf8"
    );
    await index.rebuild(workspaceRoot);

    assert.deepEqual(index.listTags(), [
      { tag: "Database", count: 1 },
      { tag: "journal", count: 1 },
      { tag: "system-design", count: 1 }
    ]);
    assert.equal(index.search("journal")[0].title, "Daily");
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});
