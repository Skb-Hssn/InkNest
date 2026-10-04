# Table operation audit

InkNest stores GFM Markdown tables. A table keeps one header row. Deleting that row removes its content and promotes the first remaining body row to the header; inserting before it creates a new blank header and preserves the old header as a body row. A header-only table is valid. Deleting the final row or final column removes the table and leaves the note editable.

## Operations and edge cases

| Operation | Cases checked | Expected behavior |
| --- | --- | --- |
| Insert table | Toolbar; `/table`; existing text and tables | Insert a 2×2 table, keeping surrounding content. |
| Add row before | Header, middle body, final body; header-only and single-cell tables | Insert one row; preserve header types, content, marks, and column alignment. |
| Add row after | Header, middle body, final body; header-only and single-cell tables | Insert one row, including after the final row. |
| Delete header row | Several body rows, one body row, header-only | Promote the next row; remove the table if no rows remain. |
| Delete body row | First, middle, final, only body row | Remove the selected row; allow a header-only table. |
| Add column before | First, middle, last column; header/body selection; header-only and single-column tables | Insert a column throughout the table with matching header/body cells. |
| Add column after | First, middle, last column; header/body selection; header-only and single-column tables | Insert a column throughout the table, including after the final column. |
| Delete column | First, middle, last, only column | Remove the column across every row; remove the table when no columns remain. |
| Delete whole table | Cell menu, toolbar, node selection; surrounded by paragraphs or the only block | Remove only that table and keep an editable paragraph when needed. |
| Multi-cell selection | Multiple rows/columns, all rows/columns | Delete the complete selected rows/columns; selecting all removes the table. |
| Cell menu targeting | Caret elsewhere, pointer crosses another cell, typing shifts positions, final cell in a long table | Apply the action to the cell that opened the menu. |
| Cell editing | Header/body text, empty cells, deleting selected text | Keep the table structure when clearing text. |
| Keyboard navigation | Tab, Shift+Tab, Tab in final cell, Ctrl+Enter | Move between cells; append a row at the end; exit into a paragraph. |
| Undo/redo | Every structural operation, consecutive commands | Undo each structural edit individually; redo restores content and structure. |
| Save/reopen | Header-only tables, structural edits, empty notes | Saved Markdown reconstructs the same table; empty notes remain empty. |
| Commands outside a table | Row/column insertion/deletion, whole-table deletion | Leave the document unchanged. |

## Bugs found and repaired

1. **Whole-table deletion was missing from the UI.** Added a cell-menu action and toolbar button.
2. **Deleting the header increased the row count.** Generic table transactions conflicted with Milkdown's distinct header-row schema. Structural commands now preserve GFM header/body node types and promote or demote rows explicitly.
3. **Deleting the final column was a no-op.** The upstream delete-column command refuses to remove every column. The shared command removes the table at that boundary.
4. **Deleting the only body row recreated a row.** The schema required at least one body row. It now accepts header-only tables, which also survive saving and reopening.
5. **Row insertion near the header could use incompatible row/cell types.** The toolbar and cell menu now use the same structural commands, preserving content, inline marks, and alignment.
6. **An open cell menu could change targets or retain stale document positions.** The menu stays attached to its original DOM cell and resolves its position at execution time.
7. **Empty notes could not save.** The IPC save handler applied non-empty-string validation to Markdown content. It now accepts empty/whitespace-only strings, while continuing to reject non-string content. This fixes persistence and normal closing after deleting a table-only note.

8. **Tab in the final cell left the table instead of extending it.** Keyboard navigation now appends a body row and places the caret in its first cell; Shift+Tab keeps its existing navigation behavior.

The editor does not expose merged-cell operations: GFM has no row/column spans. Structural commands reject nonrectangular or merged-cell tables rather than damaging their content.

## Verification

- `node tests/table-commands.test.mjs`: 75 command-level cases check schema validity, rectangular shape, header/body types, content and formatting retention, alignment, selection boundaries, and undo/redo.
- `npx playwright test tests/e2e/table-operations.spec.ts`: 32 Electron UI cases check the operations above, including autosave and reopening, plus rejection of invalid save content. Renderer exceptions fail the tests.
- `npx playwright test tests/e2e/note-tabs.spec.ts`: all four note-tab regression cases pass.
- `npm run check` and `npm run build`: repository checks, existing unit suites, and TypeScript/build validation.

The initial UI reproduction failed on all three reported operations: header deletion produced four rows instead of two; final-column deletion left the table intact; whole-table deletion had no menu action.
