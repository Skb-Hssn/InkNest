import { codeBlockSchema } from "@milkdown/kit/preset/commonmark";
import { $view } from "@milkdown/kit/utils";
import { createCodeLanguagePicker } from "./code-language-picker";

export const codeBlockView = $view(
  codeBlockSchema.node,
  () => (initialNode, view, getPos) => {
    const dom = document.createElement("pre");
    const controls = document.createElement("span");
    const languageSelect = document.createElement("button");
    const copyButton = document.createElement("button");
    const contentDOM = document.createElement("code");
    let node = initialNode;

    controls.className = "inknest-code-controls";
    controls.contentEditable = "false";
    languageSelect.className = "code-language-select";
    languageSelect.setAttribute("aria-label", "Code block language");
    copyButton.className = "code-copy-button";
    copyButton.type = "button";
    copyButton.setAttribute("aria-label", "Copy");
    copyButton.title = "Copy code";
    copyButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>';

    const languagePicker = createCodeLanguagePicker({
      trigger: languageSelect,
      getLanguage: () => String(node.attrs.language ?? ""),
      isEditable: () => view.editable,
      onSelect(language) {
        const position = getPos();
        if (position === undefined || !view.editable) return;
        view.dispatch(view.state.tr.setNodeMarkup(position, undefined, { ...node.attrs, language }));
      }
    });

    controls.append(languageSelect, copyButton);
    dom.append(controls, contentDOM);

    function bindNode() {
      const language = String(node.attrs.language ?? "");
      dom.dataset.language = language;
      contentDOM.className = language ? `language-${language}` : "";
      languagePicker.refresh();
    }

    copyButton.addEventListener("click", () => {
      void navigator.clipboard?.writeText(node.textContent);
    });

    bindNode();

    return {
      dom,
      contentDOM,
      update(updatedNode) {
        if (updatedNode.type !== node.type) {
          return false;
        }

        node = updatedNode;
        bindNode();
        return true;
      },
      stopEvent(event) {
        return controls.contains(event.target as Node);
      },
      ignoreMutation(mutation) {
        return !contentDOM.contains(mutation.target);
      },
      destroy() { languagePicker.destroy(); }
    };
  }
);
