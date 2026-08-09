import { stat } from "node:fs/promises";
import path from "node:path";
import { shell } from "electron";
import { ipcChannels, type ResolvedLocalLink } from "../../shared/ipc";
import { invalidPayload } from "./errors";
import {
  assertActiveWorkspace,
  assertPlainObject,
  assertSafeExternalUrl,
  assertString,
  type ActiveWorkspaceState
} from "./validation";
import { registerIpcHandler } from "./register";
import { resolveInsideWorkspace, toWorkspaceRelativePath } from "../services/path-utils";

export function registerLinkHandlers(activeWorkspace: ActiveWorkspaceState) {
  registerIpcHandler<{ opened: true }>(ipcChannels.links.openExternal, async (payload) => {
    assertPlainObject(payload);
    await shell.openExternal(assertSafeExternalUrl(payload.url));

    return {
      opened: true
    };
  });

  registerIpcHandler<ResolvedLocalLink>(
    ipcChannels.links.resolveLocal,
    async (payload) => {
      assertPlainObject(payload);
      const workspaceRoot = assertActiveWorkspace(activeWorkspace);
      const sourcePath = resolveInsideWorkspace(
        workspaceRoot,
        assertString(payload.fromPath, "fromPath")
      );
      const requestedUrl = assertString(payload.url, "url");

      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(requestedUrl)) {
        throw invalidPayload("Only local Markdown links can be opened here.");
      }

      const [pathPart, anchorPart] = requestedUrl.split("#", 2);
      let decodedPath: string;
      let anchor: string | null = null;

      try {
        decodedPath = decodeURIComponent(pathPart || ".");
        anchor = anchorPart ? `#${decodeURIComponent(anchorPart)}` : null;
      } catch {
        throw invalidPayload("The local link is not valid.");
      }

      const targetPath = resolveInsideWorkspace(
        workspaceRoot,
        path.relative(workspaceRoot, path.resolve(path.dirname(sourcePath), decodedPath))
      );
      const targetStats = await stat(targetPath).catch(() => null);

      if (
        !targetStats?.isFile() ||
        path.extname(targetPath).toLowerCase() !== ".md"
      ) {
        throw invalidPayload("The local link does not point to a Markdown note.");
      }

      return {
        path: toWorkspaceRelativePath(workspaceRoot, targetPath),
        anchor
      };
    }
  );
}
