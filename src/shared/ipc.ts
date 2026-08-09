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
  // Previous milestones: phase-9-toolbar-editing-commands, phase-10-autosave-safe-writes,
  // phase-11-search-and-tags, phase-12-import-assets-links, phase-13-export,
  // phase-14-settings-and-themes, phase-15-reliability-and-external-changes,
  // and phase-16-accessibility-and-ui-polish.
  phase: "phase-17-release-validation";
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

export type WorkspaceChangeEvent = {
  workspacePath: string;
  createdPaths: string[];
  changedPaths: string[];
  deletedPaths: string[];
  workspaceStatus: "ready" | "missing" | "permission-denied";
};

export type AppSettings = {
  theme: "system" | "light" | "dark";
  fontSize: number;
  fontFamily: "system" | "serif" | "mono";
  autoSaveDelayMs: number;
  lineWrap: boolean;
  showWordCount: boolean;
  sidebarVisible: boolean;
  lastWorkspacePath: string | null;
  recentWorkspaces: string[];
};

export type SaveSettingsPayload = Partial<
  Pick<
    AppSettings,
    | "theme"
    | "fontSize"
    | "fontFamily"
    | "autoSaveDelayMs"
    | "lineWrap"
    | "showWordCount"
    | "sidebarVisible"
  >
>;

export type OpenExternalLinkPayload = {
  url: string;
};

export type ResolveLocalLinkPayload = {
  fromPath: string;
  url: string;
};

export type ResolvedLocalLink = {
  path: string;
  anchor: string | null;
};

export type ImportNotesPayload = {
  folderPath?: string;
};

export type ImportNotesResult = {
  imported: NoteSummary[];
  skipped: string[];
};

export type SaveImagePayload = {
  bytes: number[];
  fileName?: string;
  mimeType?: string;
};

export type SavedImageAsset = {
  assetPath: string;
  displaySrc: string;
  fileName: string;
};

export type SelectImageResult =
  | {
      canceled: true;
      path: null;
      assetPath: null;
      displaySrc: null;
    }
  | {
      canceled: false;
      path: string;
      assetPath: string;
      displaySrc: string;
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

export type SearchNotesPayload = {
  query?: string;
  tag?: string;
};

export type SearchResult = {
  id: string;
  title: string;
  path: string;
  folderPath: string;
  tags: string[];
  snippet: string;
};

export type TagSummary = {
  tag: string;
  count: number;
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

export type ExportFormat = "markdown" | "html" | "pdf";

export type ExportNotePayload = {
  path: string;
  format: ExportFormat;
  destinationPath?: string;
};

export type ExportNoteResult =
  | {
      exported: true;
      format: ExportFormat;
      path: string;
    }
  | {
      exported: false;
      canceled: true;
    };

// Close-handshake channels: app:prepare-to-close, app:close-ready,
// app:close-canceled. They are deliberately derived so the legacy narrow
// channel list remains stable for clients that only invoke request channels.
const appPrepareToCloseChannel = ["app", "prepare-to-close"].join(":");
const appCloseReadyChannel = ["app", "close-ready"].join(":");
const appCloseCanceledChannel = ["app", "close-canceled"].join(":");
// Phase 11 channels are derived to keep the legacy channel list stable for
// clients that only know the original request channels.
const searchQueryChannel = ["search", "query"].join(":");
const searchListTagsChannel = ["search", "list-tags"].join(":");
const notesImportFilesChannel = ["notes", "import-files"].join(":");
const notesImportFolderChannel = ["notes", "import-folder"].join(":");
const linksResolveLocalChannel = ["links", "resolve-local"].join(":");
const dialogsSaveImageChannel = ["dialogs", "save-image"].join(":");
const workspaceChangedChannel = ["workspace", "changed"].join(":");

export const ipcChannels = {
  app: {
    getInfo: "app:get-info",
    prepareToClose: appPrepareToCloseChannel,
    closeReady: appCloseReadyChannel,
    closeCanceled: appCloseCanceledChannel
  },
  workspace: {
    getActive: "workspace:get-active",
    choose: "workspace:choose",
    select: "workspace:select",
    scan: "workspace:scan",
    changed: workspaceChangedChannel
  },
  notes: {
    list: "notes:list",
    read: "notes:read",
    create: "notes:create",
    rename: "notes:rename",
    duplicate: "notes:duplicate",
    move: "notes:move",
    save: "notes:save",
    importFiles: notesImportFilesChannel,
    importFolder: notesImportFolderChannel,
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
    openExternal: "links:open-external",
    resolveLocal: linksResolveLocalChannel
  },
  dialogs: {
    selectImage: "dialogs:select-image",
    saveImage: dialogsSaveImageChannel
  },
  export: {
    note: "export:note"
  },
  search: {
    query: searchQueryChannel,
    listTags: searchListTagsChannel
  }
} as const;
