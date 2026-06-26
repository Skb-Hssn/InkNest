import { contextBridge, ipcRenderer } from "electron";
import { ipcChannels } from "../shared/ipc";
import type { InkNestApi } from "../shared/preload";

const inknestApi: InkNestApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(ipcChannels.app.getInfo)
  },
  workspace: {
    getActive: () => ipcRenderer.invoke(ipcChannels.workspace.getActive),
    choose: () => ipcRenderer.invoke(ipcChannels.workspace.choose),
    select: (path) => ipcRenderer.invoke(ipcChannels.workspace.select, { path })
  },
  notes: {
    list: () => ipcRenderer.invoke(ipcChannels.notes.list),
    read: (path) => ipcRenderer.invoke(ipcChannels.notes.read, { path })
  },
  settings: {
    get: () => ipcRenderer.invoke(ipcChannels.settings.get),
    save: (payload) => ipcRenderer.invoke(ipcChannels.settings.save, payload)
  },
  links: {
    openExternal: (payload) =>
      ipcRenderer.invoke(ipcChannels.links.openExternal, payload)
  },
  dialogs: {
    selectImage: () => ipcRenderer.invoke(ipcChannels.dialogs.selectImage)
  },
  export: {
    note: (path) => ipcRenderer.invoke(ipcChannels.export.note, { path })
  }
};

contextBridge.exposeInMainWorld("inknest", inknestApi);
