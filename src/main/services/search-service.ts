import { readFile } from "node:fs/promises";
import type {
  NoteSummary,
  SearchResult,
  TagSummary
} from "../../shared/ipc";
import {
  scanMarkdownNotes,
  extractFrontmatterTags
} from "./note-service";
import { resolveInsideWorkspace } from "./path-utils";

export type IndexedNote = NoteSummary & {
  tags: string[];
  body: string;
  content: string;
  searchText: string;
};

/**
 * Small-workspace search index. The index deliberately stays in memory so the
 * Markdown files remain the source of truth and the app remains dependency
 * light and offline-friendly.
 */
export class InMemorySearchIndex {
  private workspaceRoot: string | null = null;
  private entries = new Map<string, IndexedNote>();

  async rebuild(nextWorkspaceRoot: string) {
    const root = resolveInsideWorkspace(nextWorkspaceRoot);
    const notes = await scanMarkdownNotes(root);
    const nextEntries = new Map<string, IndexedNote>();

    for (const note of notes) {
      const absolutePath = resolveInsideWorkspace(root, note.path);
      const content = await readFile(absolutePath, "utf8");
      const tags = extractFrontmatterTags(content);
      const indexedNote: IndexedNote = {
        ...note,
        tags,
        body: stripFrontmatter(content),
        content,
        searchText: normalizeSearchText(
          [note.title, note.path, content, tags.join(" ")].join(" ")
        )
      };

      nextEntries.set(note.path, indexedNote);
    }

    this.workspaceRoot = root;
    this.entries = nextEntries;
    return this;
  }

  async ensureWorkspace(nextWorkspaceRoot: string) {
    const root = resolveInsideWorkspace(nextWorkspaceRoot);

    if (this.workspaceRoot !== root) {
      await this.rebuild(root);
    }

    return this;
  }

  clear() {
    this.workspaceRoot = null;
    this.entries.clear();
  }

  getWorkspaceRoot() {
    return this.workspaceRoot;
  }

  getEntries() {
    return [...this.entries.values()];
  }

  search(query = "", tag?: string): SearchResult[] {
    const normalizedQuery = normalizeSearchText(query);
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    const normalizedTag = tag ? normalizeSearchText(tag) : "";
    const results: Array<{ result: SearchResult; score: number }> = [];

    for (const note of this.entries.values()) {
      if (
        normalizedTag &&
        !note.tags.some((noteTag) => normalizeSearchText(noteTag) === normalizedTag)
      ) {
        continue;
      }

      if (terms.length > 0 && !terms.every((term) => note.searchText.includes(term))) {
        continue;
      }

      const score = scoreSearchMatch(note, terms);
      results.push({
        result: {
          id: note.id,
          title: note.title,
          path: note.path,
          folderPath: note.folderPath,
          tags: note.tags,
          snippet: createSearchSnippet(note.body, terms)
        },
        score
      });
    }

    return results
      .sort((first, second) =>
        second.score - first.score || first.result.path.localeCompare(second.result.path)
      )
      .map(({ result }) => result);
  }

  listTags(): TagSummary[] {
    const counts = new Map<string, TagSummary>();

    for (const note of this.entries.values()) {
      for (const tag of note.tags) {
        const normalizedTag = normalizeSearchText(tag);
        const existing = counts.get(normalizedTag);

        if (existing) {
          existing.count += 1;
        } else {
          counts.set(normalizedTag, { tag, count: 1 });
        }
      }
    }

    return [...counts.values()].sort(
      (first, second) =>
        second.count - first.count || first.tag.localeCompare(second.tag)
    );
  }
}

export async function buildSearchIndex(workspaceRoot: string) {
  return new InMemorySearchIndex().rebuild(workspaceRoot);
}

export async function buildInMemorySearchIndex(workspaceRoot: string) {
  return buildSearchIndex(workspaceRoot);
}

export function searchNotes(
  index: InMemorySearchIndex,
  query = "",
  tag?: string
) {
  return index.search(query, tag);
}

export function createSearchSnippet(body: string, terms: string[] | string) {
  const normalizedTerms = Array.isArray(terms)
    ? terms.filter(Boolean).map(normalizeSearchText)
    : normalizeSearchText(terms).split(/\s+/).filter(Boolean);
  const cleanBody = body.replace(/\s+/g, " ").trim();

  if (!cleanBody) {
    return "No body preview available.";
  }

  const lowerBody = cleanBody.toLocaleLowerCase();
  const matchIndex = normalizedTerms.reduce((currentIndex, term) => {
    const nextIndex = lowerBody.indexOf(term);
    return currentIndex === -1 ? nextIndex : nextIndex === -1 ? currentIndex : Math.min(currentIndex, nextIndex);
  }, -1);

  if (matchIndex === -1 || cleanBody.length <= 180) {
    return cleanBody.slice(0, 180);
  }

  const start = Math.max(0, matchIndex - 70);
  const end = Math.min(cleanBody.length, matchIndex + 110);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < cleanBody.length ? "…" : "";

  return `${prefix}${cleanBody.slice(start, end).trim()}${suffix}`;
}

function scoreSearchMatch(note: IndexedNote, terms: string[]) {
  if (terms.length === 0) {
    return 0;
  }

  return terms.reduce((score, term) => {
    const normalizedTitle = normalizeSearchText(note.title);
    const normalizedPath = normalizeSearchText(note.path);
    const normalizedTags = normalizeSearchText(note.tags.join(" "));

    if (normalizedTitle.includes(term)) {
      return score + (normalizedTitle === term ? 100 : 60);
    }

    if (normalizedTags.includes(term)) {
      return score + 45;
    }

    if (normalizedPath.includes(term)) {
      return score + 30;
    }

    return score + 10;
  }, 0);
}

export function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

function stripFrontmatter(markdown: string) {
  return markdown.replace(
    /^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/,
    ""
  );
}
