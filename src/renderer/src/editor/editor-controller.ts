import type { Editor } from "@milkdown/kit/core";
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core";
import {
  createCodeBlockCommand,
  emphasisSchema,
  headingSchema,
  imageSchema,
  inlineCodeSchema,
  insertHrCommand,
  insertImageCommand,
  linkSchema,
  strongSchema,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand
} from "@milkdown/kit/preset/commonmark";
import {
  addColAfterCommand,
  addRowAfterCommand,
  insertTableCommand,
  strikethroughSchema,
  toggleStrikethroughCommand
} from "@milkdown/kit/preset/gfm";
import { deleteColumn, deleteRow } from "@milkdown/kit/prose/tables";
import type { Mark, Node } from "@milkdown/kit/prose/model";
import { NodeSelection, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { getMarkdown, insert } from "@milkdown/kit/utils";
import { calloutPattern } from "./extensions/callout-plugin";
import type {
  MarkdownEditorCommand,
  MarkdownEditorCommandOptions
} from "./types";

export type DeletableBlockKind = "callout" | "table" | "code";

export type DeletableBlock = {
  kind: DeletableBlockKind;
  from: number;
  to: number;
  node: Node;
};

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
      return commands.call(wrapInHeadingCommand.key, Number(command.at(-1)));
    }

    if (command === "bold") {
      return commands.call(toggleStrongCommand.key);
    }

    if (command === "italic") {
      return commands.call(toggleEmphasisCommand.key);
    }

    if (command === "strikethrough") {
      return commands.call(toggleStrikethroughCommand.key);
    }

    if (command === "inline-code") {
      return commands.call(toggleInlineCodeCommand.key);
    }

    if (command === "unordered-list") {
      return commands.call(wrapInBulletListCommand.key);
    }

    if (command === "ordered-list") {
      return commands.call(wrapInOrderedListCommand.key);
    }

    if (command === "task-list") {
      commands.call(wrapInBulletListCommand.key);
      return setCurrentListItemChecked(view, false);
    }

    if (command === "blockquote") {
      return commands.call(wrapInBlockquoteCommand.key);
    }

    if (command.startsWith("callout-")) {
      const type = command.slice("callout-".length).toUpperCase();
      insert(`> [!${type}]\n> `)(ctx);
      return true;
    }

    if (command === "clear-format") {
      return clearFormatting(view);
    }

    if (command === "code-block") {
      return commands.call(createCodeBlockCommand.key, options.language ?? "");
    }

    if (command === "divider") {
      return commands.call(insertHrCommand.key);
    }

    if (command === "table") {
      return commands.call(insertTableCommand.key, { row: 2, col: 2 });
    }

    if (command === "table-add-row") {
      return commands.call(addRowAfterCommand.key);
    }

    if (command === "table-delete-row") {
      return deleteRow(view.state, view.dispatch);
    }

    if (command === "table-add-column") {
      return commands.call(addColAfterCommand.key);
    }

    if (command === "table-delete-column") {
      return deleteColumn(view.state, view.dispatch);
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

export function collectActiveEditorCommands(editor: Editor) {
  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { $from, from, to, empty } = state.selection;
    const commands = new Set<MarkdownEditorCommand>();
    const marks = empty ? state.storedMarks ?? $from.marks() : null;
    const hasMark = (name: string) => {
      const markType = state.schema.marks[name];
      if (!markType) {
        return false;
      }

      return marks
        ? marks.some((mark) => mark.type === markType)
        : state.doc.rangeHasMark(from, to, markType);
    };

    if (hasMark(strongSchema.type(ctx).name)) commands.add("bold");
    if (hasMark(emphasisSchema.type(ctx).name)) commands.add("italic");
    if (hasMark(strikethroughSchema.type(ctx).name)) commands.add("strikethrough");
    if (hasMark(inlineCodeSchema.type(ctx).name)) commands.add("inline-code");
    if (hasMark(linkSchema.type(ctx).name)) commands.add("link");

    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);

      if (node.type === headingSchema.type(ctx)) {
        commands.add(`heading-${node.attrs.level}` as MarkdownEditorCommand);
      }
      if (node.type.name === "blockquote") commands.add("blockquote");
      if (node.type.name === "bullet_list") commands.add("unordered-list");
      if (node.type.name === "ordered_list") commands.add("ordered-list");
      if (node.type.name === "list_item" && node.attrs.checked !== null) {
        commands.add("task-list");
      }
      if (node.type.name === "code_block") commands.add("code-block");
      if (node.type.name === "table" || node.type.name.startsWith("table_")) {
        commands.add("table");
      }
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

/** Insert a stable four-space indentation inside a fenced code block. */
export function insertCodeIndent(view: EditorView) {
  const { state } = view;
  if (state.selection.$from.parent.type.name !== "code_block") {
    return false;
  }

  view.dispatch(
    state.tr
      .insertText("    ", state.selection.from, state.selection.to)
      .scrollIntoView()
  );
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

function clearFormatting(view: EditorView) {
  const { state } = view;
  const { from, to, empty } = state.selection;
  const transaction = state.tr;

  if (empty) {
    transaction.setStoredMarks([]);
  } else {
    transaction.removeMark(from, to);
  }

  view.dispatch(transaction.scrollIntoView());
  return true;
}

function setCurrentListItemChecked(
  view: EditorView,
  checked: boolean
) {
  const { $from } = view.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== "list_item") {
      continue;
    }

    view.dispatch(
      view.state.tr.setNodeMarkup($from.before(depth), undefined, {
        ...node.attrs,
        checked
      })
    );
    return true;
  }

  return false;
}

function replaceSelectionWithLink(
  view: EditorView,
  label: string,
  url: string
) {
  if (!url) {
    return false;
  }

  const mark = view.state.schema.marks.link.create({ href: url, title: null });
  const text = view.state.schema.text(label, [mark]);
  view.dispatch(view.state.tr.replaceSelectionWith(text, false).scrollIntoView());
  return true;
}

function updateSelectedLink(
  view: EditorView,
  label: string | undefined,
  url: string
) {
  const range = findLinkRange(view.state);
  if (!range || !url) {
    return false;
  }

  const nextLabel = label || view.state.doc.textBetween(range.from, range.to, " ");
  const mark = view.state.schema.marks.link.create({
    ...range.mark.attrs,
    href: url
  });
  const transaction = view.state.tr.replaceWith(
    range.from,
    range.to,
    view.state.schema.text(nextLabel, [mark])
  );
  transaction.setSelection(TextSelection.create(transaction.doc, range.from, range.from + nextLabel.length));
  view.dispatch(transaction.scrollIntoView());
  return true;
}

function removeSelectedLink(view: EditorView) {
  const range = findLinkRange(view.state);
  if (!range) {
    return false;
  }

  view.dispatch(
    view.state.tr.removeMark(range.from, range.to, range.mark).scrollIntoView()
  );
  return true;
}

function findLinkRange(state: EditorState): {
  from: number;
  to: number;
  mark: Mark;
} | null {
  const linkType = state.schema.marks.link;
  const { from, to, empty, $from } = state.selection;

  if (!empty) {
    let selectedMark: Mark | null = null;
    state.doc.nodesBetween(from, to, (node) => {
      selectedMark ??= linkType.isInSet(node.marks) ?? null;
    });

    return selectedMark ? { from, to, mark: selectedMark } : null;
  }

  const parent = $from.parent;
  const parentStart = $from.start();
  const cursorOffset = $from.parentOffset;
  let result: { from: number; to: number; mark: Mark } | null = null;

  parent.forEach((node, offset) => {
    const end = offset + node.nodeSize;
    if (cursorOffset < offset || cursorOffset > end || !node.isText) {
      return;
    }

    const mark = linkType.isInSet(node.marks);
    if (mark) {
      result = {
        from: parentStart + offset,
        to: parentStart + end,
        mark
      };
    }
  });

  return result;
}

function sanitizeMarkdownHref(value: string) {
  const href = value.trim();
  return /^(?:javascript|data|vbscript):/i.test(href) ? "#" : href;
}
