import { _electron as electron, expect, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "./fixtures";

const body = "# Alpha\n\nAlpha text.\n\n- [ ] Task\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```javascript\nconst value = 1;\n```\n\n$\\sqrt{x}$\n";
async function launch(info: TestInfo) {
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  const window = await app.firstWindow();
  return { app, window };
}
async function setup(info: TestInfo) {
  const root = info.outputPath("workspace");
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "Alpha.md"), body);
  await writeFile(path.join(root, "Beta.md"), "# Beta\n\nAnother note.\n");
  const result = await launch(info);
  await result.window.evaluate(root => window.inknest.workspace.select(root), root);
  await result.window.reload();
  await result.window.locator(".note-open-area").filter({ hasText: "Alpha" }).click();
  const editor = result.window.getByRole("textbox", { name: "Visual Markdown editor" });
  await expect(editor).toHaveAttribute("contenteditable", "true");
  return { ...result, editor, root };
}

test("lock saves pending edits and blocks typing, shortcuts, paste, block controls and replace", async ({}, info) => {
  const { app, window, editor, root } = await setup(info);
  const errors: string[] = [];
  window.on("pageerror", error => errors.push(error.message));
  try {
    await window.evaluate(() => window.inknest.settings.save({ autoSaveDelayMs: 5000 }));
    await editor.click(); await editor.press("Control+End"); await editor.press("Enter");
    await editor.pressSequentially("Pending changes.");
    await window.getByRole("button", { name: "Lock note", exact: true }).click();
    await expect(window.getByRole("button", { name: "Unlock note", exact: true })).toBeEnabled();
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await expect(editor).toHaveAttribute("aria-readonly", "true");
    const saved = await readFile(path.join(root, "Alpha.md"), "utf8");
    expect(saved).toContain("Pending changes.");
    const text = await editor.innerText();
    await expect(window.getByRole("button", { name: "B", exact: true })).toBeDisabled();
    await expect(editor.getByRole("checkbox", { name: "Toggle task" })).toBeDisabled();
    await expect(editor.getByRole("combobox", { name: "Code block language" })).toBeDisabled();
    await editor.focus();
    await editor.pressSequentially("Must not be inserted.");
    for (const shortcut of ["Control+b", "Control+z", "Control+Shift+z", "Backspace", "Delete", "Enter", "Control+x"])
      await editor.press(shortcut);
    await app.evaluate(({ clipboard }) => clipboard.writeText("Must not be pasted."));
    await editor.press("Control+v");
    expect(await editor.innerText()).toBe(text);
    await editor.locator(".inknest-math-preview").click();
    await expect(editor.locator('[data-editing="true"]')).toHaveCount(0);
    await editor.press("Control+h");
    const find = window.getByRole("region", { name: "Find in note", exact: true });
    await find.getByRole("textbox", { name: "Find in note", exact: true }).fill("Alpha");
    await find.getByRole("textbox", { name: "Replace with", exact: true }).fill("Changed");
    await expect(editor.locator(".note-search-match")).not.toHaveCount(0);
    await expect(find.getByRole("button", { name: "Replace", exact: true })).toBeDisabled();
    await expect(find.getByRole("button", { name: "Replace all", exact: true })).toBeDisabled();
    await find.getByRole("textbox", { name: "Replace with", exact: true }).press("Enter");
    await find.getByRole("button", { name: "Close find", exact: true }).click();
    expect(await readFile(path.join(root, "Alpha.md"), "utf8")).toBe(saved);
    await window.getByRole("button", { name: "Unlock note", exact: true }).click();
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor.getByRole("checkbox", { name: "Toggle task" })).toBeEnabled();
    await editor.click(); await editor.press("Control+End"); await editor.pressSequentially(" Editing restored.");
    await expect(editor).toContainText("Editing restored.");
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});

test("note locks persist across tabs and restart while other notes stay editable", async ({}, info) => {
  let { app, window, editor } = await setup(info);
  try {
    await window.getByRole("button", { name: "Lock note", exact: true }).click();
    await expect(window.getByRole("button", { name: "Unlock note", exact: true })).toBeEnabled();
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await window.locator(".note-open-area").filter({ hasText: "Beta" }).click();
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await window.getByRole("tab", { name: "Alpha", exact: true }).click();
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await app.close();
    ({ app, window } = await launch(info));
    editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await window.getByRole("button", { name: "Unlock note", exact: true }).click();
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await app.close();
    ({ app, window } = await launch(info));
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toHaveAttribute("contenteditable", "true");
  } finally { await app.close(); }
});

test("locked notes reflect external edits and locks do not leak to another workspace", async ({}, info) => {
  const { app, window, editor, root } = await setup(info);
  try {
    await window.getByRole("button", { name: "Lock note", exact: true }).click();
    await expect(window.getByRole("button", { name: "Unlock note", exact: true })).toBeEnabled();
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await writeFile(path.join(root, "Alpha.md"), "# Alpha\n\nUpdated outside InkNest.\n");
    await expect(editor).toContainText("Updated outside InkNest.");
    await expect(editor).toHaveAttribute("contenteditable", "false");
    const other = info.outputPath("other-workspace");
    await mkdir(other, { recursive: true });
    await writeFile(path.join(other, "Alpha.md"), "# Alpha\n\nDifferent workspace.\n");
    await window.evaluate(root => window.inknest.workspace.select(root), other);
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Alpha" }).click();
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor).toContainText("Different workspace.");
  } finally { await app.close(); }
});

test("locking refuses unresolved unsaved changes instead of losing edits", async ({}, info) => {
  const { app, window, editor, root } = await setup(info);
  try {
    await window.evaluate(() => window.inknest.settings.save({ autoSaveDelayMs: 5000 }));
    await editor.click(); await editor.press("Control+End"); await editor.press("Enter");
    await editor.pressSequentially("Keep this unsaved edit.");
    await writeFile(path.join(root, "Alpha.md"), "# Alpha\n\nCompeting edit.\n");
    await expect(window.getByRole("alert")).toContainText("changed outside InkNest");
    await window.getByRole("button", { name: "Lock note", exact: true }).click();
    await expect(window.getByRole("button", { name: "Lock note", exact: true })).toBeEnabled();
    await expect(window.getByRole("button", { name: "Unlock note", exact: true })).toHaveCount(0);
    await expect(editor).toHaveAttribute("contenteditable", "true");
    await expect(editor).toContainText("Keep this unsaved edit.");
    await window.getByRole("alert").getByRole("button", { name: "Reload from disk" }).click();
    await expect(editor).toContainText("Competing edit.");
  } finally { await app.close(); }
});

test("renaming a locked note keeps its lock and the old name becomes editable", async ({}, info) => {
  const { app, window, editor, root } = await setup(info);
  try {
    await window.getByRole("button", { name: "Lock note", exact: true }).click();
    await expect(window.getByRole("button", { name: "Unlock note", exact: true })).toBeEnabled();
    const row = window.locator(".note-row").filter({ hasText: "Alpha" });
    await row.hover();
    await row.getByRole("button", { name: "Note actions" }).click();
    await row.getByRole("menuitem", { name: "Rename", exact: true }).click();
    const name = window.getByRole("textbox", { name: "File name" });
    await name.fill("Renamed"); await name.press("Enter");
    await expect(window.getByRole("tab", { name: "Renamed", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(window.getByRole("button", { name: "Unlock note", exact: true })).toBeEnabled();
    await expect(editor).toHaveAttribute("contenteditable", "false");
    await writeFile(path.join(root, "Alpha.md"), "# New Alpha\n\nNew file.\n");
    await expect(window.locator(".note-open-area").filter({ hasText: "Alpha" })).toBeVisible();
    await window.locator(".note-open-area").filter({ hasText: "Alpha" }).click();
    await expect(editor).toHaveAttribute("contenteditable", "true");
  } finally { await app.close(); }
});
