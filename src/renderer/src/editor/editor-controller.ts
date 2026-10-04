import type { Editor } from "@milkdown/kit/core";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import {
  emphasisSchema,
  headingSchema,
  imageSchema,
  inlineCodeSchema,
  insertHrCommand,
  insertImageCommand,
  linkSchema,
  strongSchema
} from "@milkdown/kit/preset/commonmark";
import {
  insertTableCommand,
  strikethroughSchema
} from "@milkdown/kit/preset/gfm";
import {
  CellSelection,
  cellAround
} from "@milkdown/kit/prose/tables";
import { closeHistory } from "@milkdown/kit/prose/history";
import type { Mark, Node } from "@milkdown/kit/prose/model";
import { NodeSelection, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { getMarkdown, insert } from "@milkdown/kit/utils";
import { calloutPattern } from "./extensions/callout-plugin";
import type {
  MarkdownEditorCommand,
  MarkdownEditorCommandOptions
} from "./types";
import { runTableAction, type TableAction } from "./table-commands";
import { isMarkActive, runFormattingAction, type FormattingAction } from "./formatting-commands";

export type DeletableBlockKind = "callout" | "table" | "code";

export type TableCellAction = TableAction;

export type DeletableBlock = {
  kind: DeletableBlockKind;
  from: number;
  to: number;
  node: Node;
};

/** Read native caret movement before keyboard commands consume the selection. */
export function syncEditorDOMSelection(view: EditorView) {
  if (view.composing || !(view.state.selection instanceof TextSelection)) return;
  const native = view.dom.ownerDocument.getSelection();
  if (!native?.anchorNode || !native.focusNode ||
      !view.dom.contains(native.anchorNode) || !view.dom.contains(native.focusNode)) return;
  const anchor = view.posAtDOM(native.anchorNode, native.anchorOffset);
  const head = view.posAtDOM(native.focusNode, native.focusOffset);
  const selection = TextSelection.between(view.state.doc.resolve(anchor), view.state.doc.resolve(head));
  if (!selection.eq(view.state.selection)) view.dispatch(view.state.tr.setSelection(selection));
}

export function runEditorCommand(
  editor: Editor,
  command: MarkdownEditorCommand,
  options: MarkdownEditorCommandOptions = {}
) {
  return editor.action((ctx) => {
    const commands = ctx.get(commandsCtx);
    const view = ctx.get(editorViewCtx);
    view.focus();

    if (command.startsWith("heading-")) {
      return runFormattingAction(view.state, view.dispatch, "heading", { level: Number(command.at(-1)) });
    }
    const formatting: FormattingAction[] = ["bold", "italic", "strikethrough", "inline-code", "unordered-list", "ordered-list", "task-list", "blockquote", "code-block", "clear-format", "callout-note", "callout-warning", "callout-info", "callout-success"];
    if (formatting.includes(command as FormattingAction)) {
      return runFormattingAction(view.state, view.dispatch, command as FormattingAction, options);
    }

    if (command === "divider") {
      return commands.call(insertHrCommand.key);
    }

    if (command === "table") {
      return commands.call(insertTableCommand.key, { row: 2, col: 2 });
    }

    if (command === "table-add-row") {
      return runTableAction(view.state, view.dispatch, "add-row-after");
    }

    if (command === "table-delete-row") {
      return runTableAction(view.state, view.dispatch, "delete-row");
    }

    if (command === "table-add-column") {
      return runTableAction(view.state, view.dispatch, "add-column-after");
    }

    if (command === "table-delete-column") {
      return runTableAction(view.state, view.dispatch, "delete-column");
    }

    if (command === "table-delete") {
      return runTableAction(view.state, view.dispatch, "delete-table");
    }

    if (command === "link") {
      return replaceSelectionWithLink(
        view,
        options.label?.trim() || view.state.doc.textBetween(
          view.state.selection.from,
          view.state.selection.to,
          " "
        ) || "Link",
        sanitizeMarkdownHref(options.url ?? "")
      );
    }

    if (command === "link-edit") {
      return updateSelectedLink(
        view,
        options.label?.trim(),
        sanitizeMarkdownHref(options.url ?? "")
      );
    }

    if (command === "link-remove") {
      return removeSelectedLink(view);
    }

    if (command === "image") {
      const src = options.src?.trim();
      if (!src) {
        return false;
      }

      return commands.call(insertImageCommand.key, {
        src,
        alt: options.alt?.trim() || "Image",
        title: options.alt?.trim() || ""
      });
    }

    if (command === "inline-math") {
      insert(`$${options.equation?.trim() || "x = y"}$`, true)(ctx);
      return true;
    }

    if (command === "block-math") {
      insert(`$$\n${options.equation?.trim() || "x = y"}\n$$`)(ctx);
      return true;
    }

    if (command === "math-edit") {
      insert(`$${options.equation?.trim() || "x = y"}$`, true)(ctx);
      return true;
    }

    return false;
  });
}

function tableCellAtPosition(view: EditorView, position: number) {
  const { state } = view;
  const boundedPosition = Math.max(0, Math.min(position, state.doc.content.size));
  const $position = state.doc.resolve(boundedPosition);
  const nodeAfter = $position.nodeAfter;

  if (nodeAfter?.type.name === "table_cell" || nodeAfter?.type.name === "table_header") {
    return $position;
  }

  return cellAround($position);
}

/** Run a structural table action against the cell that owns a DOM position. */
export function runTableCellAction(
  editor: Editor,
  position: number,
  action: TableCellAction
) {
  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const $cell = tableCellAtPosition(view, position);
    if (!$cell) {
      return false;
    }

    // Use the live state after selection plugins have run. Applying a
    // selection to a detached state can append a trailing paragraph and
    // make the subsequent transaction incompatible with the live document.
    const selection = CellSelection.create(view.state.doc, $cell.pos);
    view.dispatch(view.state.tr.setSelection(selection));
    const didRun = runTableAction(view.state, view.dispatch, action);
    if (didRun) view.focus();
    return didRun;
  });
}

export function collectActiveEditorCommands(editor: Editor) {
  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const commands = new Set<MarkdownEditorCommand>();
    const hasMark = (name: string) => {
      const markType = state.schema.marks[name];
      return Boolean(markType && isMarkActive(state, markType));
    };

    if (hasMark(strongSchema.type(ctx).name)) commands.add("bold");
    if (hasMark(emphasisSchema.type(ctx).name)) commands.add("italic");
    if (hasMark(strikethroughSchema.type(ctx).name)) commands.add("strikethrough");
    if (hasMark(inlineCodeSchema.type(ctx).name)) commands.add("inline-code");
    if (hasMark(linkSchema.type(ctx).name)) commands.add("link");

    const contexts: Set<MarkdownEditorCommand>[] = [];
    state.doc.nodesBetween(state.selection.from, state.selection.to, (block, position) => {
      if (!block.isTextblock) return;
      const point = state.doc.resolve(position + 1);
      const active = new Set<MarkdownEditorCommand>();
      let listFound = false;
      let task = false;
      for (let depth = point.depth; depth > 0; depth--) {
        const node = point.node(depth);
        if (node.type === headingSchema.type(ctx)) active.add(`heading-${node.attrs.level}` as MarkdownEditorCommand);
        if (node.type.name === "blockquote") {
          const marker = node.firstChild?.textContent.match(calloutPattern)?.[1]?.toLowerCase();
          active.add(marker ? `callout-${marker}` as MarkdownEditorCommand : "blockquote");
        }
        if (node.type.name === "list_item" && !listFound) task = node.attrs.checked !== null;
        if (!listFound && (node.type.name === "bullet_list" || node.type.name === "ordered_list")) {
          active.add(task ? "task-list" : node.type.name === "bullet_list" ? "unordered-list" : "ordered-list");
          listFound = true;
        }
        if (node.type.name === "code_block") active.add("code-block");
        if (node.type.name === "table" || node.type.name.startsWith("table_")) active.add("table");
      }
      contexts.push(active);
    });
    for (const command of contexts[0] ?? []) {
      if (contexts.every((context) => context.has(command))) commands.add(command);
    }

    if (
      state.selection instanceof NodeSelection &&
      state.selection.node.type === imageSchema.type(ctx)
    ) {
      commands.add("image");
    }

    return commands;
  });
}

export function getEditorLinkDetails(editor: Editor) {
  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const range = findLinkRange(view.state);

    if (range) {
      return {
        text: view.state.doc.textBetween(range.from, range.to, " "),
        url: String(range.mark.attrs.href ?? ""),
        isEditing: true
      };
    }

    return {
      text: view.state.doc.textBetween(
        view.state.selection.from,
        view.state.selection.to,
        " "
      ),
      url: "",
      isEditing: false
    };
  });
}

export function getEditorMarkdown(editor: Editor) {
  return editor.action(getMarkdown());
}

/** Indent/dedent code without replacing a selected range of text. */
export function insertCodeIndent(view: EditorView, backwards = false) {
  const { state } = view;
  const { selection } = state;
  if (selection.$from.parent.type.name !== "code_block" || !selection.$from.sameParent(selection.$to)) return false;
  const tr = state.tr;
  if (!backwards && selection.empty) tr.insertText("    ");
  else {
    const start = selection.$from.start();
    const content = selection.$from.parent.textContent;
    const from = selection.from - start;
    const to = selection.to - start;
    let offset = from === 0 ? 0 : content.lastIndexOf("\n", from - 1) + 1;
    const edits: { from: number; to: number }[] = [];
    while (offset < to || (selection.empty && offset <= to)) {
      const indent = content.slice(offset).match(/^(?: {1,4}|\t)/)?.[0];
      if (!backwards || indent) edits.push({ from: start + offset, to: start + offset + (backwards ? indent!.length : 0) });
      const next = content.indexOf("\n", offset);
      if (next < 0) break;
      offset = next + 1;
    }
    for (const edit of edits.reverse()) {
      if (backwards) tr.delete(edit.from, edit.to);
      else tr.insertText("    ", edit.from);
    }
  }
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** Split a code-block line while carrying its leading spaces to the new line. */
export function insertCodeLineBreak(view: EditorView) {
  const { state } = view;
  const { $from, from, to } = state.selection;
  if ($from.parent.type.name !== "code_block") {
    return false;
  }

  const currentLine = $from.parent.textContent
    .slice(0, $from.parentOffset)
    .split("\n")
    .at(-1) ?? "";
  const indentation = currentLine.match(/^[\t ]*/)?.[0] ?? "";

  view.dispatch(
    state.tr
      .insertText(`\n${indentation}`, from, to)
      .scrollIntoView()
  );
  return true;
}

/** Insert an empty paragraph after the enclosing callout. */
export function insertParagraphAfterCallout(view: EditorView) {
  const { state } = view;
  const { $from } = state.selection;
  let calloutDepth: number | null = null;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "blockquote" && calloutPattern.test(node.textContent)) {
      calloutDepth = depth;
      break;
    }
  }

  if (calloutDepth === null) {
    return false;
  }

  const insertPosition = $from.after(calloutDepth);
  const paragraph = state.schema.nodes.paragraph.create();
  const transaction = state.tr.insert(insertPosition, paragraph);

  transaction.setSelection(
    TextSelection.near(transaction.doc.resolve(insertPosition + 1), 1)
  );
  view.dispatch(transaction.scrollIntoView());
  return true;
}

function getDeletableBlockKind(node: Node): DeletableBlockKind | null {
  if (node.type.name === "blockquote") {
    return calloutPattern.test(node.textContent) ? "callout" : null;
  }
  if (node.type.name === "table") {
    return "table";
  }
  if (node.type.name === "code_block") {
    return "code";
  }
  return null;
}

function getDeletableBlockAtSelection(view: EditorView): DeletableBlock | null {
  const { state } = view;

  if (state.selection instanceof NodeSelection) {
    const kind = getDeletableBlockKind(state.selection.node);
    if (kind) {
      return {
        kind,
        from: state.selection.from,
        to: state.selection.to,
        node: state.selection.node
      };
    }
  }

  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    const kind = getDeletableBlockKind(node);
    if (kind) {
      const from = $from.before(depth);
      return {
        kind,
        from,
        to: from + node.nodeSize,
        node
      };
    }
  }

  return null;
}

/** Resolve a DOM-derived position to the nearest deletable block. */
export function getDeletableBlockAtPosition(
  view: EditorView,
  position: number
): DeletableBlock | null {
  const { state } = view;
  const boundedPosition = Math.max(0, Math.min(position, state.doc.content.size));
  const $position = state.doc.resolve(boundedPosition);
  const nodeAfter = $position.nodeAfter;
  if (nodeAfter) {
    const kind = getDeletableBlockKind(nodeAfter);
    if (kind) {
      return {
        kind,
        from: boundedPosition,
        to: boundedPosition + nodeAfter.nodeSize,
        node: nodeAfter
      };
    }
  }

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth);
    const kind = getDeletableBlockKind(node);
    if (kind) {
      const from = $position.before(depth);
      return {
        kind,
        from,
        to: from + node.nodeSize,
        node
      };
    }
  }

  return null;
}

function getFirstTextPosition(block: DeletableBlock) {
  let firstTextOffset: number | null = null;
  let firstTextblockOffset: number | null = null;
  block.node.descendants((node, position) => {
    if (node.isTextblock && firstTextblockOffset === null) {
      firstTextblockOffset = position;
    }
    if (node.isText && firstTextOffset === null) {
      firstTextOffset = position;
      return false;
    }
    return firstTextOffset === null;
  });

  if (firstTextOffset !== null) {
    return block.from + 1 + firstTextOffset;
  }

  // Empty table cells still have a paragraph content boundary to place the
  // caret in, even though there is no text node to report.
  return block.from + 1 + (firstTextblockOffset === null ? 0 : firstTextblockOffset + 1);
}

function isCaretAtBlockStart(view: EditorView, block: DeletableBlock) {
  const { state } = view;
  if (!state.selection.empty) {
    return false;
  }

  const firstTextPosition = getFirstTextPosition(block);
  const visualStartPosition =
    block.kind === "callout"
      ? firstTextPosition + (block.node.textContent.match(calloutPattern)?.[0].length ?? 0)
      : firstTextPosition;

  return state.selection.from <= visualStartPosition;
}

function isEmptyDeletableBlock(block: DeletableBlock) {
  if (block.kind === "code") {
    return block.node.textContent.trim() === "";
  }
  if (block.kind === "callout") {
    const marker = block.node.textContent.match(calloutPattern)?.[0];
    return marker !== undefined && block.node.textContent.slice(marker.length).trim() === "";
  }
  return false;
}

function replaceWithParagraph(view: EditorView, block: DeletableBlock) {
  const paragraph = view.state.schema.nodes.paragraph.create();
  const transaction = view.state.tr.replaceWith(block.from, block.to, paragraph);
  transaction.setSelection(TextSelection.near(transaction.doc.resolve(block.from + 1), 1));
  view.dispatch(transaction.scrollIntoView());
}

function deleteBlockRange(view: EditorView, from: number, to: number) {
  const transaction = view.state.tr.delete(from, to);

  // Keep the document editable when the deleted block was the only node.
  if (transaction.doc.content.size === 0) {
    transaction.insert(0, view.state.schema.nodes.paragraph.create());
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(1), 1));
  }

  view.dispatch(transaction.scrollIntoView());
}

/** Handle Backspace/Delete for callouts, tables, and code blocks. */
export function handleDeletableBlockKey(view: EditorView, key: "Backspace" | "Delete") {
  const selectedBlock = getDeletableBlockAtSelection(view);
  if (!selectedBlock) {
    return false;
  }

  if (view.state.selection instanceof NodeSelection) {
    deleteBlockRange(view, selectedBlock.from, selectedBlock.to);
    return true;
  }

  if (key !== "Backspace" || !isCaretAtBlockStart(view, selectedBlock)) {
    return false;
  }

  if (
    (selectedBlock.kind === "code" || selectedBlock.kind === "callout") &&
    isEmptyDeletableBlock(selectedBlock)
  ) {
    replaceWithParagraph(view, selectedBlock);
    return true;
  }

  view.dispatch(
    view.state.tr
      .setSelection(NodeSelection.create(view.state.doc, selectedBlock.from))
      .scrollIntoView()
  );
  return true;
}

/** Delete a specific block immediately from the editor action menu. */
export function deleteBlockAtPosition(view: EditorView, position: number) {
  const block = getDeletableBlockAtPosition(view, position);
  if (!block) {
    return false;
  }

  deleteBlockRange(view, block.from, block.to);
  return true;
}

function commonSelectionMarks(state: EditorState, from: number, to: number) {
  let marks: readonly Mark[] | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isInline) return;
    marks = marks === null ? node.marks : marks.filter((mark) => mark.isInSet(node.marks));
  });
  return marks ?? state.storedMarks ?? state.selection.$from.marks();
}

function replaceSelectionWithLink(view: EditorView, label: string, url: string) {
  const { state } = view;
  const { from, to, empty, $from } = state.selection;
  const link = state.schema.marks.link;
  if (!url || !$from.parent.type.allowsMarkType(link)) return false;
  const mark = link.create({ href: url, title: null });
  const original = state.doc.textBetween(from, to, " ");
  const tr = state.tr;
  if (!empty && label === original) tr.addMark(from, to, mark);
  else {
    const marks = mark.addToSet(commonSelectionMarks(state, from, to));
    tr.replaceSelectionWith(state.schema.text(label, marks), false);
  }
  view.dispatch(closeHistory(tr).scrollIntoView());
  return true;
}

function updateSelectedLink(view: EditorView, label: string | undefined, url: string) {
  const { state } = view;
  const range = findLinkRange(state);
  if (!range || !url) return false;
  const original = state.doc.textBetween(range.from, range.to, " ");
  const nextLabel = label || original;
  const mark = range.mark.type.create({ ...range.mark.attrs, href: url });
  const tr = state.tr;
  if (nextLabel === original) tr.addMark(range.from, range.to, mark);
  else tr.replaceWith(range.from, range.to, state.schema.text(nextLabel, mark.addToSet(commonSelectionMarks(state, range.from, range.to))));
  tr.setSelection(TextSelection.create(tr.doc, range.from, range.from + nextLabel.length));
  view.dispatch(closeHistory(tr).scrollIntoView());
  return true;
}

function removeSelectedLink(view: EditorView) {
  const range = findLinkRange(view.state);
  if (!range) return false;
  view.dispatch(closeHistory(view.state.tr.removeMark(range.from, range.to, range.mark)).scrollIntoView());
  return true;
}

function findLinkRange(state: EditorState): { from: number; to: number; mark: Mark } | null {
  const { from, to, empty, $from, $to } = state.selection;
  if (!$from.sameParent($to) || !$from.parent.isTextblock) return null;
  const groups: { from: number; to: number; mark: Mark }[] = [];
  const parentStart = $from.start();
  $from.parent.forEach((node, offset) => {
    const mark = state.schema.marks.link.isInSet(node.marks);
    if (!mark) return;
    const last = groups.at(-1);
    const start = parentStart + offset;
    if (last && last.to === start && last.mark.eq(mark)) last.to += node.nodeSize;
    else groups.push({ from: start, to: start + node.nodeSize, mark });
  });
  // Editing always targets the complete logical link, including text nodes
  // split by bold/italic marks. A mixed link/plain selection creates a new link.
  return groups.find((group) => empty ? from >= group.from && from < group.to : from >= group.from && to <= group.to)
    ?? (empty ? groups.find((group) => from === group.to) : null)
    ?? null;
}

function sanitizeMarkdownHref(value: string) {
  const href = value.trim();
  return /^(?:javascript|data|vbscript):/i.test(href) ? "#" : href;
}
