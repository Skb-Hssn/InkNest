import assert from "node:assert/strict";
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
  const outputRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase8-services-"));
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

function assertIncludesAll(source, expectedValues) {
  for (const expectedValue of expectedValues) {
    assert.ok(
      source.includes(expectedValue),
      `Expected source to include: ${expectedValue}`
    );
  }
}

test("phase 8 shared contract exposes note save and current app phase", async () => {
  const sharedIpc = await readText("src/shared/ipc.ts");
  const sharedPreload = await readText("src/shared/preload.ts");
  const preloadSource = await readText("src/preload/index.ts");
  const notesHandlerSource = await readText("src/main/ipc/notes.ts");
  const appHandlerSource = await readText("src/main/ipc/app.ts");

  assertIncludesAll(sharedIpc, [
    "phase-8-visual-markdown-editor",
    "SaveNotePayload",
    "markdown: string",
    'save: "notes:save"'
  ]);
  assert.match(sharedPreload, /save:\s*\(payload: SaveNotePayload\)/);
  assert.match(preloadSource, /ipcChannels\.notes\.save/);
  assert.match(notesHandlerSource, /saveMarkdownNote/);
  assert.match(notesHandlerSource, /assertString\(payload\.markdown, "markdown"\)/);
  assert.match(appHandlerSource, /phase-8-visual-markdown-editor/);
});

test("phase 8 note service saves valid markdown inside the workspace", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase8-workspace-"));

  try {
    const { createMarkdownNote, readMarkdownNote, saveMarkdownNote } =
      await harness.requireService("src/main/services/note-service.js");

    const created = await createMarkdownNote(workspaceRoot, ".", "Round Trip");
    const markdown = [
      "# Round Trip",
      "",
      "- [x] Keep tasks",
      "- Keep lists",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| Ink | Nest |",
      ""
    ].join("\n");

    const saved = await saveMarkdownNote(workspaceRoot, created.path, markdown);
    const reopened = await readMarkdownNote(workspaceRoot, created.path);

    assert.deepEqual(saved, {
      path: created.path,
      markdown
    });
    assert.deepEqual(reopened, saved);

    await assert.rejects(
      () => saveMarkdownNote(workspaceRoot, "../outside.md", markdown),
      /outside the active workspace/
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});

test("phase 8 renderer exposes an editable visual markdown surface", async () => {
  const appSource = await readText("src/renderer/src/App.tsx");
  const editorSource = await readText("src/renderer/src/markdown-editor.ts");
  const stylesSource = await readText("src/renderer/src/styles.css");

  assertIncludesAll(appSource, [
    "VisualMarkdownEditor",
    "contentEditable={!disabled}",
    "editorDomToMarkdown",
    "markdownToHtml",
    "insertPlainTextAtSelection",
    "window.inknest.notes.save",
    "isDirty",
    "saveStatusLabel",
    "Unsaved changes",
    "Visual Markdown editor"
  ]);
  assertIncludesAll(editorSource, [
    "markdownToHtml",
    "editorDomToMarkdown",
    "insertPlainTextAtSelection",
    "blockquote",
    "data-task=\"true\"",
    "tableMarkdownToHtml",
    "tableElementToMarkdown",
    "```"
  ]);
  assertIncludesAll(stylesSource, [
    ".visual-editor",
    ".visual-editor table",
    ".visual-editor blockquote",
    ".visual-editor pre",
    ".visual-editor input[type=\"checkbox\"]"
  ]);
  assert.doesNotMatch(appSource, /from "node:fs"|from "fs"|from "electron"/);
  assert.doesNotMatch(appSource, /ipcRenderer|showOpenDialog/);
});

test("phase 8 architecture document describes the visual markdown editor", async () => {
  const archSource = await readText("ARCH.md");

  assertIncludesAll(archSource, [
    "Phase 8 Architecture: Visual Markdown Editor",
    "window.inknest.notes.save(payload)",
    "notes:save",
    "saveMarkdownNote",
    "VisualMarkdownEditor",
    "markdownToHtml",
    "editorDomToMarkdown",
    "tests/phase8.test.mjs"
  ]);
});
