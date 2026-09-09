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

          // Keep the marker in the ProseMirror document so it is serialized back
          // to Markdown, but hide it from the visual editor. The first text node
          // starts at position + 1 + offset (the blockquote content boundary).
          let firstTextOffset: number | null = null;
          node.descendants((child, childPosition) => {
            if (child.isText && firstTextOffset === null) {
              firstTextOffset = childPosition;
              return false;
            }
            return firstTextOffset === null;
          });

          if (firstTextOffset !== null) {
            const markerFrom = position + 1 + firstTextOffset;
            decorations.push(
              Decoration.inline(markerFrom, markerFrom + callout[0].length, {
                class: "inknest-callout-marker",
                "aria-hidden": "true"
              })
            );
          }
        });

        return DecorationSet.create(state.doc, decorations);
      }
    }
  })
);
