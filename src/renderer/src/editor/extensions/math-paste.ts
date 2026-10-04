import { parserCtx, remarkCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import { closeHistory } from "@milkdown/kit/prose/history";
import { Fragment, Slice, type Node } from "@milkdown/kit/prose/model";
import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { MarkdownNode, RemarkParser } from "@milkdown/kit/transformer";
import { $prose } from "@milkdown/kit/utils";
import katex from "katex";
import { mathRenderOptions } from "./math-plugin";

type MathSpan = { from: number; to: number; value: string; display: boolean };
type Range = { from: number; to: number };
const overlaps = (a: Range, b: Range) => a.from < b.to && b.from < a.to;
const escaped = (text: string, offset: number) => {
  let slashes = 0;
  while (offset > 0 && text[--offset] === "\\") slashes++;
  return slashes % 2 === 1;
};

/** Detect explicit math and clear standalone TeX, without guessing from prose. */
export function findPastedMath(text: string, processor: RemarkParser, protectedRanges: Range[] = []): MathSpan[] {
  const spans: MathSpan[] = [];
  const blocked = [...protectedRanges];
  function visit(node: MarkdownNode) {
    const from = node.position?.start.offset, to = node.position?.end.offset;
    if (from !== undefined && to !== undefined && ["code", "inlineCode", "math", "inlineMath"].includes(node.type)) {
      const range = { from, to };
      if (node.type === "code" || node.type === "inlineCode") blocked.push(range);
      else if (!blocked.some((other) => overlaps(range, other))) {
        const raw = text.slice(from, to);
        // Remark accepts an unclosed display fence; clipboard conversion must
        // wait for its closing fence rather than create an empty equation.
        if (node.type === "math") {
          const fence = raw.match(/^ {0,3}(\${2,})[^\n]*\n/);
          const lastLine = raw.split("\n").at(-1)?.trim() ?? "";
          if (!fence || !/^\$+$/.test(lastLine) || lastLine.length < fence[1].length) return;
        }
        const wholeLine = !text.slice(0, from).split("\n").at(-1)?.trim() && !text.slice(to).split("\n")[0].trim();
        spans.push({ ...range, value: String(node.value ?? ""), display: node.type === "math" || (wholeLine && /^\$\$[^$]/.test(raw)) });
        blocked.push(range);
      }
      return;
    }
    node.children?.forEach(visit);
  }
  visit(processor.parse(text) as MarkdownNode);
  const wrappers = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
  for (const match of text.matchAll(wrappers)) {
    const range = { from: match.index, to: match.index + match[0].length };
    if (escaped(text, range.from) || blocked.some((other) => overlaps(range, other))) continue;
    spans.push({ ...range, value: (match[1] ?? match[2]).trim(), display: match[2] !== undefined });
  }
  if (!spans.length && !blocked.length && /^\s*\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|iint|lim|begin|alpha|beta|gamma|theta|pi|vec|mathbf|mathrm|text)\b/.test(text)) {
    try {
      katex.renderToString(text.trim(), mathRenderOptions);
      spans.push({ from: 0, to: text.length, value: text.trim(), display: true });
    } catch { /* Ambiguous or incomplete raw TeX stays ordinary text. */ }
  }
  return spans.sort((a, b) => a.from - b.from);
}

export function normalizeMathPaste(text: string, processor: RemarkParser) {
  let result = text;
  for (const span of findPastedMath(text, processor).reverse()) {
    // Remark chooses a safe fence length when the source contains dollars.
    const math = processor.stringify({ type: "root", children: span.display
      ? [{ type: "math", value: span.value }]
      : [{ type: "paragraph", children: [{ type: "inlineMath", value: span.value || " " }] }] }).trimEnd();
    result = result.slice(0, span.from) + (span.display ? `\n\n${math}\n\n` : math) + result.slice(span.to);
  }
  return result;
}

/** Recover original source from rendered equations copied from browsers. */
export function transformMathHTML(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const annotation of template.content.querySelectorAll('annotation[encoding="application/x-tex"]')) {
    if (annotation.closest("pre, code")) continue;
    const math = annotation.closest("math");
    if (!math) continue;
    const container = math.closest(".katex-display") ?? math.closest(".katex") ?? math;
    const display = container.classList.contains("katex-display") || math.getAttribute("display") === "block";
    const replacement = document.createElement(display ? "div" : "span");
    replacement.dataset.mathSource = annotation.textContent ?? "";
    container.replaceWith(replacement);
  }
  return template.innerHTML;
}

/** Preserve rich-text marks while replacing equation spans inside pasted blocks. */
export function transformMathSlice(slice: Slice, processor: RemarkParser) {
  const blockText = (node: Node) => node.textBetween(0, node.content.size, undefined,
    (leaf) => leaf.type.name === "hardbreak" || leaf.type.name === "hard_break" ? "\n" : "\ufffc");
  const plainBlock = (node: Node) => node.type.name === "paragraph" &&
    !node.type.spec.code && !Array.from({ length: node.childCount }, (_, i) => node.child(i)).some((child) =>
      (!child.isText && child.type.name !== "hardbreak" && child.type.name !== "hard_break") || child.marks.some((mark) => mark.type.spec.code));
  function convertChildren(content: Fragment, parent?: Node): Node[] {
    const nodes: Node[] = [];
    content.forEach((node) => nodes.push(node));
    const result: Node[] = [];
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index];
      const opening = plainBlock(node) && blockText(node).trim().match(/^(\${2,}|\\\[)$/);
      if (opening) {
        let end = index + 1;
        while (end < nodes.length && plainBlock(nodes[end])) {
          const closing = blockText(nodes[end]).trim();
          if (opening[1] === "\\[" ? closing === "\\]" : /^\$+$/.test(closing) && closing.length >= opening[1].length) break;
          end++;
        }
        if (end < nodes.length && plainBlock(nodes[end])) {
          const source = nodes.slice(index + 1, end).map(blockText).join("\n");
          const blockType = node.type.schema.nodes.math_block;
          const display = !parent || parent.canReplaceWith(index, end + 1, blockType);
          if (display) result.push(blockType.create({ value: source }));
          else result.push(node.copy(Fragment.from(node.type.schema.nodes.math_inline.create({ value: source.replace(/\r?\n/g, " ") }))));
          index = end;
          continue;
        }
      }
      result.push(...convert(node, parent, index));
    }
    return result;
  }
  function convert(node: Node, parent?: Node, index = 0): Node[] {
    if (node.isTextblock && !node.type.spec.code) {
      const blocked: Range[] = [];
      node.forEach((child, offset) => {
        if ((!child.isText && child.type.name !== "hardbreak" && child.type.name !== "hard_break") || child.marks.some((mark) => mark.type.spec.code)) blocked.push({ from: offset, to: offset + child.nodeSize });
      });
      const text = blockText(node);
      const spans = findPastedMath(text, processor, blocked);
      if (!spans.length) return [node];
      const blockType = node.type.schema.nodes.math_block;
      const allowDisplay = !parent || parent.canReplaceWith(index, index + 1, blockType);
      const blocks: Node[] = [];
      let content = Fragment.empty, offset = 0;
      for (const span of spans) {
        content = content.append(node.content.cut(offset, span.from));
        if (span.display && allowDisplay) {
          if (content.size) blocks.push(node.copy(content));
          blocks.push(blockType.create({ value: span.value }));
          content = Fragment.empty;
        } else {
          const marks = (node.nodeAt(span.from)?.marks ?? []).filter((mark) => !mark.type.spec.code);
          content = content.append(Fragment.from(node.type.schema.nodes.math_inline.create({ value: span.value.replace(/\r?\n/g, " ") }, null, marks)));
        }
        offset = span.to;
      }
      content = content.append(node.content.cut(offset));
      if (content.size || !blocks.length) blocks.push(node.copy(content));
      return blocks;
    }
    return [node.isLeaf ? node : node.copy(Fragment.from(convertChildren(node.content, node)))];
  }
  const children = convertChildren(slice.content);
  const content = Fragment.from(children);
  const open = Slice.maxOpen(content);
  return new Slice(content, Math.min(slice.openStart, open.openStart), Math.min(slice.openEnd, open.openEnd));
}

export function handleMathPaste(ctx: Ctx, view: EditorView, event: ClipboardEvent) {
  if (!view.editable || !event.clipboardData || view.state.selection.$from.parent.type.spec.code) return false;
  const text = event.clipboardData.getData("text/plain");
  const marks = view.state.storedMarks ?? view.state.selection.$from.marks();
  if (marks.some((mark) => mark.type.spec.code)) {
    if (!text) return false;
    view.dispatch(view.state.tr.insertText(text));
  } else {
    if (event.clipboardData.getData("text/html") || !findPastedMath(text, ctx.get(remarkCtx)).length) return false;
    const doc = ctx.get(parserCtx)(normalizeMathPaste(text, ctx.get(remarkCtx)));
    if (!doc) return false;
    view.dispatch(closeHistory(view.state.tr).replaceSelection(Slice.maxOpen(doc.content)).scrollIntoView());
  }
  event.preventDefault();
  return true;
}

export const mathPastePlugin = $prose((ctx) => new Plugin({
  props: { transformPasted: (slice) => transformMathSlice(slice, ctx.get(remarkCtx)) }
}));
