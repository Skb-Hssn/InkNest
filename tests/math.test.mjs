import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { Schema, Fragment, Slice } from "@milkdown/kit/prose/model";
import { EditorState, TextSelection, NodeSelection } from "@milkdown/kit/prose/state";
import { history, undo, redo } from "@milkdown/kit/prose/history";
import { ParserState, SerializerState } from "@milkdown/kit/transformer";
import { remark } from "remark";
import remarkMath from "remark-math";
import katex from "katex";

const temp = await mkdtemp(path.join(fileURLToPath(new URL("../node_modules/", import.meta.url)), ".math-tests-"));
for (const [name, relative] of [["math", "extensions/math-plugin.ts"], ["formatting", "formatting-commands.ts"], ["paste", "extensions/math-paste.ts"]]) {
  const source = await readFile(new URL(`../src/renderer/src/editor/${relative}`, import.meta.url), "utf8");
  await writeFile(path.join(temp, `${name}.mjs`), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replaceAll('"./math-plugin"', '"./math.mjs"'));
}
const { mathNodeSchema, mathRenderOptions, canInsertMath, insertMath, hasOpenMathFence } = await import(pathToFileURL(path.join(temp, "math.mjs")));
const { runFormattingAction } = await import(pathToFileURL(path.join(temp, "formatting.mjs")));
const { findPastedMath, normalizeMathPaste, transformMathSlice } = await import(pathToFileURL(path.join(temp, "paste.mjs")));
await rm(temp, { recursive: true });
const container = (name, content, group) => ({ content, group,
  parseMarkdown: { match: (node) => node.type === (name === "doc" ? "root" : name), runner: (state, node, type) => { state.openNode(type).next(node.children).closeNode(); } },
  toMarkdown: { match: (node) => node.type.name === name, runner: (state, node) => { state.openNode(name === "doc" ? "root" : name).next(node.content).closeNode(); } }
});
const schema = new Schema({ nodes: {
  doc: { content: "block+", parseMarkdown: { match: (node) => node.type === "root", runner: (state, node, type) => state.injectRoot(node, type) }, toMarkdown: { match: (node) => node.type.name === "doc", runner: (state, node) => state.openNode("root").next(node.content) } },
  paragraph: container("paragraph", "inline*", "block"),
  text: { group: "inline", parseMarkdown: { match: (node) => node.type === "text", runner: (state, node) => state.addText(node.value) }, toMarkdown: { match: (node) => node.isText, runner: (state, node) => state.addNode("text", undefined, node.text) } },
  hardbreak: { inline: true, group: "inline", parseMarkdown: { match: (node) => node.type === "break", runner: (state, _node, type) => state.addNode(type) }, toMarkdown: { match: (node) => node.type.name === "hardbreak", runner: (state) => state.addNode("break") } },
  math_inline: mathNodeSchema(false), math_block: mathNodeSchema(true),
  code_block: { content: "text*", group: "block", marks: "", code: true },
  table_cell: { content: "paragraph", group: "block" },
  list_item: { content: "paragraph block*", group: "block" }
}, marks: { inlineCode: { code: true }, strong: {} } });
const processor = remark().use(remarkMath);
const parse = ParserState.create(schema, processor);
const serialize = SerializerState.create(schema, processor);
const sources = [
  "x", "E = mc^2", "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}", "\\int_0^\\infty e^{-x}\\,dx",
  "\\sum_{i=0}^{n} i^2", "\\alpha + \\beta \\leq \\gamma", "\\text{বাংলা café 😀}",
  "\\begin{matrix}a & b \\\\ c & d\\end{matrix}", "\\text{price: \\$5}",
  "\\unknowncommand{x}", "\\frac{1}{", "<script>alert(1)</script>", "a_b^c", " x ", "  "
];
for (const display of [false, true]) {
  for (const value of sources) {
    test(`${display ? "display" : "inline"} Markdown round trip: ${value}`, () => {
      const math = schema.nodes[display ? "math_block" : "math_inline"].create({ value });
      const doc = schema.nodes.doc.create(null, display ? math : schema.nodes.paragraph.create(null, [schema.text("Before "), math, schema.text(" after")]));
      const markdown = serialize(doc);
      const restored = parse(markdown);
      restored.check();
      assert.ok(restored.eq(doc), markdown);
      assert.equal(serialize(restored), markdown);
    });
  }
}
for (const value of ["\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}", "x\n\ny", "a\n$$\nb", ""]) {
  test(`display newlines and fence collisions: ${JSON.stringify(value)}`, () => {
    const doc = schema.nodes.doc.create(null, schema.nodes.math_block.create({ value }));
    assert.ok(parse(serialize(doc)).eq(doc));
  });
}
test("adjacent inline equations keep distinct sources", () => {
  const doc = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, [schema.nodes.math_inline.create({ value: "a" }), schema.nodes.math_inline.create({ value: "b" })]));
  const restored = parse(serialize(doc));
  assert.equal(restored.firstChild.child(0).attrs.value, "a");
  assert.equal(restored.firstChild.child(1).text, " ");
  assert.equal(restored.firstChild.child(2).attrs.value, "b");
});
test("empty inline equations reopen as inline placeholders", () => {
  const doc = schema.nodes.doc.create(null, schema.nodes.paragraph.create(null, schema.nodes.math_inline.create()));
  const restored = parse(serialize(doc));
  assert.equal(restored.firstChild.firstChild.type.name, "math_inline");
  assert.equal(restored.firstChild.firstChild.attrs.value.trim(), "");
});
test("display metadata survives editing and serialization", () => {
  const doc = parse("$$ equation-label\nx^2\n$$\n");
  assert.equal(doc.firstChild.attrs.meta, "equation-label");
  assert.ok(parse(serialize(doc)).eq(doc));
});
for (const value of sources.slice(0, 9)) {
  test(`KaTeX renders accessible HTML and MathML: ${value}`, () => {
    const html = katex.renderToString(value, mathRenderOptions);
    assert.match(html, /katex-html/); assert.match(html, /<math/);
  });
}
for (const value of ["\\unknowncommand{x}", "\\frac{1}{", "\\def\\loop{\\loop}\\loop"]) {
  test(`invalid or recursive source fails safely: ${value}`, () => assert.throws(() => katex.renderToString(value, mathRenderOptions)));
}
for (const value of ["\\href{javascript:alert(1)}{click}", "\\htmlClass{evil}{x}", "\\includegraphics{https://example.com/tracker}"]) {
  test(`untrusted commands cannot inject active content: ${value}`, () => {
    const html = katex.renderToString(value, mathRenderOptions);
    assert.doesNotMatch(html, /<(?:a|img|script)\b/);
    assert.doesNotMatch(html, /class="evil"/);
  });
}
test("macros do not leak between equations", () => {
  katex.renderToString("\\gdef\\custom{z}\\custom", mathRenderOptions);
  assert.throws(() => katex.renderToString("\\custom", mathRenderOptions));
});
const p = (value) => schema.nodes.paragraph.create(null, value ? schema.text(value) : null);
function fixture(doc, from, to = from) {
  let state = EditorState.create({ schema, doc: schema.nodes.doc.create(null, doc), plugins: [history()] });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
  return { get state() { return state; }, editable: true, dispatch(tr) { state = state.apply(tr); state.doc.check(); }, nodeDOM() { return null; } };
}
for (const display of [false, true]) {
  test(`${display ? "display" : "inline"} insertion preserves surrounding prose, selects math, and supports undo`, () => {
    const view = fixture(p("Before x after"), 8, 9);
    const before = view.state.doc;
    assert.equal(insertMath(view, display), true);
    assert.ok(view.state.selection instanceof NodeSelection);
    assert.equal(view.state.selection.node.attrs.value, "x");
    assert.ok(view.state.doc.textContent.includes("Before "));
    assert.ok(view.state.doc.textContent.includes(" after"));
    assert.equal(undo(view.state, view.dispatch), true); assert.ok(view.state.doc.eq(before));
    assert.equal(redo(view.state, view.dispatch), true);
  });
}
for (const context of ["code_block", "inlineCode", "table_cell", "list_item", "cross-block"]) {
  test(`insertion respects ${context} schema boundaries`, () => {
    const node = context === "code_block" ? schema.nodes.code_block.create(null, schema.text("code"))
      : context === "inlineCode" ? schema.nodes.paragraph.create(null, schema.text("code", [schema.marks.inlineCode.create()]))
      : context === "cross-block" ? [p("one"), p("two")] : schema.nodes[context].create(null, p("cell"));
    const view = fixture(node, 2, context === "cross-block" ? 7 : 2);
    assert.equal(canInsertMath(view.state, true), false);
    assert.equal(canInsertMath(view.state, false), ["table_cell", "list_item"].includes(context));
  });
}
test("converting a paragraph containing math to code cannot discard its equation", () => {
  const view = fixture(schema.nodes.paragraph.create(null, [schema.text("Text "), schema.nodes.math_inline.create({ value: "x^2" })]), 1);
  const before = view.state.doc;
  assert.equal(runFormattingAction(view.state, view.dispatch, "code-block"), false);
  assert.ok(before.eq(view.state.doc));
});
test("inline code over math cannot serialize away the equation", () => {
  const view = fixture(schema.nodes.paragraph.create(null, [schema.text("Text "), schema.nodes.math_inline.create({ value: "x^2" })]), 1, 7);
  const before = view.state.doc;
  assert.equal(runFormattingAction(view.state, view.dispatch, "inline-code"), false);
  assert.ok(before.eq(view.state.doc));
  assert.equal(canInsertMath(view.state, false), false);
});
for (const [text, open] of [["$x", true], ["$\\text{**bold**}", true], ["$$x", true], ["$x$", false], ["\\$5", false], ["$a$ $b", true], ["$$a$$", false], ["", false], ["Price 5", false], ["\\\\$x", true]]) {
  test(`unfinished math fence detection: ${text}`, () => assert.equal(hasOpenMathFence(text), open));
}

for (const [text, value, display] of [
  ["before $x^2$ after", "x^2", false], ["before \\(x^2\\) after", "x^2", false],
  ["\\[\\frac{a}{b}\\]", "\\frac{a}{b}", true], ["$$x^2$$", "x^2", true],
  ["$$\nx^2\n$$", "x^2", true], ["\\sqrt{x}", "\\sqrt{x}", true],
  ["\\(\\unknown{x}\\)", "\\unknown{x}", false]
]) {
  test(`math paste detects and normalizes ${text}`, () => {
    const spans = findPastedMath(text, processor);
    assert.equal(spans.length, 1); assert.equal(spans[0].value, value); assert.equal(spans[0].display, display);
    const restored = parse(normalizeMathPaste(text, processor));
    const equations = [];
    restored.descendants((node) => { if (node.type.name.startsWith("math_")) equations.push(node); });
    assert.equal(equations.length, 1); assert.equal(equations[0].attrs.value, value);
    assert.equal(equations[0].type.name, display ? "math_block" : "math_inline");
  });
}
for (const text of ["`\\(x\\)`", "```latex\n\\[x\\]\n```", "\\\\(x\\\\)", "Price \\$5", "\\(unfinished", "\\[unfinished", "C:\\folder\\file", "x = y", "\\frac{1}{"]) {
  test(`math paste leaves literal or ambiguous content alone: ${text}`, () => {
    assert.deepEqual(findPastedMath(text, processor), []);
    assert.equal(normalizeMathPaste(text, processor), text);
  });
}
test("rich paste preserves marks and converts bracketed math", () => {
  const paragraph = schema.nodes.paragraph.create(null, [schema.text("Bold \\(x\\)", [schema.marks.strong.create()]), schema.text(" after")]);
  const slice = transformMathSlice(new Slice(Fragment.from(paragraph), 1, 1), processor);
  assert.equal(slice.content.firstChild.child(1).attrs.value, "x");
  assert.equal(slice.content.firstChild.child(1).marks[0].type.name, "strong");
  assert.equal(slice.content.firstChild.child(0).text, "Bold ");
  assert.equal(slice.content.firstChild.child(2).text, " after");
});
test("rich paste keeps code marked text literal", () => {
  const paragraph = schema.nodes.paragraph.create(null, schema.text("$x$ \\(y\\)", [schema.marks.inlineCode.create()]));
  const slice = transformMathSlice(new Slice(Fragment.from(paragraph), 1, 1), processor);
  assert.ok(slice.content.firstChild.eq(paragraph));
});
test("rich paste creates display blocks with compatible slice boundaries", () => {
  const paragraph = p("$$x$$");
  const slice = transformMathSlice(new Slice(Fragment.from(paragraph), 1, 1), processor);
  assert.equal(slice.content.firstChild.type.name, "math_block");
  assert.equal(slice.openStart, 0); assert.equal(slice.openEnd, 0);
});
test("rich paste splits display equations from surrounding marked prose", () => {
  const paragraph = schema.nodes.paragraph.create(null, [schema.text("Before", [schema.marks.strong.create()]), schema.text("\\[x^2\\]after")]);
  const slice = transformMathSlice(new Slice(Fragment.from(paragraph), 1, 1), processor);
  assert.equal(slice.content.childCount, 3);
  assert.equal(slice.content.child(0).textContent, "Before");
  assert.equal(slice.content.child(0).firstChild.marks[0].type.name, "strong");
  assert.equal(slice.content.child(1).type.name, "math_block");
  assert.equal(slice.content.child(2).textContent, "after");
});
test("rich paste does not inherit a mark from adjacent prose", () => {
  const paragraph = schema.nodes.paragraph.create(null, [schema.text("Before", [schema.marks.strong.create()]), schema.text("$x$")]);
  const slice = transformMathSlice(new Slice(Fragment.from(paragraph), 1, 1), processor);
  assert.equal(slice.content.firstChild.lastChild.attrs.value, "x");
  assert.deepEqual(slice.content.firstChild.lastChild.marks, []);
});

for (const fence of ["$$", "$$$", "\\["]) {
  test(`rich paste joins display fences across paragraphs: ${fence}`, () => {
    const close = fence === "\\[" ? "\\]" : fence;
    const nodes = [p("These bounds assume"), p(fence), p("1\\le a_i\\le n,"), p(close), p("After")];
    const slice = transformMathSlice(new Slice(Fragment.from(nodes), 1, 1), processor);
    assert.equal(slice.content.childCount, 3);
    assert.equal(slice.content.child(0).textContent, "These bounds assume");
    assert.equal(slice.content.child(1).type.name, "math_block");
    assert.equal(slice.content.child(1).attrs.value, "1\\le a_i\\le n,");
    assert.equal(slice.content.child(2).textContent, "After");
  });
}
test("rich paste reads display fences separated by hard breaks", () => {
  const paragraph = schema.nodes.paragraph.create(null, [schema.text("$$"), schema.nodes.hardbreak.create(), schema.text("1\\le a_i\\le n,"), schema.nodes.hardbreak.create(), schema.text("$$")]);
  const slice = transformMathSlice(new Slice(Fragment.from(paragraph), 1, 1), processor);
  assert.equal(slice.content.firstChild.type.name, "math_block");
  assert.equal(slice.content.firstChild.attrs.value, "1\\le a_i\\le n,");
});
test("rich paste leaves unclosed fences and code paragraphs untouched", () => {
  for (const nodes of [[p("$$"), p("x")], [p("$$"), schema.nodes.code_block.create(null, schema.text("x")), p("$$")], [p("$$"), schema.nodes.paragraph.create(null, schema.text("x", [schema.marks.inlineCode.create()])), p("$$")]]) {
    const content = Fragment.from(nodes);
    assert.ok(transformMathSlice(new Slice(content, 1, 1), processor).content.eq(content));
  }
});
test("rich paste converts multiple fenced equations independently", () => {
  const nodes = [p("$$"), p("a"), p("$$"), p("Between"), p("$$"), p("b"), p("$$")];
  const slice = transformMathSlice(new Slice(Fragment.from(nodes), 1, 1), processor);
  assert.deepEqual(Array.from({ length: slice.content.childCount }, (_, i) => slice.content.child(i).attrs.value ?? slice.content.child(i).textContent), ["a", "Between", "b"]);
});
