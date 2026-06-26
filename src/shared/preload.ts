import type {
  AppInfo,
  AppSettings,
  IpcResult,
  NoteSummary,
  OpenExternalLinkPayload,
  SaveSettingsPayload,
  WorkspaceFileModel,
  WorkspaceInfo
} from "./ipc";

export type InkNestApi = {
  app: {
    getInfo: () => Promise<IpcResult<AppInfo>>;
  };
  workspace: {
    getActive: () => Promise<IpcResult<WorkspaceInfo>>;
    choose: () => Promise<IpcResult<WorkspaceInfo>>;
    select: (path: string) => Promise<IpcResult<WorkspaceInfo>>;
    scan: () => Promise<IpcResult<WorkspaceFileModel>>;
  };
  notes: {
    list: () => Promise<IpcResult<NoteSummary[]>>;
    read: (path: string) => Promise<IpcResult<{ path: string; markdown: string }>>;
  };
  settings: {
    get: () => Promise<IpcResult<AppSettings>>;
    save: (payload: SaveSettingsPayload) => Promise<IpcResult<AppSettings>>;
  };
  links: {
    openExternal: (
      payload: OpenExternalLinkPayload
    ) => Promise<IpcResult<{ opened: true }>>;
  };
  dialogs: {
    selectImage: () => Promise<IpcResult<{ canceled: true; path: null }>>;
  };
  export: {
    note: (path: string) => Promise<IpcResult<{ queued: false; path: string }>>;
  };
};
