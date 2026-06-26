import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenText,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  FileText,
  FilePlus2,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Hash,
  ListFilter,
  PanelLeft,
  PanelRightClose,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  SquarePen,
  Trash2
} from "lucide-react";
import type {
  DeletedNoteSummary,
  FolderSummary,
  NoteContent,
  NoteSummary,
  WorkspaceFileModel,
  WorkspaceInfo
} from "../../shared/ipc";

const initialWorkspace: WorkspaceInfo = {
  path: null,
  name: null,
  status: "none",
  message: "Choose a local Markdown folder to begin.",
  recentWorkspaces: [],
  lastWorkspacePath: null
};

const rootFolder: FolderSummary = {
  name: "Workspace root",
  path: "."
};

const toolbarPlaceholders = [
  "H1",
  "B",
  "I",
  "List",
  "Link",
  "Image"
] as const;

export function App() {
  const [phase, setPhase] = useState("phase-6-note-crud");
  const [workspace, setWorkspace] = useState<WorkspaceInfo>(initialWorkspace);
  const [fileModel, setFileModel] = useState<WorkspaceFileModel | null>(null);
  const [trashNotes, setTrashNotes] = useState<DeletedNoteSummary[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState(".");
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null);
  const [selectedNoteContent, setSelectedNoteContent] = useState<NoteContent | null>(null);
  const [noteTitleDraft, setNoteTitleDraft] = useState("");
  const [activeMoveNotePath, setActiveMoveNotePath] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isMounted = true;

    window.inknest.app.getInfo().then((result) => {
      if (isMounted && result.ok) {
        setPhase(result.data.phase);
      }
    });

    window.inknest.workspace.getActive().then((result) => {
      if (!isMounted) {
        return;
      }

      if (result.ok) {
        setWorkspace(result.data);

        if (result.data.status === "ready") {
          void refreshWorkspace();
        }
      } else {
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const folders = useMemo(
    () => [rootFolder, ...(fileModel?.folders ?? [])],
    [fileModel]
  );
  const notes = fileModel?.notes ?? [];
  const visibleNotes = notes.filter((note) => note.folderPath === selectedFolderPath);
  const selectedNote =
    notes.find((note) => note.path === selectedNotePath) ?? null;
  const hasWorkspace = workspace.status === "ready" && workspace.path !== null;
  const wordCount = selectedNoteContent?.markdown.trim()
    ? selectedNoteContent.markdown.trim().split(/\s+/).length
    : 0;
  const characterCount = selectedNoteContent?.markdown.length ?? 0;
  const workspaceName = workspace.name ?? "No workspace";
  const workspacePath =
    workspace.path ??
    workspace.lastWorkspacePath ??
    "Open a local Markdown folder to begin";
  const selectedFolderLabel =
    folders.find((folder) => folder.path === selectedFolderPath)?.name ??
    selectedFolderPath;
  const workspacePromptTitle =
    workspace.status === "missing"
      ? "Previous workspace missing"
      : workspace.status === "permission-denied"
        ? "Workspace access needed"
        : "No workspace selected";

  useEffect(() => {
    setNoteTitleDraft(selectedNote?.title ?? "");
  }, [selectedNote?.title]);

  async function refreshWorkspace() {
    const result = await window.inknest.workspace.scan();

    if (result.ok) {
      setWorkspace(result.data.workspace);
      setFileModel(result.data);
      setWorkspaceError(null);

      const trashResult = await window.inknest.notes.listTrash();
      if (trashResult.ok) {
        setTrashNotes(trashResult.data);
      }

      return result.data;
    }

    setWorkspaceError(result.error.message);
    return null;
  }

  async function chooseWorkspace() {
    setIsBusy(true);
    setWorkspaceError(null);

    const result = await window.inknest.workspace.choose();

    if (result.ok) {
      setWorkspace(result.data);
      setSelectedNotePath(null);
      setSelectedNoteContent(null);
      if (result.data.status === "ready") {
        await refreshWorkspace();
      }
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function reopenWorkspace(workspacePath: string) {
    setIsBusy(true);
    setWorkspaceError(null);

    const result = await window.inknest.workspace.select(workspacePath);

    if (result.ok) {
      setWorkspace(result.data);
      setSelectedNotePath(null);
      setSelectedNoteContent(null);
      await refreshWorkspace();
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function openNote(notePath: string) {
    setActiveMoveNotePath(null);
    setIsBusy(true);
    const result = await window.inknest.notes.read(notePath);

    if (result.ok) {
      setSelectedNotePath(result.data.path);
      setSelectedNoteContent(result.data);
      setStatusMessage("Note opened");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function createNote() {
    setIsBusy(true);
    const result = await window.inknest.notes.create({
      title: "Untitled",
      folderPath: selectedFolderPath
    });

    if (result.ok) {
      await refreshWorkspace();
      await openNote(result.data.path);
      setStatusMessage("Note created");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function createFolder() {
    setActiveMoveNotePath(null);
    setIsBusy(true);
    const result = await window.inknest.folders.create({
      parentPath: selectedFolderPath,
      name: "New Folder"
    });

    if (result.ok) {
      await refreshWorkspace();
      setSelectedFolderPath(result.data.path);
      setStatusMessage("Folder created");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function renameFolder(folder: FolderSummary) {
    const name = window.prompt("Rename folder", folder.name)?.trim();

    if (!name) {
      return;
    }

    setActiveMoveNotePath(null);
    setIsBusy(true);
    const result = await window.inknest.folders.rename({
      path: folder.path,
      name
    });

    if (result.ok) {
      await refreshWorkspace();
      setSelectedFolderPath(result.data.path);
      setStatusMessage("Folder renamed");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function deleteFolder(folder: FolderSummary) {
    if (!window.confirm(`Delete folder "${folder.name}" and all of its contents?`)) {
      return;
    }

    setActiveMoveNotePath(null);
    setIsBusy(true);
    const result = await window.inknest.folders.delete({
      path: folder.path,
      confirmed: true
    });

    if (result.ok) {
      if (selectedFolderPath === folder.path || selectedFolderPath.startsWith(`${folder.path}/`)) {
        setSelectedFolderPath(".");
      }

      if (
        selectedNote?.folderPath === folder.path ||
        selectedNote?.folderPath.startsWith(`${folder.path}/`)
      ) {
        setSelectedNotePath(null);
        setSelectedNoteContent(null);
      }

      await refreshWorkspace();
      setStatusMessage("Folder deleted");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function renameNote() {
    if (!selectedNote) {
      return;
    }

    const title = noteTitleDraft.trim();

    if (!title) {
      setWorkspaceError("Note title cannot be empty.");
      return;
    }

    setIsBusy(true);
    const result = await window.inknest.notes.rename({
      path: selectedNote.path,
      title
    });

    if (result.ok) {
      await refreshWorkspace();
      await openNote(result.data.path);
      setStatusMessage("Note renamed");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function duplicateNote(note: NoteSummary) {
    setActiveMoveNotePath(null);
    setIsBusy(true);
    const result = await window.inknest.notes.duplicate({
      path: note.path
    });

    if (result.ok) {
      await refreshWorkspace();
      await openNote(result.data.path);
      setStatusMessage("Note duplicated");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function moveNote(note: NoteSummary, folderPath: string) {
    setActiveMoveNotePath(null);
    setIsBusy(true);
    const result = await window.inknest.notes.move({
      path: note.path,
      folderPath
    });

    if (result.ok) {
      setSelectedFolderPath(result.data.folderPath);
      await refreshWorkspace();
      await openNote(result.data.path);
      setStatusMessage("Note moved");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function deleteNote(note: NoteSummary) {
    setActiveMoveNotePath(null);

    if (!window.confirm(`Move "${note.title}" to trash?`)) {
      return;
    }

    setIsBusy(true);
    const result = await window.inknest.notes.delete({
      path: note.path
    });

    if (result.ok) {
      if (note.path === selectedNotePath) {
        setSelectedNotePath(null);
        setSelectedNoteContent(null);
      }
      await refreshWorkspace();
      setStatusMessage("Note moved to trash");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function restoreNote(trashPath: string) {
    setIsBusy(true);
    const result = await window.inknest.notes.restore({ trashPath });

    if (result.ok) {
      await refreshWorkspace();
      await openNote(result.data.path);
      setStatusMessage("Note restored");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function permanentlyDeleteNote(trashPath: string) {
    if (!window.confirm("Permanently delete this trashed note?")) {
      return;
    }

    setIsBusy(true);
    const result = await window.inknest.notes.permanentlyDelete({
      trashPath,
      confirmed: true
    });

    if (result.ok) {
      await refreshWorkspace();
      setStatusMessage("Trash item deleted");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  return (
    <main className="grid min-h-screen grid-rows-[56px_minmax(0,1fr)_34px] bg-ink-50 text-ink-900">
      <header className="flex min-w-0 items-center justify-between border-b border-ink-100 bg-white px-4">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Toggle sidebar" className="icon-button">
            <PanelLeft size={18} />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ink-700 text-white">
            <SquarePen size={17} />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-5">InkNest</h1>
            <p className="text-xs text-neutral-500">{workspaceName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="command-button"
            onClick={() => void createNote()}
            disabled={!hasWorkspace || isBusy}
          >
            <FilePlus2 size={16} />
            <span>New note</span>
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void createFolder()}
            disabled={!hasWorkspace || isBusy}
          >
            <FolderPlus size={16} />
            <span>New folder</span>
          </button>
          <button type="button" aria-label="Settings" className="icon-button">
            <Settings size={18} />
          </button>
        </div>
      </header>

      <section className="grid min-h-0 grid-cols-[300px_minmax(320px,400px)_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-ink-100 bg-white">
          <div className="space-y-3 border-b border-ink-100 p-3">
            <button
              type="button"
              className="workspace-button"
              onClick={() => void chooseWorkspace()}
              disabled={isBusy}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-700 text-white">
                <FolderOpen size={15} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {isBusy ? "Working" : workspaceName}
                </span>
                <span className="block truncate text-xs text-neutral-500">
                  {hasWorkspace ? workspace.path : "Local Markdown folder"}
                </span>
              </span>
              <ChevronDown className="ml-auto text-neutral-400" size={16} />
            </button>

            <label className="search-box">
              <Search size={16} />
              <input type="search" placeholder="Search notes" aria-label="Search notes" />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="secondary-button justify-center"
                onClick={() => void createNote()}
                disabled={!hasWorkspace || isBusy}
              >
                <FilePlus2 size={16} />
                <span>New note</span>
              </button>
              <button
                type="button"
                className="secondary-button justify-center"
                onClick={() => void createFolder()}
                disabled={!hasWorkspace || isBusy}
              >
                <FolderPlus size={16} />
                <span>New folder</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
            <h2 className="text-xs font-semibold uppercase text-neutral-500">
              Folders
            </h2>
            <button type="button" aria-label="Filter folders" className="icon-button">
              <ListFilter size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!hasWorkspace ? (
              <div className="border-b border-ink-100 px-4 py-4">
                <EmptyState
                  icon={
                    workspace.status === "missing" ||
                    workspace.status === "permission-denied" ? (
                      <AlertTriangle size={18} />
                    ) : (
                      <Folder size={18} />
                    )
                  }
                  title={workspacePromptTitle}
                  description={workspace.message}
                />
                <button
                  type="button"
                  className="secondary-button mt-3 w-full justify-center"
                  onClick={() => void chooseWorkspace()}
                  disabled={isBusy}
                >
                  <FolderOpen size={16} />
                  <span>Choose workspace</span>
                </button>
              </div>
            ) : null}

            {workspaceError ? (
              <p className="m-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {workspaceError}
              </p>
            ) : null}

            {workspace.recentWorkspaces.length > 0 ? (
              <div className="border-b border-ink-100 px-3 py-3">
                <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                  Recent workspaces
                </p>
                <div className="space-y-1">
                  {workspace.recentWorkspaces.map((recentPath) => (
                    <button
                      key={recentPath}
                      type="button"
                      className="recent-workspace-row"
                      onClick={() => void reopenWorkspace(recentPath)}
                    >
                      <BookOpenText size={15} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {recentPath.split(/[\\/]/).pop() ?? recentPath}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">
                          {recentPath}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="px-3 py-3">
              <div className="space-y-1" aria-label="Folder tree">
                {folders.map((folder) => (
                  <div
                    key={folder.path}
                    className={`tree-row group ${
                      folder.path === selectedFolderPath ? "tree-row-active" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="tree-open-area"
                      onClick={() => setSelectedFolderPath(folder.path)}
                      disabled={!hasWorkspace}
                    >
                      <Folder size={15} />
                      <span className="truncate">{folder.name}</span>
                    </button>
                    {folder.path !== "." ? (
                      <span className="folder-actions">
                        <button
                          type="button"
                          aria-label="Rename folder"
                          title="Rename folder"
                          className="icon-button folder-action-button"
                          onClick={() => void renameFolder(folder)}
                          disabled={!hasWorkspace || isBusy}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete folder"
                          title="Delete folder"
                          className="icon-button folder-action-button danger"
                          onClick={() => void deleteFolder(folder)}
                          disabled={!hasWorkspace || isBusy}
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-ink-100 px-4 py-4">
              <EmptyState
                icon={<Search size={18} />}
                title="No search results"
                description="Search arrives in a later phase."
              />
            </div>
          </div>
        </aside>

        <aside className="flex min-h-0 flex-col border-r border-ink-100 bg-neutral-50">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Notes</h2>
              <p className="truncate text-xs text-neutral-500">
                {selectedFolderLabel}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Collapse notes list" className="icon-button">
                <PanelRightClose size={16} />
              </button>
              <button type="button" aria-label="Sort notes" className="icon-button">
                <SlidersHorizontal size={16} />
              </button>
              <button
                type="button"
                aria-label="New note"
                className="icon-button"
                onClick={() => void createNote()}
                disabled={!hasWorkspace || isBusy}
              >
                <FilePlus2 size={16} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleNotes.length === 0 ? (
              <div className="border-b border-ink-100 px-5 py-5">
                <EmptyState
                  icon={<Hash size={18} />}
                  title="No notes here"
                  description="Create a note in this folder to start writing."
                />
              </div>
            ) : null}

            <div className="space-y-2 px-3 py-3" aria-label="Note list">
              {visibleNotes.map((note) => (
                <NoteRow
                  key={note.path}
                  note={note}
                  folders={folders}
                  selected={note.path === selectedNotePath}
                  isMoveMenuOpen={note.path === activeMoveNotePath}
                  isBusy={isBusy}
                  onOpen={() => void openNote(note.path)}
                  onDuplicate={() => void duplicateNote(note)}
                  onToggleMove={() =>
                    setActiveMoveNotePath((currentPath) =>
                      currentPath === note.path ? null : note.path
                    )
                  }
                  onMove={(folderPath) => void moveNote(note, folderPath)}
                  onDelete={() => void deleteNote(note)}
                />
              ))}
            </div>

            <div className="border-t border-ink-100 px-3 py-3">
              <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                Trash
              </p>
              {trashNotes.length === 0 ? (
                <p className="px-2 text-sm text-neutral-500">Trash is empty.</p>
              ) : (
                <div className="space-y-2">
                  {trashNotes.map((note) => (
                    <div key={note.trashPath} className="trash-row">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{note.title}</p>
                        <p className="truncate text-xs text-neutral-500">
                          {note.originalPath}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Restore note"
                        className="icon-button"
                        onClick={() => void restoreNote(note.trashPath)}
                        disabled={isBusy}
                      >
                        <RotateCcw size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Permanently delete note"
                        className="icon-button danger"
                        onClick={() => void permanentlyDeleteNote(note.trashPath)}
                        disabled={isBusy}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-white">
          <div className="flex h-14 items-center justify-between border-b border-ink-100 px-5">
            <div className="min-w-0">
              {selectedNote ? (
                <input
                  type="text"
                  aria-label="Note title"
                  className="note-title-input"
                  value={noteTitleDraft}
                  onChange={(event) => setNoteTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                      void renameNote();
                    }
                  }}
                  disabled={isBusy}
                />
              ) : (
                <h2 className="truncate text-sm font-semibold">Untitled note</h2>
              )}
              <p className="truncate text-xs text-neutral-500">
                {selectedNote?.path ?? "No file selected"}
              </p>
            </div>
            <span className="status-pill">
              <Check size={13} />
              {statusMessage}
            </span>
          </div>

          <div className="flex h-11 items-center gap-1 border-b border-ink-100 px-4">
            {toolbarPlaceholders.map((label) => (
              <button key={label} type="button" className="toolbar-button" disabled>
                {label}
              </button>
            ))}
          </div>

          {selectedNoteContent ? (
            <article className="min-h-0 flex-1 overflow-y-auto p-8">
              <pre className="note-preview">{selectedNoteContent.markdown}</pre>
            </article>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-ink-100 text-ink-700">
                  <SquarePen size={22} />
                </div>
                <h3 className="text-lg font-semibold">No note selected</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Open or create a Markdown note to inspect its saved content here.
                </p>
              </div>
            </div>
          )}
        </section>
      </section>

      <footer className="grid grid-cols-[1fr_auto_1fr] items-center border-t border-ink-100 bg-white px-4 text-xs text-neutral-500">
        <span className="truncate">{workspacePath}</span>
        <span>{phase}</span>
        <span className="justify-self-end">
          Saved - {wordCount} words - {characterCount} characters
        </span>
      </footer>
    </main>
  );
}

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-ink-50 text-ink-700">
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-neutral-500">{description}</p>
    </div>
  );
}

type NoteRowProps = {
  note: NoteSummary;
  folders: FolderSummary[];
  selected: boolean;
  isMoveMenuOpen: boolean;
  isBusy: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onToggleMove: () => void;
  onMove: (folderPath: string) => void;
  onDelete: () => void;
};

function NoteRow({
  note,
  folders,
  selected,
  isMoveMenuOpen,
  isBusy,
  onOpen,
  onDuplicate,
  onToggleMove,
  onMove,
  onDelete
}: NoteRowProps) {
  return (
    <div className={`note-row group ${selected ? "note-row-active" : ""}`}>
      <button type="button" className="note-open-area" onClick={onOpen}>
        <div className="flex items-center gap-2">
          <FileText size={15} />
          <span className="truncate font-medium">{note.title}</span>
        </div>
        <p className="mt-1 truncate text-xs text-neutral-500">{note.path}</p>
      </button>

      <div className="note-actions">
        <button
          type="button"
          aria-label="Duplicate"
          title="Duplicate"
          className="icon-button note-action-button"
          onClick={onDuplicate}
          disabled={isBusy}
        >
          <Copy size={14} />
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="Move"
            title="Move"
            className="icon-button note-action-button"
            onClick={onToggleMove}
            disabled={isBusy}
          >
            <FolderInput size={14} />
          </button>
          {isMoveMenuOpen ? (
            <div className="move-menu" role="menu" aria-label="Move note to folder">
              {folders.map((folder) => (
                <button
                  key={folder.path}
                  type="button"
                  role="menuitem"
                  className="move-menu-item"
                  onClick={() => onMove(folder.path)}
                  disabled={folder.path === note.folderPath || isBusy}
                >
                  <Folder size={13} />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Delete"
          title="Delete"
          className="icon-button note-action-button danger"
          onClick={onDelete}
          disabled={isBusy}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
