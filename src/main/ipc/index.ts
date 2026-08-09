import { BrowserWindow } from "electron";
import { registerAppHandlers } from "./app";
import { registerDialogHandlers } from "./dialogs";
import { registerExportHandlers } from "./export";
import { registerFolderHandlers } from "./folders";
import { registerLinkHandlers } from "./links";
import { registerNoteHandlers } from "./notes";
import { registerSettingsHandlers } from "./settings";
import { registerSearchHandlers } from "./search";
import { registerWorkspaceHandlers, restoreLastWorkspace } from "./workspace";
import { InMemorySearchIndex } from "../services/search-service";
import { WorkspaceWatcher } from "../services/workspace-watcher";
import { ipcChannels } from "../../shared/ipc";
import type { ActiveWorkspaceState } from "./validation";

export async function registerIpcHandlers() {
  const activeWorkspace: ActiveWorkspaceState = {
    path: null,
    restoreStatus: "none",
    restoreMessage: "Choose a local Markdown folder to begin."
  };

  await restoreLastWorkspace(activeWorkspace);
  const searchIndex = new InMemorySearchIndex();
  const workspaceWatcher = new WorkspaceWatcher(async (change) => {
    if (change.workspaceStatus === "ready") {
      await searchIndex.rebuild(change.workspacePath).catch(() => undefined);
    } else {
      searchIndex.clear();
    }

    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(ipcChannels.workspace.changed, change);
      }
    }
  });

  if (activeWorkspace.path) {
    await searchIndex.rebuild(activeWorkspace.path);
    await workspaceWatcher.watch(activeWorkspace.path);
  }

  registerAppHandlers();
  registerWorkspaceHandlers(activeWorkspace, searchIndex, workspaceWatcher);
  registerNoteHandlers(activeWorkspace, searchIndex);
  registerFolderHandlers(activeWorkspace, searchIndex);
  registerSettingsHandlers();
  registerSearchHandlers(activeWorkspace, searchIndex);
  registerLinkHandlers(activeWorkspace);
  registerDialogHandlers(activeWorkspace);
  registerExportHandlers(activeWorkspace);
}
