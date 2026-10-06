import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import { Schema } from "@milkdown/kit/prose/model";
import { AllSelection, EditorState, NodeSelection, TextSelection } from "@milkdown/kit/prose/state";

const temp = await mkdtemp(path.join(fileURLToPath(new URL("../node_modules/", import.meta.url)), ".selection-tests-"));
let syncEditorDOMSelection;
try {
  const source = await readFile(new URL("../src/renderer/src/editor/dom-selection.ts", import.meta.url), "utf8");
  await writeFile(path.join(temp, "selection.mjs"), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText);
  ({ syncEditorDOMSelection } = await import(pathToFileURL(path.join(temp, "selection.mjs"))));
} finally { await rm(temp, { recursive: true }); }

const schema = new Schema({ nodes: {
  doc: { content: "paragraph+" }, paragraph: { content: "inline*" }, text: { group: "inline" },
  equation: { inline: true, group: "inline", atom: true }
} });
const doc = schema.nodes.doc.create(null, [
  schema.nodes.paragraph.create(null, [schema.text("Before "), schema.nodes.equation.create(), schema.text(" after")]),
  schema.nodes.paragraph.create(null, schema.text("Destination"))
]);
const end = doc.content.size - 1;
function makeView(selection, options = {}) {
  const anchorNode = {}, focusNode = anchorNode;
  const native = { anchorNode, focusNode, anchorOffset: end, focusOffset: end, isCollapsed: true, ...options.native };
  const view = {
    composing: options.composing ?? false,
    state: EditorState.create({ doc, selection }), dispatched: 0,
    dom: { ownerDocument: { getSelection: () => options.missing ? null : native }, contains: () => !options.outside },
    posAtDOM: (_node, offset) => offset,
    dispatch(tr) { view.dispatched++; view.state = view.state.apply(tr); }
  };
  return view;
}
test("native navigation collapses stale select-all before Enter or paste", () => {
  const view = makeView(new AllSelection(doc));
  syncEditorDOMSelection(view);
  assert.ok(view.state.selection instanceof TextSelection);
  assert.equal(view.state.selection.head, end);
  assert.equal(view.state.selection.empty, true);
  assert.ok(view.state.doc.eq(doc));
  assert.equal(view.dispatched, 1);
});
test("a real native select-all range stays AllSelection", () => {
  const view = makeView(new AllSelection(doc), { native: { anchorOffset: 0, isCollapsed: false } });
  syncEditorDOMSelection(view);
  assert.ok(view.state.selection instanceof AllSelection);
  assert.equal(view.dispatched, 0);
});
test("selected equation atoms remain node selections", () => {
  const view = makeView(NodeSelection.create(doc, 8));
  syncEditorDOMSelection(view);
  assert.ok(view.state.selection instanceof NodeSelection);
  assert.equal(view.dispatched, 0);
});
test("native text selection preserves its direction", () => {
  const view = makeView(TextSelection.create(doc, 1), { native: { focusOffset: end - 3, isCollapsed: false } });
  syncEditorDOMSelection(view);
  assert.equal(view.state.selection.anchor, end);
  assert.equal(view.state.selection.head, end - 3);
});
for (const options of [{ composing: true }, { outside: true }, { missing: true }]) {
  test(`selection synchronization ignores ${Object.keys(options)[0]}`, () => {
    const view = makeView(new AllSelection(doc), options);
    syncEditorDOMSelection(view);
    assert.equal(view.dispatched, 0);
  });
}
test("an already synchronized caret does not dispatch a redundant transaction", () => {
  const view = makeView(TextSelection.create(doc, end));
  syncEditorDOMSelection(view);
  assert.equal(view.dispatched, 0);
});
