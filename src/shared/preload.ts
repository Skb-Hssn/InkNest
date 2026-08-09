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
  MoveFolderPayload,
  MoveNotePayload,
  NoteContent,
  NoteSummary,
  OpenExternalLinkPayload,
  ImportNotesPayload,
  ImportNotesResult,
  PermanentlyDeleteNotePayload,
  ResolveLocalLinkPayload,
  ResolvedLocalLink,
  RenameNotePayload,
  RenameFolderPayload,
  DeleteFolderPayload,
  RestoreNotePayload,
  SelectImageResult,
  SaveImagePayload,
  SavedImageAsset,
  SearchNotesPayload,
  SearchResult,
  SaveNotePayload,
  SaveSettingsPayload,
  TagSummary,
  WorkspaceFileModel,
  WorkspaceInfo
} from "./ipc";

export type InkNestApi = {
  app: {
    getInfo: () => Promise<IpcResult<AppInfo>>;
    onPrepareToClose: (listener: () => void) => () => void;
    closeReady: () => void;
    closeCanceled: () => void;
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
    save: (payload: SaveNotePayload) => Promise<IpcResult<NoteContent>>;
    importFiles: (
      payload?: ImportNotesPayload
    ) => Promise<IpcResult<ImportNotesResult>>;
    importFolder: (
      payload?: ImportNotesPayload
    ) => Promise<IpcResult<ImportNotesResult>>;
    delete: (payload: DeleteNotePayload) => Promise<IpcResult<DeletedNoteSummary>>;
    listTrash: () => Promise<IpcResult<DeletedNoteSummary[]>>;
    restore: (payload: RestoreNotePayload) => Promise<IpcResult<NoteContent>>;
    permanentlyDelete: (
      payload: PermanentlyDeleteNotePayload
    ) => Promise<IpcResult<{ deleted: true; trashPath: string }>>;
  };
  search: {
    query: (payload?: SearchNotesPayload) => Promise<IpcResult<SearchResult[]>>;
    listTags: () => Promise<IpcResult<TagSummary[]>>;
  };
  folders: {
    create: (payload?: CreateFolderPayload) => Promise<IpcResult<FolderSummary>>;
    rename: (payload: RenameFolderPayload) => Promise<IpcResult<FolderSummary>>;
    move: (payload: MoveFolderPayload) => Promise<IpcResult<FolderSummary>>;
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
    resolveLocal: (
      payload: ResolveLocalLinkPayload
    ) => Promise<IpcResult<ResolvedLocalLink>>;
  };
  dialogs: {
    selectImage: () => Promise<IpcResult<SelectImageResult>>;
    saveImage: (payload: SaveImagePayload) => Promise<IpcResult<SavedImageAsset>>;
  };
  export: {
    note: (path: string) => Promise<IpcResult<{ queued: false; path: string }>>;
  };
};
