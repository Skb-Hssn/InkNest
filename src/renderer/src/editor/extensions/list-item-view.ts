import { listItemSchema } from "@milkdown/kit/preset/commonmark";
import { $view } from "@milkdown/kit/utils";

export const listItemView = $view(
  listItemSchema.node,
  () => (initialNode, view, getPos) => {
    const dom = document.createElement("li");
    const contentDOM = document.createElement("div");
    const checkbox = document.createElement("input");
    let node = initialNode;

    contentDOM.className = "inknest-list-item-content";
    checkbox.type = "checkbox";
    checkbox.contentEditable = "false";
    checkbox.setAttribute("aria-label", "Toggle task");
    dom.append(contentDOM);

    function bindNode() {
      const isTask = node.attrs.checked !== null;
      dom.dataset.itemType = isTask ? "task" : String(node.attrs.listType ?? "bullet");
      if (isTask) {
        dom.dataset.task = "true";
      } else {
        delete dom.dataset.task;
      }
      dom.dataset.checked = isTask ? String(Boolean(node.attrs.checked)) : "";
      checkbox.checked = Boolean(node.attrs.checked);
      checkbox.disabled = !view.editable;

      if (isTask && checkbox.parentElement !== dom) {
        dom.insertBefore(checkbox, contentDOM);
      } else if (!isTask) {
        checkbox.remove();
      }
    }

    checkbox.addEventListener("change", () => {
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
          checked: checkbox.checked
        })
      );
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
        return event.target === checkbox;
      },
      ignoreMutation(mutation) {
        return mutation.target === checkbox || !contentDOM.contains(mutation.target);
      }
    };
  }
);
