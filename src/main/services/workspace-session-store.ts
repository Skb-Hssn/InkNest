import { app } from "electron";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { WorkspaceSession } from "../../shared/ipc";

const getSessionFile = () => path.join(app.getPath("userData"), "workspace-sessions.json");
let saveQueue: Promise<unknown> = Promise.resolve();

export function isSessionNotePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !value.includes("\0") &&
    !path.posix.isAbsolute(value) && !path.win32.isAbsolute(value) &&
    !value.split(/[\\/]/).includes("..") && /\.md$/i.test(value);
}

export function normalizeWorkspaceSession(value: unknown): WorkspaceSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<WorkspaceSession>;
  if (!Array.isArray(candidate.openNotePaths)) return null;
  const openNotePaths = [...new Set(candidate.openNotePaths.filter(isSessionNotePath))];
  const activeNotePath = typeof candidate.activeNotePath === "string" && openNotePaths.includes(candidate.activeNotePath)
    ? candidate.activeNotePath : openNotePaths[0] ?? null;
  return { openNotePaths, activeNotePath };
}

async function readSessions(): Promise<Record<string, unknown>> {
  try {
    const sessions: unknown = JSON.parse(await readFile(getSessionFile(), "utf8"));
    return sessions && typeof sessions === "object" && !Array.isArray(sessions) ? sessions as Record<string, unknown> : {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return {};
    throw error;
  }
}

export async function readWorkspaceSession(workspacePath: string) {
  return normalizeWorkspaceSession((await readSessions())[path.resolve(workspacePath)]);
}

export function writeWorkspaceSession(workspacePath: string, session: WorkspaceSession) {
  const save = saveQueue.then(async () => {
    const sessions = await readSessions();
    const file = getSessionFile();
    const temporary = `${file}.${randomUUID()}.tmp`;
    await mkdir(path.dirname(file), { recursive: true });
    try {
      await writeFile(temporary, `${JSON.stringify({ ...sessions, [path.resolve(workspacePath)]: session }, null, 2)}\n`, "utf8");
      await rename(temporary, file);
    } finally { await rm(temporary, { force: true }); }
    return session;
  });
  saveQueue = save.then(() => undefined, () => undefined);
  return save;
}
