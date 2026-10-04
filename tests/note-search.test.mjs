import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { Schema } from '@milkdown/kit/prose/model';
import { EditorState, TextSelection } from '@milkdown/kit/prose/state';
import { history, undo, redo } from '@milkdown/kit/prose/history';
const temp = await mkdtemp(path.join(fileURLToPath(new URL('../node_modules/', import.meta.url)), '.note-search-tests-'));
const source = await readFile(new URL('../src/renderer/src/editor/search-plugin.ts', import.meta.url), 'utf8');
await writeFile(path.join(temp, 'search.mjs'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { createSearchStatePlugin, noteSearchKey, findNoteMatches, replacementFor, replaceNoteMatches } = await import(pathToFileURL(path.join(temp, 'search.mjs')).href);
await rm(temp, { recursive: true });
const schema = new Schema({ nodes: {
  doc: { content: 'block+' }, paragraph: { group: 'block', content: 'inline*' },
  heading: { group: 'block', content: 'inline*', attrs: { level: { default: 1 } } },
  blockquote: { group: 'block', content: 'block+' },
  code_block: { group: 'block', content: 'text*', marks: '', code: true },
  hardbreak: { group: 'inline', inline: true, selectable: false }, image: { group: 'inline', inline: true, attrs: { src: {} } },
  table: { group: 'block', content: 'table_row+' }, table_row: { content: 'table_cell+' }, table_cell: { content: 'paragraph' },
  text: { group: 'inline' }
}, marks: { strong: {}, emphasis: {}, inlineCode: { inclusive: false }, link: { attrs: { href: {} } } } });
const options = { caseSensitive: false, wholeWord: false, regex: false };
const text = (value, marks = []) => schema.text(value, marks.map((name) => schema.marks[name].create(name === 'link' ? { href: 'https://example.com' } : undefined)));
const p = (value, marks = []) => schema.nodes.paragraph.create(null, value ? text(value, marks) : null);
const doc = (...nodes) => schema.nodes.doc.create(null, nodes);
function fixture(document) {
  let state = EditorState.create({ schema, doc: document, plugins: [createSearchStatePlugin(), history()] });
  const dispatch = (tr) => { state = state.apply(tr); state.doc.check(); };
  return {
    get state() { return state; },
    get search() { return noteSearchKey.getState(state); },
    find(query, patch = {}, scope = null) { dispatch(state.tr.setMeta(noteSearchKey, { query, options: { ...options, ...patch }, scope, anchor: 0 }).setMeta('addToHistory', false)); },
    replace(value, all = true, preserveCase = false, editable = true) { return replaceNoteMatches({ get state() { return state; }, dispatch, editable }, value, all, preserveCase); },
    select(index) { const match = noteSearchKey.getState(state).matches[index]; dispatch(state.tr.setSelection(TextSelection.create(state.doc, match.from, match.to)).setMeta(noteSearchKey, { activeIndex: index })); },
    type(value, from, to = from) { dispatch(state.tr.insertText(value, from, to)); },
    undo() { return undo(state, dispatch); }, redo() { return redo(state, dispatch); }
  };
}

for (const [query, flags, count] of [
  ['alpha', {}, 4], ['Alpha', { caseSensitive: true }, 1], ['alpha', { wholeWord: true }, 3],
  ['alpha', { caseSensitive: true, wholeWord: true }, 1], ['Alpha|BETA', { regex: true }, 5],
  ['a.*a', { regex: true }, 1], ['[', { regex: true }, 0], ['', {}, 0], ['$', { regex: true }, 1],
  ['(?=alpha)', { regex: true }, 4], ['a', { regex: true, wholeWord: true }, 0], ['missing', {}, 0]
]) {
  test(`matching ${JSON.stringify(query)} ${JSON.stringify(flags)}`, () => {
    const result = findNoteMatches(doc(p('alpha Alpha ALPHA alphabet beta')), query, { ...options, ...flags });
    assert.equal(result.matches.length, count);
    assert.equal(Boolean(result.error), query === '[' && flags.regex === true);
    for (const match of result.matches) assert.equal(doc(p('alpha Alpha ALPHA alphabet beta')).textBetween(match.from, match.to), match.text);
  });
}

test('literal search escapes regex punctuation', () => {
  const result = findNoteMatches(doc(p('a.b aXb [x] $+')), 'a.b', options);
  assert.equal(result.matches.length, 1); assert.equal(result.matches[0].text, 'a.b');
  assert.equal(findNoteMatches(doc(p('[x]')), '[x]', options).matches.length, 1);
});
test('Unicode words, accented characters, and emoji have correct positions', () => {
  const document = doc(p('বাংলা বাংলা_নাম café cafeteria 😀😀'));
  assert.equal(findNoteMatches(document, 'বাংলা', { ...options, wholeWord: true }).matches.length, 1);
  assert.equal(findNoteMatches(document, 'café', { ...options, wholeWord: true }).matches.length, 1);
  assert.equal(findNoteMatches(document, '😀', options).matches.length, 2);
});
test('matching spans inline marks without changing the document', () => {
  const document = doc(schema.nodes.paragraph.create(null, [text('Al', ['strong']), text('ph', ['emphasis']), text('a')]));
  const result = findNoteMatches(document, 'alpha', options);
  assert.equal(result.matches.length, 1); assert.equal(result.matches[0].from, 1); assert.equal(result.matches[0].to, 6);
});
test('hidden callout markers and images are not search results', () => {
  const document = doc(schema.nodes.blockquote.create(null, p('[!NOTE] Alpha')), schema.nodes.paragraph.create(null, [text('A'), schema.nodes.image.create({ src: 'image.png' }), text('B')]));
  assert.equal(findNoteMatches(document, 'NOTE', options).matches.length, 0);
  assert.equal(findNoteMatches(document, 'Alpha', options).matches.length, 1);
  assert.equal(findNoteMatches(document, 'A.B', { ...options, regex: true }).matches.length, 0);
});
test('hard line breaks and fenced code newlines are searchable', () => {
  const document = doc(schema.nodes.paragraph.create(null, [text('Alpha'), schema.nodes.hardbreak.create(), text('Beta')]), schema.nodes.code_block.create(null, text('one\ntwo')));
  assert.equal(findNoteMatches(document, 'Alpha\nBeta', options).matches.length, 1);
  assert.equal(findNoteMatches(document, '^two$', { ...options, regex: true }).matches.length, 1);
});
test('match limit prevents partial replace-all', () => {
  const f = fixture(doc(p('a'.repeat(10001)))); f.find('a');
  assert.equal(f.search.matches.length, 10000); assert.equal(f.search.limited, true);
  assert.equal(f.replace('b'), 0); assert.equal(f.state.doc.textContent, 'a'.repeat(10001));
});
test('zero-width regex terminates even with astral characters', () => {
  const f = fixture(doc(p('😀😀'))); f.find('(?=)', { regex: true });
  assert.equal(f.search.matches.length, 3);
  f.replace('x'); assert.equal(f.state.doc.textContent, 'x😀x😀x');
});
for (const [original, replacement, expected] of [['alpha', 'beta', 'beta'], ['Alpha', 'beta', 'Beta'], ['ALPHA', 'beta', 'BETA'], ['AlPhA', 'beta', 'beta'], ['Alpha', '', '']]) {
  test(`preserve case ${original} -> ${JSON.stringify(replacement)}`, () => {
    const f = fixture(doc(p(original))); f.find('alpha');
    assert.equal(f.replace(replacement, true, true), 1); assert.equal(f.state.doc.textContent, expected);
  });
}
for (const [pattern, replacement, expected] of [
  ['Item-(\\d+)', 'Number $1', 'Number 12'], ['(Item)-(\\d+)', '$2:$1', '12:Item'],
  ['Item-(?<id>\\d+)', '$<id>', '12'], ['Item-\\d+', '$0 / $& / $$', 'Item-12 / Item-12 / $'],
  ['(Item)-(\\d+)', '\\U$1 $2', 'ITEM 12'], ['(Item)-(\\d+)', '\\l$1 $2', 'item 12'],
  ['(Item)-(\\d+)', '$9', '$9']
]) {
  test(`regex replacement ${replacement}`, () => {
    const f = fixture(doc(p('Item-12'))); f.find(pattern, { regex: true }); f.replace(replacement);
    assert.equal(f.state.doc.textContent, expected);
  });
}
for (const mark of ['strong', 'emphasis', 'inlineCode', 'link']) {
  test(`replacing text preserves ${mark} and neighboring content`, () => {
    const f = fixture(doc(schema.nodes.paragraph.create(null, [text('Before '), text('Alpha', [mark]), text(' After')])));
    const before = f.state.doc; f.find('alpha'); assert.equal(f.replace('Beta'), 1);
    assert.equal(f.state.doc.textContent, 'Before Beta After');
    assert.equal(f.state.doc.firstChild.child(1).marks[0].type.name, mark);
    assert.equal(f.undo(), true); assert.ok(f.state.doc.eq(before)); assert.equal(f.redo(), true);
  });
}
test('replace all is one undo and consecutive replacements undo separately', () => {
  const f = fixture(doc(p('Alpha Alpha Alpha'))); const before = f.state.doc;
  f.find('alpha'); f.replace('Beta', false); const afterOne = f.state.doc;
  assert.equal(f.search.matches.length, 2); f.replace('Gamma');
  assert.equal(f.state.doc.textContent, 'Beta Gamma Gamma');
  f.undo(); assert.ok(f.state.doc.eq(afterOne)); f.undo(); assert.ok(f.state.doc.eq(before));
});
test('empty replacement removes content and leaves the note editable', () => {
  const f = fixture(doc(p('Alpha'))); f.find('Alpha'); f.replace('');
  assert.equal(f.state.doc.firstChild.type.name, 'paragraph'); assert.equal(f.state.doc.textContent, '');
});
test('selection scope follows replacement lengths', () => {
  const f = fixture(doc(p('Alpha outside'), p('Alpha Alpha inside'), p('Alpha after')));
  const from = f.state.doc.firstChild.nodeSize + 1;
  f.find('Alpha', {}, { from, to: from + 'Alpha Alpha inside'.length });
  assert.equal(f.search.matches.length, 2); f.replace('B');
  assert.equal(f.state.doc.textContent, 'Alpha outsideB B insideAlpha after');
  f.find('B', {}, f.search.scope); assert.equal(f.search.matches.length, 2);
});
test('live edits refresh counts and map the active match', () => {
  const f = fixture(doc(p('Alpha Alpha'))); f.find('Alpha'); f.select(1);
  f.type('New ', 1); assert.equal(f.search.matches.length, 2); assert.equal(f.search.activeIndex, 1);
  f.type('Alpha ', 1); assert.equal(f.search.matches.length, 3); assert.equal(f.search.activeIndex, 2);
});
test('read-only replacement is rejected', () => {
  const f = fixture(doc(p('Alpha'))); f.find('Alpha'); assert.equal(f.replace('Beta', true, false, false), 0);
  assert.equal(f.state.doc.textContent, 'Alpha');
});
test('newlines in replacement preserve paragraph and code schemas', () => {
  const f = fixture(doc(p('Alpha'), schema.nodes.code_block.create(null, text('Alpha')))); f.find('Alpha'); f.replace('one\ntwo');
  assert.equal(f.state.doc.firstChild.child(1).type.name, 'hardbreak');
  assert.equal(f.state.doc.lastChild.textContent, 'one\ntwo');
});
test('replacements in table cells retain the table', () => {
  const f = fixture(doc(schema.nodes.table.create(null, schema.nodes.table_row.create(null, [schema.nodes.table_cell.create(null, p('Alpha')), schema.nodes.table_cell.create(null, p('Alpha'))]))));
  f.find('Alpha'); assert.equal(f.replace('Beta'), 2); assert.equal(f.state.doc.firstChild.firstChild.childCount, 2);
  assert.equal(f.state.doc.textContent, 'BetaBeta');
});
