import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function readText(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

async function loadDocumentEnvelope() {
  const source = await readText("src/renderer/src/editor/document-envelope.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  return import(`data:text/javascript,${encodeURIComponent(output)}`);
}

test("document envelope preserves frontmatter, BOM, and newline style", async () => {
  const { joinMarkdownDocument, splitMarkdownDocument } = await loadDocumentEnvelope();
  const markdown = "\uFEFF---\r\ntitle: InkNest\r\n---\r\n# Note\r\n\r\nBody\r\n";
  const envelope = splitMarkdownDocument(markdown);

  assert.equal(envelope.frontmatter, "\uFEFF---\ntitle: InkNest\n---\n");
  assert.equal(envelope.body, "# Note\n\nBody\n");
  assert.equal(envelope.newline, "\r\n");
  assert.equal(joinMarkdownDocument(envelope, envelope.body), markdown);
});

test("document envelope treats an unclosed delimiter as editable body", async () => {
  const { splitMarkdownDocument } = await loadDocumentEnvelope();
  const markdown = "---\ntitle: Unclosed\n# Still body\n";
  assert.deepEqual(splitMarkdownDocument(markdown), {
    frontmatter: "",
    body: markdown,
    newline: "\n"
  });
});

test("legacy DOM editor is removed and editor modules avoid browser mutation APIs", async () => {
  await assert.rejects(
    access(new URL("../src/renderer/src/markdown-editor.ts", import.meta.url)),
    /ENOENT/
  );

  const sources = await Promise.all([
    readText("src/renderer/src/editor/MarkdownEditor.tsx"),
    readText("src/renderer/src/editor/create-editor.ts"),
    readText("src/renderer/src/editor/editor-controller.ts"),
    readText("src/renderer/src/editor/extensions/slash-command-plugin.ts")
  ]);
  const combined = sources.join("\n");

  assert.doesNotMatch(combined, /document\.execCommand/);
  assert.doesNotMatch(combined, /\.innerHTML\s*=/);
  assert.doesNotMatch(combined, /contentEditable\s*=/);
  assert.match(combined, /Editor\.make\(\)/);
  assert.match(combined, /view\.state\.tr/);
});
