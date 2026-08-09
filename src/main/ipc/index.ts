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
import type { ActiveWorkspaceState } from "./validation";

export async function registerIpcHandlers() {
  const activeWorkspace: ActiveWorkspaceState = {
    path: null,
    restoreStatus: "none",
    restoreMessage: "Choose a local Markdown folder to begin."
  };

  await restoreLastWorkspace(activeWorkspace);
  const searchIndex = new InMemorySearchIndex();

  if (activeWorkspace.path) {
    await searchIndex.rebuild(activeWorkspace.path);
  }

  registerAppHandlers();
  registerWorkspaceHandlers(activeWorkspace, searchIndex);
  registerNoteHandlers(activeWorkspace, searchIndex);
  registerFolderHandlers(activeWorkspace, searchIndex);
  registerSettingsHandlers();
  registerSearchHandlers(activeWorkspace, searchIndex);
  registerLinkHandlers(activeWorkspace);
  registerDialogHandlers(activeWorkspace);
  registerExportHandlers(activeWorkspace);
}
