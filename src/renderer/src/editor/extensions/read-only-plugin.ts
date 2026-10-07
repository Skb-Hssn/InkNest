import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

// contenteditable=false alone does not stop commands or undo transactions.
export function createReadOnlyPlugin() {
  return $prose(() => {
    let view: EditorView | undefined;
    return new Plugin({
      filterTransaction(transaction) {
        return !transaction.docChanged || !view || view.editable;
      },
      view(editorView) {
        view = editorView;
        return { destroy() { view = undefined; } };
      }
    });
  });
}
