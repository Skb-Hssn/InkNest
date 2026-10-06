import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Replace, ReplaceAll, TextSelect, X } from "lucide-react";
import type { NoteSearchState, SearchOptions } from "./search-plugin";

type Props = {
  query: string;
  replacement: string;
  replaceOpen: boolean;
  options: SearchOptions;
  preserveCase: boolean;
  selectionOnly: boolean;
  hasSelection: boolean;
  search: NoteSearchState;
  focusToken: number;
  disabled: boolean;
  message: string;
  onQuery: (query: string) => void;
  onReplacement: (replacement: string) => void;
  onToggleReplace: () => void;
  onOptions: (options: SearchOptions) => void;
  onPreserveCase: () => void;
  onSelectionOnly: () => void;
  onNavigate: (direction: number) => void;
  onReplace: (all: boolean) => void;
  onClose: () => void;
};

export function FindReplaceBar(props: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [props.focusToken]);
  const toggle = (key: keyof SearchOptions) => props.onOptions({ ...props.options, [key]: !props.options[key] });
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); props.onClose(); }
    else if (event.key === "Enter" && event.target instanceof HTMLTextAreaElement && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if ((event.target as HTMLElement).getAttribute("aria-label") === "Replace with") props.onReplace(false);
      else props.onNavigate(event.shiftKey ? -1 : 1);
    } else if (event.altKey && !event.ctrlKey && !event.metaKey) {
      const key = event.key.toLowerCase();
      if (["c", "w", "r", "p"].includes(key)) {
        event.preventDefault();
        if (key === "p") props.onPreserveCase();
        else toggle(key === "c" ? "caseSensitive" : key === "w" ? "wholeWord" : "regex");
      }
    }
  };
  const count = props.search.matches.length;
  const canReplace = count > 0 && !props.search.error && !props.disabled;
  return (
    <div className="note-find-widget" role="region" aria-label="Find in note" onKeyDown={handleKey}>
      <button className="note-find-expand" type="button" aria-label="Toggle replace" aria-expanded={props.replaceOpen}
        onClick={props.onToggleReplace} title="Toggle replace">
        {props.replaceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      <div className="note-find-fields">
        <div className="note-find-row">
          <div className={`note-find-input${props.search.error ? " note-find-input-error" : ""}`}>
            <textarea ref={inputRef} rows={1} aria-label="Find in note" placeholder="Find" value={props.query}
              spellCheck={false} onChange={(event) => props.onQuery(event.target.value)} />
            <button type="button" aria-label="Match case" title="Match case (Alt+C)" aria-pressed={props.options.caseSensitive} onClick={() => toggle("caseSensitive")}>Aa</button>
            <button type="button" aria-label="Match whole word" title="Match whole word (Alt+W)" aria-pressed={props.options.wholeWord} onClick={() => toggle("wholeWord")}><span className="note-find-word">Ab</span></button>
            <button type="button" aria-label="Use regular expression" title="Use regular expression (Alt+R)" aria-pressed={props.options.regex} onClick={() => toggle("regex")}>.*</button>
          </div>
          <span className="note-find-count" role="status" aria-live="polite">{props.search.error ? "Invalid pattern" : !props.query ? "" : count ? `${props.search.activeIndex + 1} of ${count}${props.search.limited ? "+" : ""}` : "No results"}</span>
          <button type="button" aria-label="Previous match" title="Previous match (Shift+Enter)" disabled={!count} onClick={() => props.onNavigate(-1)}><ArrowUp size={16} /></button>
          <button type="button" aria-label="Next match" title="Next match (Enter)" disabled={!count} onClick={() => props.onNavigate(1)}><ArrowDown size={16} /></button>
          <button type="button" aria-label="Find in selection" title="Find in selection" aria-pressed={props.selectionOnly} disabled={!props.hasSelection} onClick={props.onSelectionOnly}><TextSelect size={16} /></button>
          <button type="button" aria-label="Close find" title="Close (Escape)" onClick={props.onClose}><X size={16} /></button>
        </div>
        {props.replaceOpen ? (
          <div className="note-find-row note-replace-row">
            <div className="note-find-input">
              <textarea rows={1} aria-label="Replace with" placeholder="Replace" value={props.replacement} spellCheck={false}
                onChange={(event) => props.onReplacement(event.target.value)} />
              <button type="button" aria-label="Preserve case" title="Preserve case (Alt+P)" aria-pressed={props.preserveCase} onClick={props.onPreserveCase}>AB</button>
            </div>
            <button type="button" aria-label="Replace" title="Replace current match (Enter)" disabled={!canReplace} onMouseDown={(event) => event.preventDefault()} onClick={() => props.onReplace(false)}><span>Replace</span></button>
            <button type="button" aria-label="Replace all" title="Replace all matches" disabled={!canReplace || props.search.limited} onMouseDown={(event) => event.preventDefault()} onClick={() => props.onReplace(true)}><span>Replace All</span></button>
          </div>
        ) : null}
        {props.search.error || props.search.limited || props.message ? (
          <p className={`note-find-message${props.search.error ? " note-find-error" : ""}`} role="status">
            {props.search.error ?? (props.search.limited ? "Too many matches. Narrow your search to replace all." : props.message)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
