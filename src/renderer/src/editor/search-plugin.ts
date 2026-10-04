import type { Node } from "@milkdown/kit/prose/model";
import { closeHistory } from "@milkdown/kit/prose/history";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export type SearchOptions = { caseSensitive: boolean; wholeWord: boolean; regex: boolean };
export type SearchScope = { from: number; to: number };
export type SearchMatch = SearchScope & { text: string; captures: (string | undefined)[]; groups?: Record<string, string>; input: string; index: number };
export type NoteSearchState = {
  query: string;
  options: SearchOptions;
  scope: SearchScope | null;
  matches: SearchMatch[];
  activeIndex: number;
  error: string | null;
  limited: boolean;
};
type SearchUpdate = Partial<Pick<NoteSearchState, "query" | "options" | "scope">> & { activeIndex?: number; anchor?: number };
export const noteSearchKey = new PluginKey<NoteSearchState>("inknest-note-search");
export const emptySearch: NoteSearchState = {
  query: "", options: { caseSensitive: false, wholeWord: false, regex: false },
  scope: null, matches: [], activeIndex: -1, error: null, limited: false
};
const maxMatches = 10000;
const wordCharacter = /[\p{L}\p{N}\p{M}_]/u;
function characterBefore(text: string, index: number) {
  const code = text.charCodeAt(index - 1);
  return text.slice(index - (code >= 0xdc00 && code <= 0xdfff ? 2 : 1), index);
}

/** Search rendered text, including code and hard breaks, across inline marks. */
export function findNoteMatches(doc: Node, query: string, options: SearchOptions, scope: SearchScope | null = null) {
  const matches: SearchMatch[] = [];
  if (!query) return { matches, error: null, limited: false };
  let expression: RegExp;
  try {
    expression = new RegExp(options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), `gmu${options.caseSensitive ? "" : "i"}`);
  } catch {
    return { matches, error: "Invalid regular expression", limited: false };
  }
  let limited = false;
  doc.descendants((node, pos, parent) => {
    if (!node.isTextblock || limited) return;
    let text = node.textBetween(0, node.content.size, undefined, (leaf) => leaf.type.name === "hardbreak" ? "\n" : "\ufffc");
    // Callout markers are hidden metadata, not editable note text.
    const marker = parent?.type.name === "blockquote" && parent.firstChild === node
      ? text.match(/^\[!(NOTE|WARNING|INFO|SUCCESS)\][ \t]?/i)?.[0] ?? "" : "";
    text = text.slice(marker.length);
    expression.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = expression.exec(text))) {
      const from = pos + 1 + marker.length + match.index;
      const to = from + match[0].length;
      const previous = match.index ? characterBefore(text, match.index) : "";
      const nextCode = text.codePointAt(match.index + match[0].length);
      const next = nextCode === undefined ? "" : String.fromCodePoint(nextCode);
      if ((!scope || (from >= scope.from && to <= scope.to)) && !match[0].includes("\ufffc") &&
          (!options.wholeWord || (!wordCharacter.test(previous) && !wordCharacter.test(next)))) {
        if (matches.length === maxMatches) { limited = true; break; }
        matches.push({ from, to, text: match[0], captures: match.slice(1), groups: match.groups, input: text, index: match.index });
      }
      // RegExp.exec does not advance after a zero-length match.
      if (!match[0].length) expression.lastIndex += (text.codePointAt(expression.lastIndex) ?? 0) > 0xffff ? 2 : 1;
    }
    return false;
  });
  return { matches, error: null, limited };
}

export function createNoteSearchPlugin(onChange: (state: NoteSearchState) => void) {
  return $prose(() => createSearchStatePlugin(onChange));
}

export function createSearchStatePlugin(onChange: (state: NoteSearchState) => void = () => {}) {
  return new Plugin<NoteSearchState>({
    key: noteSearchKey,
    state: {
      init: () => emptySearch,
      apply(tr, previous) {
        const update = tr.getMeta(noteSearchKey) as SearchUpdate | undefined;
        if (!tr.docChanged && !update) return previous;
        const scope = update?.scope !== undefined ? update.scope : previous.scope
          ? { from: tr.mapping.map(previous.scope.from, -1), to: tr.mapping.map(previous.scope.to, 1) } : null;
        const next = { ...previous, ...update, scope };
        if (tr.docChanged || update?.query !== undefined || update?.options || update?.scope !== undefined) {
          Object.assign(next, findNoteMatches(tr.doc, next.query, next.options, scope));
          const anchor = update?.anchor ?? tr.mapping.map(previous.matches[previous.activeIndex]?.from ?? tr.selection.from);
          const index = next.matches.findIndex((match) => match.from >= anchor);
          next.activeIndex = next.matches.length ? index < 0 ? 0 : index : -1;
        } else if (update?.anchor !== undefined) {
          const index = next.matches.findIndex((match) => match.from >= update.anchor!);
          next.activeIndex = next.matches.length ? index < 0 ? 0 : index : -1;
        }
        if (!next.matches.length) next.activeIndex = -1;
        return next;
      }
    },
    props: {
      decorations(state) {
        const search = noteSearchKey.getState(state)!;
        return DecorationSet.create(state.doc, search.matches.map((match, index) => {
          const className = `note-search-match${index === search.activeIndex ? " note-search-current" : ""}`;
          if (match.from !== match.to) return Decoration.inline(match.from, match.to, { class: className });
          return Decoration.widget(match.from, () => {
            const marker = document.createElement("span");
            marker.className = `${className} note-search-zero`;
            marker.setAttribute("aria-hidden", "true");
            return marker;
          });
        }));
      }
    },
    view: () => ({
      update(view, previous) {
        const next = noteSearchKey.getState(view.state)!;
        if (next !== noteSearchKey.getState(previous)) onChange(next);
      }
    })
  });
}

export function updateNoteSearch(view: EditorView, update: SearchUpdate) {
  view.dispatch(view.state.tr.setMeta(noteSearchKey, update).setMeta("addToHistory", false));
}
export function selectNoteMatch(view: EditorView, index: number, focus = false) {
  const search = noteSearchKey.getState(view.state)!;
  const match = search.matches[index];
  if (!match) return false;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, match.from, match.to))
    .setMeta(noteSearchKey, { activeIndex: index }).setMeta("addToHistory", false).scrollIntoView());
  if (focus) view.focus();
  return true;
}

/** VS Code-style replacement groups, with optional case preservation. */
export function replacementFor(match: SearchMatch, replacement: string, regex: boolean, preserveCase: boolean) {
  let value = regex ? replacement.replace(/(\\[ulUL])?(\$\$|\$&|\$0|\$`|\$'|\$\d{1,2}|\$<[^>]+>)/g, (token, casing: string | undefined, group: string) => {
    let captured: string;
    if (group === "$$") captured = "$";
    else if (group === "$&" || group === "$0") captured = match.text;
    else if (group === "$`") captured = match.input.slice(0, match.index);
    else if (group === "$'") captured = match.input.slice(match.index + match.text.length);
    else if (group.startsWith("$<")) captured = match.groups?.[group.slice(2, -1)] ?? "";
    else {
      const index = Number(group.slice(1)) - 1;
      if (index >= match.captures.length) return token;
      captured = match.captures[index] ?? "";
    }
    if (casing === "\\U") return captured.toUpperCase();
    if (casing === "\\L") return captured.toLowerCase();
    if (casing === "\\u") return captured.slice(0, 1).toUpperCase() + captured.slice(1);
    if (casing === "\\l") return captured.slice(0, 1).toLowerCase() + captured.slice(1);
    return captured;
  }) : replacement;
  if (regex) value = value.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  if (preserveCase && value && match.text.toLowerCase() !== match.text.toUpperCase()) {
    if (match.text === match.text.toUpperCase()) value = value.toUpperCase();
    else if (match.text === match.text.toLowerCase()) value = value.toLowerCase();
    else if (match.text[0] === match.text[0].toUpperCase() && match.text.slice(1) === match.text.slice(1).toLowerCase()) value = value[0]?.toUpperCase() + value.slice(1);
  }
  return value;
}

export function replaceNoteMatches(view: Pick<EditorView, "state" | "dispatch" | "editable">, replacement: string, all: boolean, preserveCase = false) {
  const { state } = view;
  const search = noteSearchKey.getState(state)!;
  if (!view.editable || !search.matches.length || search.error || (all && search.limited)) return 0;
  const matches = all ? search.matches : [search.matches[search.activeIndex]];
  if (!matches[0]) return 0;
  const tr = state.tr;
  let nextPosition = matches[0].from;
  for (const match of [...matches].reverse()) {
    const value = replacementFor(match, replacement, search.options.regex, preserveCase);
    const $from = state.doc.resolve(match.from);
    const marks = state.doc.nodeAt(match.from)?.marks ?? $from.marks();
    if ($from.parent.type.spec.code || !value.includes("\n")) {
      tr.replaceWith(match.from, match.to, value ? state.schema.text(value, marks) : []);
    } else {
      const nodes: Node[] = [];
      value.split("\n").forEach((line, index) => {
        if (index) nodes.push(state.schema.nodes.hardbreak.create());
        if (line) nodes.push(state.schema.text(line, marks));
      });
      tr.replaceWith(match.from, match.to, nodes);
    }
    nextPosition = match.from + value.length;
  }
  tr.setMeta(noteSearchKey, { anchor: all ? 0 : nextPosition });
  view.dispatch(closeHistory(tr).scrollIntoView());
  return matches.length;
}
