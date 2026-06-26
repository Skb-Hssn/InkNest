export type IpcSuccess<T> = {
  ok: true;
  data: T;
};

export type IpcFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type IpcResult<T> = IpcSuccess<T> | IpcFailure;

export type AppInfo = {
  name: "InkNest";
  phase: "phase-2-secure-boundary";
};

export type WorkspaceInfo = {
  path: string | null;
  name: string | null;
};

export type NoteSummary = {
  id: string;
  title: string;
  path: string;
};

export type AppSettings = {
  theme: "system" | "light" | "dark";
};

export type SaveSettingsPayload = {
  theme: AppSettings["theme"];
};

export type OpenExternalLinkPayload = {
  url: string;
};

export const ipcChannels = {
  app: {
    getInfo: "app:get-info"
  },
  workspace: {
    getActive: "workspace:get-active",
    select: "workspace:select"
  },
  notes: {
    list: "notes:list",
    read: "notes:read"
  },
  settings: {
    get: "settings:get",
    save: "settings:save"
  },
  links: {
    openExternal: "links:open-external"
  },
  dialogs: {
    selectImage: "dialogs:select-image"
  },
  export: {
    note: "export:note"
  }
} as const;
