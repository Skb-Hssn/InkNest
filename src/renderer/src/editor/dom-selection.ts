import { AllSelection, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";

/** Read native caret movement before keyboard commands consume the selection. */
export function syncEditorDOMSelection(view: EditorView) {
  if (view.composing || (!(view.state.selection instanceof TextSelection) &&
      !(view.state.selection instanceof AllSelection))) return;
  const native = view.dom.ownerDocument.getSelection();
  if (!native?.anchorNode || !native.focusNode ||
      !view.dom.contains(native.anchorNode) || !view.dom.contains(native.focusNode)) return;
  // Select-all uses AllSelection. Native Home/End can collapse it before
  // ProseMirror receives selectionchange; use that caret on the next command.
  // Keep a genuine select-all range intact for copying and block operations.
  if (view.state.selection instanceof AllSelection && !native.isCollapsed) return;
  const anchor = view.posAtDOM(native.anchorNode, native.anchorOffset);
  const head = view.posAtDOM(native.focusNode, native.focusOffset);
  const selection = TextSelection.between(view.state.doc.resolve(anchor), view.state.doc.resolve(head));
  if (!selection.eq(view.state.selection)) view.dispatch(view.state.tr.setSelection(selection));
}

