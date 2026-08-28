import { $prose } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";

const calloutPattern = /^\[!(NOTE|WARNING|INFO|SUCCESS)\]/i;

export const calloutPlugin = $prose(() =>
  new Plugin({
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];

        state.doc.descendants((node, position) => {
          if (node.type.name !== "blockquote") {
            return;
          }

          const callout = node.textContent.match(calloutPattern);
          if (!callout) {
            return;
          }

          decorations.push(
            Decoration.node(position, position + node.nodeSize, {
              class: "inknest-callout",
              "data-callout": callout[1].toLowerCase()
            })
          );
        });

        return DecorationSet.create(state.doc, decorations);
      }
    }
  })
);
