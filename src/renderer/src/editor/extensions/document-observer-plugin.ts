import { serializerCtx } from "@milkdown/kit/core";
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
        const selectionChanged = !previousState.selection.eq(nextState.selection);

        if (documentChanged || selectionChanged) {
          queueMicrotask(() => {
            if (documentChanged) {
              options.onMarkdownChange(ctx.get(serializerCtx)(nextState.doc));
            }
            if (selectionChanged) {
              options.onSelectionChange();
            }
          });
        }

        return null;
      }
    });
  });
}
