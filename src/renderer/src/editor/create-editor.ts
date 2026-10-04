import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  remarkStringifyOptionsCtx,
  rootCtx
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm, tableSchema } from "@milkdown/kit/preset/gfm";
import { clipboard } from "@milkdown/kit/plugin/clipboard";
import { history } from "@milkdown/kit/plugin/history";
import { trailing } from "@milkdown/kit/plugin/trailing";
import { splitListItem } from "@milkdown/kit/prose/schema-list";
import { TextSelection } from "@milkdown/kit/prose/state";
import {
  calloutPlugin,
  moveCaretToCalloutBodyIfNeeded
} from "./extensions/callout-plugin";
import { codeBlockView } from "./extensions/code-block-view";
import { codeHighlightPlugin } from "./extensions/code-highlight-plugin";
import { createDocumentObserverPlugin } from "./extensions/document-observer-plugin";
import { createImageView } from "./extensions/image-view";
import { listItemView } from "./extensions/list-item-view";
import { runSlashCommand, slashCommandPlugin } from "./extensions/slash-command-plugin";
import {
  collectActiveEditorCommands,
  handleDeletableBlockKey,
  insertCodeIndent,
  insertCodeLineBreak,
  insertParagraphAfterCallout,
  syncEditorDOMSelection
} from "./editor-controller";
import type { MarkdownEditorProps } from "./types";
import { moveTableCell } from "./table-commands";
import { createNoteSearchPlugin, type NoteSearchState } from "./search-plugin";
import { runFormattingAction, type FormattingAction } from "./formatting-commands";

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
  onSearchChange: (state: NoteSearchState) => void;
};

export function createMarkdownEditor(options: CreateEditorOptions) {
  let editor: Editor;

  editor = Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, options.root);
      ctx.set(defaultValueCtx, options.body);
      // GFM supports a header with no body rows. Requiring a body row makes
      // deleting the final data row recreate it during schema repair.
      ctx.update(tableSchema.key, (schema) => (schemaCtx) => ({
        ...schema(schemaCtx),
        content: "table_header_row table_row*"
      }));
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
        handleTextInput(view, from, to, text, defaultInsert) {
          const marks = view.state.storedMarks;
          if (marks?.some((mark) => mark.type.name === "inlineCode")) {
            // Explicitly enabled code remains enabled while typing. Moving the
            // caret clears stored marks, preserving the normal closed boundary.
            view.dispatch(view.state.tr.insertText(text, from, to).ensureMarks(marks));
            return true;
          }
          return previous.handleTextInput?.(view, from, to, text, defaultInsert) ?? false;
        },
        handleKeyDown(view, event) {
          // Browser caret movement (Home/End and Shift+Arrow) may precede
          // ProseMirror's asynchronous selectionchange event.
          syncEditorDOMSelection(view);
          if (event.ctrlKey || event.metaKey) {
            const key = event.key.toLowerCase();
            const shortcuts: Record<string, FormattingAction> = event.altKey
              ? { x: "strikethrough", c: "code-block", "7": "ordered-list", "8": "unordered-list" }
              : event.shiftKey ? { x: "strikethrough", b: "blockquote" }
              : { b: "bold", i: "italic", e: "inline-code", "\\": "clear-format" };
            const action = event.altKey && /^[1-6]$/.test(key) ? "heading" : shortcuts[key];
            if (action && runFormattingAction(view.state, view.dispatch, action, { level: Number(key) })) {
              event.preventDefault();
              return true;
            }
          }
          if (
            (event.key === "Backspace" || event.key === "Delete") &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey &&
            handleDeletableBlockKey(view, event.key)
          ) {
            event.preventDefault();
            return true;
          }

          if (
            event.key === "Enter" &&
            event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey &&
            insertParagraphAfterCallout(view)
          ) {
            event.preventDefault();
            return true;
          }

          if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
            const { $from } = view.state.selection;
            const item = $from.depth > 1 ? $from.node($from.depth - 1) : null;
            if (item?.type.name === "list_item" && item.attrs.checked !== null &&
                splitListItem(item.type, { ...item.attrs, checked: false })(view.state, view.dispatch)) {
              event.preventDefault();
              return true;
            }
          }

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
            (moveTableCell(view.state, view.dispatch, event.shiftKey ? -1 : 1) || insertCodeIndent(view, event.shiftKey))
          ) {
            event.preventDefault();
            return true;
          }

          if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            !event.isComposing
          ) {
            // A click can place the caret before the hidden callout marker.
            // Move it into the body before ProseMirror handles this key so
            // the marker can never end up after newly typed text.
            moveCaretToCalloutBodyIfNeeded(view);
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
    .use(createNoteSearchPlugin(options.onSearchChange))
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
