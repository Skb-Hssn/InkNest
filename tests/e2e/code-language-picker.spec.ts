import { _electron as electron, expect, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "./fixtures";

async function launch(info: TestInfo, language = "javascript") {
  const root = info.outputPath("workspace");
  await mkdir(root, { recursive: true });
  const file = path.join(root, "Code.md");
  await writeFile(file, `\`\`\`${language}\nconst value = 1;\n\`\`\`\n`);
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  const window = await app.firstWindow();
  await window.evaluate(root => window.inknest.workspace.select(root), root);
  await window.reload();
  await window.locator(".note-open-area").filter({ hasText: "Code" }).click();
  const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
  const trigger = editor.getByRole("combobox", { name: "Code block language" });
  await expect(trigger).toBeVisible();
  return { app, window, editor, trigger, file };
}

test("searchable languages have a fixed scrolling height and save/reopen selected and plain-text fences", async ({}, info) => {
  const { app, window, editor, trigger, file } = await launch(info);
  try {
    await trigger.click();
    const search = window.getByRole("searchbox", { name: "Search code languages" });
    const list = window.getByRole("listbox", { name: "Code languages" });
    const popup = window.locator(".code-language-picker");
    await expect(search).toBeFocused();
    await expect(list.getByRole("option")).toHaveCount(46);
    await expect(popup).toHaveCSS("height", "300px");
    expect(await list.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    for (const [query, label] of [["GOLANG", "Go"], ["c++", "C++"], ["c sharp", "C#"], ["yml", "YAML"]]) {
      await search.fill(query);
      await expect(list.getByRole("option", { name: label, exact: true })).toBeVisible();
      await expect(popup).toHaveCSS("height", "300px");
    }
    await search.fill("no-such-language");
    await expect(window.getByText("No matching languages", { exact: true })).toBeVisible();
    await search.press("Enter"); await expect(popup).toBeVisible();
    await search.fill("rust"); await search.press("Enter");
    await expect(popup).toHaveCount(0);
    await expect(trigger).toHaveAttribute("data-language", "rust");
    await expect(editor.locator("pre code")).toHaveText("const value = 1;");
    await expect.poll(() => readFile(file, "utf8")).toContain("```rust");
    await window.getByRole("button", { name: "Close Code tab" }).click();
    await window.locator(".note-open-area").filter({ hasText: "Code" }).click();
    await expect(trigger).toHaveAttribute("data-language", "rust");
    await trigger.click(); await search.fill("plain");
    await list.getByRole("option", { name: "Plain text", exact: true }).click();
    await expect(trigger).toHaveAttribute("data-language", "");
    await expect.poll(() => readFile(file, "utf8")).toMatch(/```\nconst value = 1;/);
  } finally { await app.close(); }
});

test("picker supports keyboard selection and cancellation and preserves custom language labels", async ({}, info) => {
  const { app, window, trigger, file } = await launch(info, "custom-lang");
  try {
    await expect(trigger).toHaveText("custom-lang");
    await trigger.focus(); await trigger.press("ArrowDown");
    const search = window.getByRole("searchbox", { name: "Search code languages" });
    const list = window.getByRole("listbox", { name: "Code languages" });
    await search.fill("custom");
    await expect(list.getByRole("option")).toHaveText("custom-lang");
    await search.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("data-language", "custom-lang");
    await trigger.click(); await search.fill("java");
    await search.press("ArrowDown"); await search.press("Enter");
    await expect(trigger).toHaveAttribute("data-language", "java");
    await expect.poll(() => readFile(file, "utf8")).toContain("```java");
    await trigger.click();
    await window.getByRole("searchbox", { name: "Search notes" }).click();
    await expect(window.locator(".code-language-picker")).toHaveCount(0);
    await window.getByRole("button", { name: "Lock note", exact: true }).click();
    await expect(window.getByRole("button", { name: "Unlock note", exact: true })).toBeEnabled();
    await expect(trigger).toBeDisabled();
    await window.getByRole("button", { name: "Unlock note", exact: true }).click();
    await expect(trigger).toBeEnabled();
    await trigger.click();
    await expect(search).toBeVisible();
    await window.getByRole("button", { name: "Close Code tab" }).click();
    await expect(window.locator(".code-language-picker")).toHaveCount(0);
  } finally { await app.close(); }
});

test("language picker is contained in a small window and works in the dark theme", async ({}, info) => {
  const { app, window, trigger } = await launch(info);
  try {
    await window.evaluate(() => window.inknest.settings.save({ theme: "dark" }));
    await window.reload();
    await expect(trigger).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ width: 900, height: 600 }));
    await trigger.click();
    await expect(window.getByRole("searchbox", { name: "Search code languages" })).toBeVisible();
    const bounds = (await window.locator(".code-language-picker").boundingBox())!;
    const viewport = await window.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(bounds.x).toBeGreaterThanOrEqual(8); expect(bounds.y).toBeGreaterThanOrEqual(8);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 8);
    await window.screenshot({ path: info.outputPath("code-language-picker-dark.png") });
  } finally { await app.close(); }
});
