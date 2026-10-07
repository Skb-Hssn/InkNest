import type { Node } from "@milkdown/kit/prose/model";
import { closeHistory } from "@milkdown/kit/prose/history";
import { NodeSelection, TextSelection, type EditorState, type Transaction } from "@milkdown/kit/prose/state";
import { goToNextCell, isInTable, selectedRect, TableMap } from "@milkdown/kit/prose/tables";

export type TableAction =
  | "delete-table"
  | "delete-row"
  | "delete-column"
  | "add-row-before"
  | "add-row-after"
  | "add-column-before"
  | "add-column-after";

/** Tab advances cells and creates a new row when it reaches the final cell. */
export function moveTableCell(state: EditorState, dispatch: ((transaction: Transaction) => void) | undefined, direction: 1 | -1) {
  if (goToNextCell(direction)(state, dispatch)) return true;
  if (direction === -1 || !isInTable(state)) return false;
  const { tableStart, bottom } = selectedRect(state);
  return runTableAction(state, dispatch ? (tr) => {
    const table = tr.doc.nodeAt(tableStart - 1)!;
    const position = tableStart + TableMap.get(table).positionAt(bottom, 0, table) + 2;
    tr.setSelection(TextSelection.near(tr.doc.resolve(position)));
    dispatch(tr);
  } : undefined, "add-row-after");
}

/** GFM has one header row; structural edits must preserve its row/cell types. */
export function runTableAction(
  state: EditorState,
  dispatch: ((transaction: Transaction) => void) | undefined,
  action: TableAction
) {
  if (state.selection instanceof NodeSelection && state.selection.node.type.name === "table") {
    if (action !== "delete-table") return false;
    return removeTable(state, dispatch, state.selection.from, state.selection.node);
  }
  if (!isInTable(state)) return false;

  const rect = selectedRect(state);
  const { table, tableStart } = rect;
  const from = tableStart - 1;
  if (action === "delete-table" ||
    (action === "delete-column" && rect.left === 0 && rect.right === rect.map.width) ||
    (action === "delete-row" && rect.top === 0 && rect.bottom === rect.map.height)) {
    return removeTable(state, dispatch, from, table);
  }

  // Markdown tables are rectangular, without merged cells. Retain every
  // existing cell node (including inline marks and alignment) during edits.
  const rows: Node[][] = [];
  table.forEach((row) => {
    const cells: Node[] = [];
    row.forEach((cell) => cells.push(cell));
    rows.push(cells);
  });
  if (rows.some((row) => row.length !== rect.map.width || row.some((cell) =>
    cell.attrs.colspan !== 1 || cell.attrs.rowspan !== 1
  ))) return false;

  let targetRow = rect.top;
  let targetColumn = rect.left;
  const blankCell = (column: number, header: boolean) => {
    const type = header ? state.schema.nodes.table_header : state.schema.nodes.table_cell;
    return type.createAndFill({ alignment: rows[0][column]?.attrs.alignment ?? "left" })!;
  };

  switch (action) {
    case "delete-row":
      rows.splice(rect.top, rect.bottom - rect.top);
      break;
    case "delete-column":
      rows.forEach((row) => row.splice(rect.left, rect.right - rect.left));
      break;
    case "add-row-before":
    case "add-row-after": {
      targetRow = action === "add-row-before" ? rect.top : rect.bottom;
      rows.splice(targetRow, 0, Array.from({ length: rect.map.width }, (_, col) => blankCell(col, false)));
      break;
    }
    case "add-column-before":
    case "add-column-after":
      targetColumn = action === "add-column-before" ? rect.left : rect.right;
      rows.forEach((row, index) => row.splice(targetColumn, 0, blankCell(rect.left, index === 0)));
      break;
  }

  const rowNodes = rows.map((cells, index) => {
    const rowType = index === 0 ? state.schema.nodes.table_header_row : state.schema.nodes.table_row;
    const cellType = index === 0 ? state.schema.nodes.table_header : state.schema.nodes.table_cell;
    return rowType.create(null, cells.map((cell) =>
      cell.type === cellType ? cell : cellType.create(cell.attrs, cell.content, cell.marks)
    ));
  });
  const updatedTable = table.type.create(table.attrs, rowNodes, table.marks);
  if (!dispatch) return true;

  const tr = state.tr.replaceWith(from, from + table.nodeSize, updatedTable);
  targetRow = Math.min(targetRow, rowNodes.length - 1);
  targetColumn = Math.min(targetColumn, rowNodes[targetRow].childCount - 1);
  let position = from + 1;
  for (let row = 0; row < targetRow; row += 1) position += rowNodes[row].nodeSize;
  position += 1;
  for (let col = 0; col < targetColumn; col += 1) position += rowNodes[targetRow].child(col).nodeSize;
  tr.setSelection(TextSelection.near(tr.doc.resolve(position + 2)));
  dispatch(closeHistory(tr).scrollIntoView());
  return true;
}

function removeTable(state: EditorState, dispatch: ((transaction: Transaction) => void) | undefined, from: number, table: Node) {
  if (dispatch) {
    const tr = state.tr.delete(from, from + table.nodeSize);
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(from, tr.doc.content.size))));
    dispatch(closeHistory(tr).scrollIntoView());
  }
  return true;
}
