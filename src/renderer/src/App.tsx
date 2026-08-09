import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
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
  Code2,
  Copy,
  Edit3,
  Eraser,
  FileText,
  FilePlus2,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  ListFilter,
  ListOrdered,
  Minus,
  PanelLeft,
  PanelRightClose,
  Quote,
  RotateCcw,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  SquarePen,
  Strikethrough,
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
  NoteSummary,
  WorkspaceFileModel,
  WorkspaceInfo
} from "../../shared/ipc";
import {
  applyMarkdownEditorCommand,
  applySlashCommandAtSelection,
  editorDomToMarkdown,
  exitEditorBlockFromElement,
  exitCurrentEditorBlock,
  exitInlineAtomAtSelection,
  handleListKeyAtSelection,
  insertPlainTextAtSelection,
  insertCodeIndentAtSelection,
  isSelectionInsideCodeBlock,
  moveTableSelection,
  normalizeEmptyBlockAtSelection,
  updateCodeBlockLanguageFromSelect,
  type MarkdownEditorCommand,
  type MarkdownEditorCommandOptions,
  markdownToHtml
} from "./markdown-editor";

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

type LinkDialogDetails = {
  text: string;
  url: string;
  isEditing: boolean;
  position?: {
    left: number;
    top: number;
  };
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
  { id: "table", label: "Insert table", icon: <TableProperties size={16} />, group: "table" },
  { id: "table-add-row", label: "Add table row", icon: addRowIcon, group: "table" },
  { id: "table-delete-row", label: "Delete table row", icon: deleteRowIcon, group: "table" },
  { id: "table-add-column", label: "Add table column", icon: addColumnIcon, group: "table" },
  { id: "table-delete-column", label: "Delete table column", icon: deleteColumnIcon, group: "table" },
  { id: "blockquote", label: "Quote", icon: <Quote size={16} />, group: "blocks" },
  { id: "callout-note", label: "Note callout", icon: <Quote size={16} />, group: "blocks" },
  { id: "callout-warning", label: "Warning callout", icon: <AlertTriangle size={16} />, group: "blocks" },
  { id: "callout-info", label: "Info callout", icon: <BookOpenText size={16} />, group: "blocks" },
  { id: "callout-success", label: "Success callout", icon: <Check size={16} />, group: "blocks" },
  { id: "divider", label: "Divider", icon: <Minus size={16} />, group: "insert" }
];

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

type SaveState = "saved" | "unsaved" | "saving" | "failed";

// Keep the debounce inside the product's 500ms-1000ms autosave range.
const autoSaveDelayMs = 750;

export function App() {
  const [phase, setPhase] = useState("phase-10-autosave-safe-writes");
  const editorHandleRef = useRef<VisualMarkdownEditorHandle | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo>(initialWorkspace);
  const [fileModel, setFileModel] = useState<WorkspaceFileModel | null>(null);
  const [trashNotes, setTrashNotes] = useState<DeletedNoteSummary[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState(".");
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null);
  const [selectedNoteContent, setSelectedNoteContent] = useState<NoteContent | null>(null);
  const [editorMarkdown, setEditorMarkdown] = useState("");
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState("");
  const [noteTitleDraft, setNoteTitleDraft] = useState("");
  const [activeMoveNotePath, setActiveMoveNotePath] = useState<string | null>(null);
  const [activeMoveFolderPath, setActiveMoveFolderPath] = useState<string | null>(null);
  const [editingFolderPath, setEditingFolderPath] = useState<string | null>(null);
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [expandedFolderPaths, setExpandedFolderPaths] = useState<Set<string>>(
    () => new Set(["."])
  );
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);
  const [activeToolbarCommands, setActiveToolbarCommands] = useState<
    Set<MarkdownEditorCommand>
  >(() => new Set());
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const saveQueuedRef = useRef(false);
  const editorMarkdownRef = useRef(editorMarkdown);
  const lastSavedMarkdownRef = useRef(lastSavedMarkdown);
  const selectedNoteContentRef = useRef(selectedNoteContent);
  const saveStateRef = useRef<SaveState>(saveState);

  editorMarkdownRef.current = editorMarkdown;
  lastSavedMarkdownRef.current = lastSavedMarkdown;
  selectedNoteContentRef.current = selectedNoteContent;
  saveStateRef.current = saveState;

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
  const folderTree = useMemo(() => buildFolderTree(folders, notes), [folders, notes]);
  const visibleNotes = notes.filter((note) => note.folderPath === selectedFolderPath);
  const selectedNote =
    notes.find((note) => note.path === selectedNotePath) ?? null;
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
  const wordCount = editorMarkdown.trim()
    ? editorMarkdown.trim().split(/\s+/).length
    : 0;
  const characterCount = editorMarkdown.length;
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
    if (!(await flushCurrentNote())) {
      return;
    }

    setIsBusy(true);
    setWorkspaceError(null);

    const result = await window.inknest.workspace.choose();

    if (result.ok) {
      setWorkspace(result.data);
      clearSelectedNote();
      if (result.data.status === "ready") {
        await refreshWorkspace();
      }
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function reopenWorkspace(workspacePath: string) {
    if (!(await flushCurrentNote())) {
      return;
    }

    setIsBusy(true);
    setWorkspaceError(null);

    const result = await window.inknest.workspace.select(workspacePath);

    if (result.ok) {
      setWorkspace(result.data);
      clearSelectedNote();
      await refreshWorkspace();
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

  function clearAutoSaveTimer() {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }

  function scheduleAutoSave(delay = autoSaveDelayMs) {
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
    selectedNoteContentRef.current = null;
    editorMarkdownRef.current = "";
    lastSavedMarkdownRef.current = "";
    setSelectedNotePath(null);
    setSelectedNoteContent(null);
    setEditorMarkdown("");
    setLastSavedMarkdown("");
    updateSaveState("saved");
    updateSaveError(null);
    setActiveToolbarCommands(new Set());
  }

  async function openNote(notePath: string) {
    if (!(await flushCurrentNote())) {
      return;
    }

    setActiveMoveNotePath(null);
    setIsBusy(true);
    const result = await window.inknest.notes.read(notePath);

    if (result.ok) {
      selectedNoteContentRef.current = result.data;
      editorMarkdownRef.current = result.data.markdown;
      lastSavedMarkdownRef.current = result.data.markdown;
      setSelectedNotePath(result.data.path);
      setSelectedNoteContent(result.data);
      setEditorMarkdown(result.data.markdown);
      setLastSavedMarkdown(result.data.markdown);
      updateSaveState("saved");
      updateSaveError(null);
      setStatusMessage("Note opened");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function saveCurrentNote(): Promise<boolean> {
    const note = selectedNoteContentRef.current;
    const markdownToSave = editorMarkdownRef.current;

    if (!note || markdownToSave === lastSavedMarkdownRef.current) {
      return saveStateRef.current !== "failed";
    }

    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      await saveInFlightRef.current;
      return !hasPendingSave();
    }

    const requestPath = note.path;
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

      setIsSaving(false);

      if (saveQueuedRef.current) {
        saveQueuedRef.current = false;
        scheduleAutoSave();
      }
    }
  }

  async function flushCurrentNote() {
    clearAutoSaveTimer();

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
  }, [editorMarkdown, isDirty, lastSavedMarkdown, selectedNoteContent?.path]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
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
  }, []);

  useEffect(() => {
    return window.inknest.app.onPrepareToClose(() => {
      void (async () => {
        try {
          const didFlush = await flushCurrentNote();

          if (didFlush) {
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
    if (!selectedNoteContent || isBusy) {
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

    if (command.id === "code-block") {
      editorHandleRef.current?.runCommand("code-block");
      setStatusMessage("Inserted code block");
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

    if (command.id === "math-edit") {
      const equation = window.prompt("LaTeX math", "x^2 + y^2 = z^2");

      if (!equation) {
        return;
      }

      options.equation = equation;
    }

    editorHandleRef.current?.runCommand(command.id, options);
    setStatusMessage(`Applied ${command.label}`);
  }

  function openLinkDialog(details: LinkDialogDetails) {
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

    editorHandleRef.current?.runCommand(linkDialog.isEditing ? "link-edit" : "link", {
      label: text,
      url
    });
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
    setActiveMoveFolderPath(null);
    setEditingFolderPath(null);
    setIsBusy(true);
    const result = await window.inknest.folders.create({
      parentPath: selectedFolderPath,
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

      if (selectedNote && isSameOrChildFolderPath(selectedNote.folderPath, folder.path)) {
        clearSelectedNote();
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

      if (
        selectedNote?.folderPath === folder.path ||
        selectedNote?.folderPath.startsWith(`${folder.path}/`)
      ) {
        clearSelectedNote();
      }

      await refreshWorkspace();
      setStatusMessage("Folder deleted");
    } else {
      setWorkspaceError(result.error.message);
    }

    setIsBusy(false);
  }

  async function moveFolder(folder: FolderSummary, parentPath: string) {
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
    const result = await window.inknest.folders.move({
      path: folder.path,
      parentPath
    });

    if (result.ok) {
      if (selectedNote && isSameOrChildFolderPath(selectedNote.folderPath, folder.path)) {
        clearSelectedNote();
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
      setStatusMessage("Folder moved");
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

  async function renameNote() {
    if (!selectedNote) {
      return;
    }

    const title = noteTitleDraft.trim();

    if (!title) {
      setWorkspaceError("Note title cannot be empty.");
      return;
    }

    if (!(await flushCurrentNote())) {
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

  async function moveNote(note: NoteSummary, folderPath: string) {
    if (note.path === selectedNotePath && !(await flushCurrentNote())) {
      return;
    }

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

    if (note.path === selectedNotePath && !(await flushCurrentNote())) {
      return;
    }

    setIsBusy(true);
    const result = await window.inknest.notes.delete({
      path: note.path
    });

    if (result.ok) {
      if (note.path === selectedNotePath) {
        clearSelectedNote();
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
    <main className="grid h-screen overflow-hidden grid-rows-[56px_minmax(0,1fr)_34px] bg-ink-50 text-ink-900">
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
                <FolderTree
                  nodes={folderTree}
                  folders={folders}
                  selectedFolderPath={selectedFolderPath}
                  expandedFolderPaths={expandedFolderPaths}
                  activeMoveFolderPath={activeMoveFolderPath}
                  editingFolderPath={editingFolderPath}
                  folderNameDraft={folderNameDraft}
                  hasWorkspace={hasWorkspace}
                  isBusy={isBusy}
                  onSelect={(folderPath) => {
                    setActiveMoveNotePath(null);
                    setSelectedFolderPath(folderPath);
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
                  onMove={(folder, parentPath) => void moveFolder(folder, parentPath)}
                  onDelete={(folder) => void deleteFolder(folder)}
                />
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void saveCurrentNote()}
                disabled={!selectedNoteContent || !isDirty || isBusy || isSaving}
              >
                <Save size={15} />
                <span>Save</span>
              </button>
              <span className="status-pill" aria-live="polite" title={saveError ?? undefined}>
                <Check size={13} />
                {statusMessage} - {saveStatusLabel}
              </span>
            </div>
          </div>

          <div className="toolbar-shell">
            <div
              className="markdown-toolbar"
              aria-label="Markdown toolbar"
            >
              {getToolbarGroups(toolbarPlaceholders).map((group) => (
                <div
                  key={group.name}
                  className="toolbar-group"
                  aria-label={`${group.name} tools`}
                >
                  {group.commands.map((command) => {
                    const isActive = activeToolbarCommands.has(command.id);

                    return (
                      <button
                        key={command.id}
                        type="button"
                        className={`toolbar-button ${
                          isActive ? "toolbar-button-active" : ""
                        }`}
                        aria-label={command.label}
                        title={command.label}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => runToolbarCommand(command, event)}
                        disabled={!selectedNoteContent || isBusy}
                      >
                        {command.icon}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

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

          {selectedNoteContent ? (
            <article className="min-h-0 flex-1 overflow-y-auto p-8">
              <VisualMarkdownEditor
                ref={editorHandleRef}
                key={selectedNoteContent.path}
                markdown={editorMarkdown}
                workspacePath={workspace.path}
                disabled={isBusy}
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
                onLinkDialogRequest={openLinkDialog}
              />
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
          {saveStatusLabel} - {wordCount} words - {characterCount} characters
          {saveError ? `: ${saveError}` : ""}
        </span>
      </footer>
    </main>
  );
}

type VisualMarkdownEditorProps = {
  markdown: string;
  workspacePath: string | null;
  disabled: boolean;
  onChange: (markdown: string) => void;
  onSelectionFormatChange: (commands: Set<MarkdownEditorCommand>) => void;
  onLinkDialogRequest: (details: LinkDialogDetails) => void;
};

type VisualMarkdownEditorHandle = {
  runCommand: (
    command: MarkdownEditorCommand,
    options?: MarkdownEditorCommandOptions
  ) => void;
  getLinkDetails: () => {
    text: string;
    url: string;
    isEditing: boolean;
  };
};

const VisualMarkdownEditor = forwardRef<
  VisualMarkdownEditorHandle,
  VisualMarkdownEditorProps
>(function VisualMarkdownEditor(
  {
    markdown,
    workspacePath,
    disabled,
    onChange,
    onSelectionFormatChange,
    onLinkDialogRequest
  },
  ref
) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastRenderedMarkdown = useRef("");
  const savedSelectionRange = useRef<Range | null>(null);

  useEffect(() => {
    if (!editorRef.current || lastRenderedMarkdown.current === markdown) {
      return;
    }

    editorRef.current.innerHTML = markdownToHtml(markdown, {
      workspacePath
    });
    lastRenderedMarkdown.current = markdown;
  }, [markdown, workspacePath]);

  useEffect(() => {
    function handleSelectionChange() {
      rememberEditorSelection();
    }

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  });

  function getSelectionElement() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const anchorNode = selection.anchorNode;
    return anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement ?? null;
  }

  function getSelectedOrNearbyLink() {
    const editorElement = editorRef.current;
    const element = getSelectionElement();
    const link = element?.closest("a");

    if (!(link instanceof HTMLAnchorElement) || !editorElement?.contains(link)) {
      return null;
    }

    return link;
  }

  function getLinkDetailsFromSelection() {
    const editorElement = editorRef.current;

    if (!editorElement || disabled) {
      return {
        text: "",
        url: "",
        isEditing: false
      };
    }

    editorElement.focus();
    if (!restoreEditorSelection()) {
      placeCaretAtEditorEnd(editorElement);
    }

    const link = getSelectedOrNearbyLink();

    if (link) {
      return {
        text: link.textContent ?? "",
        url: link.getAttribute("href") ?? "",
        isEditing: true
      };
    }

    return {
      text: window.getSelection()?.toString() ?? "",
      url: "",
      isEditing: false
    };
  }

  useImperativeHandle(ref, () => ({
    runCommand(command, options) {
      if (!editorRef.current || disabled) {
        return;
      }

      editorRef.current.focus();
      if (!restoreEditorSelection()) {
        placeCaretAtEditorEnd(editorRef.current);
      }
      applyMarkdownEditorCommand(command, options);
      syncMarkdownFromEditor(editorRef.current);
    },
    getLinkDetails() {
      return getLinkDetailsFromSelection();
    }
  }));

  function rememberEditorSelection() {
    const editorElement = editorRef.current;
    const selection = window.getSelection();

    if (!editorElement || !selection || selection.rangeCount === 0) {
      onSelectionFormatChange(new Set());
      return;
    }

    const range = selection.getRangeAt(0);

    if (editorElement.contains(range.commonAncestorContainer)) {
      savedSelectionRange.current = range.cloneRange();
      onSelectionFormatChange(collectActiveCommands(editorElement));
    } else {
      onSelectionFormatChange(new Set());
    }
  }

  function restoreEditorSelection() {
    const selection = window.getSelection();
    const range = savedSelectionRange.current;

    if (!selection || !range) {
      return false;
    }

    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function placeCaretAtEditorEnd(editorElement: HTMLDivElement) {
    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(editorElement);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function collectActiveCommands(editorElement: HTMLDivElement) {
    const activeCommands = new Set<MarkdownEditorCommand>();
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return activeCommands;
    }

    const anchorNode = selection.anchorNode;
    const element =
      anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;

    if (!element || !editorElement.contains(element)) {
      return activeCommands;
    }

    if (document.queryCommandState("bold")) {
      activeCommands.add("bold");
    }

    if (document.queryCommandState("italic")) {
      activeCommands.add("italic");
    }

    if (document.queryCommandState("strikeThrough")) {
      activeCommands.add("strikethrough");
    }

    const heading = element.closest("h1,h2,h3,h4,h5,h6");
    if (heading) {
      activeCommands.add(`heading-${heading.tagName.slice(1)}` as MarkdownEditorCommand);
    }

    if (element.closest("blockquote")) {
      activeCommands.add("blockquote");
    }

    if (element.closest("ul")) {
      activeCommands.add("unordered-list");
    }

    if (element.closest("ol")) {
      activeCommands.add("ordered-list");
    }

    if (element.closest("li[data-task='true']")) {
      activeCommands.add("task-list");
    }

    if (element.closest("pre")) {
      activeCommands.add("code-block");
    } else if (element.closest("code")) {
      activeCommands.add("inline-code");
    }

    if (element.closest("a")) {
      activeCommands.add("link");
    }

    if (element.closest("table")) {
      activeCommands.add("table");
    }

    if (element.closest("img")) {
      activeCommands.add("image");
    }

    const mathElement = element.closest("[data-math]");
    if (mathElement instanceof HTMLElement) {
      activeCommands.add(
        mathElement.dataset.mathDisplay === "block" ? "block-math" : "inline-math"
      );
    }

    return activeCommands;
  }

  function syncMarkdownFromEditor(editorElement: HTMLDivElement) {
    const nextMarkdown = editorDomToMarkdown(editorElement);

    lastRenderedMarkdown.current = nextMarkdown;
    onChange(nextMarkdown);
    rememberEditorSelection();
  }

  function handleInput(event: FormEvent<HTMLDivElement>) {
    syncMarkdownFromEditor(event.currentTarget);
  }

  function handleChange(event: FormEvent<HTMLDivElement>) {
    const target = event.target;

    if (
      target instanceof HTMLSelectElement &&
      target.dataset.codeLanguage === "true" &&
      editorRef.current
    ) {
      updateCodeBlockLanguageFromSelect(target);
      syncMarkdownFromEditor(editorRef.current);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    insertPlainTextAtSelection(event.clipboardData.getData("text/plain"));
    handleInput(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Backspace") {
      if (isSelectionInsideCodeBlock()) {
        return;
      }

      const didNormalizeBlock = normalizeEmptyBlockAtSelection();

      if (didNormalizeBlock && editorRef.current) {
        event.preventDefault();
        syncMarkdownFromEditor(editorRef.current);
      }

      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      const didExitInlineAtom = exitInlineAtomAtSelection();
      const didExitBlock = didExitInlineAtom ? false : exitCurrentEditorBlock();

      if ((didExitInlineAtom || didExitBlock) && editorRef.current) {
        event.preventDefault();
        syncMarkdownFromEditor(editorRef.current);
      }

      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "ArrowRight") {
      const didExitInlineAtom = exitInlineAtomAtSelection();

      if (didExitInlineAtom && editorRef.current) {
        event.preventDefault();
        syncMarkdownFromEditor(editorRef.current);
      }

      return;
    }

    if (event.key === "Tab") {
      const didInsertCodeIndent = insertCodeIndentAtSelection();
      const didMoveTableCell = !didInsertCodeIndent
        ? moveTableSelection(!event.shiftKey)
        : false;
      const didHandleList = !didInsertCodeIndent && !didMoveTableCell
        ? handleListKeyAtSelection(event.key, event.shiftKey)
        : false;

      if ((didInsertCodeIndent || didMoveTableCell || didHandleList) && editorRef.current) {
        event.preventDefault();
        syncMarkdownFromEditor(editorRef.current);
      }

      return;
    }

    if (event.key === "Enter") {
      if (isSelectionInsideCodeBlock()) {
        return;
      }

      const didHandleList = handleListKeyAtSelection(event.key, event.shiftKey);

      if (didHandleList && editorRef.current) {
        event.preventDefault();
        syncMarkdownFromEditor(editorRef.current);
      }

      if (didHandleList) {
        return;
      }
    }

    if (event.key !== " " && event.key !== "Enter") {
      return;
    }

    const command = applySlashCommandAtSelection();

    if (!command || !editorRef.current) {
      return;
    }

    event.preventDefault();
    syncMarkdownFromEditor(editorRef.current);
  }

  function handleMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (!event.altKey) {
      return;
    }

    const target = event.target;

    if (!(target instanceof HTMLElement) || !target.closest("pre,blockquote")) {
      return;
    }

    const didExitBlock = exitEditorBlockFromElement(target);

    if (didExitBlock && editorRef.current) {
      event.preventDefault();
      syncMarkdownFromEditor(editorRef.current);
    }
  }

  function selectImageForResize(image: HTMLImageElement) {
    let frame = image.closest(".image-resize-frame") as HTMLSpanElement | null;

    if (!frame) {
      frame = document.createElement("span");
      frame.className = "image-resize-frame";
      frame.contentEditable = "false";
      frame.dataset.imageResizeFrame = "true";
      image.insertAdjacentElement("beforebegin", frame);
      frame.append(image);
    }

    const imageWidth = image.getAttribute("width") ?? image.style.width.replace("px", "");
    const width = Number.parseInt(imageWidth, 10) || Math.round(image.getBoundingClientRect().width) || 320;

    frame.style.width = `${width}px`;
    frame.classList.add("image-resize-frame-active");
    image.style.width = "100%";
    image.style.height = "auto";

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNode(frame);
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedSelectionRange.current = range.cloneRange();

    if (editorRef.current) {
      onSelectionFormatChange(collectActiveCommands(editorRef.current));
    }
  }

  function syncImageResizeFrames() {
    if (!editorRef.current) {
      return false;
    }

    let didResize = false;

    for (const frame of Array.from(editorRef.current.querySelectorAll(".image-resize-frame"))) {
      if (!(frame instanceof HTMLElement)) {
        continue;
      }

      const image = frame.querySelector("img");

      if (!(image instanceof HTMLImageElement)) {
        continue;
      }

      const width = Math.round(frame.getBoundingClientRect().width);

      if (width > 0 && image.getAttribute("width") !== String(width)) {
        image.setAttribute("width", String(width));
        image.style.width = "100%";
        image.style.height = "auto";
        didResize = true;
      }
    }

    return didResize;
  }

  function handleMouseUp() {
    if (syncImageResizeFrames() && editorRef.current) {
      syncMarkdownFromEditor(editorRef.current);
      return;
    }

    rememberEditorSelection();
  }

  async function copyTextToClipboard(text: string) {
    try {
      await navigator.clipboard?.writeText(text);

      if (navigator.clipboard) {
        return;
      }
    } catch {
      // Fall back for Electron or browser contexts where async clipboard is unavailable.
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    const codeCopyButton =
      target instanceof HTMLElement ? target.closest("[data-code-copy='true']") : null;

    if (codeCopyButton instanceof HTMLButtonElement) {
      const code = codeCopyButton.closest("pre")?.querySelector("code")?.textContent ?? "";

      event.preventDefault();
      void copyTextToClipboard(code);
      return;
    }

    const linkTarget = target instanceof HTMLElement ? target.closest("a") : null;

    if (linkTarget instanceof HTMLAnchorElement && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void window.inknest.links.openExternal({ url: linkTarget.href });
      return;
    }

    if (
      target instanceof HTMLImageElement ||
      (target instanceof HTMLElement && target.closest("[data-math]"))
    ) {
      const selection = window.getSelection();
      const range = document.createRange();
      const selectableTarget =
        target instanceof HTMLImageElement ? target : target.closest("[data-math]");

      if (!selectableTarget) {
        return;
      }

      range.selectNode(selectableTarget);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
      return;
    }

    window.setTimeout(() => {
      if (editorRef.current) {
        syncMarkdownFromEditor(editorRef.current);
      }
    }, 0);
  }

  function handleDoubleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target instanceof HTMLImageElement) {
      event.preventDefault();
      selectImageForResize(target);
      return;
    }

    const link = target.closest("a");

    if (!(link instanceof HTMLAnchorElement) || !editorRef.current?.contains(link)) {
      return;
    }

    event.preventDefault();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(link);
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedSelectionRange.current = range.cloneRange();
    onSelectionFormatChange(collectActiveCommands(editorRef.current));

    onLinkDialogRequest({
      text: link.textContent ?? "",
      url: link.getAttribute("href") ?? "",
      isEditing: true,
      position: getViewportPopoverPosition(event.clientX, event.clientY + 8)
    });
  }

  return (
    <div
      ref={editorRef}
      className="visual-editor"
      contentEditable={!disabled}
      suppressContentEditableWarning
      aria-label="Visual Markdown editor"
      role="textbox"
      aria-multiline="true"
      data-placeholder="Start writing..."
      onInput={handleInput}
      onChange={handleChange}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={rememberEditorSelection}
      onMouseUp={handleMouseUp}
      onMouseDown={handleMouseDown}
      onPaste={handlePaste}
    />
  );
});

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

type FolderTreeNode = FolderSummary & {
  children: FolderTreeNode[];
  depth: number;
  noteCount: number;
};

type FolderTreeProps = {
  nodes: FolderTreeNode[];
  folders: FolderSummary[];
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
  onMove: (folder: FolderSummary, parentPath: string) => void;
  onDelete: (folder: FolderSummary) => void;
};

function FolderTree({
  nodes,
  folders,
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
  onMove,
  onDelete
}: FolderTreeProps) {
  return (
    <>
      {nodes.map((node) => (
        <FolderTreeRow
          key={node.path}
          node={node}
          folders={folders}
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
          onMove={onMove}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

function FolderTreeRow({
  node,
  folders,
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
  onMove,
  onDelete
}: Omit<FolderTreeProps, "nodes"> & { node: FolderTreeNode }) {
  const isExpanded = expandedFolderPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  const isRoot = node.path === ".";
  const isRenaming = editingFolderPath === node.path;
  const isMoveMenuOpen = activeMoveFolderPath === node.path;
  const moveTargets = folders.filter((folder) => isFolderMoveTarget(node, folder));

  return (
    <div>
      <div
        className={`tree-row group ${
          node.path === selectedFolderPath ? "tree-row-active" : ""
        }`}
        style={{ "--folder-depth": node.depth } as CSSProperties}
      >
        <button
          type="button"
          aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          className="tree-toggle-button"
          onClick={() => onToggle(node.path)}
          disabled={!hasWorkspace || !hasChildren}
        >
          {hasChildren ? (
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
            {isExpanded && hasChildren ? <FolderOpen size={15} /> : <Folder size={15} />}
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
            onClick={() => onSelect(node.path)}
            disabled={!hasWorkspace}
          >
            {isExpanded && hasChildren ? <FolderOpen size={15} /> : <Folder size={15} />}
            <span className="truncate">{node.name}</span>
            <span className="tree-count">{node.noteCount}</span>
          </button>
        )}
        {!isRoot ? (
          <span
            className={`folder-actions ${
              isRenaming || isMoveMenuOpen ? "folder-actions-visible" : ""
            }`}
          >
            <button
              type="button"
              aria-label={isRenaming ? "Save folder name" : "Rename folder"}
              title={isRenaming ? "Save folder name" : "Rename folder"}
              className="icon-button folder-action-button"
              onClick={() => {
                if (isRenaming) {
                  onSubmitRename(node);
                } else {
                  onStartRename(node);
                }
              }}
              disabled={!hasWorkspace || isBusy}
            >
              {isRenaming ? <Check size={13} /> : <Edit3 size={13} />}
            </button>
            {isRenaming ? (
              <button
                type="button"
                aria-label="Cancel folder rename"
                title="Cancel folder rename"
                className="icon-button folder-action-button"
                onClick={onCancelRename}
                disabled={isBusy}
              >
                <X size={13} />
              </button>
            ) : (
              <>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Move folder"
                    title="Move folder"
                    className="icon-button folder-action-button"
                    onClick={() => onToggleMove(node.path)}
                    disabled={!hasWorkspace || isBusy || moveTargets.length === 0}
                  >
                    <FolderInput size={13} />
                  </button>
                  {isMoveMenuOpen ? (
                    <div className="move-menu folder-move-menu" role="menu" aria-label="Move folder to parent">
                      {moveTargets.map((folder) => (
                        <button
                          key={folder.path}
                          type="button"
                          className="move-menu-item"
                          onClick={() => onMove(node, folder.path)}
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
                  aria-label="Delete folder"
                  title="Delete folder"
                  className="icon-button folder-action-button danger"
                  onClick={() => onDelete(node)}
                  disabled={!hasWorkspace || isBusy}
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </span>
        ) : null}
      </div>

      {isExpanded && hasChildren ? (
        <FolderTree
          nodes={node.children}
          folders={folders}
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
          onMove={onMove}
          onDelete={onDelete}
        />
      ) : null}
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

function buildFolderTree(
  folders: FolderSummary[],
  notes: NoteSummary[]
): FolderTreeNode[] {
  const folderNodes = new Map<string, FolderTreeNode>();

  for (const folder of folders) {
    folderNodes.set(folder.path, {
      ...folder,
      children: [],
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

function isFolderMoveTarget(source: FolderSummary, target: FolderSummary) {
  if (source.path === "." || target.path === source.path) {
    return false;
  }

  if (target.path.startsWith(`${source.path}/`)) {
    return false;
  }

  return getParentFolderPath(source.path) !== target.path;
}

function isSameOrChildFolderPath(candidatePath: string, folderPath: string) {
  return candidatePath === folderPath || candidatePath.startsWith(`${folderPath}/`);
}
