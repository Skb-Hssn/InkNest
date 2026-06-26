import { registerAppHandlers } from "./app";
import { registerDialogHandlers } from "./dialogs";
import { registerExportHandlers } from "./export";
import { registerLinkHandlers } from "./links";
import { registerNoteHandlers } from "./notes";
import { registerSettingsHandlers } from "./settings";
import { registerWorkspaceHandlers, restoreLastWorkspace } from "./workspace";
import type { ActiveWorkspaceState } from "./validation";

export async function registerIpcHandlers() {
  const activeWorkspace: ActiveWorkspaceState = {
    path: null,
    restoreStatus: "none",
    restoreMessage: "Choose a local Markdown folder to begin."
  };

  await restoreLastWorkspace(activeWorkspace);

  registerAppHandlers();
  registerWorkspaceHandlers(activeWorkspace);
  registerNoteHandlers(activeWorkspace);
  registerSettingsHandlers();
  registerLinkHandlers();
  registerDialogHandlers();
  registerExportHandlers(activeWorkspace);
}
