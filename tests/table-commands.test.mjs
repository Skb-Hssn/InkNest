import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { Schema } from "@milkdown/kit/prose/model";
import { EditorState, TextSelection, NodeSelection } from "@milkdown/kit/prose/state";
import { CellSelection, TableMap, tableNodes } from "@milkdown/kit/prose/tables";
import { history, undo, redo } from "@milkdown/kit/prose/history";

const temp = await mkdtemp(path.join(fileURLToPath(new URL("../node_modules/", import.meta.url)), ".table-tests-"));
const source = await readFile(new URL("../src/renderer/src/editor/table-commands.ts", import.meta.url), "utf8");
await writeFile(path.join(temp, "commands.mjs"), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const { runTableAction, moveTableCell } = await import(pathToFileURL(path.join(temp, "commands.mjs")).href);
await rm(temp, { recursive: true });

const specs = tableNodes({ tableGroup: "block", cellContent: "paragraph", cellAttributes: { alignment: { default: "left" } } });
const schema = new Schema({
  nodes: {
    doc: { content: "block+" }, paragraph: { group: "block", content: "inline*" }, text: { group: "inline" },
    table: { ...specs.table, content: "table_header_row table_row*" },
    table_header_row: { ...specs.table_row, content: "table_header*" },
    table_row: { ...specs.table_row, content: "table_cell*" },
    table_cell: specs.table_cell, table_header: specs.table_header
  },
  marks: { strong: {} }
});

function fixture(height = 3, width = 3, surrounded = true) {
  const rows = Array.from({ length: height }, (_, row) => schema.nodes[row === 0 ? "table_header_row" : "table_row"].create(null,
    Array.from({ length: width }, (_, col) => schema.nodes[row === 0 ? "table_header" : "table_cell"].create({ alignment: ["left", "center", "right"][col % 3] },
      schema.nodes.paragraph.create(null, schema.text(`${row}:${col}`, [schema.marks.strong.create()]))))));
  const table = schema.nodes.table.create(null, rows);
  const paragraph = (text) => schema.nodes.paragraph.create(null, schema.text(text));
  const doc = schema.nodes.doc.create(null, surrounded ? [paragraph("Before"), table, paragraph("After")] : [table]);
  const from = surrounded ? doc.firstChild.nodeSize : 0;
  let state = EditorState.create({ schema, doc, plugins: [history()] });
  return {
    get state() { return state; }, from,
    select(row, col, endRow = row, endCol = col, cells = false) {
      const node = state.doc.nodeAt(from);
      const map = TableMap.get(node);
      const first = from + 1 + map.positionAt(row, col, node);
      const last = from + 1 + map.positionAt(endRow, endCol, node);
      state = state.apply(state.tr.setSelection(cells ? CellSelection.create(state.doc, first, last) : TextSelection.create(state.doc, first + 2)));
    },
    apply(action) { return runTableAction(state, (tr) => { state = state.apply(tr); }, action); },
    navigate(direction) { return moveTableCell(state, (tr) => { state = state.apply(tr); }, direction); },
    undo() { return undo(state, (tr) => { state = state.apply(tr); }); },
    redo() { return redo(state, (tr) => { state = state.apply(tr); }); },
    nodeSelect() { state = state.apply(state.tr.setSelection(NodeSelection.create(state.doc, from))); }
  };
}
function tables(state) { const nodes = []; state.doc.descendants((node) => { if (node.type.name === "table") nodes.push(node); }); return nodes; }
function valid(state) {
  state.doc.check();
  for (const table of tables(state)) {
    const map = TableMap.get(table);
    assert.equal(map.problems, null);
    assert.equal(table.firstChild.type.name, "table_header_row");
    table.forEach((row, _, index) => {
      assert.equal(row.childCount, map.width);
      assert.equal(row.type.name, index === 0 ? "table_header_row" : "table_row");
      row.forEach((cell, _, col) => {
        assert.equal(cell.type.name, index === 0 ? "table_header" : "table_cell");
        assert.equal(cell.attrs.alignment, table.firstChild.child(col).attrs.alignment);
      });
    });
  }
}

for (const action of ["add-row-before", "add-row-after", "add-column-before", "add-column-after", "delete-row", "delete-column", "delete-table"]) {
  for (const [height, width] of [[3, 3], [2, 1], [1, 3], [1, 1]]) {
    for (const [row, col] of Array.from(new Map([[0, 0], [Math.floor(height / 2), Math.floor(width / 2)], [height - 1, width - 1]].map((cell) => [cell.join(","), cell])).values())) {
      test(`${action} at ${row},${col} in ${height}x${width}`, () => {
        const f = fixture(height, width);
        f.select(row, col);
        const before = f.state.doc;
        assert.equal(f.apply(action), true);
        valid(f.state);
        assert.equal(f.state.doc.firstChild.textContent, "Before");
        assert.equal(f.state.doc.lastChild.textContent, "After");
        const table = tables(f.state)[0];
        if (action === "delete-table" || (action === "delete-row" && height === 1) || (action === "delete-column" && width === 1)) assert.equal(table, undefined);
        else {
          const expectedHeight = height + (action.startsWith("add-row") ? 1 : action === "delete-row" ? -1 : 0);
          const expectedWidth = width + (action.startsWith("add-column") ? 1 : action === "delete-column" ? -1 : 0);
          assert.equal(table.childCount, expectedHeight);
          assert.equal(table.firstChild.childCount, expectedWidth);
          for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) {
            const removed = (action === "delete-row" && r === row) || (action === "delete-column" && c === col);
            let found = false;
            table.descendants((node) => { if (node.isText && node.text === `${r}:${c}`) { found = true; assert.equal(node.marks[0].type.name, "strong"); } });
            assert.equal(found, !removed, `content ${r}:${c}`);
          }
        }
        assert.equal(f.undo(), true);
        assert.equal(f.state.doc.eq(before), true);
        assert.equal(f.redo(), true);
        valid(f.state);
      });
    }
  }
}

for (const action of ["delete-row", "delete-column"]) {
  test(`${action} supports a selection of multiple cells`, () => {
    const f = fixture(4, 4);
    f.select(0, 0, 1, 1, true);
    assert.equal(f.apply(action), true);
    valid(f.state);
    const table = tables(f.state)[0];
    assert.equal(action === "delete-row" ? table.childCount : table.firstChild.childCount, 2);
  });
  test(`${action} on all cells deletes the table`, () => {
    const f = fixture();
    f.select(0, 0, 2, 2, true);
    assert.equal(f.apply(action), true);
    assert.equal(tables(f.state).length, 0);
    valid(f.state);
  });
}

test("deleting the only block leaves an editable paragraph, and supports undo", () => {
  const f = fixture(1, 1, false);
  f.select(0, 0);
  assert.equal(f.apply("delete-table"), true);
  assert.equal(f.state.doc.firstChild.type.name, "paragraph");
  assert.equal(f.state.selection.$from.parent.type.name, "paragraph");
  assert.equal(f.undo(), true);
  valid(f.state);
});

test("delete a node-selected table", () => {
  const f = fixture();
  f.nodeSelect();
  assert.equal(f.apply("delete-table"), true);
  assert.equal(tables(f.state).length, 0);
});

test("commands outside a table are no-ops", () => {
  const f = fixture();
  const before = f.state.doc;
  for (const action of ["delete-table", "delete-row", "delete-column", "add-row-before", "add-row-after", "add-column-before", "add-column-after"]) assert.equal(f.apply(action), false);
  assert.equal(f.state.doc.eq(before), true);
});

test("consecutive operations undo individually", () => {
  const f = fixture();
  f.select(1, 1);
  f.apply("add-row-after");
  const afterRow = f.state.doc;
  f.apply("add-column-after");
  assert.equal(f.undo(), true);
  assert.equal(f.state.doc.eq(afterRow), true);
  assert.equal(f.undo(), true);
  assert.equal(tables(f.state)[0].childCount, 3);
});

for (const [height, width] of [[3, 3], [1, 3], [1, 1]]) {
  test(`Tab from final cell in ${height}x${width} appends one row and selects its first cell`, () => {
    const f = fixture(height, width);
    f.select(height - 1, width - 1);
    const before = f.state.doc;
    assert.equal(f.navigate(1), true);
    valid(f.state);
    const table = tables(f.state)[0];
    assert.equal(table.childCount, height + 1);
    const first = f.from + 1 + TableMap.get(table).positionAt(height, 0, table) + 2;
    assert.equal(f.state.selection.from, first);
    assert.equal(f.undo(), true);
    assert.equal(f.state.doc.eq(before), true);
  });
}

test("Tab and Shift+Tab move between cells without changing the table", () => {
  const f = fixture();
  f.select(0, 0);
  const before = f.state.doc;
  const start = f.state.selection.from;
  assert.equal(f.navigate(1), true);
  assert.ok(f.state.selection.from > start);
  assert.equal(f.navigate(-1), true);
  assert.equal(f.state.selection.from, start);
  assert.equal(f.state.doc.eq(before), true);
});
