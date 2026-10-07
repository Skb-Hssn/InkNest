import { remarkCtx } from "@milkdown/kit/core";
import { closeHistory, redo, undo } from "@milkdown/kit/prose/history";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import { NodeSelection, Selection, type EditorState } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { NodeSchema } from "@milkdown/kit/transformer";
import { $inputRule, $node, $remark, $view } from "@milkdown/kit/utils";
import katex, { type KatexOptions } from "katex";
import remarkMath from "remark-math";

export const mathRenderOptions: KatexOptions = {
  throwOnError: true,
  trust: false,
  strict: "ignore",
  output: "htmlAndMathml",
  maxExpand: 1000,
  maxSize: 20
};

/** Keep LaTeX as data; rendered HTML never becomes the saved note. */
export function mathNodeSchema(display: boolean): NodeSchema {
  const name = display ? "math_block" : "math_inline";
  const tag = display ? "div" : "span";
  return {
    group: display ? "block" : "inline",
    inline: !display,
    atom: true,
    selectable: true,
    attrs: { value: { default: "", validate: "string" }, meta: { default: null } },
    parseDOM: [{
      tag: `${tag}[data-math-source]`,
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.mathSource ?? "", meta: (dom as HTMLElement).dataset.mathMeta ?? null })
    }],
    toDOM: (node) => [tag, { "data-math-source": node.attrs.value, "data-math-meta": node.attrs.meta }, node.attrs.value],
    parseMarkdown: {
      match: (node) => node.type === (display ? "math" : "inlineMath"),
      runner: (state, node, type) => { state.addNode(type, { value: String(node.value ?? ""), meta: node.meta ?? null }); }
    },
    toMarkdown: {
      match: (node) => node.type.name === name,
      runner: (state, node) => {
        if (!display && state.top()?.children?.at(-1)?.type === "inlineMath") {
          // Touching fences ($a$$b$) parse as one equation. Separate adjacent
          // atoms with a space so each equation keeps its own editable source.
          state.addNode("text", undefined, " ");
        }
        // An empty inline fence ($$) would reopen as a display fence. A space
        // preserves the empty inline atom, including during autosave.
        state.addNode(display ? "math" : "inlineMath", undefined, node.attrs.value || (display ? "" : " "), display ? { meta: node.attrs.meta } : undefined);
      }
    }
  };
}

export const inlineMathSchema = $node("math_inline", () => mathNodeSchema(false));
export const blockMathSchema = $node("math_block", () => mathNodeSchema(true));
const mathRemark = $remark("inknestMath", () => remarkMath);

export function canInsertMath(state: EditorState, display: boolean) {
  const { $from, $to } = state.selection;
  if (!$from.sameParent($to) || !$from.parent.isTextblock || $from.parent.type.spec.code ||
      (state.storedMarks ?? $from.marks()).some((mark) => mark.type.spec.code)) return false;
  if (!(state.selection instanceof NodeSelection)) {
    let containsAtom = false;
    state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => { if (node.isLeaf && !node.isText) containsAtom = true; });
    if (containsAtom) return false;
  }
  if (!display) return $from.parent.canReplaceWith($from.index(), $to.index(), state.schema.nodes.math_inline);
  // GFM cells require a paragraph, and the first paragraph of a list item is
  // required by Markdown. Do not let replaceSelectionWith lift math out of it.
  return $from.depth > 0 && $from.node(-1).canReplaceWith($from.index(-1), $from.index(-1) + 1, state.schema.nodes.math_block);
}

export function hasOpenMathFence(text: string) {
  let fence = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\\") { index++; continue; }
    if (text[index] !== "$") continue;
    let length = 1;
    while (text[index + 1] === "$") { length++; index++; }
    if (!fence) fence = length;
    else if (fence === length) fence = 0;
  }
  return fence > 0;
}

export function preserveMathSource(view: EditorView, from: number, to: number, text: string) {
  if (text.includes("$") || !canInsertMath(view.state, false)) return false;
  const $from = view.state.doc.resolve(from);
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  if (!hasOpenMathFence(before)) return false;
  // Markdown emphasis and smart punctuation must not rewrite unfinished TeX.
  view.dispatch(view.state.tr.insertText(text, from, to));
  return true;
}

export function openSelectedMath(view: EditorView) {
  const { selection } = view.state;
  if (!(selection instanceof NodeSelection) || !selection.node.type.name.startsWith("math_")) return false;
  view.nodeDOM(selection.from)?.dispatchEvent(new Event("inknest-edit-math"));
  return true;
}

export function insertMath(view: EditorView, display: boolean, equation?: string) {
  if (!view.editable) return false;
  const selected = view.state.selection instanceof NodeSelection ? view.state.selection.node : null;
  if (selected?.type.name === (display ? "math_block" : "math_inline") && equation === undefined) return openSelectedMath(view);
  if (!canInsertMath(view.state, display)) return false;
  const { state } = view;
  const source = equation ?? (selected?.type.name.startsWith("math_") ? selected.attrs.value : state.doc.textBetween(state.selection.from, state.selection.to, " ") || "x = y");
  const type = state.schema.nodes[display ? "math_block" : "math_inline"];
  const tr = closeHistory(state.tr).replaceSelectionWith(type.create({ value: source }), !display);
  // Block insertion may split a paragraph and put the caret inside the next
  // paragraph. Locate the atom in the inserted range instead of guessing -1.
  tr.mapping.maps.at(-1)?.forEach((_oldFrom, _oldTo, from, to) => {
    tr.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type === type) tr.setSelection(NodeSelection.create(tr.doc, pos));
    });
  });
  view.dispatch(tr.scrollIntoView());
  openSelectedMath(view);
  return true;
}

const inlineMathInput = $inputRule((ctx) => new InputRule(/\$$/, (state, _match, start, end) => {
  if (!canInsertMath(state, false)) return null;
  const { $from } = state.selection;
  const raw = $from.parent.textBetween(0, start - $from.start(), undefined, "\ufffc") + "$";
  // Use the same parser as loading/pasting notes for escaped dollars, code,
  // matched fence lengths and whitespace. A regex alone disagrees on these.
  const ast = ctx.get(remarkCtx).parse(raw);
  const paragraph = ast.children.at(-1);
  if (paragraph?.type !== "paragraph") return null;
  const math = paragraph.children.at(-1);
  if (math?.type !== "inlineMath" || math.position?.end.offset !== raw.length) return null;
  const from = $from.start() + math.position.start.offset!;
  if (raw.slice(math.position.start.offset).includes("\ufffc") ||
      (state.schema.marks.inlineCode && state.doc.rangeHasMark(from, end, state.schema.marks.inlineCode))) return null;
  return state.tr.replaceWith(from, end, inlineMathSchema.type(ctx).create({ value: math.value }, null, $from.marks()));
}));

export function handleMathKey(view: EditorView, event: KeyboardEvent) {
  if (event.key !== "Enter" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing) return false;
  if (openSelectedMath(view)) return true;
  const { state } = view;
  if (!state.selection.empty || state.selection.$from.parent.textContent.trim() !== "$$" || !canInsertMath(state, true)) return false;
  const { $from } = state.selection;
  const tr = closeHistory(state.tr).replaceWith($from.before(), $from.after(), state.schema.nodes.math_block.create({ value: "" }));
  tr.setSelection(NodeSelection.create(tr.doc, $from.before()));
  view.dispatch(tr.scrollIntoView());
  openSelectedMath(view);
  return true;
}

function mathView(schema: typeof inlineMathSchema, display: boolean) {
  return $view(schema, () => (initialNode, view, getPos) => {
    const dom = document.createElement(display ? "div" : "span");
    const preview = document.createElement("span");
    const controls = document.createElement("span");
    const label = document.createElement("span");
    const source = document.createElement("textarea");
    const done = document.createElement("button");
    const remove = document.createElement("button");
    const error = document.createElement("span");
    let node = initialNode;
    let destroyed = false;
    dom.className = `inknest-math ${display ? "inknest-math-block" : "inknest-math-inline"}`;
    dom.contentEditable = "false";
    preview.className = "inknest-math-preview";
    preview.tabIndex = 0;
    preview.setAttribute("role", "button");
    preview.setAttribute("aria-label", `Edit ${display ? "display" : "inline"} equation`);
    preview.title = "Click to edit equation";
    controls.className = "inknest-math-controls";
    controls.hidden = true;
    label.className = "inknest-math-label";
    label.textContent = `${display ? "Display" : "Inline"} equation · LaTeX`;
    source.className = "inknest-math-source";
    source.setAttribute("aria-label", `${display ? "Display" : "Inline"} equation source`);
    source.spellcheck = false;
    source.rows = display ? 4 : 2;
    done.type = remove.type = "button";
    // Keep the source/NodeSelection focused until the click handler runs;
    // a native caret move can otherwise hide the controls on mousedown.
    for (const button of [done, remove]) button.addEventListener("mousedown", (event) => event.preventDefault());
    done.textContent = "Done";
    done.title = "Ctrl+Enter or Escape";
    remove.textContent = "Delete equation";
    error.className = "inknest-math-error";
    error.setAttribute("role", "status");
    controls.append(label, source, done, remove);
    dom.append(preview, error, controls);

    function render() {
      dom.dataset.mathSource = node.attrs.value;
      const value = String(node.attrs.value);
      preview.setAttribute("aria-description", value || "Empty equation");
      if (source.value !== value) source.value = value;
      preview.replaceChildren();
      error.textContent = "";
      dom.dataset.invalid = "false";
      if (!value.trim()) {
        preview.textContent = "Empty equation";
        return;
      }
      try {
        katex.render(value, preview, { ...mathRenderOptions, displayMode: display });
      } catch (reason) {
        // textContent is intentional: parser errors can include arbitrary note text.
        preview.textContent = value;
        error.textContent = reason instanceof Error ? reason.message.replace(/^KaTeX parse error:\s*/, "") : "Invalid equation";
        dom.dataset.invalid = "true";
      }
    }

    function open() {
      if (!view.editable || destroyed) return;
      const pos = getPos();
      if (pos === undefined) return;
      view.dispatch(closeHistory(view.state.tr).setSelection(NodeSelection.create(view.state.doc, pos)));
      controls.hidden = false;
      dom.dataset.editing = "true";
      source.focus();
    }
    function close(focus = true) {
      controls.hidden = true;
      dom.dataset.editing = "false";
      if (!focus || destroyed) return;
      const pos = getPos();
      if (pos === undefined) return;
      view.dispatch(closeHistory(view.state.tr).setSelection(Selection.near(view.state.doc.resolve(pos + node.nodeSize), 1)).scrollIntoView());
      view.focus();
    }
    function deleteEquation() {
      if (!view.editable) return;
      const pos = getPos();
      if (pos === undefined) return;
      view.dispatch(closeHistory(view.state.tr).delete(pos, pos + node.nodeSize).scrollIntoView());
      view.focus();
    }
    dom.addEventListener("inknest-edit-math", open);
    preview.addEventListener("click", (event) => {
      event.preventDefault();
      if ((event.ctrlKey || event.metaKey) && preview.closest("a")) return;
      open();
    });
    preview.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
    source.addEventListener("input", () => {
      if (!view.editable) return;
      const pos = getPos();
      if (pos === undefined) return;
      // Inline math has no line breaks in Markdown's parsed representation.
      const value = display ? source.value : source.value.replace(/\r?\n/g, " ");
      const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, value });
      tr.setSelection(NodeSelection.create(tr.doc, pos));
      view.dispatch(tr);
    });
    source.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey || !display))) {
        event.preventDefault(); close();
      } else if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        (event.shiftKey || event.key.toLowerCase() === "y" ? redo : undo)(view.state, view.dispatch);
      } else if (event.key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        source.setRangeText("  ", source.selectionStart, source.selectionEnd, "end");
        source.dispatchEvent(new Event("input"));
      }
    });
    dom.addEventListener("focusout", () => {
      queueMicrotask(() => { if (!destroyed && !dom.contains(document.activeElement)) close(false); });
    });
    done.addEventListener("click", () => close());
    remove.addEventListener("click", deleteEquation);
    render();
    return {
      dom,
      update(next) {
        if (next.type !== node.type) return false;
        if (!next.eq(node)) { node = next; render(); }
        return true;
      },
      selectNode() { dom.classList.add("ProseMirror-selectednode"); },
      deselectNode() { dom.classList.remove("ProseMirror-selectednode"); close(false); },
      stopEvent(event) {
        // Preserve the note's existing Ctrl/Cmd+click link handling for math
        // wrapped in a Markdown link; ordinary clicks only edit the equation.
        return !(event.type === "click" && event instanceof MouseEvent &&
          (event.ctrlKey || event.metaKey) && preview.contains(event.target as Node) && preview.closest("a"));
      },
      ignoreMutation: () => true,
      destroy() { destroyed = true; }
    };
  });
}

export const mathPlugins = [
  ...mathRemark, inlineMathSchema, blockMathSchema, inlineMathInput,
  mathView(inlineMathSchema, false), mathView(blockMathSchema, true)
];
