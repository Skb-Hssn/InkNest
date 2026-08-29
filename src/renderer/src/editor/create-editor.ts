import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  remarkStringifyOptionsCtx,
  rootCtx
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { TextSelection } from "@milkdown/kit/prose/state";
import { calloutPlugin } from "./extensions/callout-plugin";
import { codeBlockView } from "./extensions/code-block-view";
import { codeHighlightPlugin } from "./extensions/code-highlight-plugin";
import { createDocumentObserverPlugin } from "./extensions/document-observer-plugin";
import { createImageView } from "./extensions/image-view";
import { listItemView } from "./extensions/list-item-view";
import { runSlashCommand, slashCommandPlugin } from "./extensions/slash-command-plugin";
import {
  collectActiveEditorCommands,
  insertCodeIndent,
  insertCodeLineBreak
} from "./editor-controller";
import type { MarkdownEditorProps } from "./types";

type CreateEditorOptions = Pick<
  MarkdownEditorProps,
  | "workspacePath"
  | "notePath"
  | "onSelectionFormatChange"
  | "onLinkDialogRequest"
  | "onImagePaste"
  | "onLocalLinkRequest"
> & {
  root: HTMLElement;
  body: string;
  disabled: boolean;
  onBodyChange: (body: string) => void;
};

export function createMarkdownEditor(options: CreateEditorOptions) {
  let editor: Editor;

  editor = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, options.root);
      ctx.set(defaultValueCtx, options.body);
      ctx.update(remarkStringifyOptionsCtx, (previous) => ({
        ...previous,
        bullet: "-" as const
      }));
      ctx.update(editorViewOptionsCtx, (previous) => ({
        ...previous,
        editable: () => !options.disabled,
        attributes: {
          ...(previous.attributes ?? {}),
          role: "textbox",
          "aria-label": "Visual Markdown editor",
          "aria-multiline": "true",
          spellcheck: "true"
        },
        handleKeyDown(view, event) {
          if (
            event.key === "Enter" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            insertCodeLineBreak(view)
          ) {
            event.preventDefault();
            return true;
          }

          if (
            event.key === "Tab" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            insertCodeIndent(view)
          ) {
            event.preventDefault();
            return true;
          }

          return (
            runSlashCommand(ctx, view, event) ||
            previous.handleKeyDown?.(view, event) ||
            false
          );
        },
        handlePaste(view, event) {
          const imageItem = Array.from(event.clipboardData?.items ?? []).find(
            (item) => item.kind === "file" && item.type.startsWith("image/")
          );

          if (!imageItem) {
            return false;
          }

          const file = imageItem.getAsFile();
          if (!file) {
            return false;
          }

          event.preventDefault();
          void file.arrayBuffer().then((buffer) => {
            options.onImagePaste({
              bytes: Array.from(new Uint8Array(buffer)),
              fileName: file.name || undefined,
              mimeType: file.type || imageItem.type
            });
          });
          return true;
        },
        handleDOMEvents: {
          ...previous.handleDOMEvents,
          click(view, event) {
            const target = event.target;
            const link = target instanceof HTMLElement ? target.closest("a") : null;

            if (!(link instanceof HTMLAnchorElement) || !(event.ctrlKey || event.metaKey)) {
              return false;
            }

            event.preventDefault();
            const href = link.getAttribute("href") ?? "";
            if (/^(?:https?:)?\/\//i.test(href)) {
              void window.inknest.links.openExternal({ url: link.href });
            } else {
              options.onLocalLinkRequest(href);
            }
            return true;
          },
          dblclick(view, event) {
            const target = event.target;
            const link = target instanceof HTMLElement ? target.closest("a") : null;
            if (!(link instanceof HTMLAnchorElement)) {
              return false;
            }

            event.preventDefault();
            const from = view.posAtDOM(link, 0);
            const to = from + (link.textContent?.length ?? 0);
            if (to > from) {
              view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
            }
            options.onLinkDialogRequest({
              text: link.textContent ?? "",
              url: link.getAttribute("href") ?? "",
              isEditing: true,
              position: {
                left: event.clientX,
                top: event.clientY + 8
              }
            });
            return true;
          }
        }
      }));

    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(clipboard)
    .use(trailing)
    .use(createDocumentObserverPlugin({
      onMarkdownChange: options.onBodyChange,
      onSelectionChange() {
        options.onSelectionFormatChange(collectActiveEditorCommands(editor));
      }
    }))
    .use(calloutPlugin)
    .use(codeHighlightPlugin)
    .use(slashCommandPlugin)
    .use(createImageView({
      workspacePath: options.workspacePath,
      notePath: options.notePath
    }))
    .use(codeBlockView)
    .use(listItemView);

  return editor;
}

export function setEditorEditable(editor: Editor, editable: boolean) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    view.setProps({ editable: () => editable });
  });
}
