# Math in notes

InkNest renders LaTeX math with KaTeX. The renderer, styles, and fonts are bundled with the app, so equations work offline. Markdown files contain the original equation source, never generated HTML.

## Writing and editing

- Inline: type `$E = mc^2$`, or use **Inline math** in the toolbar. Closing the fence renders the equation.
- Display: type `$$` on an otherwise empty paragraph and press Enter, use **Display math**, or type `/math` and press Enter. The source field accepts multiple lines.
- Click a rendered equation to edit its LaTeX. Changes preview and autosave as you type. **Done**, Escape, or Ctrl/Cmd+Enter returns to the note; Enter also finishes inline editing. Escape keeps changes.
- In display source, Enter adds a line and Tab inserts two spaces. Ctrl/Cmd+Z undoes source edits; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes them. **Delete equation** removes the entire equation and supports undo.
- For existing files and pasted Markdown, use display delimiters on separate lines:

```markdown
Inline: $E = mc^2$.

$$
\begin{aligned}
a &= b + c \\
d &= e - f
\end{aligned}
$$
```

Invalid or unsupported LaTeX remains visible as editable source with an error message. Empty equations remain editable placeholders. Use `\$` for literal dollar signs in prose; code spans and code blocks remain literal. Inline source line breaks normalize to spaces. When an equation contains dollar signs, inserting/editing through the source field lets the serializer choose a safe delimiter length. Adjacent inline equations gain a separating space on save so their fences cannot merge.

Inline equations work in headings, lists, callouts, links, and table cells. Display insertion is rejected in positions that require a paragraph, including GFM table cells and a list item's first paragraph. Applying code formatting across an equation is rejected to prevent losing its source. Note Find/Replace searches surrounding prose, not equation source; edit LaTeX through its source field.

KaTeX supports mathematical notation, not full LaTeX documents. HTML/link/image trust commands are disabled, macro expansion and sizing are bounded, and macros do not leak between equations.

## Operation and edge-case audit

Automated coverage: `tests/math.test.mjs` and `tests/e2e/math.spec.ts`.

| Operation | Corner cases checked | Result |
| --- | --- | --- |
| Load and view | Inline/display; fractions, roots, sums, integrals, Greek letters, matrices, Unicode; bundled fonts and MathML | Pass |
| Type inline math | Surrounding text, subscripts, backslashes, braces, Markdown-like emphasis and punctuation inside LaTeX | Pass |
| Create display math | `$$` + Enter, toolbar, `/math`; multiline aligned equations | Pass |
| Edit source | Live preview, autosave before closing, source undo/redo, Enter, Tab, Escape, Done | Pass |
| Insert from toolbar | Inline/display; selected text; surrounding prose retained; inserted equation selected | Pass |
| Save and reopen | Tab switching, renderer reload, immediate switching during edits, BOM/frontmatter/CRLF | Pass |
| Parse/serialize | Whitespace, special characters, literal dollars, display metadata, internal fence collisions, repeated round trips | Pass |
| Adjacent equations | Touching inline atoms serialize as separate equations | Pass |
| Empty equations | Inline/display placeholders survive save, reopen, and subsequent editing | Pass |
| Invalid equations | Missing braces, unknown commands, recursive macros; source retained and correctable | Pass |
| Clipboard | Plain Markdown paste; rendered content copy/paste preserves editable source | Pass |
| Literal text | Escaped currency, incomplete inline fences, inline code and fenced code remain literal | Pass |
| Nested content | Headings, lists, task lists, callouts, links, table headers and cells | Pass |
| Incompatible selections | Cross-block insertion, code contexts, display math inside a table, mixed prose/equation selection | Pass |
| Formatting and search | Code formatting cannot discard math; Find/Replace leaves LaTeX unchanged | Pass |
| Delete and undo | Inline/display deletion, undo/redo, deleting a math-only note leaves it editable | Pass |
| Layout | Long display equations scroll; light and dark colors inherit correctly | Pass |
| Untrusted content | HTML-like source, unsafe links/images, recursive macros, isolated macro definitions | Pass |

## Bugs found and fixed

- Display insertion selected a nearby paragraph instead of the new equation, so its source editor did not open.
- Updating an inline atom moved the selection and closed its source controls.
- Button focus could close the equation controls before the delete click ran.
- Milkdown's trailing-space serializer shortcut left literal dollars unescaped, changing prose into math on reopening.
- Adjacent inline fences merged into one equation during Markdown parsing.
- Code formatting could silently discard an equation's stored source.
- Markdown input rules could rewrite emphasis-like characters while LaTeX was still being typed.

Run `npm run check`, `npm run build`, and `npx playwright test tests/e2e/math.spec.ts`. Electron UI tests require an available display.
