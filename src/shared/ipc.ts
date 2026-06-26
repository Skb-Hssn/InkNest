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
  phase: "phase-4-workspace-selection";
};

export type WorkspaceStatus =
  | "none"
  | "ready"
  | "missing"
  | "permission-denied";

export type WorkspaceInfo = {
  path: string | null;
  name: string | null;
  status: WorkspaceStatus;
  message: string;
  recentWorkspaces: string[];
  lastWorkspacePath: string | null;
};

export type NoteSummary = {
  id: string;
  title: string;
  path: string;
};

export type AppSettings = {
  theme: "system" | "light" | "dark";
  lastWorkspacePath: string | null;
  recentWorkspaces: string[];
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
    choose: "workspace:choose",
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
