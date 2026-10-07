# Text formatting operation audit

This audit covers text-formatting controls, their keyboard shortcuts, Markdown input rules, and formatting slash commands. Images and table structure are separate features; table cells are included as a formatting context. Equation controls and their interactions with formatting are covered in [the math audit](math-audit.md).

## Operations and edge cases

| Operation | Cases checked | Expected behavior |
| --- | --- | --- |
| Bold | Partial text, full paragraph, several blocks, mixed marked/plain text, empty paragraph, caret typing, Unicode, combined marks | Apply to the selection; mixed selections become uniformly bold; repeat removes bold. At a caret, toggle subsequent typing. Preserve other marks. |
| Italic | Same inline selection matrix as bold | Apply/remove italic without replacing text or other marks. |
| Strikethrough | Same inline selection matrix; Markdown `~~text~~` | Apply/remove strikethrough; preserve content and other marks. |
| Inline code | Same inline selection matrix; typing after enabling at a caret; bold plus code; Markdown backticks | Toggle code; explicit typing mode continues until disabled or the caret moves. Existing code spans retain their closed end boundary. |
| Inline toolbar state | Caret, stored marks, mixed selections, combining marks, clearing at a caret | Buttons reflect effective typing marks or formatting shared by all eligible selected text. Stored-mark changes update the toolbar immediately. |
| H1–H6 | Each level, multiple paragraphs, marked text, ordinary and nested list items, quotes, repeated clicks, save/reopen | Convert selected blocks, preserving text and inline marks. Clicking the current level returns them to paragraphs. Lift list items as needed to satisfy the schema. |
| Bullet list | Single/multiple/empty paragraphs, headings, mixed paragraphs plus existing list items, nested lists, partial existing-list selection | Create one item per paragraph. Convert list type without losing content. Repeating the current type lifts selected items. |
| Numbered list | Same list matrix; bullet/task conversion; undo/redo | Create an ordered list; preserve unselected list items and numbering attributes when splitting a list. |
| Task list | Multiple selected paragraphs/items, bullet/numbered conversion, checked item, save/reopen, Enter, empty-item exit | Every selected item becomes a task. Existing checked states survive conversion to tasks. New tasks after Enter start unchecked. |
| List indentation | Tab, Shift+Tab, nested item converted to a heading | Indent/outdent without deleting text. Heading conversion lifts the item out of all enclosing lists. |
| Quote | Single/multiple/empty blocks, repeated toggle, existing quote, list/heading/code contexts | Wrap selected content; repeating removes the selected quote wrapper without nesting another quote. |
| Note/Warning/Info/Success callouts | All four types, multiple paragraphs, headings, existing quote, changing type, repeated toggle, undo, typing | Preserve selected content. Change the marker rather than nesting callouts. Repeating a type unwraps selected content, including standalone markers before headings. |
| Fenced code block | Single/multiple/empty blocks, heading/list/quote contexts, language selection, custom language, repeated toggle | Preserve text, convert back to paragraphs on repeat, retain the selected language while editing and saving. Inline styling is removed by the code-block schema; undo restores it. |
| Code editing | Enter indentation, Tab at a caret, selected multiline Tab/Shift+Tab, Copy | Carry line indentation; indent/dedent selected lines without replacing their text. Copy only code content. |
| Links | Add to formatted text; edit URL; rename; remove; caret within a link split by bold/italic; link/plain selection; validation, cancel, undo | Preserve existing marks when adding/editing/removing. Edit the complete contiguous logical link. Mixed selections create a new link. Renaming preserves marks common to the original text. |
| Clear formatting | Selected inline marks, caret typing, headings, code blocks, lists, nested lists, quotes/callouts, mixed block selections, unselected neighbors | Remove selected marks, return selected blocks to paragraphs, lift selected wrappers and remove callout markers. At a caret, reset subsequent typing marks and the current block format. |
| Divider | Insert at text boundary, surrounding text, undo/redo, save | Insert a horizontal rule and keep adjacent content editable. |
| Hard line break | Shift+Enter within text, save | Insert a hard break inside the paragraph. |
| Keyboard parity | Mod+B/I/E, Mod+Shift+X, Mod+Alt+X, Mod+Alt+1–6/7/8/C, Mod+Shift+B, Mod+backslash | Use the same formatting logic as toolbar commands. Existing paragraph, list indentation, and history bindings remain available. |
| Markdown typing | Bold, italic, strikethrough, inline code, heading, bullet/numbered list, quote | Recognize delimiters/prefixes and construct the expected schema nodes/marks. |
| Slash formatting | `/heading`, `/code`, `/todo`, `/note`, `/warning`, `/info`, `/success` | Format the command paragraph, keep following content, and allow typing in the result. |
| Table cells | Inline formatting, Clear formatting, incompatible heading/code/quote/list requests | Format inline text while retaining the table. Paragraph-only cell schema rejects incompatible blocks without changing content. |
| Code-only schema contexts | Inline mark operations and link insertion in fenced code | Keep code literal; reject unsupported marks/links. |
| History | Apply/remove, list conversions, block lifting, callouts, links, consecutive commands | Each formatting command is one undo operation, including commands requiring multiple structural steps. Redo restores the result. |
| Persistence | All heading levels, tasks, combined inline marks, links, code language, dividers, hard breaks, Unicode, frontmatter and CRLF | Serialize valid Markdown that reopens with the same supported formatting; preserve frontmatter and line endings. |

## Bugs found and fixed

1. Inline code could not be enabled at a caret. The original command rejected empty selections. The shared mark command supports stored marks, and explicit code typing mode now persists across characters.
2. Mixed inline selections removed formatting from the already-formatted text instead of applying it uniformly. Mark toggles now remove only when all eligible text has the mark.
3. Toolbar state used any mark in a selection and ignored stored-mark-only changes. It now checks shared formatting and observes effective typing marks.
4. Heading buttons could not toggle back to paragraphs. All six levels now toggle, and nested list items are lifted sufficiently before conversion.
5. Selected paragraphs became one list item. Schema-list wrapping creates separate items; mixed paragraph/list selections first lift selected existing items to avoid unintended nesting.
6. Task formatting reached only the current item. It now applies to every selected item and supports list-type conversion while preserving checked states.
7. Enter after a completed task copied the checked state into the new task. New tasks start unchecked.
8. Quote formatting nested wrappers rather than toggling. Repeating now lifts the selected quote content.
9. Callout insertion replaced selected text. Callouts now wrap existing content, support type changes, and remove standalone marker paragraphs when toggling around headings.
10. Clear formatting only removed inline marks. It now clears block formats and selected list/quote wrappers, including selections across mixed block types, while preserving unselected content.
11. Code-block formatting did not toggle back to plain text. The same block conversion command now handles apply and remove.
12. Adding and editing links stripped other marks. Link transactions preserve formatting, and link lookup expands across adjacent text nodes split by other marks. A mixed link/plain selection no longer edits an unrelated partial range.
13. Tab replaced selected code with spaces, and Shift+Tab inserted additional indentation. Selected lines now indent/dedent without losing code.
14. Existing code languages outside the preset dropdown appeared as Plain text. The dropdown now displays the actual custom language and keeps it during edits.
15. Several keyboard bindings used upstream commands with different behavior from the repaired toolbar. They now share the formatting command implementation.
16. Toolbar actions reported success when the schema rejected an operation. They now report an unsupported selection; link insertion keeps the dialog open with a useful error.

17. Native Home/End caret movement could reach editor state after the next key command, intermittently preventing keyboard block deletion. Keyboard handling now synchronizes text selections with the native selection before applying commands, while retaining node and cell selections.

## Verification

- `node tests/formatting-commands.test.mjs`: 142 command-level cases exercise the selection/context matrix, schema validity, text preservation, active marks, and undo/redo. The test schema mirrors installed Milkdown/GFM constraints; Electron checks use the actual schema and plugins.
- `npx playwright test tests/e2e/text-formatting.spec.ts`: 73 Electron UI cases cover the operation matrix, real controls, keyboard/input rules, and representative save/reopen paths. Renderer exceptions fail the suite.
- Existing table-operation and note-tab Electron suites are regression checks (32 and 4 cases).
- `npm run check` and `npm run build` validate the repository unit suites, TypeScript, and production build.

Save/reopen checks explicitly reopen the note after a renderer reload, since a reload clears the in-memory open-tab state. This avoids mistaking an unopened note for lost formatting.
