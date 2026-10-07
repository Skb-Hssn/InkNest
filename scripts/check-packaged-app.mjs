import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const executablePath = process.env.INKNEST_PACKAGED_EXECUTABLE;
if (!executablePath) throw new Error("Set INKNEST_PACKAGED_EXECUTABLE to the extracted installer executable.");
const profile = await mkdtemp(path.join(os.tmpdir(), "inknest-package-check-"));
const errors = [];
let app;

async function launch() {
  app = await electron.launch({
    executablePath,
    // The extracted sandbox helper lacks installation-time ownership/permissions.
    args: ["--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: profile, ELECTRON_RUN_AS_NODE: undefined }
  });
  const window = await app.firstWindow();
  window.on("pageerror", error => errors.push(error.message));
  return window;
}

try {
  let window = await launch();
  const runtime = await app.evaluate(({ app }) => ({
    packaged: app.isPackaged, appPath: app.getAppPath(), userData: app.getPath("userData")
  }));
  expect(runtime.packaged).toBe(true);
  expect(runtime.appPath).toContain("app.asar");
  expect(runtime.userData).toBe(profile);
  await expect(window.getByRole("tab")).toHaveCount(3);
  let editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
  await expect(editor.locator(".katex")).toHaveCount(2);
  await expect(editor.locator("table")).toHaveCount(1);
  await window.getByRole("button", { name: "Create new note", exact: true }).click();
  await expect(editor).toHaveText("");
  await editor.click();
  await editor.pressSequentially("Packaged app installation smoke test.");
  const tabs = await window.getByRole("tab").allTextContents();
  await app.close();
  app = undefined;

  window = await launch();
  editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
  await expect(window.getByRole("tab")).toHaveText(tabs);
  await expect(editor).toHaveText("Packaged app installation smoke test.");
  const session = await window.evaluate(() => window.inknest.workspace.getSession());
  expect(session.ok).toBe(true);
  const settings = JSON.parse(await readFile(path.join(profile, "settings.json"), "utf8"));
  const savedNote = path.join(settings.lastWorkspacePath, session.data.activeNotePath);
  expect(await readFile(savedNote, "utf8")).toContain("Packaged app installation smoke test.");
  expect(errors).toEqual([]);
  console.log("Packaged app launch, rendering, saving, and session restoration passed.");
} finally {
  try { if (app) await app.close(); }
  finally { await rm(profile, { recursive: true, force: true }); }
}
