import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from "react";
import { CirclePlus, Grip, MoreHorizontal, Trash2 } from "lucide-react";
import type { Editor } from "@milkdown/kit/core";
import { editorViewCtx } from "@milkdown/kit/core";
import { replaceAll } from "@milkdown/kit/utils";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "@milkdown/kit/prose/tables/style/tables.css";
import "./editor.css";
import { createMarkdownEditor, setEditorEditable } from "./create-editor";
import {
  collectActiveEditorCommands,
  deleteBlockAtPosition,
  getDeletableBlockAtPosition,
  getEditorLinkDetails,
  getEditorMarkdown,
  runEditorCommand,
  runTableCellAction,
  type TableCellAction
} from "./editor-controller";
import {
  joinMarkdownDocument,
  splitMarkdownDocument,
  type MarkdownDocumentEnvelope
} from "./document-envelope";
import type { MarkdownEditorHandle, MarkdownEditorProps } from "./types";
import type { DeletableBlockKind } from "./editor-controller";

type BlockActionState = {
  kind: DeletableBlockKind;
  position: number;
  top: number;
  left: number;
  menuOpen: boolean;
};

type TableCellActionState = {
  cell: HTMLElement;
  position: number;
  top: number;
  left: number;
  menuLeft: number;
  menuOpen: boolean;
};

const tableCellActions: Array<{ action: TableCellAction; label: string }> = [
  { action: "delete-table", label: "Delete table" },
  { action: "delete-row", label: "Delete row" },
  { action: "delete-column", label: "Delete column" },
  { action: "add-row-before", label: "Add row before" },
  { action: "add-row-after", label: "Add row after" },
  { action: "add-column-before", label: "Add column before" },
  { action: "add-column-after", label: "Add column after" }
];

function blockActionLabel(kind: DeletableBlockKind) {
  return kind === "callout"
    ? "callout"
    : kind === "code"
      ? "code block"
      : "table";
}

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(props, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [blockAction, setBlockAction] = useState<BlockActionState | null>(null);
  const [tableCellAction, setTableCellAction] = useState<TableCellActionState | null>(null);
  const propsRef = useRef(props);
  const envelopeRef = useRef<MarkdownDocumentEnvelope>(
    splitMarkdownDocument(props.markdown)
  );
  const lastEmittedMarkdownRef = useRef(props.markdown);
  const latestMarkdownRef = useRef(props.markdown);
  const replacingExternallyRef = useRef(false);

  propsRef.current = props;
  latestMarkdownRef.current = props.markdown;

  useEffect(() => {
    if (!blockAction?.menuOpen && !tableCellAction?.menuOpen) {
      return;
    }

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) {
        return;
      }
      setBlockAction(null);
      setTableCellAction(null);
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [blockAction?.menuOpen, tableCellAction?.menuOpen]);

  function handleEditorMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    const root = rootRef.current;
    const container = containerRef.current;
    const target = event.target;
    if (!root || !container || !(target instanceof Element)) {
      return;
    }

    // Keep an open menu attached to its original cell while the pointer
    // crosses nearby cells on the way to the menu.
    if (tableCellAction?.menuOpen) return;

    if (
      target.closest(
        ".inknest-block-handle, .inknest-block-menu, .inknest-table-cell-handle, .inknest-table-cell-menu"
      )
    ) {
      return;
    }

    const cellElement = target.closest("td, th");
    if (cellElement instanceof HTMLElement && root.contains(cellElement)) {
      setBlockAction(null);

      const editor = editorRef.current;
      if (!editor) {
        setTableCellAction(null);
        return;
      }

      const nextAction = editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        let position: number;
        try {
          position = view.posAtDOM(cellElement, 0);
        } catch {
          return null;
        }

        const containerRect = container.getBoundingClientRect();
        const cellRect = cellElement.getBoundingClientRect();
        const left = Math.max(4, cellRect.right - containerRect.left - 28);
        const menuWidth = 210;
        const menuLeft = Math.min(
          left + 28,
          Math.max(4, container.clientWidth - menuWidth - 4)
        );

        return {
          cell: cellElement,
          position,
          top: Math.max(0, cellRect.top - containerRect.top + 4),
          left,
          menuLeft,
          menuOpen: false
        } satisfies TableCellActionState;
      });

      setTableCellAction((current) => {
        if (
          current &&
          nextAction &&
          current.position === nextAction.position &&
          current.top === nextAction.top &&
          current.left === nextAction.left &&
          current.menuLeft === nextAction.menuLeft
        ) {
          return current.menuOpen ? current : nextAction;
        }
        return nextAction;
      });
      return;
    }

    setTableCellAction(null);

    const blockElement = target.closest("blockquote, table, pre");
    if (!(blockElement instanceof HTMLElement) || !root.contains(blockElement)) {
      setBlockAction(null);
      return;
    }

    // Tables expose actions on each cell, so do not show the generic block
    // handle when the pointer is over table chrome or whitespace.
    if (blockElement.tagName === "TABLE") {
      setBlockAction(null);
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const nextAction = editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      let position: number;
      try {
        position = view.posAtDOM(blockElement, 0);
      } catch {
        return null;
      }

      const block = getDeletableBlockAtPosition(view, position);
      if (!block) {
        return null;
      }

      const containerRect = container.getBoundingClientRect();
      const blockRect = blockElement.getBoundingClientRect();
      return {
        kind: block.kind,
        position: block.from,
        top: Math.max(0, blockRect.top - containerRect.top + 4),
        left: Math.max(4, blockRect.left - containerRect.left - 28),
        menuOpen: false
      } satisfies BlockActionState;
    });

    setBlockAction((current) => {
      if (
        current &&
        nextAction &&
        current.kind === nextAction.kind &&
        current.position === nextAction.position &&
        current.top === nextAction.top &&
        current.left === nextAction.left
      ) {
        return current.menuOpen ? current : nextAction;
      }
      return nextAction;
    });
  }

  function deleteHoveredBlock() {
    const editor = editorRef.current;
    const action = blockAction;
    if (!editor || !action) {
      return;
    }

    const didDelete = editor.action((ctx) =>
      deleteBlockAtPosition(ctx.get(editorViewCtx), action.position)
    );
    if (didDelete) {
      setBlockAction(null);
    }
  }

  function runHoveredTableAction(action: TableCellAction) {
    const editor = editorRef.current;
    const currentAction = tableCellAction;
    if (!editor || !currentAction || propsRef.current.disabled) {
      return;
    }

    // Resolve the current DOM cell at execution time: typing/undo may have
    // shifted document positions since the menu first appeared.
    if (rootRef.current?.contains(currentAction.cell)) {
      const position = editor.action((ctx) => ctx.get(editorViewCtx).posAtDOM(currentAction.cell, 0));
      runTableCellAction(editor, position, action);
    }
    setTableCellAction(null);
  }

  useImperativeHandle(ref, () => ({
    runCommand(command, options) {
      const editor = editorRef.current;
      if (!editor) {
        return false;
      }

      const didRun = runEditorCommand(editor, command, options);
      propsRef.current.onSelectionFormatChange(collectActiveEditorCommands(editor));
      return didRun;
    },
    getLinkDetails() {
      const editor = editorRef.current;
      return editor
        ? getEditorLinkDetails(editor)
        : { text: "", url: "", isEditing: false };
    },
    getMarkdown() {
      const editor = editorRef.current;
      if (!editor) {
        return latestMarkdownRef.current;
      }

      return joinMarkdownDocument(envelopeRef.current, getEditorMarkdown(editor));
    },
    focus() {
      const editor = editorRef.current;
      if (editor) {
        editor.action((ctx) => {
          ctx.get(editorViewCtx).focus();
        });
      }
    }
  }));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const initialEnvelope = splitMarkdownDocument(latestMarkdownRef.current);
    envelopeRef.current = initialEnvelope;
    let disposed = false;
    const editor = createMarkdownEditor({
      root,
      body: initialEnvelope.body,
      workspacePath: props.notePath ? props.workspacePath : null,
      notePath: props.notePath,
      disabled: props.disabled,
      onBodyChange(body) {
        if (disposed || replacingExternallyRef.current) {
          return;
        }

        const markdown = joinMarkdownDocument(envelopeRef.current, body);
        lastEmittedMarkdownRef.current = markdown;
        latestMarkdownRef.current = markdown;
        propsRef.current.onChange(markdown);
      },
      onSelectionFormatChange(commands) {
        propsRef.current.onSelectionFormatChange(commands);
      },
      onLinkDialogRequest(details) {
        propsRef.current.onLinkDialogRequest(details);
      },
      onImagePaste(payload) {
        propsRef.current.onImagePaste(payload);
      },
      onLocalLinkRequest(url) {
        propsRef.current.onLocalLinkRequest(url);
      }
    });

    void editor.create().then(() => {
      if (disposed) {
        return editor.destroy();
      }

      editorRef.current = editor;
      setEditorEditable(editor, !propsRef.current.disabled);
      propsRef.current.onSelectionFormatChange(collectActiveEditorCommands(editor));
    });

    return () => {
      disposed = true;
      if (editorRef.current === editor) {
        editorRef.current = null;
      }
      propsRef.current.onSelectionFormatChange(new Set());
      void editor.destroy();
    };
  }, [props.notePath, props.workspacePath]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      setEditorEditable(editor, !props.disabled);
    }
  }, [props.disabled]);

  useEffect(() => {
    const nextEnvelope = splitMarkdownDocument(props.markdown);
    envelopeRef.current = nextEnvelope;

    if (props.markdown === lastEmittedMarkdownRef.current) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const currentBody = getEditorMarkdown(editor);
    if (currentBody !== nextEnvelope.body) {
      replacingExternallyRef.current = true;
      try {
        editor.action(replaceAll(nextEnvelope.body, true));
      } finally {
        replacingExternallyRef.current = false;
      }
    }
  }, [props.markdown]);

  return (
    <div
      ref={containerRef}
      className={`inknest-editor ${props.lineWrap ? "" : "inknest-editor-no-wrap"}`}
      data-placeholder="Start writing..."
      onMouseMove={handleEditorMouseMove}
      onMouseLeave={() => {
        setBlockAction(null);
        setTableCellAction(null);
      }}
    >
      <div ref={rootRef} className="inknest-editor-root" />
      {blockAction ? (
        <>
          <button
            type="button"
            className="inknest-block-handle"
            style={{ top: blockAction.top, left: blockAction.left }}
            aria-label={`Block actions for ${blockActionLabel(blockAction.kind)}`}
            aria-haspopup="menu"
            aria-expanded={blockAction.menuOpen}
            title="Block actions"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              setBlockAction((current) =>
                current ? { ...current, menuOpen: !current.menuOpen } : current
              );
            }}
          >
            <Grip size={16} />
          </button>
          {blockAction.menuOpen ? (
            <div
              className="inknest-block-menu"
              style={{ top: blockAction.top + 30, left: blockAction.left }}
              role="menu"
              aria-label={`${blockActionLabel(blockAction.kind)} actions`}
            >
              <button
                type="button"
                className="inknest-block-menu-item"
                role="menuitem"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  deleteHoveredBlock();
                }}
              >
                <Trash2 size={14} />
                <span>Delete {blockActionLabel(blockAction.kind)}</span>
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      {tableCellAction ? (
        <>
          <button
            type="button"
            className="inknest-table-cell-handle"
            style={{ top: tableCellAction.top, left: tableCellAction.left }}
            aria-label="Table cell actions"
            aria-haspopup="menu"
            aria-expanded={tableCellAction.menuOpen}
            title="Table cell actions"
            disabled={props.disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              setTableCellAction((current) =>
                current ? { ...current, menuOpen: !current.menuOpen } : current
              );
            }}
          >
            <MoreHorizontal size={15} />
          </button>
          {tableCellAction.menuOpen ? (
            <div
              className="inknest-table-cell-menu"
              style={{ top: tableCellAction.top + 28, left: tableCellAction.menuLeft }}
              role="menu"
              aria-label="Table cell actions"
            >
              {tableCellActions.map(({ action, label }) => (
                <button
                  key={action}
                  type="button"
                  className="inknest-block-menu-item"
                  role="menuitem"
                  disabled={props.disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.stopPropagation();
                    runHoveredTableAction(action);
                  }}
                >
                  {action.startsWith("delete") ? <Trash2 size={14} /> : <CirclePlus size={14} />}
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
});
