import { _electron as electron, expect, test, type Locator, type TestInfo } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const tableMarkdown = "Before table.\n\n| H1 | H2 | H3 |\n| :--- | :---: | ---: |\n| A1 | A2 | A3 |\n| B1 | B2 | B3 |\n\nAfter table.\n";

let pageErrors: string[] = [];

test.beforeEach(async ({}, testInfo) => {
  pageErrors = [];
  await mkdir(testInfo.outputPath("workspace"), { recursive: true });
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

async function launchTable(testInfo: TestInfo, markdown = tableMarkdown) {
  const workspace = testInfo.outputPath("workspace");
  const notePath = path.join(workspace, "Table.md");
  await writeFile(notePath, markdown);
  const app = await electron.launch({
    args: [".", "--no-sandbox", "--disable-gpu", "--disable-gpu-compositing", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: testInfo.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined }
  });
  const window = await app.firstWindow();
  window.on("pageerror", (error) => pageErrors.push(error.message));
  await window.evaluate((workspacePath) => window.inknest.workspace.select(workspacePath), workspace);
  await window.reload();
  await window.locator(".note-open-area").filter({ hasText: "Table" }).click();
  const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
  await expect(editor.locator("table")).toBeVisible();
  return { app, window, editor, notePath };
}

async function cellMenu(cell: Locator, label: string) {
  await cell.hover();
  const window = cell.page();
  await window.getByRole("button", { name: "Table cell actions", exact: true }).click();
  await window.getByRole("menuitem", { name: label, exact: true }).click();
}

for (const [name, markdown, row, column, action, expectedRows, expectedColumns] of [
  ["delete header", tableMarkdown, 0, 0, "Delete row", 2, 3],
  ["delete final column", "| H |\n| --- |\n| A |\n", 1, 0, "Delete column", 0, 0],
  ["delete whole table", tableMarkdown, 1, 1, "Delete table", 0, 0]
] as const) {
  test(name, async ({}, testInfo) => {
    const { app, window, editor, notePath } = await launchTable(testInfo, markdown);
    try {
      await cellMenu(editor.locator("tr").nth(row).locator("th, td").nth(column), action);
      await expect(editor.locator("tr")).toHaveCount(expectedRows);
      if (expectedRows) {
        await expect(editor.locator("tr").first().locator("th")).toHaveCount(expectedColumns);
        await expect(editor.locator("tr").first()).toContainText("A1");
      }
      await expect.poll(() => readFile(notePath, "utf8")).not.toContain(expectedRows ? "H1" : "| H");
      await window.reload();
      await window.locator(".note-open-area").filter({ hasText: "Table" }).click();
      await expect(editor.locator("tr")).toHaveCount(expectedRows);
    } finally {
      await app.close();
    }
  });
}

const headerOnly = "| H1 | H2 | H3 |\n| :--- | :---: | ---: |\n";
const menuCases = [
  ["add row before header", tableMarkdown, 0, 1, "Add row before", 4, 3],
  ["add row after header", tableMarkdown, 0, 1, "Add row after", 4, 3],
  ["add row before body", tableMarkdown, 1, 1, "Add row before", 4, 3],
  ["add row after last body", tableMarkdown, 2, 1, "Add row after", 4, 3],
  ["delete middle body row", tableMarkdown, 1, 1, "Delete row", 2, 3],
  ["delete last body row", tableMarkdown, 2, 1, "Delete row", 2, 3],
  ["delete only body row", "| H1 | H2 |\n| --- | --- |\n| A1 | A2 |\n", 1, 0, "Delete row", 1, 2],
  ["delete only header row", headerOnly, 0, 1, "Delete row", 0, 0],
  ["add column before first", tableMarkdown, 0, 0, "Add column before", 3, 4],
  ["add column after middle", tableMarkdown, 1, 1, "Add column after", 3, 4],
  ["add column after last", tableMarkdown, 2, 2, "Add column after", 3, 4],
  ["delete first column", tableMarkdown, 0, 0, "Delete column", 3, 2],
  ["delete middle column", tableMarkdown, 1, 1, "Delete column", 3, 2],
  ["delete last column", tableMarkdown, 2, 2, "Delete column", 3, 2],
  ["add column to header-only table", headerOnly, 0, 2, "Add column after", 1, 4],
  ["add row to header-only table", headerOnly, 0, 0, "Add row after", 2, 3]
] as const;

async function tableSnapshot(editor: Locator) {
  return editor.locator("table").evaluateAll((tables) => tables.map((table) =>
    Array.from(table.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("th, td")).map((cell) => ({
        header: cell.tagName === "TH", text: cell.textContent, align: (cell as HTMLElement).style.textAlign
      }))
    )
  ));
}

for (const [name, markdown, row, column, action, expectedRows, expectedColumns] of menuCases) {
  test(name, async ({}, testInfo) => {
    const { app, window, editor, notePath } = await launchTable(testInfo, markdown);
    try {
      const before = await tableSnapshot(editor);
      await cellMenu(editor.locator("tr").nth(row).locator("th, td").nth(column), action);
      await expect(editor.locator("tr")).toHaveCount(expectedRows);
      if (expectedRows) {
        await expect(editor.locator("tr").first().locator("th")).toHaveCount(expectedColumns);
        for (const bodyRow of await editor.locator("tr").all()) await expect(bodyRow.locator("th, td")).toHaveCount(expectedColumns);
      }
      const after = await tableSnapshot(editor);
      await editor.press("Control+z");
      await expect.poll(() => tableSnapshot(editor)).toEqual(before);
      await editor.press("Control+Shift+z");
      await expect.poll(() => tableSnapshot(editor)).toEqual(after);
      await expect.poll(() => readFile(notePath, "utf8")).not.toBe(markdown);
      await window.reload();
      await window.locator(".note-open-area").filter({ hasText: "Table" }).click();
      await expect.poll(() => tableSnapshot(editor)).toEqual(after);
    } finally {
      await app.close();
    }
  });
}

for (const [action, row, column, rows, columns] of [
  ["Add table row", 0, 1, 4, 3],
  ["Add table column", 2, 2, 3, 4],
  ["Delete table row", 0, 1, 2, 3],
  ["Delete table column", 2, 2, 3, 2],
  ["Delete table", 1, 1, 0, 0]
] as const) {
  test(`toolbar: ${action}`, async ({}, testInfo) => {
    const { app, window, editor } = await launchTable(testInfo);
    try {
      await editor.locator("tr").nth(row).locator("th, td").nth(column).click();
      await window.getByRole("button", { name: action, exact: true }).click();
      await expect(editor.locator("tr")).toHaveCount(rows);
      if (rows) await expect(editor.locator("tr").first().locator("th")).toHaveCount(columns);
      await expect(editor.locator("p").filter({ hasText: "Before table." })).toBeVisible();
      await expect(editor.locator("p").filter({ hasText: "After table." })).toBeVisible();
    } finally {
      await app.close();
    }
  });
}

test("cell menu keeps its target while crossing cells and typing before the table", async ({}, testInfo) => {
  const { app, window, editor } = await launchTable(testInfo);
  try {
    const before = editor.locator("p").filter({ hasText: "Before table." });
    await before.click();
    await editor.press("Home");
    await editor.locator("td").last().hover();
    await window.getByRole("button", { name: "Table cell actions", exact: true }).click();
    await editor.locator("th").first().hover();
    await editor.pressSequentially("Extra text. ");
    await window.getByRole("menuitem", { name: "Delete column", exact: true }).click();
    await expect(editor.locator("th")).toHaveText(["H1", "H2"]);
    await expect(before).toContainText("Extra text.");
  } finally {
    await app.close();
  }
});

test("Tab, Shift+Tab, typing, clearing a cell, and exiting a table remain usable", async ({}, testInfo) => {
  const { app, window, editor } = await launchTable(testInfo);
  try {
    await editor.locator("th").first().click();
    await editor.press("Tab");
    await editor.press("End");
    await editor.pressSequentially(" edited");
    await expect(editor.locator("th").nth(1)).toHaveText("H2 edited");
    await editor.press("Shift+Tab");
    await editor.press("End");
    await editor.pressSequentially(" previous");
    await expect(editor.locator("th").first()).toHaveText("H1 previous");
    await editor.locator("td").last().click();
    await editor.press("Tab");
    await expect(editor.locator("tr")).toHaveCount(4);
    await editor.pressSequentially("New last row");
    await expect(editor.locator("tr").last().locator("td").first()).toHaveText("New last row");
    await editor.press("Home");
    await editor.press("Shift+End");
    await editor.press("Delete");
    await expect(editor.locator("tr").last().locator("td").first()).toHaveText("");
    await editor.press("Control+Enter");
    await editor.pressSequentially("Outside table");
    await expect(editor.locator("p").filter({ hasText: "Outside table" })).toBeVisible();
    await expect(editor.locator("table")).not.toContainText("Outside table");
    await expect(window.getByRole("button", { name: "Delete table", exact: true })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("deleting a table-only note leaves an editable paragraph", async ({}, testInfo) => {
  const { app, window, editor, notePath } = await launchTable(testInfo, "| H |\n| --- |\n| A |\n");
  try {
    await cellMenu(editor.locator("td").first(), "Delete column");
    await expect(editor.locator("table")).toHaveCount(0);
    await editor.pressSequentially("Still editable");
    await expect(editor).toContainText("Still editable");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("Still editable");
  } finally {
    await app.close();
  }
});

test("inserting tables with the toolbar and slash command, and commands outside tables", async ({}, testInfo) => {
  const { app, window, editor } = await launchTable(testInfo);
  try {
    const before = await tableSnapshot(editor);
    await editor.locator("p").filter({ hasText: "Before table." }).click();
    for (const name of ["Delete table", "Delete table row", "Delete table column", "Add table row", "Add table column"]) {
      await window.getByRole("button", { name, exact: true }).click();
      expect(await tableSnapshot(editor)).toEqual(before);
    }
    await editor.locator("p").filter({ hasText: "After table." }).click();
    await editor.press("End");
    await editor.press("Enter");
    await window.getByRole("button", { name: "Insert table", exact: true }).click();
    await expect(editor.locator("table")).toHaveCount(2);
    await expect(editor.locator("table").last().locator("tr")).toHaveCount(2);
    await expect(editor.locator("table").last().locator("th")).toHaveCount(2);
    await editor.locator("table").last().locator("td").first().click();
    await editor.press("Control+Enter");
    await editor.pressSequentially("/table");
    await editor.press("Enter");
    await expect(editor.locator("table")).toHaveCount(3);
    await expect(editor.locator("table").last().locator("tr")).toHaveCount(2);
    await expect(editor.locator("table").last().locator("th")).toHaveCount(2);
  } finally {
    await app.close();
  }
});

test("saving empty or whitespace-only notes succeeds and invalid content is rejected", async ({}, testInfo) => {
  const { app, window, notePath } = await launchTable(testInfo);
  try {
    for (const markdown of ["", " \n\t"]) {
      const result = await window.evaluate((text) => window.inknest.notes.save({ path: "Table.md", markdown: text }), markdown);
      expect(result.ok).toBe(true);
      expect(await readFile(notePath, "utf8")).toBe(markdown);
    }
    const result = await window.evaluate(() => window.inknest.notes.save({ path: "Table.md", markdown: 42 as unknown as string }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_PAYLOAD");
  } finally {
    await app.close();
  }
});

test("Backspace selects the table at its start and Delete removes it with undo", async ({}, testInfo) => {
  const { app, editor } = await launchTable(testInfo);
  try {
    const before = await tableSnapshot(editor);
    await editor.locator("th").first().click();
    await editor.press("Home");
    await editor.press("Backspace");
    await expect(editor.locator("table")).toHaveCount(1);
    await editor.press("Delete");
    await expect(editor.locator("table")).toHaveCount(0);
    await editor.press("Control+z");
    await expect.poll(() => tableSnapshot(editor)).toEqual(before);
  } finally {
    await app.close();
  }
});

test("structural editing preserves rich cell content through saving and reopening", async ({}, testInfo) => {
  const markdown = "| **Header** | Other |\n| :---: | ---: |\n| [Link](https://example.com) and `code` | Delete me |\n";
  const { app, window, editor, notePath } = await launchTable(testInfo, markdown);
  try {
    await cellMenu(editor.locator("th").first(), "Add row before");
    await cellMenu(editor.locator("th").last(), "Delete column");
    await expect(editor.locator("strong")).toHaveText("Header");
    await expect(editor.locator("a")).toHaveAttribute("href", "https://example.com");
    await expect(editor.locator("code")).toHaveText("code");
    await expect.poll(() => readFile(notePath, "utf8")).not.toContain("Delete me");
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Table" }).click();
    await expect(editor.locator("strong")).toHaveText("Header");
    await expect(editor.locator("a")).toHaveAttribute("href", "https://example.com");
    await expect(editor.locator("code")).toHaveText("code");
    await expect(editor.locator("tr")).toHaveCount(3);
  } finally {
    await app.close();
  }
});

test("cell actions remain usable at the bottom of a long table", async ({}, testInfo) => {
  const markdown = `| H1 | H2 |\n| --- | --- |\n${Array.from({ length: 40 }, (_, row) => `| Row ${row} | Value ${row} |`).join("\n")}\n`;
  const { app, editor } = await launchTable(testInfo, markdown);
  try {
    await cellMenu(editor.locator("td").last(), "Delete column");
    await expect(editor.locator("tr")).toHaveCount(41);
    await expect(editor.locator("th")).toHaveText(["H1"]);
    await expect(editor.locator("td").last()).toHaveText("Row 39");
  } finally {
    await app.close();
  }
});
