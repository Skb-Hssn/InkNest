import { _electron as electron, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "./fixtures";

test("name filtering includes empty and nested matching folders without unrelated parents or contents", async ({}, info) => {
  const root = info.outputPath("workspace");
  for (const folder of ["Parent/Target Folder/Nested", "Parent/TargetEmpty", "Parent/Other Branch", "Unrelated"])
    await mkdir(path.join(root, folder), { recursive: true });
  await writeFile(path.join(root, "Target.md"), "# Different heading\n\nsecret-only content.\n");
  await writeFile(path.join(root, "Parent/Other Branch/Target Note.md"), "# Different heading\n\nsecret-only content.\n");
  await writeFile(path.join(root, "Parent/Target Folder/Hidden.md"), "# Target\n\nsecret-only content.\n");
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  try {
    const window = await app.firstWindow();
    await window.evaluate(root => window.inknest.workspace.select(root), root);
    await window.reload();
    const search = window.getByRole("searchbox", { name: "Search notes" });
    await search.fill(" TARGET ");
    await expect(window.locator(".tree-open-area span[title]")).toHaveText(["Target Folder", "TargetEmpty"]);
    await expect(window.locator(".note-open-area span[title]")).toHaveText(["Target", "Target Note"]);
    await expect(window.locator(".sidebar-section-heading .section-count")).toHaveText("4");
    await expect(window.locator(".tree-row-root")).toHaveCount(0);
    await expect(window.locator(".note-open-area").filter({ hasText: "Hidden" })).toHaveCount(0);
    await search.fill("secret-only");
    await expect(window.locator(".tree-row, .note-row")).toHaveCount(0);
    await expect(window.getByRole("heading", { name: "No matching files or folders" })).toBeVisible();
    await search.fill("parent");
    await expect(window.locator(".tree-open-area span[title]")).toHaveText(["Parent"]);
    await expect(window.locator(".note-row")).toHaveCount(0);
    await search.fill("target folder");
    await expect(window.locator(".tree-open-area span[title]")).toHaveText(["Target Folder"]);
    await window.getByRole("button", { name: "Target Folder", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(window.locator(".note-open-area").filter({ hasText: "Hidden" })).toBeVisible();
    await search.fill("targetempty");
    const row = window.locator(".tree-row");
    await expect(row).toHaveCount(1);
    await row.hover();
    await row.getByRole("button", { name: "Folder actions" }).click();
    await row.getByRole("menuitem", { name: "Rename", exact: true }).click();
    const input = window.getByRole("textbox", { name: "Folder name" });
    await input.fill("Renamed Empty"); await input.press("Enter");
    await expect(window.locator(".tree-row")).toHaveCount(0);
    await search.fill("renamed");
    await expect(window.locator(".tree-open-area span[title]")).toHaveText(["Renamed Empty"]);
  } finally { await app.close(); }
});

test("sidebar searches note names only and keeps compact rows at narrow and wide widths", async ({}, info) => {
  const root = info.outputPath("workspace");
  await mkdir(path.join(root, "Folder"), { recursive: true });
  for (let index = 0; index < 10; index++) {
    await writeFile(path.join(root, index % 2 ? "Folder" : "", `${index} Very long searchable note title.md`),
      `---\ntags: [first-tag, second-tag, third-tag, fourth-extremely-long-tag-that-would-otherwise-overflow]\n---\n# Content heading ${index}\n\nneedle ${"Long preview text ".repeat(20)}\n`);
  }
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  try {
    const window = await app.firstWindow();
    await window.evaluate(root => window.inknest.workspace.select(root), root);
    await window.reload();
    const search = window.getByRole("searchbox", { name: "Search notes" });
    for (const query of ["needle", "Content heading", "first-tag"]) {
      await search.fill(query);
      await expect(window.locator(".note-row")).toHaveCount(0);
      await expect(window.locator(".tree-row")).toHaveCount(0);
    }
    await search.fill("searchable");
    await expect(window.locator(".note-row")).toHaveCount(10);
    const invalidScope = await window.evaluate(() => window.inknest.search.query({ scope: "body" as "name" }));
    expect(invalidScope.ok).toBe(false);
    for (const theme of ["light", "dark"] as const) {
      await window.evaluate(theme => window.inknest.settings.save({ theme }), theme);
      await window.reload();
      await search.fill(" SEARCHABLE ");
      await expect(window.locator(".note-row")).toHaveCount(10);
      await expect(window.locator(".tree-row")).toHaveCount(0);
      await expect(window.locator(".note-search-snippet, .note-tag-list")).toHaveCount(0);
      for (const target of [220, 480]) {
        const handle = window.getByRole("separator", { name: "Resize workspace sidebar", exact: true });
        await handle.focus();
        await handle.press(target === 220 ? "Home" : "End");
        await expect(handle).toHaveAttribute("aria-valuenow", String(target));
        await expect.poll(() => window.locator(".note-row").evaluateAll(rows => {
          return rows.every(row => {
            const box = row.getBoundingClientRect();
            const contents = [...row.querySelectorAll('.note-open-area > div:first-child')];
            return contents.every(element => {
              const rect = element.getBoundingClientRect();
              return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1 && rect.right <= box.right + 1;
            });
          }) && rows.every((row, index) => !index || row.getBoundingClientRect().top >= rows[index - 1].getBoundingClientRect().bottom - 1);
        })).toBe(true);
        const preview = window.locator(".note-open-area span[title]").first();
        await expect(preview).toHaveCSS("white-space", "nowrap");
        await expect(preview).toHaveCSS("text-overflow", "ellipsis");
        await window.screenshot({ path: info.outputPath(`search-${theme}-${target}.png`) });
      }
    }
    const first = window.locator(".note-row").first();
    const height = (await first.boundingBox())!.height;
    await first.hover();
    await expect(first.getByRole("button", { name: "Note actions" })).toBeVisible();
    expect((await first.boundingBox())!.height).toBe(height);
    await first.locator(".note-open-area").click();
    await expect(window.getByRole("textbox", { name: "Visual Markdown editor" })).toContainText("needle");
    await window.getByRole("button", { name: "Clear search" }).click();
    // Clearing the filter restores the normal collapsed folder tree.
    await expect(window.locator(".note-row")).toHaveCount(5);
    const folder = window.locator(".tree-row").filter({ has: window.locator('.tree-open-area span[title="Folder"]') });
    await folder.getByRole("button", { name: "Expand folder", exact: true }).click();
    await expect(window.locator(".note-row")).toHaveCount(10);
    await expect(window.locator(".note-row").first()).toHaveCSS("height", "29px");
  } finally { await app.close(); }
});
