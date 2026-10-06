import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { after } from "node:test";
import ts from "typescript";

const root = await mkdtemp(path.join(fileURLToPath(new URL("../node_modules/", import.meta.url)), ".session-tests-"));
const source = await readFile(new URL("../src/main/services/workspace-session-store.ts", import.meta.url), "utf8");
const module = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('import { app } from "electron";', `const app = { getPath: () => ${JSON.stringify(root)} };`);
await writeFile(path.join(root, "sessions.mjs"), module);
const { isSessionNotePath, normalizeWorkspaceSession, readWorkspaceSession, writeWorkspaceSession } = await import(pathToFileURL(path.join(root, "sessions.mjs")));
after(() => rm(root, { recursive: true, force: true }));

for (const invalid of [null, [], "text", {}, { openNotePaths: "a.md" }]) {
  test(`invalid session falls back safely: ${JSON.stringify(invalid)}`, () => assert.equal(normalizeWorkspaceSession(invalid), null));
}
test("session preserves tab order, removes duplicates and retains the active tab", () => {
  assert.deepEqual(normalizeWorkspaceSession({ openNotePaths: ["B.md", "Folder/A.md", "B.md"], activeNotePath: "Folder/A.md" }),
    { openNotePaths: ["B.md", "Folder/A.md"], activeNotePath: "Folder/A.md" });
});
test("an explicitly closed session stays empty instead of falling back to sample tabs", () => {
  assert.deepEqual(normalizeWorkspaceSession({ openNotePaths: [], activeNotePath: null }), { openNotePaths: [], activeNotePath: null });
});
test("unsafe saved paths are removed and an unavailable active tab falls back", () => {
  assert.deepEqual(normalizeWorkspaceSession({ openNotePaths: ["../Outside.md", "/private.md", "Good.md", 42], activeNotePath: "../Outside.md" }),
    { openNotePaths: ["Good.md"], activeNotePath: "Good.md" });
});
for (const value of ["/outside.md", "C:\\outside.md", "\\\\server\\outside.md", "../outside.md", "Folder/../../outside.md", "Folder\\..\\outside.md", "nul\0.md", "not-a-note.html"]) {
  test(`reject unsafe or non-note session path: ${JSON.stringify(value)}`, () => assert.equal(isSessionNotePath(value), false));
}
test("nested, spaced and Unicode note names remain valid", () => {
  for (const value of ["Notes/Ideas worth keeping.md", "বাংলা.md", "note.MD"]) assert.equal(isSessionNotePath(value), true);
});
test("queued session writes preserve other workspaces and the latest tab state", async () => {
  const a = path.join(root, "Workspace A"), b = path.join(root, "Workspace B");
  const first = { openNotePaths: ["One.md"], activeNotePath: "One.md" };
  const last = { openNotePaths: ["Two.md", "One.md"], activeNotePath: "Two.md" };
  await Promise.all([writeWorkspaceSession(a, first), writeWorkspaceSession(b, first), writeWorkspaceSession(a, last)]);
  assert.deepEqual(await readWorkspaceSession(a), last);
  assert.deepEqual(await readWorkspaceSession(b), first);
  assert.ok(JSON.parse(await readFile(path.join(root, "workspace-sessions.json"), "utf8")));
  assert.equal((await readdir(root)).filter((name) => name.endsWith(".tmp")).length, 0);
});
test("corrupt session storage can recover on the next valid save", async () => {
  await writeFile(path.join(root, "workspace-sessions.json"), "{broken");
  assert.equal(await readWorkspaceSession(root), null);
  const empty = { openNotePaths: [], activeNotePath: null };
  await writeWorkspaceSession(root, empty);
  assert.deepEqual(await readWorkspaceSession(root), empty);
});
