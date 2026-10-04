import { serializerCtx } from "@milkdown/kit/core";
import { Mark } from "@milkdown/kit/prose/model";
import { Plugin } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

type DocumentObserverOptions = {
  onMarkdownChange: (markdown: string) => void;
  onSelectionChange: () => void;
};

export function createDocumentObserverPlugin(options: DocumentObserverOptions) {
  return $prose((ctx) => {
    return new Plugin({
      appendTransaction(_transactions, previousState, nextState) {
        const documentChanged = !previousState.doc.eq(nextState.doc);
        const selectionChanged = !previousState.selection.eq(nextState.selection) ||
          !Mark.sameSet(previousState.storedMarks ?? previousState.selection.$from.marks(), nextState.storedMarks ?? nextState.selection.$from.marks());

        if (documentChanged || selectionChanged) {
          queueMicrotask(() => {
            if (documentChanged) {
              options.onMarkdownChange(ctx.get(serializerCtx)(nextState.doc));
            }
            // Formatting may change while the selection stays at the same
            // positions (including non-inclusive code marks via shortcuts).
            options.onSelectionChange();
          });
        }

        return null;
      }
    });
  });
}
