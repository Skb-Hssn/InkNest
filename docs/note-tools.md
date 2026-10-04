# Note layout and Find/Replace

New notes have an empty body and are saved as empty files. Their initial filename is `Untitled.md`, with a number added when that name already exists.

The **Full width** button above the editor switches between the normal reading width and the available writing area. **Show heading minimap** toggles the outline on the right. Both preferences persist across restarts and are also available in Settings.

The outline floats in a rounded card on the right, with an independently scrollable list of headings H1–H6. It follows the current section as the note scrolls and updates when headings change. Click a heading to move to it. Use the card's close button or **Show heading minimap** to hide it; opening and closing animate smoothly and respect reduced-motion preferences.

Drag anywhere along the card's left edge, including the corners, or use the visible grip to resize it. Its width is remembered across notes and restarts, and it adapts to smaller windows. Double-click the resize handle to reset the width. With the handle focused, Left/Right arrows widen/narrow the card; hold Shift for larger steps, or use Home/End for the smallest/largest width. Escape cancels an active drag.

Scrollbars throughout the app use slim, rounded thumbs with hover feedback and colors that follow the selected theme.

## Find and replace

| Action | Shortcut |
| --- | --- |
| Open Find | Ctrl+F (Cmd+F on macOS) |
| Open Find and Replace | Ctrl+H (Cmd+H on macOS) |
| Next / previous match | Enter / Shift+Enter in Find, or F3 / Shift+F3 |
| Replace current match | Enter in Replace |
| Close and return to the editor | Escape |
| Match case / whole word / regular expression | Alt+C / Alt+W / Alt+R in the panel |
| Preserve replacement case | Alt+P in the panel |
| Insert a newline in either input | Alt+Enter |

The panel follows VS Code's compact Find/Replace layout: a collapsible replacement row, match count, navigation arrows, and individual options. Use the header buttons to open it without a keyboard shortcut.

Search covers visible text in headings, paragraphs, lists, table cells, links, and code. Text spanning inline formatting still matches. A match stays within its paragraph, heading, table cell, or code block; hard breaks and code-block newlines can be included. Front matter, link destinations, image metadata, and hidden callout markers are excluded.

Opening Find with selected text seeds the query. **Find in selection** restricts both searching and replacing to that original selection, which tracks replacements while enabled.

**Replace** changes the current match and moves to the next. **Replace all** changes every match in the current scope in a single undoable edit. Empty replacement text deletes matches. Existing block structure and the formatting at each match's start are retained. **Preserve case** adapts replacement text to lowercase, uppercase, and title-case matches.

With regular expressions enabled, replacements support `$1`, `$2`, named groups such as `$<name>`, `$0`/`$&` for the whole match, `$$` for a literal dollar sign, and `\n`/`\t`. Prefix a capture with `\u` or `\l` to change its first character's case, or `\U`/`\L` to change the entire capture. For example, finding `Item-(\d+)` and replacing with `Number $1` changes `Item-12` into `Number 12`.

Invalid regular expressions show an error and disable replacement. Zero-length matches are supported. A search displays up to 10,000 matches; replace-all is disabled if that limit is exceeded so a partial replacement cannot be mistaken for a complete one.

## Verification

- `tests/note-search.test.mjs`: 42 cases for matching, Unicode word boundaries, scopes, regex captures, zero-length matches, formatting, table structure, live updates, and undo/redo.
- `tests/e2e/note-tools.spec.ts`: 18 Electron UI cases covering empty files, persistent layout preferences, heading navigation, floating-card animations, edge/corner resizing and rendered widths, reduced motion, themed scrollbars, keyboard controls, search options, replacement, saving/reopening, and note switching.
- Existing tab, table-operation, and text-formatting suites provide editor regression coverage.
