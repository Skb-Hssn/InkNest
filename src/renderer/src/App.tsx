import { createPortal } from "react-dom";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  AlertTriangle,
  BookOpenText,
  Bold,
  Check,
  ChevronDown,
  ChevronRight,
  CircleMinus,
  CirclePlus,
  Command,
  Code2,
  Copy,
  Edit3,
  Eraser,
  FileText,
  FilePlus2,
  FileOutput,
  Folder,
  FolderOpen,
  FolderPlus,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image,
  Italic,
  Link,
  Leaf,
  Lightbulb,
  CircleUserRound,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  LockKeyhole,
  UnlockKeyhole,
  Replace,
  Maximize2,
  MoreHorizontal,
  Minus,
  Minimize2,
  PanelLeft,
  Plus,
  Quote,
  RotateCcw,
  Save,
  Search,
  Settings,
  SquarePen,
  Square,
  Strikethrough,
  Star,
  Sigma,
  Radical,
  TableColumnsSplit,
  TableProperties,
  TableRowsSplit,
  Trash2,
  X
} from "lucide-react";
import type {
  DeletedNoteSummary,
  FolderSummary,
  NoteContent,
  WorkspaceChangeEvent,
  NoteSummary,
  ExportFormat,
  AppSettings,
  SaveSettingsPayload,
  SaveImagePayload,
  SearchResult,
  TagSummary,
  WorkspaceFileModel,
  WorkspaceInfo,
  SaveWorkspaceSessionPayload
} from "../../shared/ipc";
import { accentColors, defaultAccentColor } from "../../shared/accent-colors";
import {
  MarkdownEditor,
  type LinkDialogDetails,
  type MarkdownEditorCommand,
  type MarkdownEditorCommandOptions,
  type MarkdownEditorHandle
} from "./editor";

const initialWorkspace: WorkspaceInfo = {
  path: null,
  name: null,
  status: "none",
  message: "Choose a local Markdown folder to begin.",
  recentWorkspaces: [],
  lastWorkspacePath: null
};

const rootFolder: FolderSummary = {
  name: "Workspace",
  path: "."
};

const initialSettings: AppSettings = {
  theme: "system",
  accentColor: defaultAccentColor,
  fontSize: 16,
  fontFamily: "system",
  autoSaveDelayMs: 750,
  lineWrap: true,
  fullWidth: false,
  showOutline: true,
  outlineWidth: 232,
  showWordCount: true,
  sidebarVisible: true,
  lockedNoteKeys: [],
  favoriteNoteKeys: [],
  lastWorkspacePath: null,
  recentWorkspaces: []
};

type ToolbarCommand = {
  id: MarkdownEditorCommand;
  label: string;
  icon: ReactNode;
  group:
    | "headings"
    | "blocks"
    | "lists"
    | "inline"
    | "code"
    | "table"
    | "links"
    | "media"
    | "insert";
};

type LinkDialogState = {
  text: string;
  url: string;
  isEditing: boolean;
  position: {
    left: number;
    top: number;
  };
  error?: string;
};

function tableActionIcon(baseIcon: ReactNode, badgeIcon: ReactNode) {
  return (
    <span className="toolbar-composite-icon">
      {baseIcon}
      <span className="toolbar-composite-badge">{badgeIcon}</span>
    </span>
  );
}

const addRowIcon = tableActionIcon(
  <TableRowsSplit size={16} />,
  <CirclePlus size={10} />
);
const deleteRowIcon = tableActionIcon(
  <TableRowsSplit size={16} />,
  <CircleMinus size={10} />
);
const addColumnIcon = tableActionIcon(
  <TableColumnsSplit size={16} />,
  <CirclePlus size={10} />
);
const deleteColumnIcon = tableActionIcon(
  <TableColumnsSplit size={16} />,
  <CircleMinus size={10} />
);

const toolbarPlaceholders: ToolbarCommand[] = [
  { id: "bold", label: "B", icon: <Bold size={16} />, group: "inline" },
  { id: "italic", label: "I", icon: <Italic size={16} />, group: "inline" },
  { id: "strikethrough", label: "Strikethrough", icon: <Strikethrough size={16} />, group: "inline" },
  { id: "inline-code", label: "Code", icon: <Code2 size={16} />, group: "inline" },
  { id: "clear-format", label: "Clear formatting", icon: <Eraser size={16} />, group: "inline" },
  { id: "heading-1", label: "H1", icon: <Heading1 size={16} />, group: "headings" },
  { id: "heading-2", label: "H2", icon: <Heading2 size={16} />, group: "headings" },
  { id: "heading-3", label: "H3", icon: <Heading3 size={16} />, group: "headings" },
  { id: "heading-4", label: "H4", icon: <Heading4 size={16} />, group: "headings" },
  { id: "heading-5", label: "H5", icon: <Heading5 size={16} />, group: "headings" },
  { id: "heading-6", label: "H6", icon: <Heading6 size={16} />, group: "headings" },
  { id: "unordered-list", label: "List", icon: <List size={16} />, group: "lists" },
  { id: "ordered-list", label: "Numbered list", icon: <ListOrdered size={16} />, group: "lists" },
  { id: "task-list", label: "Task list", icon: <ListChecks size={16} />, group: "lists" },
  { id: "link", label: "Link", icon: <Link size={16} />, group: "links" },
  { id: "image", label: "Image", icon: <Image size={16} />, group: "media" },
  { id: "code-block", label: "Code block", icon: <Code2 size={16} />, group: "code" },
  { id: "inline-math", label: "Inline math", icon: <Radical size={16} />, group: "insert" },
  { id: "block-math", label: "Display math", icon: <Sigma size={16} />, group: "insert" },
  { id: "table", label: "Insert table", icon: <TableProperties size={16} />, group: "table" },
  { id: "table-add-row", label: "Add table row", icon: addRowIcon, group: "table" },
  { id: "table-delete-row", label: "Delete table row", icon: deleteRowIcon, group: "table" },
  { id: "table-add-column", label: "Add table column", icon: addColumnIcon, group: "table" },
  { id: "table-delete-column", label: "Delete table column", icon: deleteColumnIcon, group: "table" },
  { id: "table-delete", label: "Delete table", icon: tableActionIcon(<TableProperties size={16} />, <Trash2 size={10} />), group: "table" },
  { id: "blockquote", label: "Quote", icon: <Quote size={16} />, group: "blocks" },
  { id: "callout-note", label: "Note callout", icon: <Quote size={16} />, group: "blocks" },
  { id: "callout-warning", label: "Warning callout", icon: <AlertTriangle size={16} />, group: "blocks" },
  { id: "callout-info", label: "Info callout", icon: <BookOpenText size={16} />, group: "blocks" },
  { id: "callout-success", label: "Success callout", icon: <Check size={16} />, group: "blocks" },
  { id: "divider", label: "Divider", icon: <Minus size={16} />, group: "insert" }
];

const primaryToolbarOrder = ["bold", "italic", "strikethrough", "unordered-list", "ordered-list", "task-list", "blockquote", "callout-note", "link", "image", "code-block", "table", "block-math"];

function getToolbarGroups(commands: ToolbarCommand[]) {
  return commands.reduce<Array<{ name: ToolbarCommand["group"]; commands: ToolbarCommand[] }>>(
    (groups, command) => {
      const currentGroup = groups[groups.length - 1];

      if (currentGroup?.name === command.group) {
        currentGroup.commands.push(command);
      } else {
        groups.push({
          name: command.group,
          commands: [command]
        });
      }

      return groups;
    },
    []
  );
}

function getViewportPopoverPosition(left: number, top: number) {
  const popoverWidth = 320;
  const popoverHeight = 220;
  const viewportWidth = window.innerWidth || popoverWidth;
  const viewportHeight = window.innerHeight || popoverHeight;

  return {
    left: Math.max(12, Math.min(left, viewportWidth - popoverWidth - 12)),
    top: Math.max(12, Math.min(top, viewportHeight - popoverHeight - 12))
  };
}

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).pop() ?? "Image";
}

function noteNameFromPath(notePath: string) {
  return fileNameFromPath(notePath).replace(/\.md$/i, "");
}

function fontFamilyCssValue(fontFamily: AppSettings["fontFamily"]) {
  if (fontFamily === "serif") {
    return "Georgia, Cambria, 'Times New Roman', serif";
  }

  if (fontFamily === "mono") {
    return "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace";
  }

  return "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
}

type SaveState = "saved" | "unsaved" | "saving" | "failed";
type ExternalNoteChange = {
  kind: "changed" | "deleted";
  path: string;
};
type CommandPaletteCommand = {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  icon: ReactNode;
  disabled: boolean;
};

// Keep the debounce inside the product's 500ms-1000ms autosave range.
const autoSaveDelayMs = 750;
const sidebarMinWidth = 220;
const sidebarMaxWidth = 480;

export function App() {
  const [phase, setPhase] = useState("phase-16-accessibility-and-ui-polish");
  const editorHandleRef = useRef<MarkdownEditorHandle | null>(null);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [sidebarWidth, setSidebarWidth] = useState(232);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toolbarMenu, setToolbarMenu] = useState<{ kind: "headings" | "more"; left: number; top: number } | null>(null);
  const [isFoldersExpanded, setIsFoldersExpanded] = useState(true);
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(true);
  const [isTrashExpanded, setIsTrashExpanded] = useState(false);
  const [activeSidebarMenu, setActiveSidebarMenu] = useState<"recent" | "trash" | null>(null);
  const [isEmptyTrashDialogOpen, setIsEmptyTrashDialogOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceInfo>(initialWorkspace);
  const [fileModel, setFileModel] = useState<WorkspaceFileModel | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [tagSummaries, setTagSummaries] = useState<TagSummary[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [trashNotes, setTrashNotes] = useState<DeletedNoteSummary[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState(".");
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null);
  const [openNotePaths, setOpenNotePaths] = useState<string[]>([]);
  const [tabMenu, setTabMenu] = useState<{ path: string; left: number; top: number } | null>(null);
  const [tabRename, setTabRename] = useState<{ path: string; name: string } | null>(null);
  const tabMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedNoteContent, setSelectedNoteContent] = useState<NoteContent | null>(null);
  const [editorMarkdown, setEditorMarkdown] = useState("");
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState("");
  const [activeMoveNotePath, setActiveMoveNotePath] = useState<string | null>(null);
  const [activeMoveFolderPath, setActiveMoveFolderPath] = useState<string | null>(null);
  const [editingNotePath, setEditingNotePath] = useState<string | null>(null);
  const [noteNameDraft, setNoteNameDraft] = useState("");
  const [editingFolderPath, setEditingFolderPath] = useState<string | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [expandedFolderPaths, setExpandedFolderPaths] = useState<Set<string>>(
    () => new Set(["."])
  );
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [isFavoriteSaving, setIsFavoriteSaving] = useState(false);
  const favoriteSaveInFlightRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [externalNoteChange, setExternalNoteChange] =
    useState<ExternalNoteChange | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);
  const [activeToolbarCommands, setActiveToolbarCommands] = useState<
    Set<MarkdownEditorCommand>
  >(() => new Set());
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const pendingNoteSaveRef = useRef<{ path: string; markdown: string } | null>(null);
  const saveQueuedRef = useRef(false);
  const editorMarkdownRef = useRef(editorMarkdown);
  const lastSavedMarkdownRef = useRef(lastSavedMarkdown);
  const selectedNoteContentRef = useRef(selectedNoteContent);
  const saveStateRef = useRef<SaveState>(saveState);
  const externalNoteChangeRef = useRef<ExternalNoteChange | null>(externalNoteChange);
  const commandPaletteInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSettingsSavesRef = useRef<Set<Promise<unknown>>>(new Set());
  const sidebarResizeStartRef = useRef<{ clientX: number; width: number } | null>(null);
  const noteNavigationRef = useRef(false);
  const [sessionReadyWorkspace, setSessionReadyWorkspace] = useState<string | null>(null);
  const sessionSnapshotRef = useRef<SaveWorkspaceSessionPayload | null>(null);
  const sessionSaveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  if (sessionReadyWorkspace !== workspace.path) sessionSnapshotRef.current = null;
  else if (workspace.path) sessionSnapshotRef.current = {
    workspacePath: workspace.path, openNotePaths,
    activeNotePath: selectedNotePath && openNotePaths.includes(selectedNotePath) ? selectedNotePath : openNotePaths[0] ?? null
  };

  function persistSession(snapshot = sessionSnapshotRef.current): Promise<boolean> {
    if (!snapshot) return sessionSaveQueueRef.current;
    const save = sessionSaveQueueRef.current.then(async () => {
      const result = await window.inknest.workspace.saveSession(snapshot);
      if (!result.ok) { setWorkspaceError(`Could not preserve the open note tabs: ${result.error.message}`); return false; }
      setWorkspaceError((error) => error?.startsWith("Could not preserve the open note tabs") ? null : error);
      return true;
    }).catch(() => { setWorkspaceError("Could not preserve the open note tabs."); return false; });
    sessionSaveQueueRef.current = save;
    return save;
  }

  useEffect(() => {
    if (workspace.path && sessionReadyWorkspace === workspace.path) void persistSession();
  }, [workspace.path, sessionReadyWorkspace, openNotePaths, selectedNotePath]);

  async function restoreWorkspaceSession(info: WorkspaceInfo, current = () => true) {
    const model = await refreshWorkspace();
    if (!current() || !model || model.workspace.path !== info.path) return;
    const saved = await window.inknest.workspace.getSession();
    if (!current()) return;
    if (!saved.ok) setWorkspaceError(saved.error.message);
    const session = saved.ok ? saved.data : null;
    const existing = new Set(model.notes.map((note) => note.path));
    const paths = (session?.openNotePaths ?? info.initialNotePaths ?? []).filter((notePath) => existing.has(notePath));
    const results = await Promise.all(paths.map((notePath) => window.inknest.notes.read(notePath)));
    if (!current()) return;
    const restored = results.filter((result): result is { ok: true; data: NoteContent } => result.ok).map((result) => result.data);
    setOpenNotePaths(restored.map((note) => note.path));
    const active = restored.find((note) => note.path === session?.activeNotePath) ?? restored[0];
    if (active) {
      const folder = active.path.includes("/") ? active.path.slice(0, active.path.lastIndexOf("/")) : ".";
      setSelectedFolderPath(folder);
      setExpandedFolderPaths(new Set([".", ...getAncestorFolderPaths(folder), folder, ...(info.initialNotePaths ? ["Notes", "Projects"] : [])]));
      applyNoteContent(active);
    }
    setSessionReadyWorkspace(info.path);
  }

  useEffect(() => {
    document.getElementById("active-note-tab")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedNotePath, openNotePaths]);

  editorMarkdownRef.current = editorMarkdown;
  lastSavedMarkdownRef.current = lastSavedMarkdown;
  selectedNoteContentRef.current = selectedNoteContent;
  saveStateRef.current = saveState;
  externalNoteChangeRef.current = externalNoteChange;

  useEffect(() => {
    let isMounted = true;

    window.inknest.settings.get().then((result) => {
      if (!isMounted) {
        return;
      }

      if (result.ok) {
        setSettings(result.data);
        return;
      }

      setWorkspaceError(result.error.message);
    });

    window.inknest.app.getInfo().then((result) => {
      if (isMounted && result.ok) {
        setPhase(result.data.phase);
      }
    });

    window.inknest.workspace.getActive().then(async (result) => {
      if (!isMounted) {
        return;
      }

      if (result.ok) {
        setWorkspace(result.data);

        if (result.data.status === "ready") {
          setIsBusy(true);
          try { await restoreWorkspaceSession(result.data, () => isMounted); }
          finally { if (isMounted) setIsBusy(false); }
        }
      } else {
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    const color = accentColors.find((accent) => accent.id === settings.accentColor) ?? accentColors[0];
    const root = document.documentElement;
    root.dataset.accent = color.id;
    root.style.setProperty("--app-accent-light-rgb", color.light.join(" "));
    root.style.setProperty("--app-accent-dark-rgb", color.dark.join(" "));
    root.style.setProperty("--app-accent-solid-rgb", color.solid.join(" "));
  }, [settings.accentColor]);

  useEffect(() => {
    let isMounted = true;

    window.inknest.app.getWindowState().then((result) => {
      if (isMounted && result.ok) {
        setIsWindowMaximized(result.data.isMaximized);
      }
    });

    const unsubscribe = window.inknest.app.onWindowStateChanged((state) => {
      if (isMounted) {
        setIsWindowMaximized(state.isMaximized);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    function closeActionMenus(event: Event) {
      if (event instanceof globalThis.KeyboardEvent) {
        if (event.key !== "Escape") {
          return;
        }

        setActiveMoveFolderPath(null);
        setActiveMoveNotePath(null);
        setActiveSidebarMenu(null);
        setIsEmptyTrashDialogOpen(false);
      }

      const eventTarget = event.target instanceof Element ? event.target : null;
      const clickedMenu =
        eventTarget?.closest(".action-menu") ?? null;
      const clickedContextMenu =
        eventTarget?.closest("[data-context-menu]") ?? null;

      if (!eventTarget?.closest(".toolbar-menu-trigger, .toolbar-command-menu")) setToolbarMenu(null);
      if (!clickedContextMenu) {
        setActiveMoveFolderPath(null);
        setActiveMoveNotePath(null);
        setActiveSidebarMenu(null);
      }

      document
        .querySelectorAll<HTMLDetailsElement>(".action-menu[open]")
        .forEach((menu) => {
          if (menu !== clickedMenu) {
            menu.removeAttribute("open");
          }
        });
    }

    document.addEventListener("pointerdown", closeActionMenus);
    document.addEventListener("click", closeActionMenus);
    window.addEventListener("keydown", closeActionMenus);

    return () => {
      document.removeEventListener("pointerdown", closeActionMenus);
      document.removeEventListener("click", closeActionMenus);
      window.removeEventListener("keydown", closeActionMenus);
    };
  }, []);

  useEffect(() => {
    if (!tabMenu) return;
    if (!openNotePaths.includes(tabMenu.path)) { setTabMenu(null); return; }
    tabMenuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && tabMenuRef.current?.contains(event.target)) return;
      setTabMenu(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [tabMenu, openNotePaths]);

  useEffect(() => {
    setTabMenu(null);
    setTabRename(null);
  }, [workspace.path]);

  function showTabMenu(notePath: string, left: number, top: number) {
    if (isBusy || noteNavigationRef.current) return;
    setTabRename(null);
    setToolbarMenu(null);
    setTabMenu({ path: notePath,
      left: Math.max(8, Math.min(left, window.innerWidth - 238)),
      top: Math.max(8, Math.min(top, window.innerHeight - 202)) });
  }

  function focusNoteTab(notePath: string) {
    document.querySelectorAll<HTMLButtonElement>('[role="tab"]').forEach((tab) => {
      if (tab.title === notePath) tab.focus();
    });
  }

  const workspaceRootName =
    fileModel?.workspace.name ??
    workspace.name ??
    (workspace.path ? fileNameFromPath(workspace.path) : rootFolder.name);
  const folders = useMemo(
    () => [
      { ...rootFolder, name: workspaceRootName },
      ...(fileModel?.folders ?? [])
    ],
    [fileModel, workspaceRootName]
  );
  const notes = fileModel?.notes ?? [];
  const favoriteKeys = useMemo(() => new Set(settings.favoriteNoteKeys), [settings.favoriteNoteKeys]);
  function isFavoriteNote(notePath: string) {
    const root = workspace.path ?? workspace.lastWorkspacePath;
    return root !== null && favoriteKeys.has(JSON.stringify([root, notePath]));
  }
  const favoriteNotes = useMemo(() => notes.filter((note) => isFavoriteNote(note.path))
    .sort((a, b) => noteNameFromPath(a.path).localeCompare(noteNameFromPath(b.path))),
    [notes, favoriteKeys, workspace.path, workspace.lastWorkspacePath]);
  const hasActiveSearch = searchQuery.trim().length > 0 || selectedTag.length > 0;
  const matchingFolders = useMemo(() => {
    const terms = searchQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return terms.length ? folders.filter((folder) => folder.path !== "." &&
      terms.every((term) => folder.name.toLocaleLowerCase().includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name)) : [];
  }, [folders, searchQuery]);
  const displayedNotes: Array<NoteSummary | SearchResult> = useMemo(() => {
    const source = hasActiveSearch ? searchResults : notes;
    return [...source].sort((firstNote, secondNote) => {
      return noteNameFromPath(firstNote.path).localeCompare(
        noteNameFromPath(secondNote.path)
      );
    });
  }, [hasActiveSearch, notes, searchResults]);
  const folderTree = useMemo(
    () => {
      if (hasActiveSearch) return matchingFolders.map((folder): FolderTreeNode => ({
        ...folder, children: [], notes: [], depth: 0, noteCount: 0
      }));
      const tree = buildFolderTree(folders, displayedNotes);
      if (workspace.initialNotePaths && tree[0]) {
        const order = ["Notes", "Projects", "Journal", "Archive"];
        tree[0].children.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
        for (const folder of tree[0].children) if (folder.name === "Notes") {
          const notes = ["Ideas worth keeping", "Reading list", "Daily notes", "Untitled"];
          folder.notes.sort((a, b) => notes.indexOf(noteNameFromPath(a.path)) - notes.indexOf(noteNameFromPath(b.path)));
        }
      }
      return tree;
    },
    [displayedNotes, folders, workspace.initialNotePaths, hasActiveSearch, matchingFolders]
  );
  const visibleExpandedFolderPaths = useMemo(
    () =>
      hasActiveSearch
        ? new Set(collectFolderTreePaths(folderTree))
        : expandedFolderPaths,
    [expandedFolderPaths, folderTree, hasActiveSearch]
  );
  const selectedNote =
    notes.find((note) => note.path === selectedNotePath) ?? null;
  const selectedNoteName = selectedNote ? noteNameFromPath(selectedNote.path) : null;
  const selectedNoteLockKey = selectedNoteContent && workspace.path
    ? JSON.stringify([workspace.path, selectedNoteContent.path]) : null;
  const isNoteLocked = selectedNoteLockKey !== null && settings.lockedNoteKeys.includes(selectedNoteLockKey);
  const isEditorDisabled = isBusy || isNoteLocked;
  const hasWorkspace = workspace.status === "ready" && workspace.path !== null;
  const isDirty = selectedNoteContent !== null && editorMarkdown !== lastSavedMarkdown;
  const saveStatusLabel = selectedNoteContent
    ? saveState === "saving"
      ? "Saving"
      : saveState === "failed"
        ? "Save failed"
        : isDirty || saveState === "unsaved"
          ? "Unsaved changes"
          : "Saved"
    : "No note";
  const editorStatusLabel = statusMessage === "Ready" ? saveStatusLabel : statusMessage;
  const wordCount = editorMarkdown.trim()
    ? editorMarkdown.trim().split(/\s+/).length
    : 0;
  const characterCount = editorMarkdown.length;
  const workspaceName = workspace.name ?? "No workspace";
  const workspacePath =
    workspace.path ??
    workspace.lastWorkspacePath ??
    "Open a local Markdown folder to begin";
  const currentFilePath = selectedNote?.path ?? selectedNoteContent?.path ?? workspacePath;
  const workspacePromptTitle =
    workspace.status === "missing"
      ? "Previous workspace missing"
      : workspace.status === "permission-denied"
        ? "Workspace access needed"
        : "No workspace selected";
  const currentMode = selectedNoteContent ? "Visual editor" : "Workspace overview";

  const commandPaletteCommands = useMemo<CommandPaletteCommand[]>(
    () => [
      {
        id: "new-note",
        label: "Create new note",
        description: "Create a Markdown note in the current folder.",
        icon: <FilePlus2 size={16} />,
        disabled: !hasWorkspace || isBusy
      },
      {
        id: "new-folder",
        label: "Create new folder",
        description: "Create a folder in the current workspace.",
        icon: <FolderPlus size={16} />,
        disabled: !hasWorkspace || isBusy
      },
      {
        id: "choose-workspace",
        label: "Choose workspace",
        description: "Open or create a local Markdown workspace.",
        icon: <FolderOpen size={16} />,
        disabled: isBusy
      },
      {
        id: "focus-search",
        label: "Focus note search",
        description: "Jump to the note search field.",
        shortcut: "/",
        icon: <Search size={16} />,
        disabled: !settings.sidebarVisible
      },
      {
        id: "save-note",
        label: "Save current note",
        description: "Write the current note to disk.",
        shortcut: "⌘/Ctrl+S",
        icon: <Save size={16} />,
        disabled: !selectedNoteContent || !isDirty || isBusy || isSaving
      },
      {
        id: "toggle-sidebar",
        label: settings.sidebarVisible ? "Hide sidebar" : "Show sidebar",
        description: "Toggle the workspace and note panels.",
        icon: <PanelLeft size={16} />,
        disabled: false
      },
      {
        id: "open-settings",
        label: "Open settings",
        description: "Change theme, editor, and layout preferences.",
        icon: <Settings size={16} />,
        disabled: false
      },
      {
        id: "export-markdown",
        label: "Export Markdown",
        description: "Save the current note as Markdown.",
        icon: <FileOutput size={16} />,
        disabled: !selectedNoteContent || isBusy
      },
      {
        id: "export-html",
        label: "Export HTML",
        description: "Save a readable HTML version of the current note.",
        icon: <FileOutput size={16} />,
        disabled: !selectedNoteContent || isBusy
      },
      {
        id: "export-pdf",
        label: "Export PDF",
        description: "Print the current note to PDF.",
        icon: <FileOutput size={16} />,
        disabled: !selectedNoteContent || isBusy
      }
    ],
    [hasWorkspace, isBusy, isDirty, isSaving, selectedNoteContent, settings.sidebarVisible]
  );
  const filteredCommandPaletteCommands = commandPaletteCommands.filter((command) => {
    const query = commandPaletteQuery.trim().toLocaleLowerCase();
    return (
      !query ||
      `${command.label} ${command.description}`.toLocaleLowerCase().includes(query)
    );
  });

  useEffect(() => {
    if (!fileModel) {
      return;
    }

    const folderPaths = new Set(folders.map((folder) => folder.path));

    if (!folderPaths.has(selectedFolderPath)) {
      setSelectedFolderPath(".");
    }

    setExpandedFolderPaths((currentPaths) => {
      const nextPaths = new Set(
        [...currentPaths].filter((folderPath) => folderPaths.has(folderPath))
      );

      nextPaths.add(".");
      for (const ancestorPath of getAncestorFolderPaths(selectedFolderPath)) {
        if (folderPaths.has(ancestorPath)) {
          nextPaths.add(ancestorPath);
        }
      }

      return nextPaths;
    });
  }, [fileModel, folders, selectedFolderPath]);

  useEffect(() => {
    let isCurrent = true;

    if (!hasWorkspace || !hasActiveSearch) {
      setSearchResults([]);
      setSearchError(null);
      return () => {
        isCurrent = false;
      };
    }

    window.inknest.search.query({
      query: searchQuery,
      scope: "name",
      tag: selectedTag || undefined
    })
      .then((result) => {
        if (!isCurrent) {
          return;
        }

        if (result.ok) {
          setSearchResults(result.data);
          setSearchError(null);
        } else {
          setSearchResults([]);
          setSearchError(result.error.message);
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return;
        }

        setSearchResults([]);
        setSearchError(
          error instanceof Error ? error.message : "Search could not be completed."
        );
      });

    return () => {
      isCurrent = false;
    };
  }, [fileModel, hasActiveSearch, hasWorkspace, searchQuery, selectedTag, workspace.path]);

  async function refreshWorkspace() {
    const result = await window.inknest.workspace.scan();

    if (result.ok) {
      setWorkspace((current) => ({ ...result.data.workspace,
        ...(current.path === result.data.workspace.path && current.initialNotePaths ? { initialNotePaths: current.initialNotePaths } : {}) }));
      setFileModel(result.data);
      setWorkspaceError(null);

      const trashResult = await window.inknest.notes.listTrash();
      if (trashResult.ok) {
        setTrashNotes(trashResult.data);
      }

      const tagsResult = await window.inknest.search.listTags();
      if (tagsResult.ok) {
        setTagSummaries(tagsResult.data);
      }

      return result.data;
    }

    setWorkspaceError(result.error.message);
    return null;
  }

  function applyNoteContent(note: NoteContent) {
    setOpenNotePaths((currentPaths) =>
      currentPaths.includes(note.path) ? currentPaths : [...currentPaths, note.path]
    );
    setLinkDialog(null);
    setActiveToolbarCommands(new Set());
    selectedNoteContentRef.current = note;
    editorMarkdownRef.current = note.markdown;
    lastSavedMarkdownRef.current = note.markdown;
    setSelectedNotePath(note.path);
    setSelectedNoteContent(note);
    setEditorMarkdown(note.markdown);
    setLastSavedMarkdown(note.markdown);
    setExternalNoteChange(null);
    updateSaveState("saved");
    updateSaveError(null);
  }

  async function reloadNoteFromDisk(notePath: string) {
    setIsBusy(true);
    const result = await window.inknest.notes.read(notePath);

    if (result.ok) {
      applyNoteContent(result.data);
      setWorkspaceError(null);
      setStatusMessage("Reloaded from disk");
    } else {
      setWorkspaceError(result.error.message);
      setStatusMessage("Reload failed");
    }

    setIsBusy(false);
  }

  async function handleWorkspaceChanged(change: WorkspaceChangeEvent) {
    const currentWorkspacePath = workspace.path ?? workspace.lastWorkspacePath;

    if (!currentWorkspacePath || change.workspacePath !== currentWorkspacePath) {
      return;
    }

    if (change.workspaceStatus !== "ready") {
      const message =
        change.workspaceStatus === "permission-denied"
          ? "InkNest cannot access the workspace. Check its permissions or choose another folder."
          : "The workspace folder is no longer available. Choose it again to continue.";
      setWorkspace((currentWorkspace) => ({
        ...currentWorkspace,
        path: null,
        name: null,
        status: change.workspaceStatus,
        message
      }));
      setWorkspaceError(message);
      setStatusMessage("Workspace unavailable");

      if (selectedNoteContentRef.current) {
        setExternalNoteChange({
          kind: "deleted",
          path: selectedNoteContentRef.current.path
        });
      }
      return;
    }

    if (!workspace.path) {
      setWorkspace((currentWorkspace) => ({
        ...currentWorkspace,
        path: change.workspacePath,
        name: change.workspacePath.split(/[\\/]/).pop() ?? null,
        status: "ready",
        message: "Workspace is ready."
      }));
      setWorkspaceError(null);
      setStatusMessage("Workspace available");
    }

    const openNotePath = selectedNoteContentRef.current?.path;
    setOpenNotePaths((currentPaths) =>
      currentPaths.filter((notePath) =>
        notePath === openNotePath || !change.deletedPaths.includes(notePath)
      )
    );
    const noteWasDeleted = openNotePath
      ? change.deletedPaths.includes(openNotePath)
      : false;
    const noteWasChanged = openNotePath
      ? change.changedPaths.includes(openNotePath)
      : false;
    syncEditorMarkdownSnapshot();
    if (openNotePath && (noteWasDeleted || noteWasChanged)) {
      let ownSaveNotification = false;
      if (noteWasChanged && !noteWasDeleted) {
        const disk = await window.inknest.notes.read(openNotePath);
        if (selectedNoteContentRef.current?.path !== openNotePath ||
            (sessionSnapshotRef.current && sessionSnapshotRef.current.workspacePath !== change.workspacePath)) return;
        const pending = pendingNoteSaveRef.current;
        ownSaveNotification = disk.ok && (disk.data.markdown === lastSavedMarkdownRef.current ||
          (pending?.path === openNotePath && disk.data.markdown === pending.markdown));
      }
      // A watcher can observe our atomic save before its IPC response arrives.
      // Matching saved content is not a competing external edit.
      if (ownSaveNotification) {
        await refreshWorkspace();
        return;
      }
      syncEditorMarkdownSnapshot();
      const hasLocalChangesNow = editorMarkdownRef.current !== lastSavedMarkdownRef.current;
      if (noteWasDeleted || hasLocalChangesNow) {
        setExternalNoteChange({
          kind: noteWasDeleted ? "deleted" : "changed",
          path: openNotePath
        });
        updateSaveError(
          noteWasDeleted
            ? "This note was deleted outside InkNest."
            : "This note changed outside InkNest while you had local edits."
        );
        setStatusMessage("External change needs review");
      } else {
        await reloadNoteFromDisk(openNotePath);
      }
    }

    await refreshWorkspace();
  }

  useEffect(() => {
    const unsubscribe = window.inknest.workspace.onChanged((change) => {
      void handleWorkspaceChanged(change);
    });

    return unsubscribe;
  }, [workspace.path]);

  async function updateAppSettings(patch: SaveSettingsPayload) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      ...patch
    }));
    setStatusMessage("Saving settings");

    const savePromise = window.inknest.settings.save(patch);
    pendingSettingsSavesRef.current.add(savePromise);

    try {
      const result = await savePromise;

      if (result.ok) {
        setSettings(result.data);
        setStatusMessage("Settings saved");
        setWorkspaceError(null);
        return true;
      }

      const latestSettings = await window.inknest.settings.get();
      if (latestSettings.ok) {
        setSettings(latestSettings.data);
      }
      setWorkspaceError(result.error.message);
      setStatusMessage("Settings failed");
      return false;
    } finally {
      pendingSettingsSavesRef.current.delete(savePromise);
    }
  }

  async function clearRecentWorkspaces() {
    setStatusMessage("Clearing recent workspaces");

    const clearPromise = window.inknest.settings.clearRecentWorkspaces();
    pendingSettingsSavesRef.current.add(clearPromise);

    try {
      const result = await clearPromise;

      if (result.ok) {
        setSettings(result.data);
        setWorkspace((currentWorkspace) => ({
          ...currentWorkspace,
          recentWorkspaces: result.data.recentWorkspaces
        }));
        setStatusMessage("Recent workspaces cleared");
        setWorkspaceError(null);
        return true;
      }

      setWorkspaceError(result.error.message);
      setStatusMessage("Recent workspaces could not be cleared");
      return false;
    } finally {
      pendingSettingsSavesRef.current.delete(clearPromise);
    }
  }

  function requestEmptyTrash() {
    setActiveSidebarMenu(null);
    setIsEmptyTrashDialogOpen(true);
  }

  async function emptyTrash() {
    setIsEmptyTrashDialogOpen(false);

    if (trashNotes.length === 0) {
      setStatusMessage("Trash is already empty");
      return;
    }

    setIsBusy(true);
    setWorkspaceError(null);

    let deletedCount = 0;
    let errorMessage: string | null = null;

    for (const note of trashNotes) {
      const result = await window.inknest.notes.permanentlyDelete({
        trashPath: note.trashPath,
        confirmed: true
      });

      if (!result.ok) {
        errorMessage = result.error.message;
        break;
      }

      deletedCount += 1;
    }

    await refreshWorkspace();

    if (errorMessage) {
      setWorkspaceError(errorMessage);
      setStatusMessage(
        deletedCount > 0 ? `Trash partially emptied (${deletedCount} deleted)` : "Trash could not be emptied"
      );
    } else {
      setStatusMessage("Trash emptied");
    }

    setIsBusy(false);
  }

  async function flushPendingSettings() {
    while (pendingSettingsSavesRef.current.size > 0) {
      await Promise.allSettled([...pendingSettingsSavesRef.current]);
    }
  }

  async function minimizeWindow() {
    const result = await window.inknest.app.minimizeWindow();

    if (result.ok) {
      setIsWindowMaximized(result.data.isMaximized);
    }
  }

  async function toggleMaximizeWindow() {
    const result = await window.inknest.app.toggleMaximizeWindow();

    if (result.ok) {
      setIsWindowMaximized(result.data.isMaximized);
    }
  }

  async function closeWindow() {
    await window.inknest.app.closeWindow();
  }

  function closeCommandPalette() {
    setIsCommandPaletteOpen(false);
    setCommandPaletteQuery("");
    setActiveCommandIndex(0);
  }

  async function runCommandPaletteCommand(commandId: string) {
    closeCommandPalette();

    switch (commandId) {
      case "new-note":
        await createNote();
        break;
      case "new-folder":
        await createFolder();
        break;
      case "choose-workspace":
        await chooseWorkspace();
        break;
      case "focus-search":
        if (!settings.sidebarVisible) {
          await updateAppSettings({ sidebarVisible: true });
        }
        window.setTimeout(() => {
          const searchInput = document.querySelector<HTMLInputElement>(
            'input[aria-label="Search notes"]'
          );
          searchInput?.focus();
          searchInput?.select();
        }, 0);
        break;
      case "save-note":
        await saveCurrentNote();
        break;
      case "toggle-sidebar":
        await updateAppSettings({ sidebarVisible: !settings.sidebarVisible });
        break;
      case "open-settings":
        setIsSettingsOpen(true);
        break;
      case "export-markdown":
        await exportCurrentNote("markdown");
        break;
      case "export-html":
        await exportCurrentNote("html");
        break;
      case "export-pdf":
        await exportCurrentNote("pdf");
        break;
      default:
        break;
    }
  }

  async function toggleNoteLock() {
    if (!selectedNoteLockKey || isBusy) return;
    setIsBusy(true);
    setToolbarMenu(null);
    setLinkDialog(null);
    try {
      if (!(await flushCurrentNote())) return;
      const lockedNoteKeys = isNoteLocked
        ? settings.lockedNoteKeys.filter((key) => key !== selectedNoteLockKey)
        : [...settings.lockedNoteKeys, selectedNoteLockKey];
      if (await updateAppSettings({ lockedNoteKeys })) {
        setStatusMessage(isNoteLocked ? "Note unlocked" : "Note locked — view only");
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleFavoriteNote(notePath: string) {
    if (!workspace.path || isBusy || favoriteSaveInFlightRef.current) return;
    const key = JSON.stringify([workspace.path, notePath]);
    const wasFavorite = settings.favoriteNoteKeys.includes(key);
    favoriteSaveInFlightRef.current = true;
    setIsFavoriteSaving(true);
    try {
      const favoriteNoteKeys = wasFavorite ? settings.favoriteNoteKeys.filter((value) => value !== key)
        : [...settings.favoriteNoteKeys, key];
      if (await updateAppSettings({ favoriteNoteKeys })) setStatusMessage(wasFavorite ? "Removed from favorites" : "Added to favorites");
    } finally {
      favoriteSaveInFlightRef.current = false;
      setIsFavoriteSaving(false);
    }
  }

  async function remapNotePreferences(fromPath: string, toPath: string, folder = false) {
    const remap = (keys: string[]) => keys.map((key) => {
      try {
        const [root, notePath] = JSON.parse(key);
        if (root !== workspace.path || typeof notePath !== "string") return key;
        if (notePath === fromPath || (folder && notePath.startsWith(`${fromPath}/`))) {
          return JSON.stringify([root, `${toPath}${notePath.slice(fromPath.length)}`]);
        }
      } catch { /* Ignore malformed legacy lock entries. */ }
      return key;
    });
    const lockedNoteKeys = remap(settings.lockedNoteKeys);
    const favoriteNoteKeys = remap(settings.favoriteNoteKeys);
    if (lockedNoteKeys.some((key, index) => key !== settings.lockedNoteKeys[index]) ||
        favoriteNoteKeys.some((key, index) => key !== settings.favoriteNoteKeys[index])) {
      await updateAppSettings({ lockedNoteKeys, favoriteNoteKeys });
    }
  }

  async function insertPastedImage(payload: SaveImagePayload) {
    if (!selectedNoteContent || isEditorDisabled) {
      return;
    }

    const result = await window.inknest.dialogs.saveImage(payload);

    if (!result.ok) {
      setWorkspaceError(result.error.message);
      setStatusMessage("Image paste failed");
      return;
    }

    editorHandleRef.current?.runCommand("image", {
      src: result.data.assetPath,
      previewSrc: result.data.displaySrc,
      alt: fileNameFromPath(result.data.fileName)
    });
    setStatusMessage("Image inserted");
  }

  async function openLocalLink(url: string) {
    if (!selectedNoteContent) {
      return;
    }

    const result = await window.inknest.links.resolveLocal({
      fromPath: selectedNoteContent.path,
      url
    });

    if (!result.ok) {
      setWorkspaceError(result.error.message);
      return;
    }

    setSelectedFolderPath(
      result.data.path.includes("/")
        ? result.data.path.slice(0, result.data.path.lastIndexOf("/")) || "."
        : "."
    );
    await openNote(result.data.path);
  }

  async function chooseWorkspace() {
    if (!(await flushCurrentNote()) || !(await persistSession())) {
      return;
    }

    setIsBusy(true);
    setWorkspaceError(null);

    const result = await window.inknest.workspace.choose();

    if (result.ok) {
      if (result.data.path === workspace.path) {
        if (result.data.status === "ready") await refreshWorkspace();
        setIsBusy(false);
        return;
      }
      setSessionReadyWorkspace(null);
      setWorkspace(result.data);
      setSearchQuery("");
      setSelectedTag("");
      clearSelectedNote();
      setSelectedFolderPath(".");
      setExpandedFolderPaths(new Set(["."]));
      setOpenNotePaths([]);
      if (result.data.status === "ready") {
        await restoreWorkspaceSession(result.data);
      }
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function reopenWorkspace(workspacePath: string) {
    if (!(await flushCurrentNote()) || !(await persistSession())) {
      return;
    }

    setIsBusy(true);
    setWorkspaceError(null);

    const result = await window.inknest.workspace.select(workspacePath);

    if (result.ok) {
      if (result.data.path === workspace.path) {
        if (result.data.status === "ready") await refreshWorkspace();
        setIsBusy(false);
        return;
      }
      setSessionReadyWorkspace(null);
      setWorkspace(result.data);
      setSearchQuery("");
      setSelectedTag("");
      clearSelectedNote();
      setSelectedFolderPath(".");
      setExpandedFolderPaths(new Set(["."]));
      setOpenNotePaths([]);
      await restoreWorkspaceSession(result.data);
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  function updateSaveState(nextState: SaveState) {
    saveStateRef.current = nextState;
    setSaveState(nextState);
  }

  function updateSaveError(nextError: string | null) {
    setSaveError(nextError);
  }

  function hasPendingSave() {
    const note = selectedNoteContentRef.current;
    return note !== null && editorMarkdownRef.current !== lastSavedMarkdownRef.current;
  }

  function syncEditorMarkdownSnapshot() {
    const note = selectedNoteContentRef.current;
    const nextMarkdown = editorHandleRef.current?.getMarkdown();

    if (!note || nextMarkdown === undefined || nextMarkdown === editorMarkdownRef.current) {
      return editorMarkdownRef.current;
    }

    editorMarkdownRef.current = nextMarkdown;
    setEditorMarkdown(nextMarkdown);
    if (saveStateRef.current !== "saving") {
      updateSaveState("unsaved");
    }

    return nextMarkdown;
  }

  function clearAutoSaveTimer() {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }

  function scheduleAutoSave(delay = settings.autoSaveDelayMs || autoSaveDelayMs) {
    clearAutoSaveTimer();

    if (!hasPendingSave()) {
      return;
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveCurrentNote();
    }, delay);
  }

  function clearSelectedNote() {
    clearAutoSaveTimer();
    setEditingNotePath(null);
    setNoteNameDraft("");
    selectedNoteContentRef.current = null;
    editorMarkdownRef.current = "";
    lastSavedMarkdownRef.current = "";
    setSelectedNotePath(null);
    setSelectedNoteContent(null);
    setEditorMarkdown("");
    setLastSavedMarkdown("");
    setExternalNoteChange(null);
    setLinkDialog(null);
    updateSaveState("saved");
    updateSaveError(null);
    setActiveToolbarCommands(new Set());
  }

  async function openNote(notePath: string) {
    if (noteNavigationRef.current) {
      return;
    }

    if (selectedNoteContentRef.current?.path === notePath) {
      return;
    }

    noteNavigationRef.current = true;
    setIsBusy(true);
    try {
      if (!(await flushCurrentNote())) {
        return;
      }

      setActiveMoveNotePath(null);
      const result = await window.inknest.notes.read(notePath);

      if (result.ok) {
        applyNoteContent(result.data);
        setWorkspaceError(null);
        setStatusMessage("Note opened");
      } else {
        setWorkspaceError(result.error.message);
      }
    } finally {
      noteNavigationRef.current = false;
      setIsBusy(false);
    }
  }

  function remapNoteTabs(fromPath: string, toPath: string) {
    setOpenNotePaths((currentPaths) => [...new Set(currentPaths.map((notePath) =>
      notePath === fromPath ? toPath : notePath
    ))]);
  }

  async function removeNoteTabs(notePaths: string[]) {
    const remainingPaths = openNotePaths.filter((notePath) => !notePaths.includes(notePath));
    const activePath = selectedNoteContentRef.current?.path;
    setOpenNotePaths((currentPaths) => currentPaths.filter((notePath) => !notePaths.includes(notePath)));

    if (activePath && notePaths.includes(activePath)) {
      const activeIndex = openNotePaths.indexOf(activePath);
      const nextPath = remainingPaths[Math.min(activeIndex, remainingPaths.length - 1)];
      clearSelectedNote();
      if (nextPath) {
        await openNote(nextPath);
      }
    }
  }

  async function closeNoteTabs(notePaths: string[]) {
    if (isBusy || noteNavigationRef.current) {
      return;
    }
    noteNavigationRef.current = true;
    setIsBusy(true);
    setTabMenu(null);
    setTabRename(null);
    try {
      const activePath = selectedNoteContentRef.current?.path;
      if (activePath && notePaths.includes(activePath) && !(await flushCurrentNote())) {
        return;
      }
      noteNavigationRef.current = false;
      await removeNoteTabs(notePaths);
    } finally {
      noteNavigationRef.current = false;
      setIsBusy(false);
    }
  }

  async function closeNoteTab(notePath: string) {
    await closeNoteTabs([notePath]);
  }

  function openSearchResult(result: SearchResult) {
    setSelectedFolderPath(result.folderPath);
    void openNote(result.path);
  }

  async function saveCurrentNote(): Promise<boolean> {
    const note = selectedNoteContentRef.current;
    const markdownToSave = syncEditorMarkdownSnapshot();

    if (externalNoteChangeRef.current) {
      setStatusMessage("Resolve the external change first");
      return false;
    }

    if (!note || markdownToSave === lastSavedMarkdownRef.current) {
      return saveStateRef.current !== "failed";
    }

    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      await saveInFlightRef.current;
      return !hasPendingSave();
    }

    const requestPath = note.path;
    const pendingSave = { path: requestPath, markdown: markdownToSave.trim() ? markdownToSave : "" };
    pendingNoteSaveRef.current = pendingSave;
    updateSaveState("saving");
    updateSaveError(null);
    setStatusMessage("Saving");
    setIsSaving(true);

    const savePromise = (async () => {
      let result;

      try {
        result = await window.inknest.notes.save({
          path: requestPath,
          markdown: markdownToSave
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The note could not be saved.";

        updateSaveState("failed");
        updateSaveError(message);
        setWorkspaceError(message);
        setStatusMessage("Save failed");
        return false;
      }

      if (!result.ok) {
        if (selectedNoteContentRef.current?.path === requestPath) {
          updateSaveState("failed");
          updateSaveError(result.error.message);
          setWorkspaceError(result.error.message);
          setStatusMessage("Save failed");
        }

        return false;
      }

      if (selectedNoteContentRef.current?.path === requestPath) {
        selectedNoteContentRef.current = result.data;
        lastSavedMarkdownRef.current = result.data.markdown;
        setSelectedNoteContent(result.data);
        setLastSavedMarkdown(result.data.markdown);

        if (editorMarkdownRef.current === markdownToSave) {
          editorMarkdownRef.current = result.data.markdown;
          setEditorMarkdown(result.data.markdown);
        }
      }

      await refreshWorkspace();

      if (selectedNoteContentRef.current?.path === requestPath) {
        const stillDirty = hasPendingSave();
        updateSaveState(stillDirty ? "unsaved" : "saved");
        setStatusMessage(stillDirty ? "Unsaved changes" : "Saved");
        updateSaveError(null);
        if (!stillDirty) {
          setWorkspaceError(null);
        }
      }

      return true;
    })();

    saveInFlightRef.current = savePromise;

    try {
      return await savePromise;
    } finally {
      if (saveInFlightRef.current === savePromise) {
        saveInFlightRef.current = null;
      }

      if (pendingNoteSaveRef.current === pendingSave) pendingNoteSaveRef.current = null;
      setIsSaving(false);

      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        scheduleAutoSave();
      }
    }
  }

  function keepLocalNoteVersion() {
    const note = selectedNoteContentRef.current;

    if (!note) {
      return;
    }

    if (externalNoteChangeRef.current?.kind === "deleted") {
      const localMarkdown = editorMarkdownRef.current;
      const localBaseline = localMarkdown.length > 0 ? "" : " ";
      lastSavedMarkdownRef.current = localBaseline;
      setLastSavedMarkdown(localBaseline);
      updateSaveState("unsaved");
    }

    setExternalNoteChange(null);
    updateSaveError(null);
    setWorkspaceError(null);
    setStatusMessage("Keeping local version");
    scheduleAutoSave();
  }

  async function saveLocalVersionAsNewNote() {
    const note = selectedNoteContentRef.current;
    const markdownToSave = syncEditorMarkdownSnapshot();

    if (!note) {
      return;
    }

    setIsBusy(true);
    const folderPath = note.path.includes("/")
      ? note.path.slice(0, note.path.lastIndexOf("/"))
      : ".";
    const title = `${note.path
      .split("/")
      .pop()
      ?.replace(/\.md$/i, "") ?? "Recovered note"} Recovered`;
    const created = await window.inknest.notes.create({ folderPath, title });

    if (!created.ok) {
      setWorkspaceError(created.error.message);
      setStatusMessage("Save as new failed");
      setIsBusy(false);
      return;
    }

    const saved = await window.inknest.notes.save({
      path: created.data.path,
      markdown: markdownToSave
    });

    if (!saved.ok) {
      setWorkspaceError(saved.error.message);
      setStatusMessage("Save as new failed");
      setIsBusy(false);
      return;
    }

    await refreshWorkspace();
    remapNoteTabs(note.path, saved.data.path);
    applyNoteContent(saved.data);
    setIsBusy(false);
    setStatusMessage("Saved local version as new note");
  }

  async function exportCurrentNote(format: ExportFormat) {
    if (!selectedNoteContent || isBusy || !(await flushCurrentNote())) {
      return;
    }

    setIsBusy(true);
    setWorkspaceError(null);

    const result = await window.inknest.export.note({
      path: selectedNoteContent.path,
      format
    });

    if (!result.ok) {
      setWorkspaceError(result.error.message);
      setStatusMessage("Export failed");
    } else if ("exported" in result.data && result.data.exported) {
      setStatusMessage(`Exported ${format === "markdown" ? "Markdown" : format.toUpperCase()}`);
    }

    setIsBusy(false);
  }

  async function flushCurrentNote() {
    clearAutoSaveTimer();
    syncEditorMarkdownSnapshot();

    while (true) {
      if (saveInFlightRef.current) {
        await saveInFlightRef.current;
        await Promise.resolve();
        continue;
      }

      if (!hasPendingSave()) {
        return true;
      }

      if (!(await saveCurrentNote())) {
        return false;
      }
    }
  }

  useEffect(() => {
    if (!selectedNoteContent || !isDirty) {
      return;
    }

    if (saveStateRef.current !== "saving") {
      updateSaveState("unsaved");
    }

    scheduleAutoSave();

    return clearAutoSaveTimer;
  }, [
    editorMarkdown,
    isDirty,
    lastSavedMarkdown,
    selectedNoteContent?.path,
    settings.autoSaveDelayMs
  ]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
          ["f", "h"].includes(event.key.toLowerCase()) && editorHandleRef.current && !isSettingsOpen && !isCommandPaletteOpen) {
        event.preventDefault();
        editorHandleRef.current.openSearch(event.key.toLowerCase() === "h" ? "replace" : "find");
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (event.shiftKey) { setIsCommandPaletteOpen(true); setIsSettingsOpen(false); }
        else {
          setIsSettingsOpen(false);
          if (!settings.sidebarVisible) void updateAppSettings({ sidebarVisible: true });
          window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[aria-label="Search notes"]')?.focus());
        }
        return;
      }

      if (event.key === "Escape") {
        if (isCommandPaletteOpen) {
          event.preventDefault();
          closeCommandPalette();
          return;
        }

        if (isSettingsOpen) {
          event.preventDefault();
          setIsSettingsOpen(false);
          return;
        }
      }

      if (event.key === "/" && !isTypingTarget && settings.sidebarVisible) {
        event.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search notes"]'
        );
        searchInput?.focus();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        void saveCurrentNote();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isCommandPaletteOpen, isSettingsOpen, settings.sidebarVisible]);

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [commandPaletteQuery]);

  useEffect(() => {
    if (!isCommandPaletteOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      commandPaletteInputRef.current?.focus();
      commandPaletteInputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    return window.inknest.app.onPrepareToClose(() => {
      void (async () => {
        try {
          const didFlush = await flushCurrentNote();
          await flushPendingSettings();
          const didSaveSession = await persistSession();

          if (didFlush && didSaveSession) {
            window.inknest.app.closeReady();
            return;
          }

          setStatusMessage("Save failed");
          window.inknest.app.closeCanceled();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "The pending save could not be completed.";
          updateSaveState("failed");
          updateSaveError(message);
          setWorkspaceError(message);
          setStatusMessage("Save failed");
          window.inknest.app.closeCanceled();
        }
      })();
    });
  }, []);

  async function runToolbarCommand(
    command: ToolbarCommand,
    event?: ReactMouseEvent<HTMLButtonElement>
  ) {
    if (!selectedNoteContent || isEditorDisabled) {
      return;
    }

    if (command.id === "link") {
      const buttonRect = event?.currentTarget.getBoundingClientRect();
      const linkDetails = editorHandleRef.current?.getLinkDetails();

      openLinkDialog({
        text: linkDetails?.text ?? "",
        url: linkDetails?.url ?? "",
        isEditing: linkDetails?.isEditing ?? false,
        position: getViewportPopoverPosition(
          buttonRect?.left ?? 24,
          buttonRect ? buttonRect.bottom + 8 : 120
        )
      });
      return;
    }

    const options: MarkdownEditorCommandOptions = {};

    if (command.id === "image") {
      const result = await window.inknest.dialogs.selectImage();

      if (!result.ok) {
        setStatusMessage("Image picker failed");
        return;
      }

      if (result.data.canceled) {
        return;
      }

      options.src = result.data.assetPath;
      options.previewSrc = result.data.displaySrc;
      options.alt = fileNameFromPath(result.data.path);
    }

    const didRun = editorHandleRef.current?.runCommand(command.id, options);
    setStatusMessage(didRun ? `Applied ${command.label}` : `Cannot apply ${command.label} to this selection`);
  }

  function openLinkDialog(details: LinkDialogDetails) {
    if (isEditorDisabled) return;
    setLinkDialog({
      text: details.text,
      url: details.url,
      isEditing: details.isEditing,
      position: details.position ?? getViewportPopoverPosition(24, 120)
    });
  }

  function submitLinkDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!linkDialog) {
      return;
    }

    const text = linkDialog.text.trim();
    const url = linkDialog.url.trim();

    if (!text || !url) {
      setLinkDialog({
        ...linkDialog,
        error: "Enter both text and link."
      });
      return;
    }

    const didRun = editorHandleRef.current?.runCommand(linkDialog.isEditing ? "link-edit" : "link", {
      label: text,
      url
    });
    if (!didRun) {
      setLinkDialog({ ...linkDialog, error: "Select text in a paragraph or heading to add a link." });
      return;
    }
    setStatusMessage(linkDialog.isEditing ? "Updated link" : "Inserted link");
    setLinkDialog(null);
  }

  function removeLinkFromDialog() {
    if (!linkDialog?.isEditing) {
      return;
    }

    editorHandleRef.current?.runCommand("link-remove");
    setStatusMessage("Removed link");
    setLinkDialog(null);
  }

  async function createNote(folderPath = selectedFolderPath) {
    if (isBusy || !(await flushCurrentNote())) {
      return;
    }
    setActiveMoveNotePath(null);
    setActiveMoveFolderPath(null);
    setEditingNotePath(null);
    setNoteNameDraft("");
    setEditingFolderPath(null);
    setSelectedFolderPath(folderPath);
    setExpandedFolderPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      nextPaths.add(folderPath);
      for (const ancestorPath of getAncestorFolderPaths(folderPath)) {
        nextPaths.add(ancestorPath);
      }
      return nextPaths;
    });
    setIsBusy(true);
    const result = await window.inknest.notes.create({
      title: "Untitled",
      folderPath
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

  async function createFolder(parentPath = selectedFolderPath) {
    setActiveMoveNotePath(null);
    setActiveMoveFolderPath(null);
    setEditingNotePath(null);
    setNoteNameDraft("");
    setEditingFolderPath(null);
    setSelectedFolderPath(parentPath);
    setExpandedFolderPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);
      nextPaths.add(parentPath);
      for (const ancestorPath of getAncestorFolderPaths(parentPath)) {
        nextPaths.add(ancestorPath);
      }
      return nextPaths;
    });
    setIsBusy(true);
    const result = await window.inknest.folders.create({
      parentPath,
      name: "New Folder"
    });

    if (result.ok) {
      await refreshWorkspace();
      setSelectedFolderPath(result.data.path);
      setExpandedFolderPaths((currentPaths) => {
        const nextPaths = new Set(currentPaths);
        nextPaths.add(result.data.path);
        for (const ancestorPath of getAncestorFolderPaths(result.data.path)) {
          nextPaths.add(ancestorPath);
        }
        return nextPaths;
      });
      setStatusMessage("Folder created");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  function startRenamingFolder(folder: FolderSummary) {
    setActiveMoveNotePath(null);
    setActiveMoveFolderPath(null);
    setEditingNotePath(null);
    setNoteNameDraft("");
    setEditingFolderPath(folder.path);
    setFolderNameDraft(folder.name);
  }

  async function renameFolder(folder: FolderSummary, name: string) {
    const nextName = name.trim();

    if (!nextName) {
      setWorkspaceError("Folder name cannot be empty.");
      return;
    }

    if (
      selectedNote &&
      isSameOrChildFolderPath(selectedNote.folderPath, folder.path) &&
      !(await flushCurrentNote())
    ) {
      return;
    }

    setActiveMoveNotePath(null);
    setActiveMoveFolderPath(null);
    setIsBusy(true);
    const result = await window.inknest.folders.rename({
      path: folder.path,
      name: nextName
    });

    if (result.ok) {
      setEditingFolderPath(null);
      setFolderNameDraft("");
      await remapNotePreferences(folder.path, result.data.path, true);

      setOpenNotePaths((currentPaths) => currentPaths.map((notePath) =>
        notePath.startsWith(`${folder.path}/`)
          ? `${result.data.path}${notePath.slice(folder.path.length)}`
          : notePath
      ));

      if (selectedNote && isSameOrChildFolderPath(selectedNote.folderPath, folder.path)) {
        await openNote(`${result.data.path}${selectedNote.path.slice(folder.path.length)}`);
      }

      await refreshWorkspace();
      setSelectedFolderPath(result.data.path);
      setExpandedFolderPaths((currentPaths) => {
        const nextPaths = new Set(currentPaths);
        nextPaths.add(result.data.path);
        for (const ancestorPath of getAncestorFolderPaths(result.data.path)) {
          nextPaths.add(ancestorPath);
        }
        return nextPaths;
      });
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

    if (
      selectedNote &&
      isSameOrChildFolderPath(selectedNote.folderPath, folder.path) &&
      !(await flushCurrentNote())
    ) {
      return;
    }

    setActiveMoveNotePath(null);
    setActiveMoveFolderPath(null);
    setEditingFolderPath(null);
    setIsBusy(true);
    const result = await window.inknest.folders.delete({
      path: folder.path,
      confirmed: true
    });

    if (result.ok) {
      if (selectedFolderPath === folder.path || selectedFolderPath.startsWith(`${folder.path}/`)) {
        setSelectedFolderPath(".");
      }

      await removeNoteTabs(openNotePaths.filter((notePath) => notePath.startsWith(`${folder.path}/`)));

      await refreshWorkspace();
      setStatusMessage("Folder deleted");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  function toggleFolder(folderPath: string) {
    setExpandedFolderPaths((currentPaths) => {
      const nextPaths = new Set(currentPaths);

      if (nextPaths.has(folderPath)) {
        nextPaths.delete(folderPath);
      } else {
        nextPaths.add(folderPath);
      }

      return nextPaths;
    });
  }

  async function renameNote(note: NoteSummary | SearchResult, name: string) {
    const title = noteNameFromPath(name.trim());

    if (!title) {
      setWorkspaceError("Note title cannot be empty.");
      return;
    }

    const shouldReopen = note.path === selectedNotePath;
    if (shouldReopen && !(await flushCurrentNote())) {
      return;
    }

    setActiveMoveNotePath(null);
    setEditingNotePath(null);
    setNoteNameDraft("");
    setIsBusy(true);
    const result = await window.inknest.notes.rename({
      path: note.path,
      title
    });

    if (result.ok) {
      remapNoteTabs(note.path, result.data.path);
      await remapNotePreferences(note.path, result.data.path);
      await refreshWorkspace();
      if (shouldReopen) {
        await openNote(result.data.path);
      }
      setStatusMessage("Note renamed");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  function startRenamingNote(note: NoteSummary | SearchResult) {
    setActiveMoveNotePath(null);
    setActiveMoveFolderPath(null);
    setEditingFolderPath(null);
    setFolderNameDraft("");
    setEditingNotePath(note.path);
    setNoteNameDraft(noteNameFromPath(note.path));
  }

  async function duplicateNote(note: NoteSummary) {
    if (note.path === selectedNotePath && !(await flushCurrentNote())) {
      return;
    }

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

  async function deleteNote(note: NoteSummary) {
    setActiveMoveNotePath(null);

    if (!window.confirm(`Move "${noteNameFromPath(note.path)}" to trash?`)) {
      return;
    }

    if (note.path === selectedNotePath && !(await flushCurrentNote())) {
      return;
    }

    setIsBusy(true);
    const result = await window.inknest.notes.delete({
      path: note.path
    });

    if (result.ok) {
      await removeNoteTabs([note.path]);
      await refreshWorkspace();
      setIsTrashExpanded(true);
      setStatusMessage("Note moved to trash");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function restoreNote(note: DeletedNoteSummary) {
    if (!window.confirm(`Restore "${noteNameFromPath(note.originalPath)}"?`)) {
      return;
    }

    setIsBusy(true);
    const result = await window.inknest.notes.restore({ trashPath: note.trashPath });

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

  function getSidebarWidthMax() {
    if (typeof window !== "undefined" && window.innerWidth <= 1100) {
      return Math.max(
        sidebarMinWidth,
        Math.min(sidebarMaxWidth, Math.floor(window.innerWidth * 0.4))
      );
    }

    return sidebarMaxWidth;
  }

  function clampSidebarWidth(width: number) {
    return Math.min(getSidebarWidthMax(), Math.max(sidebarMinWidth, width));
  }

  function finishSidebarResize(event?: ReactPointerEvent<HTMLDivElement>) {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    sidebarResizeStartRef.current = null;
    setIsSidebarResizing(false);
  }

  function handleSidebarPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!settings.sidebarVisible) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sidebarResizeStartRef.current = {
      clientX: event.clientX,
      width: sidebarWidth
    };
    setIsSidebarResizing(true);
  }

  function handleSidebarPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = sidebarResizeStartRef.current;

    if (!start) {
      return;
    }

    setSidebarWidth(clampSidebarWidth(start.width + event.clientX - start.clientX));
  }

  function handleSidebarKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!settings.sidebarVisible) {
      return;
    }

    const step = event.shiftKey ? 32 : 16;
    let nextWidth: number | null = null;

    if (event.key === "ArrowLeft") {
      nextWidth = sidebarWidth - step;
    } else if (event.key === "ArrowRight") {
      nextWidth = sidebarWidth + step;
    } else if (event.key === "Home") {
      nextWidth = sidebarMinWidth;
    } else if (event.key === "End") {
      nextWidth = getSidebarWidthMax();
    }

    if (nextWidth !== null) {
      event.preventDefault();
      setSidebarWidth(clampSidebarWidth(nextWidth));
    }
  }

  function renderSidebarTree() {
    const renderNote = (note: NoteSummary | SearchResult) => (
      <NoteRow
        key={note.path}
        note={note}
        selected={note.path === selectedNotePath}
        isFavorite={isFavoriteNote(note.path)}
        isFavoriteSaving={isFavoriteSaving}
        onToggleFavorite={() => void toggleFavoriteNote(note.path)}
        isRenaming={note.path === editingNotePath}
        noteNameDraft={noteNameDraft}
        isMoveMenuOpen={note.path === activeMoveNotePath}
        isBusy={isBusy}
        onOpen={() => {
          if ("snippet" in note) {
            openSearchResult(note);
          } else {
            void openNote(note.path);
          }
        }}
        onRename={() => startRenamingNote(note)}
        onRenameDraftChange={setNoteNameDraft}
        onSubmitRename={() => void renameNote(note, noteNameDraft)}
        onCancelRename={() => {
          setEditingNotePath(null);
          setNoteNameDraft("");
        }}
        onDuplicate={() => void duplicateNote(note)}
        onToggleMove={() =>
          setActiveMoveNotePath((currentPath) =>
            currentPath === note.path ? null : note.path
          )
        }
        onDelete={() => void deleteNote(note)}
      />
    );
    return (
      <div className="sidebar-tree">
        <div className="space-y-1" aria-label="Folder tree">
          <FolderTree
            nodes={folderTree}
            selectedFolderPath={selectedFolderPath}
            expandedFolderPaths={visibleExpandedFolderPaths}
            activeMoveFolderPath={activeMoveFolderPath}
            editingFolderPath={editingFolderPath}
            folderNameDraft={folderNameDraft}
            hasWorkspace={hasWorkspace}
            isBusy={isBusy}
            onSelect={(folderPath) => {
              setActiveMoveNotePath(null);
              setSelectedFolderPath(folderPath);
              if (hasActiveSearch) {
                setSearchQuery("");
                setSelectedTag("");
                setExpandedFolderPaths((paths) => new Set([...paths, folderPath, ...getAncestorFolderPaths(folderPath)]));
              }
            }}
            onToggle={toggleFolder}
            onStartRename={startRenamingFolder}
            onRenameDraftChange={setFolderNameDraft}
            onSubmitRename={(folder) => void renameFolder(folder, folderNameDraft)}
            onCancelRename={() => {
              setEditingFolderPath(null);
              setFolderNameDraft("");
            }}
            onToggleMove={(folderPath) =>
              setActiveMoveFolderPath((currentPath) =>
                currentPath === folderPath ? null : folderPath
              )
            }
            onNewNote={(folderPath) => void createNote(folderPath)}
            onNewFolder={(parentPath) => void createFolder(parentPath)}
            onDelete={(folder) => void deleteFolder(folder)}
            renderNote={renderNote}
          />
          {hasActiveSearch ? <div className="space-y-1 sidebar-name-results">{displayedNotes.map(renderNote)}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <main
      className="app-shell grid h-screen min-w-0 overflow-hidden grid-rows-[32px_minmax(0,1fr)_28px] bg-ink-50 text-ink-900"
      data-build-phase={phase}
      style={{
        "--app-font-size": `${settings.fontSize}px`,
        "--app-font-family": fontFamilyCssValue(settings.fontFamily)
      } as CSSProperties}
    >
      <header className="app-window-bar" aria-label="Application window controls">
        <div className="app-window-bar-drag-region">
          <Leaf size={19} aria-hidden="true" /><h1 className="app-window-bar-title">InkNest</h1>
        </div>
        <div className="app-window-controls">
          <button
            type="button"
            className="app-window-control"
            aria-label="Minimize window"
            title="Minimize window"
            onClick={() => void minimizeWindow()}
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            className="app-window-control"
            aria-label={isWindowMaximized ? "Restore window" : "Maximize window"}
            title={isWindowMaximized ? "Restore window" : "Maximize window"}
            onClick={() => void toggleMaximizeWindow()}
          >
            {isWindowMaximized ? <Copy size={13} /> : <Square size={13} />}
          </button>
          <button
            type="button"
            className="app-window-control app-window-control-close"
            aria-label="Close window"
            title="Close window"
            onClick={() => void closeWindow()}
          >
            <X size={15} />
          </button>
        </div>
      </header>

      <section
        data-layout="app-layout-columns"
        data-workspace-sidebar={settings.sidebarVisible ? "visible" : "hidden"}
        data-sidebar-resizing={isSidebarResizing ? "true" : "false"}
        data-example-workspace={Boolean(workspace.initialNotePaths)}
        className="app-layout-columns grid min-h-0 grid-cols-[232px_minmax(0,1fr)]"
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
      >
        <aside
          className="workspace-sidebar"
          aria-hidden={!settings.sidebarVisible}
        >
          <div className="sidebar-dock">
          <div className="sidebar-unified">
            <section className="sidebar-main-view" aria-label="Workspace files">
                <div className="sidebar-workspace-controls">
                  <button
                    type="button"
                    className="workspace-button"
                    title={workspace.path ?? "Choose a local Markdown folder"}
                    onClick={() => void chooseWorkspace()}
                    disabled={isBusy}
                  >
                    <span className="workspace-button-icon">
                      <CircleUserRound size={15} />
                    </span>
                    <span className="workspace-button-copy">
                      <span className="workspace-button-name">
                        {isBusy ? "Working" : hasWorkspace ? `${workspaceName} workspace` : workspaceName}
                      </span>
                      <span className="workspace-button-path">
                        {hasWorkspace ? workspace.path : "Local Markdown folder"}
                      </span>
                    </span>
                    <ChevronDown className="workspace-button-chevron" size={15} />
                  </button>

                  <label className="search-box">
                    <Search size={16} />
                    <input
                      type="search"
                      placeholder="Search files and folders"
                      aria-label="Search notes"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        aria-label="Clear search"
                        className="search-clear-button"
                        onClick={() => setSearchQuery("")}
                      >
                        <X size={13} />
                      </button>
                    ) : <span className="search-shortcut" aria-hidden="true">Ctrl+K</span>}
                  </label>

                  {tagSummaries.length > 0 ? (
                    <div className="tag-filter-panel" aria-label="Filter notes by tag">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase text-neutral-500">Tags</p>
                        {selectedTag ? (
                          <button
                            type="button"
                            className="tag-filter-clear"
                            onClick={() => setSelectedTag("")}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      <div className="tag-filter-list">
                        {tagSummaries.map((tagSummary) => (
                          <button
                            key={tagSummary.tag}
                            type="button"
                            className={`tag-filter-chip ${
                              selectedTag === tagSummary.tag ? "tag-filter-chip-active" : ""
                            }`}
                            aria-pressed={selectedTag === tagSummary.tag}
                            onClick={() =>
                              setSelectedTag((currentTag) =>
                                currentTag === tagSummary.tag ? "" : tagSummary.tag
                              )
                            }
                          >
                            <span>#{tagSummary.tag}</span>
                            <span className="tag-filter-count">{tagSummary.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="sidebar-content">
                  {workspaceError ? <p className="sidebar-alert">{workspaceError}</p> : null}
                  {searchError ? <p className="sidebar-alert">{searchError}</p> : null}
                  {!hasWorkspace ? (
                    <div className="sidebar-empty-state">
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

                  {!hasActiveSearch && favoriteNotes.length > 0 ? (
                    <section className="sidebar-favorites" aria-label="Favorite notes">
                      <div className="section-heading sidebar-section-heading">
                        <h2>Favorites</h2><span className="section-count">{favoriteNotes.length}</span>
                        <button type="button" className="section-toggle" aria-label={isFavoritesExpanded ? "Collapse favorites" : "Expand favorites"}
                          aria-expanded={isFavoritesExpanded} onClick={() => setIsFavoritesExpanded((expanded) => !expanded)}>
                          {isFavoritesExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                      </div>
                      {isFavoritesExpanded ? <div className="favorite-note-list">
                        {favoriteNotes.map((note) => (
                          <div className="favorite-note-row" key={note.path} data-active={note.path === selectedNotePath}>
                            <button type="button" className="favorite-note-open" aria-label={`Open favorite ${noteNameFromPath(note.path)}`}
                              title={note.path} disabled={isBusy} onClick={() => void openNote(note.path)}>
                              <Star size={14} fill="currentColor" aria-hidden="true" /><span className="truncate">{noteNameFromPath(note.path)}</span>
                            </button>
                            <button type="button" className="favorite-note-remove" aria-label={`Remove ${noteNameFromPath(note.path)} from favorites`}
                              title="Remove from favorites" disabled={isBusy || isFavoriteSaving} onClick={() => void toggleFavoriteNote(note.path)}><X size={12} /></button>
                          </div>
                        ))}
                      </div> : null}
                    </section>
                  ) : null}
                  <div className="section-heading sidebar-section-heading">
                    <h2>{hasActiveSearch ? "Search results" : "Folders"}</h2>
                    {hasActiveSearch ? (
                      <span className="section-count">{displayedNotes.length + matchingFolders.length}</span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={isFoldersExpanded ? "Collapse folders" : "Expand folders"}
                      aria-expanded={isFoldersExpanded}
                      className="section-toggle"
                      onClick={() => setIsFoldersExpanded((isExpanded) => !isExpanded)}
                    >
                      {isFoldersExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                  </div>
                  {isFoldersExpanded ? renderSidebarTree() : null}

                  {hasWorkspace && hasActiveSearch && displayedNotes.length === 0 && matchingFolders.length === 0 ? (
                    <div className="sidebar-empty-state">
                      <EmptyState
                        icon={<Search size={18} />}
                        title="No matching files or folders"
                        description="Try a different word or clear the active tag."
                      />
                    </div>
                  ) : null}
                </div>
            </section>
          </div>

          <div className="sidebar-bottom">
            {workspace.recentWorkspaces.length > 0 ? (
              <div className="sidebar-bottom-section sidebar-action-section shrink-0">
                <div className="sidebar-section-header sidebar-section-header-recent">
                  <details className="collapsible-section" open>
                    <summary
                      className="collapsible-section-trigger"
                      onClick={() => setActiveSidebarMenu(null)}
                    >
                      <BookOpenText size={15} />
                      <span className="collapsible-section-label">Recent workspaces</span>
                      <span className="section-count">{workspace.recentWorkspaces.length}</span>
                      <ChevronRight className="collapsible-chevron" size={14} />
                    </summary>
                    <div className="recent-workspace-list">
                      {workspace.recentWorkspaces.map((recentPath) => (
                        <button
                          key={recentPath}
                          type="button"
                          className="recent-workspace-row"
                          title={recentPath}
                          onClick={() => void reopenWorkspace(recentPath)}
                        >
                          <span className="recent-workspace-dot" data-current={recentPath === workspace.path} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {recentPath.split(/[\\/]/).pop() ?? recentPath}
                            </span>
                            <span className="block truncate text-[11px] text-neutral-500">
                              {recentPath}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </details>
                  <ContextMenu
                    label="Recent workspaces"
                    className="sidebar-section-action-menu"
                    open={activeSidebarMenu === "recent"}
                    onToggle={() =>
                      setActiveSidebarMenu((currentMenu) =>
                        currentMenu === "recent" ? null : "recent"
                      )
                    }
                    onContextMenu={() => setActiveSidebarMenu("recent")}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="context-menu-item"
                      onClick={() => {
                        setActiveSidebarMenu(null);
                        void clearRecentWorkspaces();
                      }}
                      disabled={isBusy}
                    >
                      <X size={14} />
                      <span>Clear recent workspaces</span>
                    </button>
                  </ContextMenu>
                </div>
              </div>
            ) : null}

            <div className="trash-section workspace-trash-section sidebar-bottom-section sidebar-action-section shrink-0">
              <div className="sidebar-section-header sidebar-section-header-trash">
                <button
                  type="button"
                  className="collapsible-section-trigger w-full"
                  aria-label="Trash"
                  aria-expanded={isTrashExpanded}
                  aria-controls="trash-notes"
                  onClick={() => {
                    setActiveSidebarMenu(null);
                    setIsTrashExpanded((isExpanded) => !isExpanded);
                  }}
                >
                  <Trash2 size={15} />
                  <span className="collapsible-section-label">Trash</span>
                  {trashNotes.length > 0 ? (
                    <span className="section-count">{trashNotes.length}</span>
                  ) : (
                    <span className="section-empty-label">Empty</span>
                  )}
                  {isTrashExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <ContextMenu
                  label="Trash"
                  className="sidebar-section-action-menu"
                  open={activeSidebarMenu === "trash"}
                  onToggle={() =>
                    setActiveSidebarMenu((currentMenu) =>
                      currentMenu === "trash" ? null : "trash"
                    )
                  }
                  onContextMenu={() => setActiveSidebarMenu("trash")}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="context-menu-item danger"
                    onClick={requestEmptyTrash}
                    disabled={isBusy || !hasWorkspace}
                  >
                    <Trash2 size={14} />
                    <span>Empty Trash</span>
                  </button>
                </ContextMenu>
              </div>
              {isTrashExpanded ? (
                <div id="trash-notes" className="trash-note-list">
                  {trashNotes.length > 0 ? (
                    trashNotes.map((note) => (
                      <div key={note.trashPath} className="trash-row">
                        <p
                          className="min-w-0 truncate text-sm font-medium"
                          title={noteNameFromPath(note.originalPath)}
                        >
                          {noteNameFromPath(note.originalPath)}
                        </p>
                        <button
                          type="button"
                          aria-label="Restore note"
                          title="Restore note"
                          className="icon-button"
                          onClick={() => void restoreNote(note)}
                          disabled={isBusy}
                        >
                          <RotateCcw size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label="Permanently delete note"
                          title="Permanently delete note"
                          className="icon-button danger"
                          onClick={() => void permanentlyDeleteNote(note.trashPath)}
                          disabled={isBusy}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="trash-empty-message">Trash is empty.</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="sidebar-utility-row">
              <button type="button" className="sidebar-settings-button" aria-label="Settings" aria-pressed={isSettingsOpen}
                onClick={() => setIsSettingsOpen((open) => !open)}><Settings size={15} /><span>Settings</span></button>
              <button type="button" className="icon-button sidebar-toggle" aria-label="Toggle sidebar" aria-pressed={settings.sidebarVisible}
                title="Collapse sidebar" onClick={() => void updateAppSettings({ sidebarVisible: false })}><PanelLeft size={15} /></button>
              {isSettingsOpen && settings.sidebarVisible ? createPortal(<SettingsPopover settings={settings}
                onUpdate={(patch) => void updateAppSettings(patch)} onClose={() => setIsSettingsOpen(false)} className="reference-settings-popover" />, document.body) : null}
            </div>
          </div>
          </div>
        </aside>

        <div
          className="sidebar-resize-handle"
          role="separator"
          tabIndex={settings.sidebarVisible ? 0 : -1}
          aria-label="Resize workspace sidebar"
          aria-orientation="vertical"
          aria-valuemin={sidebarMinWidth}
          aria-valuemax={getSidebarWidthMax()}
          aria-valuenow={Math.round(clampSidebarWidth(sidebarWidth))}
          onKeyDown={handleSidebarKeyDown}
          onPointerDown={handleSidebarPointerDown}
          onPointerMove={handleSidebarPointerMove}
          onPointerUp={finishSidebarResize}
          onPointerCancel={finishSidebarResize}
          onLostPointerCapture={() => finishSidebarResize()}
        />

        <section className="editor-pane flex min-h-0 flex-col bg-white" data-note-open={Boolean(selectedNoteContent)}>
          <div className="note-tab-bar">
            <div className="note-tab-list" role="tablist" aria-label="Open notes">
              {openNotePaths.map((notePath) => {
                const isActive = notePath === selectedNotePath;
                const name = noteNameFromPath(notePath);
                return (
                  <div key={notePath} className="note-tab" data-active={isActive} role="presentation">
                    {tabRename?.path === notePath ? (
                      <form className="note-tab-rename" onSubmit={(event) => {
                        event.preventDefault();
                        const note = notes.find((note) => note.path === notePath);
                        if (!note || !tabRename.name.trim()) {
                          setWorkspaceError("Note title cannot be empty.");
                          return;
                        }
                        const name = tabRename.name;
                        setTabRename(null);
                        void renameNote(note, name);
                      }}>
                        <input aria-label="Tab name" value={tabRename.name} autoFocus disabled={isBusy}
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) => setTabRename({ path: notePath, name: event.target.value })}
                          onBlur={() => setTabRename(null)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault(); setTabRename(null);
                              window.requestAnimationFrame(() => focusNoteTab(notePath));
                            }
                          }} />
                      </form>
                    ) : (
                    <button
                      type="button"
                      role="tab"
                      aria-label={name}
                      id={isActive ? "active-note-tab" : undefined}
                      aria-selected={isActive}
                      aria-controls={isActive ? "note-tab-panel" : undefined}
                      tabIndex={isActive || !selectedNotePath ? 0 : -1}
                      className="note-tab-select"
                      title={notePath}
                      aria-disabled={isBusy}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        showTabMenu(notePath, event.clientX, event.clientY);
                      }}
                      onClick={() => {
                        if (!isBusy) {
                          void openNote(notePath);
                        }
                      }}
                      onKeyDown={async (event) => {
                        if (isBusy) {
                          return;
                        }
                        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                          event.preventDefault();
                          const rect = event.currentTarget.getBoundingClientRect();
                          showTabMenu(notePath, rect.left, rect.bottom);
                          return;
                        }
                        const index = openNotePaths.indexOf(notePath);
                        const nextIndex = event.key === "ArrowRight" ? (index + 1) % openNotePaths.length
                          : event.key === "ArrowLeft" ? (index - 1 + openNotePaths.length) % openNotePaths.length
                            : event.key === "Home" ? 0
                              : event.key === "End" ? openNotePaths.length - 1 : null;
                        if (nextIndex !== null) {
                          event.preventDefault();
                          const tabs = event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                          const nextTab = tabs?.[nextIndex];
                          await openNote(openNotePaths[nextIndex]);
                          nextTab?.focus();
                        }
                      }}
                    >
                      <FileText size={14} aria-hidden="true" />
                      <span className="truncate">{name}</span>
                      {isActive && isDirty ? <span className="note-tab-dirty" aria-label="Unsaved changes" /> : null}
                    </button>
                    )}
                    <button
                      type="button"
                      className="note-tab-close"
                      aria-label={`Close ${name} tab`}
                      title={`Close ${name} tab`}
                      disabled={isBusy}
                      onClick={() => void closeNoteTab(notePath)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="icon-button note-tab-add"
              aria-label="Create new note"
              title="Create new unnamed note"
              disabled={!hasWorkspace || isBusy}
              onClick={() => void createNote()}
            >
              <Plus size={18} />
            </button>
          </div>
          {tabMenu ? createPortal(
            <div ref={tabMenuRef} className="toolbar-command-menu note-tab-context-menu" role="menu" aria-label="Tab options"
              style={{ left: tabMenu.left, top: tabMenu.top }}
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault(); event.stopPropagation(); setTabMenu(null); focusNoteTab(tabMenu.path);
                  return;
                }
                if (event.key === "Tab") { setTabMenu(null); return; }
                const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
                const index = items.indexOf(document.activeElement as HTMLButtonElement);
                const next = event.key === "ArrowDown" ? (index + 1) % items.length
                  : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length
                    : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : null;
                if (next !== null) { event.preventDefault(); items[next]?.focus(); }
              }}>
              <button type="button" className="toolbar-button" role="menuitem" disabled={isBusy || !notes.some((note) => note.path === tabMenu.path)}
                onClick={() => { setTabRename({ path: tabMenu.path, name: noteNameFromPath(tabMenu.path) }); setTabMenu(null); }}><Edit3 size={15} />Rename</button>
              <button type="button" className="toolbar-button" role="menuitem" disabled={isBusy}
                onClick={() => void closeNoteTabs([tabMenu.path])}><X size={15} />Close Tab</button>
              <button type="button" className="toolbar-button" role="menuitem" disabled={isBusy || openNotePaths.length < 2}
                onClick={() => void closeNoteTabs(openNotePaths.filter((path) => path !== tabMenu.path))}><X size={15} />Close Other Tabs</button>
              <button type="button" className="toolbar-button" role="menuitem" disabled={isBusy}
                onClick={() => void closeNoteTabs(openNotePaths)}><X size={15} />Close All Tabs</button>
              <button type="button" className="toolbar-button" role="menuitem" disabled={isBusy || openNotePaths.indexOf(tabMenu.path) === openNotePaths.length - 1}
                onClick={() => void closeNoteTabs(openNotePaths.slice(openNotePaths.indexOf(tabMenu.path) + 1))}><X size={15} />Close Tabs to the Right</button>
            </div>, document.body
          ) : null}
          {/* The centered empty state replaces the old "Untitled note" header. */}
          <div className="app-editor-header flex h-14 items-center justify-between border-b border-ink-100 px-5">
            <div className="app-editor-header-copy flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1">
                {selectedNote ? (
                  <h2
                    className="truncate text-sm font-semibold"
                    title={selectedNoteName ?? undefined}
                  >
                    {selectedNoteName}
                  </h2>
                ) : (
                  <h2 className="truncate text-sm font-semibold">Editor</h2>
                )}
                {/* The header intentionally omits the former "No file selected" path line. */}
              </div>
            </div>
            {selectedNoteContent ? (
              <div className="app-editor-header-actions flex items-center gap-2">
                <button type="button" className="icon-button" aria-label={isFavoriteNote(selectedNoteContent.path) ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={isFavoriteNote(selectedNoteContent.path)} disabled={isBusy || isFavoriteSaving}
                  title={isFavoriteNote(selectedNoteContent.path) ? "Remove from favorites" : "Add to favorites"}
                  onClick={() => void toggleFavoriteNote(selectedNoteContent.path)}>
                  <Star size={17} fill={isFavoriteNote(selectedNoteContent.path) ? "currentColor" : "none"} />
                </button>
                <button type="button" className="icon-button" aria-label={isNoteLocked ? "Unlock note" : "Lock note"}
                  aria-pressed={isNoteLocked} disabled={isBusy}
                  title={isNoteLocked ? "View only — unlock to edit" : "Lock note to make it view only"}
                  onClick={() => void toggleNoteLock()}>
                  {isNoteLocked ? <LockKeyhole size={17} /> : <UnlockKeyhole size={17} />}
                </button>
                <button type="button" className="icon-button" aria-label="Find in note" title="Find in note (Ctrl+F)"
                  aria-keyshortcuts="Control+F" onClick={() => editorHandleRef.current?.openSearch("replace")}><Search size={17} /></button>
                <button type="button" className="icon-button" aria-label="Find and replace" title="Find and replace (Ctrl+H)"
                  aria-keyshortcuts="Control+H" onClick={() => editorHandleRef.current?.openSearch("replace")}><Replace size={17} /></button>
                <button type="button" aria-label="Full width" aria-pressed={settings.fullWidth}
                  title={settings.fullWidth ? "Use readable width" : "Use full width"} className="icon-button reading-width-control"
                  onClick={() => void updateAppSettings({ fullWidth: !settings.fullWidth })}><span>Reading width</span><span className="reading-width-switch" data-enabled={!settings.fullWidth} /></button>
                <button type="button" className="icon-button" aria-label="Show heading minimap" aria-pressed={settings.showOutline}
                  title="Toggle heading minimap" onClick={() => void updateAppSettings({ showOutline: !settings.showOutline })}><ListTree size={17} /></button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void saveCurrentNote()}
                  disabled={!isDirty || isBusy || isSaving}
                  aria-keyshortcuts="Control+S"
                >
                  <Save size={15} />
                  <span className="sr-only">Save</span>
                </button>
                <details className="action-menu editor-action-menu">
                  <summary className="secondary-button" aria-label="Export note">
                    <MoreHorizontal size={15} />
                    <span className="sr-only">Export</span>
                    <ChevronDown size={14} />
                  </summary>
                  <div className="action-menu-popover" role="menu" aria-label="Export note">
                    {([
                      ["markdown", "Markdown", "Export MD"],
                      ["html", "HTML", "Export HTML"],
                      ["pdf", "PDF", "Export PDF"]
                    ] as Array<[ExportFormat, string, string]>).map(([format, label, ariaLabel]) => (
                      <button
                        key={format}
                        type="button"
                        role="menuitem"
                        className="action-menu-item"
                        aria-label={ariaLabel}
                        onClick={(event) => {
                          event.currentTarget.closest("details")?.removeAttribute("open");
                          void exportCurrentNote(format);
                        }}
                        disabled={isBusy}
                      >
                        <FileOutput size={15} />
                        <span>
                          <strong>{label}</strong>
                          <small>{format === "markdown" ? "Original note format" : `Export as ${label}`}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            ) : null}
          </div>

          {selectedNoteContent ? (
            <div className="toolbar-shell">
              <div className="markdown-toolbar" aria-label="Markdown toolbar">
                <button type="button" className="toolbar-button toolbar-menu-trigger" disabled={isEditorDisabled} aria-label="Heading level" title="Heading level"
                  aria-expanded={toolbarMenu?.kind === "headings"} onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setToolbarMenu(toolbarMenu?.kind === "headings" ? null : { kind: "headings", left: rect.left, top: rect.bottom + 5 }); }}>H<ChevronDown size={11} /></button>
                {getToolbarGroups(toolbarPlaceholders.filter((command) => primaryToolbarOrder.includes(command.id)).sort((a, b) => primaryToolbarOrder.indexOf(a.id) - primaryToolbarOrder.indexOf(b.id))).map((group) => (
                  <div key={group.name} className="toolbar-group" aria-label={`${group.name} tools`}>
                    {group.commands.map((command) => <button key={command.id} type="button"
                      className={`toolbar-button ${activeToolbarCommands.has(command.id) ? "toolbar-button-active" : ""}`}
                      aria-label={command.label} title={command.label} onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => runToolbarCommand(command, event)} disabled={isEditorDisabled}>
                      {command.id === "callout-note" ? <Lightbulb size={16} /> : command.icon}
                    </button>)}
                  </div>
                ))}
                <button type="button" className="toolbar-button toolbar-menu-trigger" disabled={isEditorDisabled} aria-label="More formatting" title="More formatting"
                  aria-expanded={toolbarMenu?.kind === "more"} onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setToolbarMenu(toolbarMenu?.kind === "more" ? null : { kind: "more", left: Math.min(rect.left, window.innerWidth - 230), top: rect.bottom + 5 }); }}><MoreHorizontal size={16} /></button>
              </div>
              {toolbarMenu ? createPortal(<div className="toolbar-command-menu" role="group" aria-label={toolbarMenu.kind === "headings" ? "Heading levels" : "Additional formatting"}
                style={{ left: toolbarMenu.left, top: toolbarMenu.top }}>
                {toolbarPlaceholders.filter((command) => toolbarMenu.kind === "headings" ? command.group === "headings" :
                  ["inline-code", "clear-format", "inline-math", "divider", "callout-warning", "callout-info", "callout-success", "table-add-row", "table-delete-row", "table-add-column", "table-delete-column", "table-delete"].includes(command.id)).map((command) =>
                  <button key={command.id} type="button" aria-label={command.label} disabled={isEditorDisabled}
                    className={`toolbar-button ${command.id.startsWith("table-delete") ? "danger" : ""} ${activeToolbarCommands.has(command.id) ? "toolbar-button-active" : ""}`}
                    onMouseDown={(event) => event.preventDefault()} onClick={(event) => { runToolbarCommand(command, event); setToolbarMenu(null); }}>
                    {command.icon}<span>{command.label}</span>
                  </button>)}
              </div>, document.body) : null}
            </div>
          ) : null}

          {externalNoteChange ? (
            <div className="external-change-banner" role="alert">
              <div className="min-w-0">
                <p className="font-semibold">
                  {externalNoteChange.kind === "deleted"
                    ? "This note was deleted outside InkNest."
                    : "This note changed outside InkNest."}
                </p>
                <p className="mt-1 text-xs text-amber-900/80">
                  {externalNoteChange.kind === "deleted"
                    ? "Your local content is still open. Keep it, or save it as a new note."
                    : "Your local edits are preserved. Choose which version to keep."
                  }
                </p>
              </div>
              <div className="external-change-actions">
                {externalNoteChange.kind === "changed" ? (
                  <button
                    type="button"
                    className="external-change-button"
                    onClick={() => void reloadNoteFromDisk(externalNoteChange.path)}
                    disabled={isBusy}
                  >
                    Reload from disk
                  </button>
                ) : null}
                <button
                  type="button"
                  className="external-change-button"
                  onClick={keepLocalNoteVersion}
                  disabled={isBusy}
                >
                  Keep my version
                </button>
                <button
                  type="button"
                  className="external-change-button external-change-button-primary"
                  onClick={() => void saveLocalVersionAsNewNote()}
                  disabled={isBusy}
                >
                  Save as new note
                </button>
              </div>
            </div>
          ) : null}

          {linkDialog ? (
            <form
              className="link-popover"
              style={{
                "--link-popover-left": `${linkDialog.position.left}px`,
                "--link-popover-top": `${linkDialog.position.top}px`
              } as CSSProperties}
              onSubmit={submitLinkDialog}
            >
              <label className="link-popover-field">
                <span>Text</span>
                <input
                  type="text"
                  value={linkDialog.text}
                  onChange={(event) =>
                    setLinkDialog({
                      ...linkDialog,
                      text: event.target.value,
                      error: undefined
                    })
                  }
                  autoFocus
                />
              </label>
              <label className="link-popover-field">
                <span>Link</span>
                <input
                  type="text"
                  inputMode="url"
                  value={linkDialog.url}
                  onChange={(event) =>
                    setLinkDialog({
                      ...linkDialog,
                      url: event.target.value,
                      error: undefined
                    })
                  }
                  placeholder="https://example.com"
                />
              </label>
              {linkDialog.error ? (
                <p className="link-popover-error">{linkDialog.error}</p>
              ) : null}
              <div className="link-popover-actions">
                {linkDialog.isEditing ? (
                  <button
                    type="button"
                    className="link-popover-remove"
                    onClick={removeLinkFromDialog}
                  >
                    Remove
                  </button>
                ) : null}
                <button
                  type="button"
                  className="link-popover-secondary"
                  onClick={() => setLinkDialog(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="link-popover-primary">
                  Apply
                </button>
              </div>
            </form>
          ) : null}

          {/* Former empty-state copy: "Open or create a Markdown note to inspect its saved content here." */}
          {selectedNoteContent ? (
            <article className="editor-scroll" role="tabpanel" id="note-tab-panel" aria-labelledby="active-note-tab">
              <MarkdownEditor
                ref={editorHandleRef}
                key={selectedNoteContent.path}
                markdown={editorMarkdown}
                workspacePath={workspace.path}
                notePath={selectedNoteContent.path}
                disabled={isEditorDisabled}
                readOnly={isNoteLocked}
                lineWrap={settings.lineWrap}
                fullWidth={settings.fullWidth}
                showOutline={settings.showOutline}
                outlineWidth={settings.outlineWidth}
                onOutlineWidthChange={(width) => void updateAppSettings({ outlineWidth: width })}
                onOutlineClose={() => void updateAppSettings({ showOutline: false })}
                onChange={(nextMarkdown) => {
                  editorMarkdownRef.current = nextMarkdown;
                  setEditorMarkdown(nextMarkdown);
                  if (saveStateRef.current !== "saving") {
                    updateSaveState("unsaved");
                  }
                  updateSaveError(null);
                  setStatusMessage("Editing");
                }}
                onSelectionFormatChange={setActiveToolbarCommands}
                onCommandRequest={(command) => {
                  const tool = toolbarPlaceholders.find((tool) => tool.id === command);
                  if (tool) void runToolbarCommand(tool);
                }}
                onLinkDialogRequest={openLinkDialog}
                onImagePaste={(payload) => void insertPastedImage(payload)}
                onLocalLinkRequest={(url) => void openLocalLink(url)}
              />
            </article>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-sm text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-ink-100 text-ink-700">
                  <SquarePen size={22} />
                </div>
                <h3 className="text-lg font-semibold">No note selected</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Select a note from the list or create a new one to start writing.
                </p>
              </div>
            </div>
          )}
        </section>
      </section>

      {!settings.sidebarVisible ? (
        <div className="sidebar-collapsed-controls fixed bottom-10 left-3 z-50 flex items-center gap-1 rounded-lg border border-ink-100 bg-white p-1 shadow-lg">
          <button
            type="button"
            aria-label="Toggle sidebar"
            aria-pressed={settings.sidebarVisible}
            title="Show sidebar"
            className="icon-button"
            onClick={() => void updateAppSettings({ sidebarVisible: true })}
          >
            <PanelLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Settings"
            aria-pressed={isSettingsOpen}
            title="Settings"
            className="icon-button"
            onClick={() => setIsSettingsOpen((isOpen) => !isOpen)}
          >
            <Settings size={18} />
          </button>
          {isSettingsOpen && !settings.sidebarVisible ? (
            <SettingsPopover
              settings={settings}
              onUpdate={(patch) => void updateAppSettings(patch)}
              onClose={() => setIsSettingsOpen(false)}
              className="sidebar-settings-popover"
            />
          ) : null}
        </div>
      ) : null}

      <footer className="app-status-bar grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-t border-ink-100 bg-white px-4 text-xs text-neutral-500">
        <span className="status-bar-path truncate" title={currentFilePath}>
          {currentFilePath}
        </span>
        {currentMode ? <span className="status-bar-mode">{currentMode}</span> : null}
        <span className="status-bar-details col-start-3 justify-self-end truncate">
          {/* Previous combined status/count copy: {saveStatusLabel} - {wordCount} words - {characterCount} characters */}
          {settings.showWordCount ? (
            <>{wordCount} words · {characterCount} characters</>
          ) : (
            <>{characterCount} characters</>
          )}
          {saveError ? `: ${saveError}` : ""}
        </span>
      </footer>

      {isEmptyTrashDialogOpen ? (
        <div
          className="confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setIsEmptyTrashDialogOpen(false);
            }
          }}
        >
          <div
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="empty-trash-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="confirmation-modal-header">
              <span className="confirmation-modal-icon" aria-hidden="true">
                <Trash2 size={18} />
              </span>
              <div className="min-w-0">
                <h2 id="empty-trash-dialog-title">Empty Trash?</h2>
                <p>
                  {trashNotes.length > 0
                    ? `This permanently deletes ${trashNotes.length} ${trashNotes.length === 1 ? "note" : "notes"}. This cannot be undone.`
                    : "Trash is already empty."}
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close confirmation"
                title="Close confirmation"
                onClick={() => setIsEmptyTrashDialogOpen(false)}
                disabled={isBusy}
              >
                <X size={16} />
              </button>
            </div>
            <div className="confirmation-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsEmptyTrashDialogOpen(false)}
                disabled={isBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="secondary-button danger"
                onClick={() => void emptyTrash()}
                disabled={isBusy || trashNotes.length === 0}
              >
                <Trash2 size={15} />
                Empty Trash
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isCommandPaletteOpen ? (
        <div
          className="command-palette-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              closeCommandPalette();
            }
          }}
        >
          <div
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="command-palette-search">
              <Command size={18} aria-hidden="true" />
              <input
                ref={commandPaletteInputRef}
                type="search"
                role="combobox"
                aria-label="Command palette search"
                aria-expanded="true"
                aria-controls="command-palette-results"
                placeholder="Search commands..."
                value={commandPaletteQuery}
                onChange={(event) => setCommandPaletteQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveCommandIndex((currentIndex) =>
                      Math.min(currentIndex + 1, Math.max(filteredCommandPaletteCommands.length - 1, 0))
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveCommandIndex((currentIndex) => Math.max(currentIndex - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    const command = filteredCommandPaletteCommands[activeCommandIndex];
                    if (command && !command.disabled) {
                      void runCommandPaletteCommand(command.id);
                    }
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    closeCommandPalette();
                  }
                }}
              />
              <kbd>Esc</kbd>
            </div>
            <div id="command-palette-results" className="command-palette-results">
              {filteredCommandPaletteCommands.length === 0 ? (
                <p className="command-palette-empty">No matching commands.</p>
              ) : (
                filteredCommandPaletteCommands.map((command, index) => (
                  <button
                    key={command.id}
                    id={`command-palette-${command.id}`}
                    type="button"
                    className={`command-palette-item ${
                      index === activeCommandIndex ? "command-palette-item-active" : ""
                    }`}
                    aria-selected={index === activeCommandIndex}
                    disabled={command.disabled}
                    onMouseEnter={() => setActiveCommandIndex(index)}
                    onClick={() => void runCommandPaletteCommand(command.id)}
                  >
                    <span className="command-palette-item-icon" aria-hidden="true">
                      {command.icon}
                    </span>
                    <span className="command-palette-item-copy">
                      <strong>{command.label}</strong>
                      <small>{command.description}</small>
                    </span>
                    {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
                  </button>
                ))
              )}
            </div>
            <div className="command-palette-footer">
              <span>↑↓ Navigate</span>
              <span>Enter Run</span>
              <span>Esc Close</span>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

type SettingsPopoverProps = {
  settings: AppSettings;
  onUpdate: (patch: SaveSettingsPayload) => void;
  onClose: () => void;
  className?: string;
};

function SettingsPopover({ settings, onUpdate, onClose, className = "" }: SettingsPopoverProps) {
  return (
    <div className={`settings-popover ${className}`} role="dialog" aria-label="Settings">
      <div className="settings-popover-header">
        <div>
          <p className="settings-popover-title">Settings</p>
          <p className="settings-popover-description">Customize your writing space.</p>
        </div>
        <button type="button" className="icon-button" aria-label="Close settings" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <label className="settings-field">
        <span>Theme</span>
        <select
          aria-label="Theme"
          value={settings.theme}
          onChange={(event) => onUpdate({ theme: event.target.value as AppSettings["theme"] })}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>

      <fieldset className="settings-accent-field">
        <legend>Accent color</legend>
        <div className="settings-accent-grid">
          {accentColors.map((color) => (
            <label key={color.id} className="settings-accent-choice">
              <input type="radio" name="accent-color" aria-label={color.name} value={color.id}
                checked={settings.accentColor === color.id} onChange={() => onUpdate({ accentColor: color.id })} />
              <span className="settings-accent-swatch" style={{ "--swatch-color": `rgb(${color.light.join(" ")})` } as CSSProperties}>
                {settings.accentColor === color.id ? <Check size={14} aria-hidden="true" /> : null}
              </span>
              <span>{color.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="settings-field">
        <span>Font size</span>
        <select
          aria-label="Font size"
          value={settings.fontSize}
          onChange={(event) => onUpdate({ fontSize: Number(event.target.value) })}
        >
          {[12, 14, 16, 18, 20, 22, 24].map((fontSize) => (
            <option key={fontSize} value={fontSize}>
              {fontSize}px
            </option>
          ))}
        </select>
      </label>

      <label className="settings-field">
        <span>Font family</span>
        <select
          aria-label="Font family"
          value={settings.fontFamily}
          onChange={(event) =>
            onUpdate({ fontFamily: event.target.value as AppSettings["fontFamily"] })
          }
        >
          <option value="system">System sans</option>
          <option value="serif">Serif</option>
          <option value="mono">Monospace</option>
        </select>
      </label>

      <label className="settings-field">
        <span>Auto-save delay</span>
        <select
          aria-label="Auto-save delay"
          value={settings.autoSaveDelayMs}
          onChange={(event) => onUpdate({ autoSaveDelayMs: Number(event.target.value) })}
        >
          {[500, 750, 1000, 1500, 2000, 3000, 5000].map((delay) => (
            <option key={delay} value={delay}>
              {delay} ms
            </option>
          ))}
        </select>
      </label>

      <label className="settings-checkbox">
        <input
          type="checkbox"
          checked={settings.lineWrap}
          onChange={(event) => onUpdate({ lineWrap: event.target.checked })}
        />
        <span>Wrap editor lines</span>
      </label>
      <label className="settings-checkbox">
        <input type="checkbox" checked={settings.fullWidth} onChange={(event) => onUpdate({ fullWidth: event.target.checked })} />
        <span>Full width notes</span>
      </label>
      <label className="settings-checkbox">
        <input type="checkbox" checked={settings.showOutline} onChange={(event) => onUpdate({ showOutline: event.target.checked })} />
        <span>Show heading minimap</span>
      </label>
      <label className="settings-checkbox">
        <input
          type="checkbox"
          checked={settings.showWordCount}
          onChange={(event) => onUpdate({ showWordCount: event.target.checked })}
        />
        <span>Show word count</span>
      </label>
      <label className="settings-checkbox">
        <input
          type="checkbox"
          checked={settings.sidebarVisible}
          onChange={(event) => onUpdate({ sidebarVisible: event.target.checked })}
        />
        <span>Show sidebar</span>
      </label>

      <div className="settings-default-workspace">
        <span>Default workspace</span>
        <strong title={settings.lastWorkspacePath ?? undefined}>
          {settings.lastWorkspacePath ?? "No workspace selected"}
        </strong>
      </div>
    </div>
  );
}

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

type ContextMenuProps = {
  label: string;
  open: boolean;
  onToggle: () => void;
  onContextMenu?: () => void;
  className?: string;
  children: ReactNode;
};

function ContextMenu({
  label,
  open,
  onToggle,
  onContextMenu,
  className = "",
  children
}: ContextMenuProps) {
  return (
    <div
      className={`context-menu-anchor ${className} ${open ? "context-menu-anchor-open" : ""}`}
      data-context-menu
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.();
      }}
    >
      <button
        type="button"
        className="context-menu-trigger"
        aria-label={`${label} actions`}
        title={`${label} actions`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        <MoreHorizontal size={15} />
      </button>
      {open ? (
        <div
          className="context-menu"
          role="menu"
          aria-label={`${label} options`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type FolderTreeNode = FolderSummary & {
  children: FolderTreeNode[];
  notes: Array<NoteSummary | SearchResult>;
  depth: number;
  noteCount: number;
};

type FolderTreeProps = {
  nodes: FolderTreeNode[];
  selectedFolderPath: string;
  expandedFolderPaths: Set<string>;
  activeMoveFolderPath: string | null;
  editingFolderPath: string | null;
  folderNameDraft: string;
  hasWorkspace: boolean;
  isBusy: boolean;
  onSelect: (folderPath: string) => void;
  onToggle: (folderPath: string) => void;
  onStartRename: (folder: FolderSummary) => void;
  onRenameDraftChange: (name: string) => void;
  onSubmitRename: (folder: FolderSummary) => void;
  onCancelRename: () => void;
  onToggleMove: (folderPath: string) => void;
  onNewNote: (folderPath: string) => void;
  onNewFolder: (parentPath: string) => void;
  onDelete: (folder: FolderSummary) => void;
  renderNote: (note: NoteSummary | SearchResult) => ReactNode;
};

function FolderTree({
  nodes,
  selectedFolderPath,
  expandedFolderPaths,
  activeMoveFolderPath,
  editingFolderPath,
  folderNameDraft,
  hasWorkspace,
  isBusy,
  onSelect,
  onToggle,
  onStartRename,
  onRenameDraftChange,
  onSubmitRename,
  onCancelRename,
  onToggleMove,
  onNewNote,
  onNewFolder,
  onDelete,
  renderNote
}: FolderTreeProps) {
  return (
    <>
      {nodes.map((node) => (
        <FolderTreeRow
          key={node.path}
          node={node}
          selectedFolderPath={selectedFolderPath}
          expandedFolderPaths={expandedFolderPaths}
          activeMoveFolderPath={activeMoveFolderPath}
          editingFolderPath={editingFolderPath}
          folderNameDraft={folderNameDraft}
          hasWorkspace={hasWorkspace}
          isBusy={isBusy}
          onSelect={onSelect}
          onToggle={onToggle}
          onStartRename={onStartRename}
          onRenameDraftChange={onRenameDraftChange}
          onSubmitRename={onSubmitRename}
          onCancelRename={onCancelRename}
          onToggleMove={onToggleMove}
          onNewNote={onNewNote}
          onNewFolder={onNewFolder}
          onDelete={onDelete}
          renderNote={renderNote}
        />
      ))}
    </>
  );
}

function FolderTreeRow({
  node,
  selectedFolderPath,
  expandedFolderPaths,
  activeMoveFolderPath,
  editingFolderPath,
  folderNameDraft,
  hasWorkspace,
  isBusy,
  onSelect,
  onToggle,
  onStartRename,
  onRenameDraftChange,
  onSubmitRename,
  onCancelRename,
  onToggleMove,
  onNewNote,
  onNewFolder,
  onDelete,
  renderNote
}: Omit<FolderTreeProps, "nodes"> & { node: FolderTreeNode }) {
  const isExpanded = expandedFolderPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  const hasExpandableContent = hasChildren || node.notes.length > 0;
  const isRoot = node.path === ".";
  const isRenaming = editingFolderPath === node.path;
  const isMoveMenuOpen = activeMoveFolderPath === node.path;

  return (
    <div>
      <div
        className={`tree-row group ${
          node.path === selectedFolderPath ? "tree-row-active" : ""
        } ${isRoot ? "tree-row-root" : ""}`}
        style={{ "--folder-depth": node.depth } as CSSProperties}
        onContextMenu={(event) => {
          if (isRenaming || !hasWorkspace || isBusy) {
            return;
          }

          event.preventDefault();
          onToggleMove(node.path);
        }}
      >
        <button
          type="button"
          aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          className="tree-toggle-button"
          onClick={() => onToggle(node.path)}
          disabled={!hasWorkspace || !hasExpandableContent}
        >
          {hasExpandableContent ? (
            isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span className="tree-toggle-spacer" />
          )}
        </button>
        {isRenaming ? (
          <form
            className="folder-rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitRename(node);
            }}
          >
            {isExpanded && hasExpandableContent ? (
              <FolderOpen className="shrink-0" size={15} />
            ) : (
              <Folder className="shrink-0" size={15} />
            )}
            <input
              type="text"
              aria-label="Folder name"
              value={folderNameDraft}
              onChange={(event) => onRenameDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelRename();
                }
              }}
              autoFocus
              disabled={isBusy}
            />
          </form>
        ) : (
          <button
            type="button"
            className="tree-open-area"
            onClick={() => {
              onSelect(node.path);
              if (hasExpandableContent) {
                onToggle(node.path);
              }
            }}
            disabled={!hasWorkspace}
          >
            {isExpanded && hasExpandableContent ? (
              <FolderOpen className="shrink-0" size={15} />
            ) : (
              <Folder className="shrink-0" size={15} />
            )}
            <span className="truncate" title={node.name}>
              {node.name}
            </span>
            <span className="tree-count">{node.noteCount}</span>
          </button>
        )}
        {!isRenaming ? <button type="button" className="folder-add-note" aria-label={`Create note in ${node.name}`} title="New note"
          onClick={() => onNewNote(node.path)} disabled={!hasWorkspace || isBusy}><Plus size={14} /></button> : null}
        {!isRenaming ? (
          <ContextMenu
            label="Folder"
            open={isMoveMenuOpen}
            onToggle={() => onToggleMove(node.path)}
            onContextMenu={() => onToggleMove(node.path)}
          >
            <button
              type="button"
              role="menuitem"
              className="context-menu-item"
              onClick={() => {
                onToggleMove(node.path);
                onNewNote(node.path);
              }}
              disabled={!hasWorkspace || isBusy}
            >
              <FilePlus2 size={14} />
              <span>New note</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="context-menu-item"
              onClick={() => {
                onToggleMove(node.path);
                onNewFolder(node.path);
              }}
              disabled={!hasWorkspace || isBusy}
            >
              <FolderPlus size={14} />
              <span>New folder</span>
            </button>
            {!isRoot ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-item"
                  onClick={() => {
                    onToggleMove(node.path);
                    onStartRename(node);
                  }}
                  disabled={!hasWorkspace || isBusy}
                >
                  <Edit3 size={14} />
                  <span>Rename</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-item danger"
                  onClick={() => {
                    onToggleMove(node.path);
                    onDelete(node);
                  }}
                  disabled={!hasWorkspace || isBusy}
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </>
            ) : null}
          </ContextMenu>
        ) : null}
      </div>

      {isExpanded && node.notes.length > 0 ? (
        <div
          className="folder-notes space-y-1"
          style={{ "--folder-depth": node.depth } as CSSProperties}
          aria-label={`${node.name} notes`}
        >
          {node.notes.map((note) => renderNote(note))}
        </div>
      ) : null}

      {isExpanded && hasChildren ? (
        <FolderTree
          nodes={node.children}
          selectedFolderPath={selectedFolderPath}
          expandedFolderPaths={expandedFolderPaths}
          activeMoveFolderPath={activeMoveFolderPath}
          editingFolderPath={editingFolderPath}
          folderNameDraft={folderNameDraft}
          hasWorkspace={hasWorkspace}
          isBusy={isBusy}
          onSelect={onSelect}
          onToggle={onToggle}
          onStartRename={onStartRename}
          onRenameDraftChange={onRenameDraftChange}
          onSubmitRename={onSubmitRename}
          onCancelRename={onCancelRename}
          onToggleMove={onToggleMove}
          onNewNote={onNewNote}
          onNewFolder={onNewFolder}
          onDelete={onDelete}
          renderNote={renderNote}
        />
      ) : null}
    </div>
  );
}

type NoteRowProps = {
  note: NoteSummary | SearchResult;
  selected: boolean;
  isFavorite: boolean;
  isFavoriteSaving: boolean;
  onToggleFavorite: () => void;
  isRenaming: boolean;
  noteNameDraft: string;
  isMoveMenuOpen: boolean;
  isBusy: boolean;
  onOpen: () => void;
  onRename: () => void;
  onRenameDraftChange: (name: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onToggleMove: () => void;
  onDelete: () => void;
};

function NoteRow({
  note,
  selected,
  isFavorite,
  isFavoriteSaving,
  onToggleFavorite,
  isRenaming,
  noteNameDraft,
  isMoveMenuOpen,
  isBusy,
  onOpen,
  onRename,
  onRenameDraftChange,
  onSubmitRename,
  onCancelRename,
  onDuplicate,
  onToggleMove,
  onDelete
}: NoteRowProps) {
  const noteName = noteNameFromPath(note.path);

  return (
    <div
      className={`note-row group ${selected ? "note-row-active" : ""}`}
      onContextMenu={(event) => {
        if (isRenaming) {
          return;
        }

        event.preventDefault();
        onToggleMove();
      }}
    >
      {isRenaming ? (
        <form
          className="note-rename-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitRename();
          }}
        >
          <FileText className="shrink-0" size={15} />
          <input
            type="text"
            aria-label="File name"
            value={noteNameDraft}
            onChange={(event) => onRenameDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
            autoFocus
            disabled={isBusy}
          />
        </form>
      ) : (
        <button type="button" className="note-open-area" onClick={onOpen}>
          <div className="flex items-center gap-2">
            {isFavorite ? <Star className="shrink-0 note-favorite-star" size={15} fill="currentColor" aria-label="Favorite note" /> : <FileText className="shrink-0" size={15} />}
            <span className="truncate font-medium" title={noteName}>
              {noteName}
            </span>
          </div>
        </button>
      )}

      {!isRenaming ? (
        <ContextMenu
          label="Note"
          open={isMoveMenuOpen}
          onToggle={onToggleMove}
          onContextMenu={onToggleMove}
        >
          <button type="button" role="menuitem" className="context-menu-item" disabled={isBusy || isFavoriteSaving}
            onClick={() => { onToggleMove(); onToggleFavorite(); }}>
            <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
            <span>{isFavorite ? "Remove from favorites" : "Add to favorites"}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="context-menu-item"
            onClick={() => {
              onToggleMove();
              onRename();
            }}
            disabled={isBusy}
          >
            <Edit3 size={14} />
            <span>Rename</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="context-menu-item"
            onClick={() => {
              onToggleMove();
              onDuplicate();
            }}
            disabled={isBusy}
          >
            <Copy size={14} />
            <span>Duplicate</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="context-menu-item danger"
            onClick={() => {
              onToggleMove();
              onDelete();
            }}
            disabled={isBusy}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </ContextMenu>
      ) : null}
    </div>
  );
}

function buildFolderTree(
  folders: FolderSummary[],
  notes: Array<NoteSummary | SearchResult>
): FolderTreeNode[] {
  const folderNodes = new Map<string, FolderTreeNode>();

  for (const folder of folders) {
    folderNodes.set(folder.path, {
      ...folder,
      children: [],
      notes: notes.filter((note) => note.folderPath === folder.path),
      depth: 0,
      noteCount: notes.filter((note) => note.folderPath === folder.path).length
    });
  }

  const rootNode = folderNodes.get(".");

  if (!rootNode) {
    return [];
  }

  for (const folder of folders) {
    if (folder.path === ".") {
      continue;
    }

    const node = folderNodes.get(folder.path);
    const parentNode = folderNodes.get(getParentFolderPath(folder.path)) ?? rootNode;

    if (node) {
      parentNode.children.push(node);
    }
  }

  function sortAndSetDepth(node: FolderTreeNode, depth: number) {
    node.depth = depth;
    node.children.sort((first, second) => first.name.localeCompare(second.name));

    for (const child of node.children) {
      sortAndSetDepth(child, depth + 1);
    }
  }

  sortAndSetDepth(rootNode, 0);

  return [rootNode];
}

function collectFolderTreePaths(nodes: FolderTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.path, ...collectFolderTreePaths(node.children)]);
}

function getParentFolderPath(folderPath: string) {
  if (folderPath === "." || !folderPath.includes("/")) {
    return ".";
  }

  return folderPath.slice(0, folderPath.lastIndexOf("/"));
}

function getAncestorFolderPaths(folderPath: string) {
  const ancestorPaths = ["."];
  let currentPath = folderPath;

  while (currentPath !== ".") {
    currentPath = getParentFolderPath(currentPath);

    if (!ancestorPaths.includes(currentPath)) {
      ancestorPaths.push(currentPath);
    }
  }

  return ancestorPaths;
}

function isSameOrChildFolderPath(candidatePath: string, folderPath: string) {
  return candidatePath === folderPath || candidatePath.startsWith(`${folderPath}/`);
}
