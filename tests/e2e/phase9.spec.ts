import {
  _electron as electron,
  expect,
  type Locator,
  type Page,
  test
} from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const electronLaunchArgs = [
  ".",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-gpu-compositing",
  "--disable-accelerated-video-decode",
  "--disable-accelerated-video-encode",
  "--disable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE,VaapiVideoDecoder,VaapiVideoEncoder",
  "--ozone-platform=x11"
];

async function launchInkNest(userDataDir: string) {
  return electron.launch({
    args: electronLaunchArgs,
    env: {
      ...process.env,
      INKNEST_USER_DATA_DIR: userDataDir,
      ELECTRON_RUN_AS_NODE: undefined
    }
  });
}

async function openNote(
  window: Page,
  workspaceDir: string,
  title: string
) {
  await window.evaluate((workspacePath) => {
    return window.inknest.workspace.select(workspacePath);
  }, workspaceDir);
  await window.reload();
  await window
    .locator(".note-open-area")
    .filter({ hasText: title })
    .click();

  return window.getByRole("textbox", { name: "Visual Markdown editor" });
}

async function selectContents(locator: Locator) {
  await locator.evaluate((element) => {
    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
}

async function placeCaretAtEnd(locator: Locator) {
  await locator.evaluate((element) => {
    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
}

test("phase 9 toolbar formatting updates the editor and saved Markdown", async ({
}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  const notePath = path.join(workspaceDir, "toolbar.md");

  await mkdir(workspaceDir, { recursive: true });
  await writeFile(notePath, "Toolbar text\n", "utf8");

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    const editor = await openNote(window, workspaceDir, "toolbar");
    const paragraph = editor.locator("p").filter({ hasText: "Toolbar text" });

    await selectContents(paragraph);
    await window.getByRole("button", { name: "B", exact: true }).click();
    await expect(editor.locator("strong, b")).toHaveText("Toolbar text");
    await expect(window.getByRole("button", { name: "B", exact: true })).toHaveClass(
      /toolbar-button-active/
    );

    await window.getByRole("button", { name: "H3", exact: true }).click();
    await expect(editor.locator("h3")).toContainText("Toolbar text");

    await window.getByRole("button", { name: "Save", exact: true }).click();
    await expect(window.getByText(/Saved - Saved/).first()).toBeVisible();

    const savedMarkdown = await readFile(notePath, "utf8");
    expect(savedMarkdown).toBe("### **Toolbar text**\n");
  } finally {
    await app.close();
  }
});

test("phase 9 inserts and edits code blocks and tables", async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  const notePath = path.join(workspaceDir, "blocks.md");

  await mkdir(workspaceDir, { recursive: true });
  await writeFile(notePath, "Block tools\n", "utf8");

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    const editor = await openNote(window, workspaceDir, "blocks");

    await placeCaretAtEnd(editor);
    await window.getByRole("button", { name: "Code block", exact: true }).click();
    const codeBlock = editor.locator("pre");
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock.getByRole("button", { name: "Copy" })).toBeVisible();

    await codeBlock.locator("code").evaluate((code) => {
      code.textContent = "const value = 1;";
      code.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: "const value = 1;",
          inputType: "insertText"
        })
      );
    });
    await codeBlock.getByRole("combobox", { name: "Code block language" }).selectOption(
      "typescript"
    );
    await expect(codeBlock.locator(".syntax-keyword")).toHaveText("const");

    await placeCaretAtEnd(editor);
    await window.getByRole("button", { name: "Insert table", exact: true }).click();
    const table = editor.locator("table");
    await expect(table.locator("tr")).toHaveCount(2);
    await expect(table.locator("th")).toHaveCount(2);

    await placeCaretAtEnd(table.locator("td").first());
    await window.getByRole("button", { name: "Add table row", exact: true }).click();
    await expect(table.locator("tr")).toHaveCount(3);
    await window.getByRole("button", { name: "Add table column", exact: true }).click();
    await expect(table.locator("tr").first().locator("th, td")).toHaveCount(3);

    await window.getByRole("button", { name: "Save", exact: true }).click();
    await expect(window.getByText(/Saved - Saved/).first()).toBeVisible();
    const savedMarkdown = await readFile(notePath, "utf8");

    expect(savedMarkdown).toContain("```typescript\nconst value = 1;\n```");
    expect(savedMarkdown).toContain("| Column 1 | Column 2 |  |");
    expect(savedMarkdown).toContain("| --- | --- | --- |");
  } finally {
    await app.close();
  }
});

test("phase 9 slash commands and link popover produce editable Markdown", async ({
}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  const workspaceDir = testInfo.outputPath("workspace");
  const notePath = path.join(workspaceDir, "commands.md");

  await mkdir(workspaceDir, { recursive: true });
  await writeFile(notePath, "/todo\n", "utf8");

  const app = await launchInkNest(userDataDir);

  try {
    const window = await app.firstWindow();
    const editor = await openNote(window, workspaceDir, "commands");

    await placeCaretAtEnd(editor.locator("p"));
    await editor.press("Enter");
    await expect(editor.locator("li[data-task='true']")).toBeVisible();
    await expect(editor.locator("input[type='checkbox']")).not.toBeChecked();

    await placeCaretAtEnd(editor);
    await window.getByRole("button", { name: "Link", exact: true }).click();
    const linkPopover = window.locator(".link-popover");
    await linkPopover.getByLabel("Text", { exact: true }).fill("InkNest docs");
    await linkPopover
      .getByLabel("Link", { exact: true })
      .fill("https://example.com/docs");
    await window.getByRole("button", { name: "Apply", exact: true }).click();

    const link = editor.locator("a");
    await expect(link).toHaveText("InkNest docs");
    await expect(link).toHaveAttribute("href", "https://example.com/docs");

    await link.dblclick();
    await linkPopover.getByLabel("Text", { exact: true }).fill("Edited docs");
    await linkPopover
      .getByLabel("Link", { exact: true })
      .fill("https://example.com/edited");
    await window.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(link).toHaveText("Edited docs");
    await expect(link).toHaveAttribute("href", "https://example.com/edited");

    await window.getByRole("button", { name: "Save", exact: true }).click();
    await expect(window.getByText(/Saved - Saved/).first()).toBeVisible();
    const savedMarkdown = await readFile(notePath, "utf8");

    expect(savedMarkdown).toContain("- [ ] Task");
    expect(savedMarkdown).toContain("[Edited docs](https://example.com/edited)");
  } finally {
    await app.close();
  }
});
