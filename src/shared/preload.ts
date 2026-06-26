import type {
  AppInfo,
  AppSettings,
  CreateFolderPayload,
  CreateNotePayload,
  DeletedNoteSummary,
  DeleteNotePayload,
  DuplicateNotePayload,
  FolderSummary,
  IpcResult,
  MoveNotePayload,
  NoteContent,
  NoteSummary,
  OpenExternalLinkPayload,
  PermanentlyDeleteNotePayload,
  RenameNotePayload,
  RenameFolderPayload,
  DeleteFolderPayload,
  RestoreNotePayload,
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
    read: (path: string) => Promise<IpcResult<NoteContent>>;
    create: (payload?: CreateNotePayload) => Promise<IpcResult<NoteContent>>;
    rename: (payload: RenameNotePayload) => Promise<IpcResult<NoteSummary>>;
    duplicate: (payload: DuplicateNotePayload) => Promise<IpcResult<NoteContent>>;
    move: (payload: MoveNotePayload) => Promise<IpcResult<NoteSummary>>;
    delete: (payload: DeleteNotePayload) => Promise<IpcResult<DeletedNoteSummary>>;
    listTrash: () => Promise<IpcResult<DeletedNoteSummary[]>>;
    restore: (payload: RestoreNotePayload) => Promise<IpcResult<NoteContent>>;
    permanentlyDelete: (
      payload: PermanentlyDeleteNotePayload
    ) => Promise<IpcResult<{ deleted: true; trashPath: string }>>;
  };
  folders: {
    create: (payload?: CreateFolderPayload) => Promise<IpcResult<FolderSummary>>;
    rename: (payload: RenameFolderPayload) => Promise<IpcResult<FolderSummary>>;
    delete: (
      payload: DeleteFolderPayload
    ) => Promise<IpcResult<{ deleted: true; path: string }>>;
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
