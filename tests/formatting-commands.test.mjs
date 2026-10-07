import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { history, undo, redo } from '@milkdown/kit/prose/history';

const temp = await mkdtemp(path.join(fileURLToPath(new URL('../node_modules/', import.meta.url)), '.formatting-tests-'));
const source = await readFile(new URL('../src/renderer/src/editor/formatting-commands.ts', import.meta.url), 'utf8');
await writeFile(path.join(temp, 'commands.mjs'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { runFormattingAction, isMarkActive } = await import(pathToFileURL(path.join(temp, 'commands.mjs')).href);
await rm(temp, { recursive: true });
// Mirror the installed Milkdown/GFM content constraints and attributes. UI tests
// exercise the actual Milkdown schema, serialization, plugins and node views.
const schema = new Schema({ nodes: {
  doc: { content: 'block+' }, paragraph: { group: 'block', content: 'inline*' },
  heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
  code_block: { group: 'block', content: 'text*', marks: '', code: true, attrs: { language: { default: '' } } },
  blockquote: { group: 'block', content: 'block+' },
  bullet_list: { group: 'block', content: 'list_item+', attrs: { spread: { default: false } } },
  ordered_list: { group: 'block', content: 'list_item+', attrs: { order: { default: 1 }, spread: { default: false } } },
  list_item: { content: 'paragraph block*', attrs: { checked: { default: null }, listType: { default: 'bullet' }, label: { default: '•' }, spread: { default: true } } },
  table: { group: 'block', content: 'table_row+' }, table_row: { content: 'table_cell+' }, table_cell: { content: 'paragraph' },
  text: { group: 'inline' }
}, marks: { strong: {}, emphasis: {}, strike_through: {}, inlineCode: { code: true, inclusive: false }, link: { attrs: { href: {} } } } });
const text = (value, marks = []) => schema.text(value, marks.map((name) => schema.marks[name].create()));
const p = (value = 'Alpha', marks = []) => schema.nodes.paragraph.create(null, value ? text(value, marks) : null);
const li = (value, checked = null, extra = []) => schema.nodes.list_item.create({ checked }, [p(value), ...extra]);
const list = (...items) => schema.nodes.bullet_list.create(null, items);
const quote = (...items) => schema.nodes.blockquote.create(null, items);
function fixture(nodes = [p('Alpha'), p('Beta'), p('Gamma')]) {
  let state = EditorState.create({ schema, doc: schema.nodes.doc.create(null, nodes), plugins: [history()] });
  return {
    get state() { return state; },
    select(from, to = from) { state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to))); },
    apply(action, options) { const handled = runFormattingAction(state, (tr) => { state = state.apply(tr); }, action, options); state.doc.check(); return handled; },
    undo() { return undo(state, (tr) => { state = state.apply(tr); }); },
    redo() { return redo(state, (tr) => { state = state.apply(tr); }); }
  };
}
const blocks = (state, name) => { const result = []; state.doc.descendants((node, pos) => { if (node.type.name === name) result.push({ node, pos }); }); return result; };
for (const [action, markName] of [['bold', 'strong'], ['italic', 'emphasis'], ['strikethrough', 'strike_through'], ['inline-code', 'inlineCode']]) {
  for (const kind of ['partial', 'multiple blocks', 'mixed', 'empty', 'caret', 'Unicode']) {
    test(`${action}: ${kind} selection and toggle`, () => {
      const f = fixture(kind === 'mixed' ? [schema.nodes.paragraph.create(null, [text('Al', [markName]), text('pha')])] : kind === 'empty' ? [p('')] : kind === 'Unicode' ? [p('বাংলা 😀 café')] : undefined);
      if (kind === 'caret' || kind === 'empty') f.select(1);
      else f.select(1, kind === 'multiple blocks' ? 12 : kind === 'partial' ? 3 : f.state.doc.firstChild.nodeSize - 1);
      const before = f.state.doc;
      assert.equal(f.apply(action), true);
      assert.equal(isMarkActive(f.state, schema.marks[markName]), true);
      assert.equal(f.apply(action), true);
      assert.equal(isMarkActive(f.state, schema.marks[markName]), false);
      assert.equal(f.state.doc.textContent, before.textContent);
      if (!f.state.selection.empty) { assert.equal(f.undo(), true); assert.equal(isMarkActive(f.state, schema.marks[markName]), true); assert.equal(f.redo(), true); }
    });
  }
}
for (const level of [1, 2, 3, 4, 5, 6]) {
  for (const context of ['paragraph', 'multiple', 'list', 'nested list', 'quote']) {
    test(`heading ${level}: ${context}`, () => {
      const f = fixture(context === 'list' ? [list(li('Alpha'), li('Beta'))] : context === 'nested list' ? [list(li('Outer', null, [list(li('Alpha'))]))] : context === 'quote' ? [quote(p('Alpha'))] : undefined);
      const paragraphs = blocks(f.state, 'paragraph');
      const selected = context === 'nested list' ? paragraphs[1] : paragraphs[0];
      f.select(selected.pos + 1, context === 'multiple' ? paragraphs[1].pos + 5 : selected.pos + 3);
      const before = f.state.doc;
      assert.equal(f.apply('heading', { level }), true);
      assert.ok(blocks(f.state, 'heading').length >= 1);
      assert.equal(f.state.doc.textContent, before.textContent);
      assert.equal(f.undo(), true); assert.ok(f.state.doc.eq(before)); assert.equal(f.redo(), true);
      assert.equal(f.apply('heading', { level }), true);
      assert.equal(blocks(f.state, 'heading').length, 0);
    });
  }
}
for (const action of ['unordered-list', 'ordered-list', 'task-list']) {
  for (const context of ['paragraph', 'multiple', 'empty', 'list', 'nested list', 'quote', 'heading']) {
    test(`${action}: ${context}, content and undo`, () => {
      const f = fixture(context === 'empty' ? [p('')] : context === 'list' ? [list(li('Alpha', true), li('Beta'))] : context === 'nested list' ? [list(li('Outer', null, [list(li('Alpha', true))]))] : context === 'quote' ? [quote(p('Alpha'))] : context === 'heading' ? [schema.nodes.heading.create({ level: 2 }, text('Alpha', ['strong']))] : undefined);
      const paragraphs = blocks(f.state, context === 'heading' ? 'heading' : 'paragraph');
      const selected = context === 'nested list' ? paragraphs[1] : paragraphs[0];
      f.select(selected.pos + 1, context === 'multiple' ? paragraphs[1].pos + 5 : selected.pos + 1);
      const before = f.state.doc;
      assert.equal(f.apply(action), true); assert.equal(f.state.doc.textContent, before.textContent);
      assert.equal(f.undo(), true); assert.ok(f.state.doc.eq(before)); assert.equal(f.redo(), true); f.state.doc.check();
    });
  }
}
for (const action of ['blockquote', 'callout-note', 'callout-warning', 'callout-info', 'callout-success', 'code-block', 'clear-format']) {
  for (const context of ['paragraph', 'multiple', 'empty', 'list', 'nested list', 'quote', 'heading', 'code', 'table']) {
    test(`${action}: ${context}, schema and undo`, () => {
      const f = fixture(context === 'empty' ? [p('')] : context === 'list' ? [list(li('Alpha'), li('Beta'))] : context === 'nested list' ? [list(li('Outer', null, [list(li('Alpha'))]))] : context === 'quote' ? [quote(p('Alpha'))] : context === 'heading' ? [schema.nodes.heading.create({ level: 2 }, text('Alpha', ['strong']))] : context === 'code' ? [schema.nodes.code_block.create(null, text('Alpha'))] : context === 'table' ? [schema.nodes.table.create(null, schema.nodes.table_row.create(null, schema.nodes.table_cell.create(null, p('Alpha'))))] : undefined);
      const paragraphs = blocks(f.state, context === 'heading' ? 'heading' : context === 'code' ? 'code_block' : 'paragraph');
      const selected = context === 'nested list' ? paragraphs[1] : paragraphs[0];
      f.select(selected.pos + 1, context === 'multiple' ? paragraphs[1].pos + 5 : selected.pos + 1);
      const before = f.state.doc;
      const handled = f.apply(action);
      if (!handled) assert.ok(f.state.doc.eq(before));
      if (!f.state.doc.eq(before)) { assert.equal(f.undo(), true); assert.ok(f.state.doc.eq(before)); assert.equal(f.redo(), true); f.state.doc.check(); }
      const plain = f.state.doc.textContent.replace(/\[!(NOTE|WARNING|INFO|SUCCESS)\] ?/g, '');
      assert.equal(plain, before.textContent);
    });
  }
}

test('clear formatting across headings, lists, quotes, and ordinary paragraphs', () => {
  const f = fixture([schema.nodes.heading.create({ level: 2 }, text('Heading', ['strong'])), list(li('Alpha'), li('Beta')), quote(p('[!NOTE] Gamma')), p('End', ['emphasis'])]);
  f.select(1, f.state.doc.content.size - 1);
  assert.equal(f.apply('clear-format'), true);
  assert.equal(blocks(f.state, 'heading').length, 0);
  assert.equal(blocks(f.state, 'bullet_list').length, 0);
  assert.equal(blocks(f.state, 'blockquote').length, 0);
  assert.equal(f.state.doc.textContent, 'HeadingAlphaBetaGammaEnd');
});

for (const action of ['unordered-list', 'ordered-list', 'task-list']) {
  test(`${action}: a mixed paragraph/list selection produces one flat list`, () => {
    const f = fixture([p('Before'), list(li('Alpha'), li('Beta')), p('After')]);
    f.select(1, f.state.doc.content.size - 1);
    const before = f.state.doc;
    assert.equal(f.apply(action), true);
    assert.equal(f.state.doc.childCount, 1);
    assert.equal(f.state.doc.firstChild.childCount, 4);
    assert.equal(blocks(f.state, 'list_item').length, 4);
    assert.equal(f.state.doc.textContent, before.textContent);
    assert.equal(f.undo(), true); assert.ok(f.state.doc.eq(before));
  });
}
