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
    copyButton.textContent = "Copy";

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
      languageSelect.value = codeBlockLanguages.some(([value]) => value === language)
        ? language
        : "";
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
