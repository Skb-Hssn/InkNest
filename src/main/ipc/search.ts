import {
  ipcChannels,
  type SearchNotesPayload,
  type SearchResult,
  type TagSummary
} from "../../shared/ipc";
import { InMemorySearchIndex } from "../services/search-service";
import {
  assertActiveWorkspace,
  assertPlainObject,
  type ActiveWorkspaceState
} from "./validation";
import { invalidPayload } from "./errors";
import { registerIpcHandler } from "./register";

export function registerSearchHandlers(
  activeWorkspace: ActiveWorkspaceState,
  searchIndex: InMemorySearchIndex
) {
  registerIpcHandler<SearchResult[]>(ipcChannels.search.query, async (payload = {}) => {
    assertPlainObject(payload);
    const workspaceRoot = assertActiveWorkspace(activeWorkspace);
    const request = readSearchPayload(payload);

    await searchIndex.ensureWorkspace(workspaceRoot);
    return searchIndex.search(request.query, request.tag);
  });

  registerIpcHandler<TagSummary[]>(ipcChannels.search.listTags, async () => {
    const workspaceRoot = assertActiveWorkspace(activeWorkspace);

    await searchIndex.ensureWorkspace(workspaceRoot);
    return searchIndex.listTags();
  });
}

function readSearchPayload(payload: Record<string, unknown>): SearchNotesPayload {
  return {
    query: readOptionalText(payload.query, "query") ?? "",
    tag: readOptionalText(payload.tag, "tag")
  };
}

function readOptionalText(value: unknown, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw invalidPayload(`${fieldName} must be a string.`);
  }

  return value.trim();
}

