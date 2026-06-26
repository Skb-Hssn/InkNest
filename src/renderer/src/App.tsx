import { type ReactNode, useEffect, useState } from "react";
import {
  BookOpenText,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  FilePlus2,
  Folder,
  FolderPlus,
  Hash,
  ListFilter,
  MoreHorizontal,
  PanelLeft,
  PanelRightClose,
  Search,
  Settings,
  SlidersHorizontal,
  SquarePen
} from "lucide-react";

const workspaceName = "No workspace";
const workspacePath = "Open a local Markdown folder to begin";

const folderPlaceholders = [
  "Inbox",
  "Projects",
  "Archive"
] as const;

const toolbarPlaceholders = [
  "H1",
  "B",
  "I",
  "List",
  "Link",
  "Image"
] as const;

export function App() {
  const [phase, setPhase] = useState("phase-3-static-layout");

  useEffect(() => {
    let isMounted = true;

    window.inknest.app.getInfo().then((result) => {
      if (isMounted && result.ok) {
        setPhase(result.data.phase);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="grid min-h-screen grid-rows-[56px_minmax(0,1fr)_34px] bg-ink-50 text-ink-900">
      <header className="flex min-w-0 items-center justify-between border-b border-ink-100 bg-white px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Toggle sidebar"
            className="icon-button"
          >
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
          <button type="button" className="command-button">
            <FilePlus2 size={16} />
            <span>New note</span>
          </button>
          <button type="button" className="secondary-button">
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
            <button type="button" className="workspace-button">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-700 text-white">
                <BookOpenText size={15} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  Choose workspace
                </span>
                <span className="block truncate text-xs text-neutral-500">
                  Local Markdown folder
                </span>
              </span>
              <ChevronDown className="ml-auto text-neutral-400" size={16} />
            </button>

            <label className="search-box">
              <Search size={16} />
              <input
                type="search"
                placeholder="Search notes"
                aria-label="Search notes"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="secondary-button justify-center">
                <FilePlus2 size={16} />
                <span>New note</span>
              </button>
              <button type="button" className="secondary-button justify-center">
                <FolderPlus size={16} />
                <span>New folder</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
            <h2 className="text-xs font-semibold uppercase text-neutral-500">
              Folders
            </h2>
            <button
              type="button"
              aria-label="Filter folders"
              className="icon-button"
            >
              <ListFilter size={16} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-ink-100 px-4 py-4">
              <EmptyState
                icon={<Folder size={18} />}
                title="No workspace selected"
                description="Choose a workspace to show folders stored on disk."
              />
            </div>

            <div className="px-3 py-3">
              <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                Folder tree placeholder
              </p>
              <div className="space-y-1" aria-label="Folder tree preview">
                {folderPlaceholders.map((folderName) => (
                  <button
                    key={folderName}
                    type="button"
                    className="tree-row"
                    disabled
                  >
                    <ChevronRight size={15} />
                    <Folder size={15} />
                    <span>{folderName}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-ink-100 px-4 py-4">
              <EmptyState
                icon={<Search size={18} />}
                title="No search results"
                description="Search results will appear here after a workspace is indexed."
              />
            </div>
          </div>
        </aside>

        <aside className="flex min-h-0 flex-col border-r border-ink-100 bg-neutral-50">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Notes</h2>
              <p className="truncate text-xs text-neutral-500">
                No folder selected
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Collapse notes list"
                className="icon-button"
              >
                <PanelRightClose size={16} />
              </button>
              <button type="button" aria-label="Sort notes" className="icon-button">
                <SlidersHorizontal size={16} />
              </button>
              <button type="button" aria-label="New note" className="icon-button">
                <FilePlus2 size={16} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-ink-100 px-5 py-5">
              <EmptyState
                icon={<Hash size={18} />}
                title="No folder selected"
                description="Select a folder to list its Markdown notes."
              />
            </div>

            <div className="px-3 py-3">
              <p className="mb-2 text-xs font-semibold uppercase text-neutral-500">
                Note list placeholder
              </p>
              <div className="space-y-2" aria-label="Note list preview">
                <NotePlaceholder title="Untitled note" />
                <NotePlaceholder title="Meeting notes" />
                <NotePlaceholder title="Reading list" />
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-white">
          <div className="flex h-14 items-center justify-between border-b border-ink-100 px-5">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">Untitled note</h2>
              <p className="truncate text-xs text-neutral-500">
                No file selected
              </p>
            </div>
            <span className="status-pill">
              <Check size={13} />
              Saved
            </span>
          </div>

          <div className="flex h-11 items-center gap-1 border-b border-ink-100 px-4">
            {toolbarPlaceholders.map((label) => (
              <button key={label} type="button" className="toolbar-button">
                {label}
              </button>
            ))}
            <span className="mx-2 h-5 w-px bg-ink-100" />
            <button type="button" aria-label="More editor actions" className="icon-button">
              <MoreHorizontal size={16} />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-ink-100 text-ink-700">
                <SquarePen size={22} />
              </div>
              <h3 className="text-lg font-semibold">No note selected</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Open or create a Markdown note to edit formatted content here.
              </p>
            </div>
          </div>
        </section>
      </section>

      <footer className="grid grid-cols-[1fr_auto_1fr] items-center border-t border-ink-100 bg-white px-4 text-xs text-neutral-500">
        <span className="truncate">{workspacePath}</span>
        <span>{phase}</span>
        <span className="justify-self-end">Saved - 0 words - 0 characters</span>
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

type NotePlaceholderProps = {
  title: string;
};

function NotePlaceholder({ title }: NotePlaceholderProps) {
  return (
    <button type="button" className="note-row" disabled>
      <div className="flex items-center gap-2">
        <FileText size={15} />
        <span className="truncate font-medium">{title}</span>
      </div>
      <p className="mt-1 truncate text-xs text-neutral-500">
        Preview text will appear after notes are scanned.
      </p>
      <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
        <Circle size={8} fill="currentColor" />
        <span>Markdown</span>
      </div>
    </button>
  );
}
