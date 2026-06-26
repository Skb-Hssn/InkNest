import { registerAppHandlers } from "./app";
import { registerDialogHandlers } from "./dialogs";
import { registerExportHandlers } from "./export";
import { registerLinkHandlers } from "./links";
import { registerNoteHandlers } from "./notes";
import { registerSettingsHandlers } from "./settings";
import { registerWorkspaceHandlers } from "./workspace";
import type { ActiveWorkspaceState } from "./validation";

export function registerIpcHandlers() {
  const activeWorkspace: ActiveWorkspaceState = {
    path: null
  };

  registerAppHandlers();
  registerWorkspaceHandlers(activeWorkspace);
  registerNoteHandlers(activeWorkspace);
  registerSettingsHandlers();
  registerLinkHandlers();
  registerDialogHandlers();
  registerExportHandlers(activeWorkspace);
}
