import { _electron as electron, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "./fixtures";

test("C++ is colored in both themes, survives editing/reopening, and language changes clear or update colors", async ({}, info) => {
  const root = info.outputPath("workspace");
  await mkdir(root, { recursive: true });
  const file = path.join(root, "Colors.md");
  const source = '#include<bits/stdc++.h>\nusing namespace std;\nint main() { cout << "বাংলা 😀"; return 42; }\n// comment';
  await writeFile(file, `\`\`\`cpp\n${source}\n\`\`\`\n`);
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  const errors: string[] = [];
  try {
    const window = await app.firstWindow();
    window.on("pageerror", error => errors.push(error.message));
    await window.evaluate(root => window.inknest.workspace.select(root), root);
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Colors" }).click();
    const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
    const code = editor.locator("pre code");
    const trigger = editor.getByRole("combobox", { name: "Code block language" });
    for (const theme of ["light", "dark"] as const) {
      await window.evaluate(theme => window.inknest.settings.save({ theme }), theme);
      await window.reload();
      await expect(code).toHaveText(source);
      await expect(code.locator(".syntax-keyword").filter({ hasText: "namespace" })).toBeVisible();
      await expect(code.locator(".syntax-function")).toHaveText("main");
      await expect(code.locator(".syntax-number")).toHaveText("42");
      const colors = await code.evaluate(element => [".syntax-keyword", ".syntax-string", ".syntax-number", ".syntax-function", ".syntax-comment"]
        .map(selector => getComputedStyle(element.querySelector(selector)!).color));
      expect(new Set(colors).size).toBe(5);
      await window.screenshot({ path: info.outputPath(`cpp-${theme}.png`) });
    }
    await code.evaluate(element => {
      (element.closest('[contenteditable="true"]') as HTMLElement).focus();
      const range = document.createRange(); range.selectNodeContents(element); range.collapse(false);
      const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
    await editor.pressSequentially(" updated");
    await expect.poll(() => readFile(file, "utf8")).toContain("// comment updated");
    await window.getByRole("button", { name: "Close Colors tab" }).click();
    await window.locator(".note-open-area").filter({ hasText: "Colors" }).click();
    await expect(code.locator(".syntax-comment")).toHaveText("// comment updated");
    await trigger.click();
    await window.getByRole("searchbox", { name: "Search code languages" }).fill("plain");
    await window.getByRole("option", { name: "Plain text", exact: true }).click();
    await expect(code.locator('[class*="syntax-"]')).toHaveCount(0);
    await expect(code).toHaveText(`${source} updated`);
    await trigger.click();
    await window.getByRole("searchbox", { name: "Search code languages" }).fill("cpp");
    await window.getByRole("option", { name: "C++", exact: true }).click();
    await expect(code.locator(".syntax-function")).toHaveText("main");
    await expect.poll(() => readFile(file, "utf8")).toContain("```cpp");
    expect(errors).toEqual([]);
  } finally { await app.close(); }
});

test("markup code is highlighted as literal text and never executed", async ({}, info) => {
  const root = info.outputPath("workspace");
  await mkdir(root, { recursive: true });
  const source = '<script>window.highlightExecuted = true;</script>\n<img src="invalid" onerror="window.highlightExecuted=true">';
  await writeFile(path.join(root, "HTML.md"), `\`\`\`html\n${source}\n\`\`\`\n`);
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  try {
    const window = await app.firstWindow();
    await window.evaluate(root => window.inknest.workspace.select(root), root);
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "HTML" }).click();
    const code = window.locator(".inknest-editor pre code");
    await expect(code).toHaveText(source);
    await expect(code.locator(".syntax-tag")).not.toHaveCount(0);
    await expect(code.locator("script, img")).toHaveCount(0);
    expect(await window.evaluate(() => Reflect.get(window, "highlightExecuted"))).toBeUndefined();
  } finally { await app.close(); }
});
