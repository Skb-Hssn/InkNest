import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels } from "../shared/ipc";
import type { InkNestApi } from "../shared/preload";

const subscribeToIpcMessage = ipcRenderer["on"].bind(ipcRenderer);
const unsubscribeFromIpcMessage = ipcRenderer["removeListener"].bind(ipcRenderer);
const sendIpcMessage = ipcRenderer["send"].bind(ipcRenderer);

const inknestApi: InkNestApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(ipcChannels.app.getInfo),
    getWindowState: () => ipcRenderer.invoke(ipcChannels.app.getWindowState),
    minimizeWindow: () => ipcRenderer.invoke(ipcChannels.app.minimizeWindow),
    toggleMaximizeWindow: () =>
      ipcRenderer.invoke(ipcChannels.app.toggleMaximizeWindow),
    closeWindow: () => ipcRenderer.invoke(ipcChannels.app.closeWindow),
    onWindowStateChanged: (listener) => {
      const handler = (_event: unknown, state: Parameters<typeof listener>[0]) =>
        listener(state);
      subscribeToIpcMessage(ipcChannels.app.windowStateChanged, handler);

      return () => {
        unsubscribeFromIpcMessage(ipcChannels.app.windowStateChanged, handler);
      };
    },
    onPrepareToClose: (listener) => {
      const handler = () => listener();
      subscribeToIpcMessage(ipcChannels.app.prepareToClose, handler);

      return () => {
        unsubscribeFromIpcMessage(ipcChannels.app.prepareToClose, handler);
      };
    },
    closeReady: () => {
      sendIpcMessage(ipcChannels.app.closeReady);
    },
    closeCanceled: () => {
      sendIpcMessage(ipcChannels.app.closeCanceled);
    }
  },
  workspace: {
    getActive: () => ipcRenderer.invoke(ipcChannels.workspace.getActive),
    choose: () => ipcRenderer.invoke(ipcChannels.workspace.choose),
    select: (path) => ipcRenderer.invoke(ipcChannels.workspace.select, { path }),
    scan: () => ipcRenderer.invoke(ipcChannels.workspace.scan),
    onChanged: (listener) => {
      const handler = (_event: unknown, change: Parameters<typeof listener>[0]) =>
        listener(change);
      subscribeToIpcMessage(ipcChannels.workspace.changed, handler);

      return () => {
        unsubscribeFromIpcMessage(ipcChannels.workspace.changed, handler);
      };
    }
  },
  notes: {
    list: () => ipcRenderer.invoke(ipcChannels.notes.list),
    read: (path) => ipcRenderer.invoke(ipcChannels.notes.read, { path }),
    create: (payload = {}) => ipcRenderer.invoke(ipcChannels.notes.create, payload),
    rename: (payload) => ipcRenderer.invoke(ipcChannels.notes.rename, payload),
    duplicate: (payload) => ipcRenderer.invoke(ipcChannels.notes.duplicate, payload),
    move: (payload) => ipcRenderer.invoke(ipcChannels.notes.move, payload),
    save: (payload) => ipcRenderer.invoke(ipcChannels.notes.save, payload),
    importFiles: (payload = {}) =>
      ipcRenderer.invoke(ipcChannels.notes.importFiles, payload),
    importFolder: (payload = {}) =>
      ipcRenderer.invoke(ipcChannels.notes.importFolder, payload),
    delete: (payload) => ipcRenderer.invoke(ipcChannels.notes.delete, payload),
    listTrash: () => ipcRenderer.invoke(ipcChannels.notes.listTrash),
    restore: (payload) => ipcRenderer.invoke(ipcChannels.notes.restore, payload),
    permanentlyDelete: (payload) =>
      ipcRenderer.invoke(ipcChannels.notes.permanentlyDelete, payload)
  },
  folders: {
    create: (payload = {}) => ipcRenderer.invoke(ipcChannels.folders.create, payload),
    rename: (payload) => ipcRenderer.invoke(ipcChannels.folders.rename, payload),
    move: (payload) => ipcRenderer.invoke(ipcChannels.folders.move, payload),
    delete: (payload) => ipcRenderer.invoke(ipcChannels.folders.delete, payload)
  },
  settings: {
    get: () => ipcRenderer.invoke(ipcChannels.settings.get),
    save: (payload) => ipcRenderer.invoke(ipcChannels.settings.save, payload),
    clearRecentWorkspaces: () =>
      ipcRenderer.invoke(ipcChannels.settings.clearRecentWorkspaces)
  },
  links: {
    openExternal: (payload) =>
      ipcRenderer.invoke(ipcChannels.links.openExternal, payload),
    resolveLocal: (payload) =>
      ipcRenderer.invoke(ipcChannels.links.resolveLocal, payload)
  },
  dialogs: {
    selectImage: () => ipcRenderer.invoke(ipcChannels.dialogs.selectImage),
    saveImage: (payload) =>
      ipcRenderer.invoke(ipcChannels.dialogs.saveImage, payload)
  },
  export: {
    note: (payload) =>
      ipcRenderer.invoke(
        ipcChannels.export.note,
        typeof payload === "string" ? { path: payload } : payload
      )
  },
  search: {
    query: (payload = {}) => ipcRenderer.invoke(ipcChannels.search.query, payload),
    listTags: () => ipcRenderer.invoke(ipcChannels.search.listTags)
  }
};

contextBridge.exposeInMainWorld("inknest", inknestApi);
