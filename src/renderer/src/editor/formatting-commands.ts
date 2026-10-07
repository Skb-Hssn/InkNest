import { lift, setBlockType, toggleMark, wrapIn } from "@milkdown/kit/prose/commands";
import { closeHistory } from "@milkdown/kit/prose/history";
import type { MarkType, Node } from "@milkdown/kit/prose/model";
import { liftTarget } from "@milkdown/kit/prose/transform";
import { liftListItem, wrapInList } from "@milkdown/kit/prose/schema-list";
import { EditorState, Selection, TextSelection, type Command, type Transaction } from "@milkdown/kit/prose/state";

export type FormattingAction =
  | "bold" | "italic" | "strikethrough" | "inline-code" | "heading"
  | "unordered-list" | "ordered-list" | "task-list" | "blockquote"
  | "code-block" | "clear-format"
  | "callout-note" | "callout-warning" | "callout-info" | "callout-success";
const markNames = { bold: "strong", italic: "emphasis", strikethrough: "strike_through", "inline-code": "inlineCode" };
const markerPattern = /^\[!(NOTE|WARNING|INFO|SUCCESS)\][ \t]?/i;

export function isMarkActive(state: EditorState, type: MarkType) {
  const { from, to, empty, $from } = state.selection;
  if (empty) return Boolean(type.isInSet(state.storedMarks ?? $from.marks()));
  let found = false;
  let allMarked = true;
  state.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!node.isText || !parent?.type.allowsMarkType(type)) return;
    const text = node.text!.slice(Math.max(0, from - pos), Math.min(node.nodeSize, to - pos));
    if (!text.trim()) return;
    found = true;
    if (!type.isInSet(node.marks)) allMarked = false;
  });
  return found && allMarked;
}

function selectedTextblocks(state: EditorState) {
  const nodes: Node[] = [];
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
    if (node.isTextblock) nodes.push(node);
  });
  return nodes;
}

function enclosingList(state: EditorState) {
  const { $from, $to } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if ((node.type.name === "bullet_list" || node.type.name === "ordered_list") && $to.pos < $from.after(depth)) {
      return { node, from: $from.before(depth), depth };
    }
  }
  return null;
}

function enclosingQuote(state: EditorState) {
  const { $from, $to } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === "blockquote" && $to.pos < $from.after(depth)) {
      return { node: $from.node(depth), from: $from.before(depth) };
    }
  }
  return null;
}

/** Group multi-step formatting into one live transaction and one undo step. */
export function runFormattingAction(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  action: FormattingAction,
  options: { level?: number; language?: string } = {}
) {
  if (action === "code-block" || action === "inline-code") {
    let hasMath = false;
    const from = action === "code-block" ? state.selection.$from.start() : state.selection.from;
    const to = action === "code-block" ? Math.min(state.doc.content.size, state.selection.$to.end()) : state.selection.to;
    state.doc.nodesBetween(from, to, (node) => {
      if (node.type.name.startsWith("math_")) hasMath = true;
    });
    // ProseMirror's setBlockType drops inline atoms when converting to text-only
    // code. Keep equations intact rather than silently discarding their source.
    if (hasMath) return false;
  }
  // A plugin-free working state avoids running appendTransaction (for example
  // trailing paragraphs) on a detached document. Plugins run once on dispatch.
  let current = EditorState.create({
    schema: state.schema,
    doc: state.doc,
    selection: state.selection,
    storedMarks: state.storedMarks
  });
  const result = state.tr;
  const apply = (tr: Transaction) => {
    tr.steps.forEach((step) => result.step(step));
    current = current.apply(tr);
  };
  const run = (command: Command) => command(current, apply);
  const paragraph = state.schema.nodes.paragraph;
  const liftSelectedBlocks = (includeQuotes: boolean) => {
    const selection = current.selection;
    const mappingStart = result.mapping.maps.length;
    const points: { pos: number; depth: number }[] = [];
    current.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (node.isTextblock) points.push({ pos: pos + 1, depth: current.doc.resolve(pos + 1).depth });
    });
    for (const point of points) {
      const mapped = result.mapping.slice(mappingStart).map(point.pos);
      apply(current.tr.setSelection(TextSelection.near(current.doc.resolve(mapped))));
      for (let attempts = 0; attempts < point.depth + 4; attempts++) {
        if (enclosingList(current)) {
          if (!run(liftListItem(state.schema.nodes.list_item)) && !run(lift)) break;
        } else if (includeQuotes && enclosingQuote(current)) {
          const quote = enclosingQuote(current)!;
          const marker = quote.node.firstChild?.textContent.match(markerPattern)?.[0];
          if (marker) apply(current.tr.delete(quote.from + 2, quote.from + 2 + marker.length));
          if (!run(lift)) break;
        } else break;
      }
    }
    apply(current.tr.setSelection(selection.map(current.doc, result.mapping.slice(mappingStart))));
  };
  let handled = false;

  if (action in markNames) {
    const type = state.schema.marks[markNames[action as keyof typeof markNames]];
    handled = Boolean(type) && run(toggleMark(type, undefined, { removeWhenPresent: false }));
  } else if (action === "heading" || action === "code-block") {
    const blocks = selectedTextblocks(current);
    const target = action === "heading" ? state.schema.nodes.heading : state.schema.nodes.code_block;
    const level = options.level ?? 1;
    const active = blocks.length > 0 && blocks.every((node) => node.type === target && (action !== "heading" || node.attrs.level === level));
    if (!active) liftSelectedBlocks(false);
    handled = run(setBlockType(active ? paragraph : target, active ? undefined : action === "heading" ? { level } : { language: options.language ?? "" }));
  } else if (action.endsWith("list")) {
    const mode = action as "unordered-list" | "ordered-list" | "task-list";
    const target = mode === "ordered-list" ? state.schema.nodes.ordered_list : state.schema.nodes.bullet_list;
    const existing = enclosingList(current);
    const range = current.selection.$from.blockRange(current.selection.$to, (node) => node.type === existing?.node.type);
    if (existing && range?.parent === existing.node) {
      const selected: Node[] = [];
      for (let i = range.startIndex; i < range.endIndex; i++) selected.push(existing.node.child(i));
      const active = existing.node.type === target && selected.every((node) => mode === "task-list" ? node.attrs.checked !== null : node.attrs.checked === null);
      if (active) {
        handled = run(liftListItem(state.schema.nodes.list_item));
      } else {
        const children: Node[] = [];
        existing.node.forEach((node) => children.push(node));
        const before = children.slice(0, range.startIndex);
        const after = children.slice(range.endIndex);
        const items = selected.map((node, i) => node.type.create({
          ...node.attrs,
          listType: mode === "ordered-list" ? "ordered" : "bullet",
          label: mode === "ordered-list" ? String(i + 1) : "•",
          checked: mode === "task-list" ? node.attrs.checked ?? false : null
        }, node.content, node.marks));
        const beforeList = before.length ? existing.node.type.create(existing.node.attrs, before) : null;
        const afterList = after.length ? existing.node.type.create({ ...existing.node.attrs, ...(existing.node.type.name === "ordered_list" ? { order: existing.node.attrs.order + range.endIndex } : {}) }, after) : null;
        const converted = target.create({ ...(existing.node.type === target ? existing.node.attrs : {}), spread: existing.node.attrs.spread }, items);
        const oldStart = existing.from + 1 + before.reduce((sum, node) => sum + node.nodeSize, 0);
        const delta = existing.from + (beforeList?.nodeSize ?? 0) + 1 - oldStart;
        const tr = current.tr.replaceWith(existing.from, existing.from + existing.node.nodeSize, [beforeList, converted, afterList].filter((node): node is Node => node !== null));
        tr.setSelection(Selection.fromJSON(tr.doc, { type: "text", anchor: current.selection.from + delta, head: current.selection.to + delta }));
        apply(tr);
        handled = true;
      }
    } else {
      liftSelectedBlocks(false);
      run(setBlockType(paragraph));
      handled = run(wrapInList(target));
      if (handled) {
        const tr = current.tr;
        current.doc.nodesBetween(current.selection.from, current.selection.to, (node, pos) => {
          if (node.type.name === "list_item") tr.setNodeMarkup(pos, undefined, { ...node.attrs, listType: mode === "ordered-list" ? "ordered" : "bullet", checked: mode === "task-list" ? false : null });
        });
        apply(tr);
      }
    }
  } else if (action === "blockquote" || action.startsWith("callout-")) {
    let quote = enclosingQuote(current);
    const oldMarker = quote?.node.firstChild?.textContent.match(markerPattern)?.[0];
    const requested = action.startsWith("callout-") ? action.slice("callout-".length).toUpperCase() : null;
    const sameCallout = requested !== null && oldMarker?.toUpperCase().startsWith(`[!${requested}]`);
    if (quote && oldMarker) {
      const first = quote.node.firstChild!;
      if (quote.node.childCount > 1 && first.type === paragraph && first.textContent === oldMarker) {
        apply(current.tr.delete(quote.from + 1, quote.from + 1 + first.nodeSize));
      } else apply(current.tr.delete(quote.from + 2, quote.from + 2 + oldMarker.length));
      quote = enclosingQuote(current);
    }
    if (quote && (sameCallout || (action === "blockquote" && !oldMarker))) {
      const range = current.selection.$from.blockRange(current.selection.$to, (node) => node.type.name === "blockquote");
      const target = range && liftTarget(range);
      if (range && target !== null && target !== undefined) {
        apply(current.tr.lift(range, target));
        handled = true;
      }
    } else {
      if (!quote) {
        handled = run(wrapIn(state.schema.nodes.blockquote));
        quote = enclosingQuote(current);
      } else handled = true;
      if (quote && requested) {
        if (quote.node.firstChild?.type === paragraph) apply(current.tr.insertText(`[!${requested}] `, quote.from + 2));
        else apply(current.tr.insert(quote.from + 1, paragraph.create(null, state.schema.text(`[!${requested}] `))));
      }
    }
  } else if (action === "clear-format") {
    const tr = current.tr;
    if (current.selection.empty) tr.setStoredMarks([]);
    else tr.removeMark(current.selection.from, current.selection.to);
    apply(tr);
    // Map each selected block through previous lifts so mixed selections also
    // clear lists and quotes, while preserving unselected siblings.
    liftSelectedBlocks(true);
    run(setBlockType(paragraph));
    // Block conversion may reintroduce inherited marks at the cursor.
    if (current.selection.empty) apply(current.tr.setStoredMarks([]));
    handled = true;
  }

  if (!handled) return false;
  result.setSelection(Selection.fromJSON(result.doc, current.selection.toJSON()));
  result.setStoredMarks(current.storedMarks);
  dispatch?.(closeHistory(result).scrollIntoView());
  return true;
}
