import { $prose } from "@milkdown/kit/utils";
import { Plugin, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";

export const calloutPattern = /^\[!(NOTE|WARNING|INFO|SUCCESS)\]/i;

/**
 * Move the caret to the editable body of a newly-created callout.
 *
 * Wrapping a paragraph can reset the selection to the beginning of the
 * paragraph. If we leave it there, the first typed character is inserted
 * before the `[!TYPE]` marker and the block stops being recognized as a
 * callout. Resolve the marker's document position and explicitly place the
 * caret after it.
 */
function getCalloutBodyPosition(view: EditorView, onlyAtMarker = false) {
  const { state } = view;
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== "blockquote") {
      continue;
    }

    const marker = node.textContent.match(calloutPattern)?.[0];
    if (!marker) {
      continue;
    }

    let firstTextOffset: number | null = null;
    node.descendants((child, childPosition) => {
      if (child.isText && firstTextOffset === null) {
        firstTextOffset = childPosition;
        return false;
      }
      return firstTextOffset === null;
    });

    if (firstTextOffset === null) {
      continue;
    }

    const blockFrom = $from.before(depth);
    const markerStart = blockFrom + 1 + firstTextOffset;
    const markerEnd = markerStart + marker.length;
    if (
      onlyAtMarker &&
      (!state.selection.empty || state.selection.from > markerEnd)
    ) {
      return null;
    }

    const bodyText = node.textContent.slice(marker.length);
    const leadingWhitespace = bodyText.match(/^\s*/)?.[0].length ?? 0;
    return markerEnd + leadingWhitespace;
  }

  return null;
}

export function focusCalloutBody(view: EditorView) {
  const bodyPosition = getCalloutBodyPosition(view);
  if (bodyPosition === null) {
    return false;
  }

  const transaction = view.state.tr.setSelection(
    TextSelection.near(view.state.doc.resolve(bodyPosition), 1)
  );
  view.dispatch(transaction.scrollIntoView());
  return true;
}

/** Keep text typed at the visual start of a callout in its editable body. */
export function moveCaretToCalloutBodyIfNeeded(view: EditorView) {
  const bodyPosition = getCalloutBodyPosition(view, true);
  if (bodyPosition === null || bodyPosition === view.state.selection.from) {
    return false;
  }

  const transaction = view.state.tr.setSelection(
    TextSelection.near(view.state.doc.resolve(bodyPosition), 1)
  );
  view.dispatch(transaction);
  return true;
}

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
