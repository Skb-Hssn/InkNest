import { Plugin } from "@milkdown/kit/prose/state";
import type { Node } from "@milkdown/kit/prose/model";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { highlightCode, type CodeHighlight } from "../code-highlighting";

// Tokens such as syntax-keyword and syntax-comment are rendered as decorations.
// Cache immutable nodes so moving the caret does not parse every block again.
export const codeHighlightPlugin = $prose(() => {
  const cache = new WeakMap<Node, CodeHighlight[]>();
  return new Plugin({
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        state.doc.descendants((node, position) => {
          if (node.type.name !== "code_block" || !node.textContent) return;
          let highlights = cache.get(node);
          if (!highlights) {
            highlights = highlightCode(node.textContent, String(node.attrs.language ?? ""));
            cache.set(node, highlights);
          }
          highlights.forEach(({ from, to, className }) => {
            decorations.push(Decoration.inline(position + 1 + from, position + 1 + to, { class: className }));
          });
        });
        return DecorationSet.create(state.doc, decorations);
      }
    }
  });
});
