import { BrowserWindow } from "electron";
import { ipcChannels, type AppInfo, type AppWindowState } from "../../shared/ipc";
import { registerIpcHandler } from "./register";

export function registerAppHandlers() {
  registerIpcHandler<AppInfo>(ipcChannels.app.getInfo, () => ({
    name: "InkNest",
    // Previous milestones: phase-9-toolbar-editing-commands, phase-10-autosave-safe-writes,
    // phase-11-search-and-tags, phase-12-import-assets-links, phase-13-export,
    // phase-14-settings-and-themes, phase-15-reliability-and-external-changes,
    // and phase-16-accessibility-and-ui-polish.
    phase: "phase-17-release-validation"
  }));

  registerIpcHandler<AppWindowState>(
    ipcChannels.app.getWindowState,
    (_payload, event) => getWindowState(event)
  );

  registerIpcHandler<AppWindowState>(
    ipcChannels.app.minimizeWindow,
    (_payload, event) => {
      const window = getSenderWindow(event);
      window.minimize();
      return getWindowState(event);
    }
  );

  registerIpcHandler<AppWindowState>(
    ipcChannels.app.toggleMaximizeWindow,
    (_payload, event) => {
      const window = getSenderWindow(event);

      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }

      return getWindowState(event);
    }
  );

  registerIpcHandler<{ closing: true }>(
    ipcChannels.app.closeWindow,
    (_payload, event) => {
      getSenderWindow(event).close();
      return { closing: true };
    }
  );
}

export function getWindowState(event: Electron.IpcMainInvokeEvent): AppWindowState {
  return {
    isMaximized: getSenderWindow(event).isMaximized()
  };
}

function getSenderWindow(event: Electron.IpcMainInvokeEvent) {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window || window.isDestroyed()) {
    throw new Error("The application window is no longer available.");
  }

  return window;
}
