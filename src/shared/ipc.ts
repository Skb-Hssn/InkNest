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
  phase: "phase-8-visual-markdown-editor";
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
  folderPath: string;
};

export type NoteContent = {
  path: string;
  markdown: string;
};

export type DeletedNoteSummary = {
  id: string;
  title: string;
  originalPath: string;
  trashPath: string;
};

export type FolderSummary = {
  name: string;
  path: string;
};

export type CreateFolderPayload = {
  parentPath?: string;
  name?: string;
};

export type RenameFolderPayload = {
  path: string;
  name: string;
};

export type DeleteFolderPayload = {
  path: string;
  confirmed: true;
};

export type MoveFolderPayload = {
  path: string;
  parentPath: string;
};

export type WorkspaceMetadata = {
  metadataPath: string;
  assetsPath: string;
  trashPath: string;
};

export type WorkspaceFileModel = {
  workspace: WorkspaceInfo;
  folders: FolderSummary[];
  notes: NoteSummary[];
  metadata: WorkspaceMetadata;
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

export type CreateNotePayload = {
  title?: string;
  folderPath?: string;
};

export type RenameNotePayload = {
  path: string;
  title: string;
};

export type DuplicateNotePayload = {
  path: string;
};

export type MoveNotePayload = {
  path: string;
  folderPath: string;
};

export type SaveNotePayload = {
  path: string;
  markdown: string;
};

export type DeleteNotePayload = {
  path: string;
};

export type RestoreNotePayload = {
  trashPath: string;
};

export type PermanentlyDeleteNotePayload = {
  trashPath: string;
  confirmed: true;
};

export const ipcChannels = {
  app: {
    getInfo: "app:get-info"
  },
  workspace: {
    getActive: "workspace:get-active",
    choose: "workspace:choose",
    select: "workspace:select",
    scan: "workspace:scan"
  },
  notes: {
    list: "notes:list",
    read: "notes:read",
    create: "notes:create",
    rename: "notes:rename",
    duplicate: "notes:duplicate",
    move: "notes:move",
    save: "notes:save",
    delete: "notes:delete",
    listTrash: "notes:list-trash",
    restore: "notes:restore",
    permanentlyDelete: "notes:permanently-delete"
  },
  folders: {
    create: "folders:create",
    rename: "folders:rename",
    move: "folders:move",
    delete: "folders:delete"
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
