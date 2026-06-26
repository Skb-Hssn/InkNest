import { useEffect, useState } from "react";
import {
  FilePlus2,
  FolderPlus,
  PanelLeft,
  Search,
  Settings,
  Sparkle,
  SquarePen
} from "lucide-react";

const workspaceName = "No workspace";

export function App() {
  const [phase, setPhase] = useState("phase-2-secure-boundary");

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
    <main className="grid min-h-screen grid-rows-[56px_minmax(0,1fr)_32px] bg-ink-50 text-ink-900">
      <header className="flex items-center justify-between border-b border-ink-100 bg-white px-4">
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
          <button type="button" aria-label="Settings" className="icon-button">
            <Settings size={18} />
          </button>
        </div>
      </header>

      <section className="grid min-h-0 grid-cols-[280px_minmax(320px,420px)_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-ink-100 bg-white">
          <div className="border-b border-ink-100 p-3">
            <button type="button" className="workspace-button">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ember-400 text-white">
                <Sparkle size={15} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  Choose workspace
                </span>
                <span className="block truncate text-xs text-neutral-500">
                  Local Markdown folder
                </span>
              </span>
            </button>
          </div>

          <div className="border-b border-ink-100 p-3">
            <label className="search-box">
              <Search size={16} />
              <input
                type="search"
                placeholder="Search notes"
                aria-label="Search notes"
              />
            </label>
          </div>

          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
            <h2 className="text-xs font-semibold uppercase text-neutral-500">
              Folders
            </h2>
            <button type="button" aria-label="New folder" className="icon-button">
              <FolderPlus size={16} />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="max-w-[180px] text-sm leading-6 text-neutral-500">
              Select a workspace to show folders.
            </p>
          </div>
        </aside>

        <aside className="flex min-h-0 flex-col border-r border-ink-100 bg-neutral-50">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-semibold">Notes</h2>
            <button type="button" aria-label="New note" className="icon-button">
              <FilePlus2 size={16} />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center px-8 text-center">
            <p className="max-w-[220px] text-sm leading-6 text-neutral-500">
              Notes will appear after a workspace is opened.
            </p>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-white">
          <div className="flex h-12 items-center justify-between border-b border-ink-100 px-5">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">Untitled note</h2>
              <p className="truncate text-xs text-neutral-500">
                No file selected
              </p>
            </div>
            <span className="rounded-md border border-ink-100 px-2 py-1 text-xs text-neutral-500">
              Ready
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-ink-100 text-ink-700">
                <SquarePen size={22} />
              </div>
              <h3 className="text-lg font-semibold">Open a workspace</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                The editor is ready for local Markdown notes.
              </p>
            </div>
          </div>
        </section>
      </section>

      <footer className="flex items-center justify-between border-t border-ink-100 bg-white px-4 text-xs text-neutral-500">
        <span>0 words</span>
        <span>{phase}</span>
      </footer>
    </main>
  );
}
