import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceChangeEvent } from "../../shared/ipc";

const workspaceMetadataFolderName = ".inknest";
const pollIntervalMs = 400;

type WorkspaceSnapshot = Map<string, string>;
type WorkspaceChangeListener = (event: WorkspaceChangeEvent) => void;

export class WorkspaceWatcher {
  private activeWorkspacePath: string | null = null;
  private snapshot: WorkspaceSnapshot = new Map();
  private unavailableStatus: WorkspaceChangeEvent["workspaceStatus"] | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly onChange: WorkspaceChangeListener) {}

  async watch(workspacePath: string) {
    await this.stop();
    this.activeWorkspacePath = path.resolve(workspacePath);
    this.snapshot = await snapshotWorkspace(this.activeWorkspacePath);
    this.unavailableStatus = null;
    this.timer = setInterval(() => {
      void this.checkForChanges();
    }, pollIntervalMs);
  }

  async stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.activeWorkspacePath = null;
    this.snapshot = new Map();
    this.unavailableStatus = null;
  }

  private async checkForChanges() {
    const workspacePath = this.activeWorkspacePath;

    if (!workspacePath) {
      return;
    }

    let nextSnapshot: WorkspaceSnapshot;

    try {
      nextSnapshot = await snapshotWorkspace(workspacePath);
    } catch (error) {
      const status = getWorkspaceStatus(error);

      if (this.unavailableStatus === status) {
        return;
      }

      this.unavailableStatus = status;
      this.onChange({
        workspacePath,
        createdPaths: [],
        changedPaths: [],
        deletedPaths: [],
        workspaceStatus: status
      });
      return;
    }

    const wasUnavailable = this.unavailableStatus !== null;
    this.unavailableStatus = null;
    const createdPaths: string[] = [];
    const changedPaths: string[] = [];
    const deletedPaths: string[] = [];

    for (const [relativePath, signature] of nextSnapshot) {
      const previousSignature = this.snapshot.get(relativePath);

      if (previousSignature === undefined) {
        createdPaths.push(relativePath);
      } else if (previousSignature !== signature) {
        changedPaths.push(relativePath);
      }
    }

    for (const relativePath of this.snapshot.keys()) {
      if (!nextSnapshot.has(relativePath)) {
        deletedPaths.push(relativePath);
      }
    }

    this.snapshot = nextSnapshot;

    if (wasUnavailable || createdPaths.length || changedPaths.length || deletedPaths.length) {
      this.onChange({
        workspacePath,
        createdPaths: createdPaths.sort(),
        changedPaths: changedPaths.sort(),
        deletedPaths: deletedPaths.sort(),
        workspaceStatus: "ready"
      });
    }
  }
}

async function snapshotWorkspace(workspacePath: string): Promise<WorkspaceSnapshot> {
  const snapshot: WorkspaceSnapshot = new Map();

  async function walk(currentPath: string, relativeDirectory: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.name === workspaceMetadataFolderName && entry.isDirectory()) {
        const trashPath = path.join(entryPath, "trash");
        const relativeTrashPath = normalizeRelativePath(
          path.join(relativeDirectory, entry.name, "trash")
        );
        snapshot.set(relativeTrashPath, "directory");
        await walk(trashPath, relativeTrashPath).catch(() => undefined);
        continue;
      }

      const relativePath = normalizeRelativePath(
        path.join(relativeDirectory, entry.name)
      );

      if (entry.isDirectory()) {
        snapshot.set(relativePath, "directory");
        await walk(entryPath, relativePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (entry.name.endsWith(".tmp")) {
        continue;
      }

      const fileStats = await stat(entryPath);
      snapshot.set(relativePath, `${fileStats.size}:${fileStats.mtimeMs}`);
    }
  }

  await walk(workspacePath, "");
  return snapshot;
}

function normalizeRelativePath(relativePath: string) {
  return relativePath.split(path.sep).join("/");
}

function getWorkspaceStatus(error: unknown): WorkspaceChangeEvent["workspaceStatus"] {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EACCES" || error.code === "EPERM")
  ) {
    return "permission-denied";
  }

  return "missing";
}
