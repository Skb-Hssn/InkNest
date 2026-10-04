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
import { TextSelection } from "@milkdown/kit/prose/state";
import { FindReplaceBar } from "./FindReplaceBar";
import { HeadingMinimap, collectNoteHeadings, type NoteHeading } from "./HeadingMinimap";
import { emptySearch, noteSearchKey, updateNoteSearch, selectNoteMatch, replaceNoteMatches,
  type NoteSearchState, type SearchOptions, type SearchScope } from "./search-plugin";
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [headings, setHeadings] = useState<NoteHeading[]>([]);
  const [activeHeading, setActiveHeading] = useState<number | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(emptySearch.options);
  const [preserveCase, setPreserveCase] = useState(false);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const searchSelectionRef = useRef<SearchScope | null>(null);
  const pendingNavigationRef = useRef<number | null>(null);
  const [search, setSearch] = useState<NoteSearchState>(emptySearch);
  const [findFocusToken, setFindFocusToken] = useState(0);
  const [replaceMessage, setReplaceMessage] = useState("");
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

  function refreshHeadings(editor: Editor) {
    const next = editor.action((ctx) => collectNoteHeadings(ctx.get(editorViewCtx).state.doc));
    setHeadings((previous) => previous.length === next.length && previous.every((heading, index) =>
      heading.position === next[index].position && heading.text === next[index].text && heading.level === next[index].level
    ) ? previous : next);
  }

  function openSearch(mode: "find" | "replace", seedSelection = true) {
    const editor = editorRef.current;
    if (!editor) return;
    if (!findOpen && seedSelection) {
      editor.action((ctx) => {
        const { state } = ctx.get(editorViewCtx);
        const { from, to, empty } = state.selection;
        searchSelectionRef.current = empty ? null : { from, to };
        setSelectionOnly(false);
        const selected = state.doc.textBetween(from, to, "\n");
        if (selected && selected.length < 1000) setQuery(selected);
      });
    }
    setFindOpen(true);
    setReplaceOpen(mode === "replace");
    setReplaceMessage("");
    setFindFocusToken((token) => token + 1);
  }
  function closeSearch() {
    setFindOpen(false);
    setReplaceMessage("");
    editorRef.current?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      updateNoteSearch(view, { query: "", scope: null });
      view.focus();
    });
  }
  function navigateMatch(direction: number) {
    editorRef.current?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const current = noteSearchKey.getState(view.state)!;
      if (!current.matches.length) return;
      const active = current.matches[current.activeIndex];
      const selection = view.state.selection;
      let index = (current.activeIndex + direction + current.matches.length) % current.matches.length;
      if (!active || selection.from !== active.from || selection.to !== active.to) {
        index = direction > 0 ? current.matches.findIndex((match) => match.from >= selection.to)
          : current.matches.length - 1 - [...current.matches].reverse().findIndex((match) => match.to <= selection.from);
        if (index < 0 || index >= current.matches.length) index = direction > 0 ? 0 : current.matches.length - 1;
      }
      selectNoteMatch(view, index);
    });
    setReplaceMessage("");
  }
  function replaceMatches(all: boolean) {
    if (propsRef.current.disabled) return;
    editorRef.current?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const count = replaceNoteMatches(view, replacement, all, preserveCase);
      setReplaceMessage(count ? `Replaced ${count} ${count === 1 ? "match" : "matches"}` : "No matches to replace");
      const current = noteSearchKey.getState(view.state)!;
      if (current.matches.length) selectNoteMatch(view, current.activeIndex);
    });
  }
  function navigateHeading(heading: NoteHeading) {
    editorRef.current?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(heading.position + 1)))
        .setMeta("addToHistory", false));
      view.focus();
      const element = view.nodeDOM(heading.position);
      const scroller = scrollRef.current;
      if (element instanceof HTMLElement && scroller) {
        scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 24;
      }
      setActiveHeading(heading.position);
    });
  }

  useEffect(() => {
    if (!editorReady) return;
    editorRef.current?.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      updateNoteSearch(view, {
        query: findOpen ? query : "", options: searchOptions,
        scope: findOpen && selectionOnly ? searchSelectionRef.current : null,
        anchor: view.state.selection.from
      });
      const current = noteSearchKey.getState(view.state)!;
      if (findOpen && current.matches.length) {
        if (pendingNavigationRef.current !== null) navigateMatch(pendingNavigationRef.current);
        else selectNoteMatch(view, current.activeIndex);
      }
      pendingNavigationRef.current = null;
    });
    setReplaceMessage("");
  }, [editorReady, findOpen, query, searchOptions, selectionOnly]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "F3" && query) {
        event.preventDefault();
        if (!findOpen) {
          pendingNavigationRef.current = event.shiftKey ? -1 : 1;
          openSearch("find", false);
        } else navigateMatch(event.shiftKey ? -1 : 1);
      } else if (event.key === "Escape" && findOpen &&
        event.target instanceof HTMLElement && containerRef.current?.contains(event.target)) {
        event.preventDefault();
        closeSearch();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [findOpen, query]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !editorReady) return;
    let frame = 0;
    const update = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const top = scroller.getBoundingClientRect().top + 80;
      let position = headings[0]?.position ?? null;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        for (const heading of headings) {
          const node = view.nodeDOM(heading.position);
          if (node instanceof HTMLElement && node.getBoundingClientRect().top <= top) position = heading.position;
          else break;
        }
      });
      if (scroller.scrollHeight > scroller.clientHeight + 3 &&
          scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 3) {
        position = headings.at(-1)?.position ?? position;
      }
      setActiveHeading(position);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    schedule();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [editorReady, headings, props.fullWidth, props.showOutline, props.lineWrap]);

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
    openSearch,
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
        if (!disposed) refreshHeadings(editor);
      },
      onSearchChange(next) {
        if (!disposed) {
          setSearch(next);
          if (next.scope) searchSelectionRef.current = next.scope;
        }
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
      setEditorReady(true);
      refreshHeadings(editor);
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
    <div className={`note-workspace${props.showOutline ? " note-workspace-with-outline" : ""}`}>
      <div className="note-editor-column">
        {findOpen ? <FindReplaceBar query={query} replacement={replacement} replaceOpen={replaceOpen}
          options={searchOptions} preserveCase={preserveCase} selectionOnly={selectionOnly}
          hasSelection={Boolean(searchSelectionRef.current)} search={search} focusToken={findFocusToken}
          disabled={props.disabled} message={replaceMessage} onQuery={setQuery} onReplacement={setReplacement}
          onToggleReplace={() => setReplaceOpen((open) => !open)} onOptions={setSearchOptions}
          onPreserveCase={() => setPreserveCase((enabled) => !enabled)} onSelectionOnly={() => setSelectionOnly((enabled) => !enabled)}
          onNavigate={navigateMatch} onReplace={replaceMatches} onClose={closeSearch} /> : null}
        <div ref={scrollRef} className="note-writing-scroll">
    <div
      ref={containerRef}
      className={`inknest-editor ${props.lineWrap ? "" : "inknest-editor-no-wrap"} ${props.fullWidth ? "inknest-editor-full-width" : ""}`}
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
        </div>
      </div>
      {props.showOutline ? <HeadingMinimap headings={headings} activePosition={activeHeading} onNavigate={navigateHeading} /> : null}
    </div>
  );
});
