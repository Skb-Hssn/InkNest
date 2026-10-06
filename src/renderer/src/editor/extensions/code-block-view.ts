import { codeBlockSchema } from "@milkdown/kit/preset/commonmark";
import { $view } from "@milkdown/kit/utils";

const codeBlockLanguages = [
  ["", "Plain text"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["tsx", "TSX"],
  ["html", "HTML"],
  ["css", "CSS"],
  ["json", "JSON"],
  ["python", "Python"],
  ["bash", "Bash"],
  ["markdown", "Markdown"]
] as const;

export const codeBlockView = $view(
  codeBlockSchema.node,
  () => (initialNode, view, getPos) => {
    const dom = document.createElement("pre");
    const controls = document.createElement("span");
    const languageSelect = document.createElement("select");
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

    for (const [value, label] of codeBlockLanguages) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      languageSelect.append(option);
    }

    controls.append(languageSelect, copyButton);
    dom.append(controls, contentDOM);

    function bindNode() {
      const language = String(node.attrs.language ?? "");
      dom.dataset.language = language;
      contentDOM.className = language ? `language-${language}` : "";
      languageSelect.querySelector("option[data-custom-language]")?.remove();
      if (language && !codeBlockLanguages.some(([value]) => value === language)) {
        const option = document.createElement("option");
        option.dataset.customLanguage = "true";
        option.value = language;
        option.textContent = language;
        languageSelect.append(option);
      }
      languageSelect.value = language;
    }

    languageSelect.addEventListener("change", () => {
      if (!view.editable) {
        return;
      }

      const position = getPos();
      if (position === undefined) {
        return;
      }

      view.dispatch(
        view.state.tr.setNodeMarkup(position, undefined, {
          ...node.attrs,
          language: languageSelect.value
        })
      );
    });

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
      }
    };
  }
);
