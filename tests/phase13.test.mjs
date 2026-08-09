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
  const outputRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase13-services-"));
  const files = [
    "src/main/ipc/errors.ts",
    "src/main/services/path-utils.ts",
    "src/main/services/export-service.ts"
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

  const electronStubPath = path.join(outputRoot, "node_modules", "electron", "index.js");
  await mkdir(path.dirname(electronStubPath), { recursive: true });
  await writeFile(
    electronStubPath,
    "exports.BrowserWindow = class BrowserWindow {};\n",
    "utf8"
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

test("phase 13 exposes export contracts and renderer actions", async () => {
  const sources = await Promise.all([
    readText("src/shared/ipc.ts"),
    readText("src/shared/preload.ts"),
    readText("src/preload/index.ts"),
    readText("src/main/ipc/export.ts"),
    readText("src/main/services/export-service.ts"),
    readText("src/renderer/src/App.tsx")
  ]);
  const combined = sources.join("\n");

  for (const expected of [
    "phase-13-export",
    "ExportFormat",
    "ExportNotePayload",
    "exportMarkdownNote",
    "markdownToHtmlDocument",
    "sanitizeExportedHtml",
    "printToPDF",
    "Export Markdown",
    "Export HTML",
    "Export PDF",
    "window.inknest.export.note"
  ]) {
    assert.ok(combined.includes(expected), `Expected Phase 13 source to include ${expected}`);
  }
});

test("phase 13 writes Markdown and safe readable HTML exports", async () => {
  const harness = await createServiceHarness();
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "inknest-phase13-workspace-"));

  try {
    const notePath = path.join(workspaceRoot, "Design.md");
    const markdown = [
      "# Design",
      "",
      "A **bold** note with [unsafe](javascript:alert(1)).",
      "",
      "- First",
      "- Second",
      "",
      "| Name | Value |",
      "| --- | --- |",
      "| Mode | Local |",
      "",
      "```ts",
      "const answer = 42;",
      "```"
    ].join("\n");
    await writeFile(notePath, markdown, "utf8");

    const exportDirectory = await mkdir(path.join(workspaceRoot, "exports"), {
      recursive: true
    }).then(() => path.join(workspaceRoot, "exports"));
    const { exportMarkdownNote, markdownToHtmlDocument } = await harness.requireService(
      "src/main/services/export-service.js"
    );

    const html = markdownToHtmlDocument(markdown, notePath, workspaceRoot);
    assert.match(html, /<h1>Design<\/h1>/);
    assert.match(html, /<strong>bold<\/strong>/);
    assert.match(html, /<table>/);
    assert.match(html, /<pre><code class="language-ts">/);
    assert.doesNotMatch(html, /javascript:alert/);
    assert.doesNotMatch(html, /<script/);

    const markdownResult = await exportMarkdownNote(
      workspaceRoot,
      "Design.md",
      "markdown",
      path.join(exportDirectory, "Design.md")
    );
    assert.equal(markdownResult.exported, true);
    assert.equal(await readFile(markdownResult.path, "utf8"), markdown);

    const htmlResult = await exportMarkdownNote(
      workspaceRoot,
      "Design.md",
      "html",
      path.join(exportDirectory, "Design.html")
    );
    assert.equal(htmlResult.exported, true);
    assert.match(await readFile(htmlResult.path, "utf8"), /<h1>Design<\/h1>/);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
    await harness.cleanup();
  }
});
