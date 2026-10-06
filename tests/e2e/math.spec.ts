import { _electron as electron, expect, test, type TestInfo, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

let errors: string[] = [];
test.beforeEach(() => { errors = []; });
test.afterEach(() => expect(errors).toEqual([]));
async function launch(info: TestInfo, markdown = "Start\n\nEnd\n") {
  const workspace = info.outputPath("workspace");
  await mkdir(workspace, { recursive: true });
  const notePath = path.join(workspace, "Math.md");
  await writeFile(notePath, markdown);
  await writeFile(path.join(workspace, "Other.md"), "Other note\n");
  const app = await electron.launch({ args: [".", "--no-sandbox", "--disable-gpu", "--disable-gpu-compositing", "--ozone-platform=x11"],
    env: { ...process.env, INKNEST_USER_DATA_DIR: info.outputPath("user-data"), ELECTRON_RUN_AS_NODE: undefined } });
  const window = await app.firstWindow();
  window.on("pageerror", (error) => errors.push(error.message));
  await window.evaluate((folder) => window.inknest.workspace.select(folder), workspace);
  await window.reload();
  await window.locator(".note-open-area").filter({ hasText: "Math" }).click();
  const editor = window.getByRole("textbox", { name: "Visual Markdown editor" });
  await expect(editor).toBeVisible();
  return { app, window, editor, notePath };
}
async function reopen(window: Page) {
  await window.locator(".note-open-area").filter({ hasText: "Other" }).click();
  await window.getByRole("tab", { name: "Math", exact: true }).click();
}
async function paste(window: Page, text: string, html = "") {
  await window.evaluate(({ text, html }) => {
    const data = new DataTransfer(); data.setData("text/plain", text);
    if (html) data.setData("text/html", html);
    document.querySelector('[aria-label="Visual Markdown editor"]')!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, { text, html });
}

test("saved inline and display math render with local fonts, MathML, and unchanged source", async ({}, info) => {
  const markdown = "Energy $E = mc^2$ and $\\alpha + \\beta$.\n\n$$\n\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\n$$\n";
  const { app, window, editor, notePath } = await launch(info, markdown);
  try {
    await expect(editor.locator(".inknest-math-inline .katex")).toHaveCount(2);
    await expect(editor.locator(".inknest-math-block .katex-display")).toHaveCount(1);
    await expect(editor.locator("math")).toHaveCount(3);
    expect(await readFile(notePath, "utf8")).toBe(markdown);
    expect(await window.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px KaTeX_Main'); })).toBe(true);
    await reopen(window);
    await expect(editor.locator(".katex")).toHaveCount(3);
  } finally { await app.close(); }
});

test("typing inline syntax renders, saves, and reopens without losing surrounding text", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "");
  try {
    await editor.click();
    await editor.pressSequentially("Before $x^2 + y^2$ after");
    await expect(editor.locator(".inknest-math-inline")).toHaveAttribute("data-math-source", "x^2 + y^2");
    await expect(editor.locator(".katex")).toHaveCount(1);
    await expect.poll(() => readFile(notePath, "utf8")).toContain("Before $x^2 + y^2$ after");
    await reopen(window);
    await expect(editor.locator(".katex")).toHaveCount(1);
    await expect(editor).toContainText("Before"); await expect(editor).toContainText("after");
  } finally { await app.close(); }
});

test("typing a display fence opens multiline source, live preview, autosave and exit", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "");
  try {
    await editor.click(); await editor.pressSequentially("$$"); await editor.press("Enter");
    const source = window.getByRole("textbox", { name: "Display equation source" });
    await expect(source).toBeFocused();
    const equation = "\\begin{aligned}\na &= b+c \\\\\nd &= e-f\n\\end{aligned}";
    await source.fill(equation);
    await expect(editor.locator(".katex-display")).toHaveCount(1);
    await expect.poll(() => readFile(notePath, "utf8")).toContain(equation);
    await source.press("Control+Enter");
    await expect(source).toBeHidden();
    await editor.pressSequentially("After equation");
    await reopen(window);
    await expect(editor.locator(".inknest-math-block")).toHaveAttribute("data-math-source", equation);
    await expect(editor).toContainText("After equation");
  } finally { await app.close(); }
});

for (const display of [false, true]) {
  test(`${display ? "display" : "inline"} toolbar insertion, editing, undo, deletion and reopening`, async ({}, info) => {
    const { app, window, editor, notePath } = await launch(info);
    try {
      await editor.locator("p").first().click(); await editor.press("End");
      await window.getByRole("button", { name: display ? "Display math" : "Inline math", exact: true }).click();
      const source = window.getByRole("textbox", { name: display ? "Display equation source" : "Inline equation source" });
      await expect(source).toBeVisible();
      await source.fill("\\frac{1}{2}");
      await source.press("Escape");
      await expect(editor.locator(".katex")).toHaveCount(1);
      await editor.locator(".inknest-math-preview").click();
      await source.fill("\\sqrt{x}");
      await window.screenshot({ path: info.outputPath(display ? "display-editor.png" : "inline-editor.png") });
      await window.getByRole("button", { name: "Done", exact: true }).click();
      await expect.poll(() => readFile(notePath, "utf8")).toContain("\\sqrt{x}");
      await editor.press("Control+z");
      await expect(editor.locator(".inknest-math")).toHaveAttribute("data-math-source", "\\frac{1}{2}");
      await editor.press("Control+Shift+z");
      await expect(editor.locator(".inknest-math")).toHaveAttribute("data-math-source", "\\sqrt{x}");
      await reopen(window);
      await editor.locator(".inknest-math-preview").click();
      await window.getByRole("button", { name: "Delete equation" }).click();
      await expect(editor.locator(".inknest-math")).toHaveCount(0);
      await expect(editor).toContainText("Start"); await expect(editor).toContainText("End");
      await editor.press("Control+z");
      await expect(editor.locator(".katex")).toHaveCount(1);
    } finally { await app.close(); }
  });
}

test("pasted Markdown renders equations and keeps code and escaped dollars literal", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "");
  try {
    await editor.click();
    await paste(window, "Price \\$5; `$code$`; $\\theta$.\n\n```latex\n$not_math$\n```\n\n$$\n\\sum_{i=1}^{n} i\n$$\n");
    await expect(editor.locator(".katex")).toHaveCount(2);
    await expect(editor.locator("pre code")).toHaveText("$not_math$");
    await expect(editor).toContainText("Price $5");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("\\sum_{i=1}^{n} i");
    await reopen(window);
    await expect(editor.locator(".katex")).toHaveCount(2);
  } finally { await app.close(); }
});

test("invalid equations remain editable and saved; fixing them restores rendering", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "$\\frac{1}{$\n\n$$\n\\notACommand{x}\n$$\n");
  try {
    await expect(editor.locator('.inknest-math[data-invalid="true"]')).toHaveCount(2);
    await editor.locator(".inknest-math-inline .inknest-math-preview").click();
    const source = window.getByRole("textbox", { name: "Inline equation source" });
    await source.fill("\\frac{1}{2}"); await source.press("Enter");
    await expect(editor.locator(".katex")).toHaveCount(1);
    await editor.locator(".inknest-math-block .inknest-math-preview").click();
    await window.getByRole("textbox", { name: "Display equation source" }).fill("\\def\\loop{\\loop}\\loop");
    await expect(editor.locator(".inknest-math-block")).toHaveAttribute("data-invalid", "true");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("\\def\\loop{\\loop}\\loop");
    await reopen(window);
    await expect(editor.locator(".katex")).toHaveCount(1);
    await expect(editor.locator('.inknest-math[data-invalid="true"]')).toHaveCount(1);
  } finally { await app.close(); }
});

test("empty inline and display equations persist as editable placeholders", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "$x$\n\n$$\ny\n$$\n");
  try {
    for (const kind of ["Inline", "Display"]) {
      await window.getByRole("button", { name: `Edit ${kind.toLowerCase()} equation` }).click();
      const source = window.getByRole("textbox", { name: `${kind} equation source` });
      await source.fill(""); await source.press("Escape");
    }
    await expect(editor.locator(".inknest-math-preview")).toHaveText(["Empty equation", "Empty equation"]);
    await expect.poll(() => readFile(notePath, "utf8")).not.toContain("$x$");
    await reopen(window);
    await expect(editor.locator(".inknest-math-inline")).toHaveCount(1);
    await expect(editor.locator(".inknest-math-block")).toHaveCount(1);
    await expect(editor.locator(".inknest-math-preview")).toHaveText(["Empty equation", "Empty equation"]);
    await editor.locator(".inknest-math-inline .inknest-math-preview").click();
    await window.getByRole("textbox", { name: "Inline equation source" }).fill("z^2");
    await expect(editor.locator(".katex")).toHaveCount(1);
  } finally { await app.close(); }
});

test("inline math works inside headings, lists, callouts, links and table cells", async ({}, info) => {
  const markdown = "# Heading $h^2$\n\n- Item $x$\n- [x] Done $y$\n\n> [!NOTE]\n> Value $z$\n\n[Formula $a$](https://example.com)\n\n| Value $b$ | Result |\n| --- | --- |\n| $\\lvert x \\rvert$ | $c$ |\n";
  const { app, window, editor, notePath } = await launch(info, markdown);
  try {
    await expect(editor.locator(".katex")).toHaveCount(8);
    await editor.locator("a .inknest-math-preview").click();
    await expect(window.getByRole("textbox", { name: "Inline equation source" })).toHaveValue("a");
    await window.getByRole("textbox", { name: "Inline equation source" }).press("Escape");
    await editor.locator("td .inknest-math-preview").first().click();
    const source = window.getByRole("textbox", { name: "Inline equation source" });
    await source.fill("\\frac{a}{b}"); await source.press("Escape");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("\\frac{a}{b}");
    await reopen(window);
    await expect(editor.locator(".katex")).toHaveCount(8);
    await expect(editor.locator("table tr")).toHaveCount(2);
    await expect(editor.locator("td .inknest-math").first()).toHaveAttribute("data-math-source", "\\frac{a}{b}");
    await expect(editor.locator("h1 .katex")).toHaveCount(1);
  } finally { await app.close(); }
});

test("source editing survives immediate tab switching, reload and CRLF frontmatter", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "\uFEFF---\r\ntitle: Math\r\n---\r\n\r\n$x$\r\n");
  try {
    await editor.locator(".inknest-math-preview").click();
    await window.getByRole("textbox", { name: "Inline equation source" }).fill("\\beta^2");
    await reopen(window);
    await expect(editor.locator(".inknest-math")).toHaveAttribute("data-math-source", "\\beta^2");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("$\\beta^2$");
    const content = await readFile(notePath, "utf8");
    expect(content.startsWith("\uFEFF---\r\ntitle: Math\r\n---\r\n")).toBe(true);
    expect(content.replace(/\r\n/g, "")).not.toContain("\n");
    await window.reload();
    await window.locator(".note-open-area").filter({ hasText: "Math" }).click();
    await expect(editor.locator(".katex")).toHaveCount(1);
    await expect(editor.locator(".inknest-math")).toHaveAttribute("data-math-source", "\\beta^2");
  } finally { await app.close(); }
});

test("typing subscripts, braces, escapes and adjacent equations preserves exact LaTeX", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "");
  try {
    await editor.click();
    await editor.pressSequentially("$x_i + y_j$ $\\frac{a_b}{c_d}$ $\\{x\\}$");
    await expect(editor.locator(".inknest-math")).toHaveCount(3);
    expect(await editor.locator(".inknest-math").evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.mathSource))).toEqual(["x_i + y_j", "\\frac{a_b}{c_d}", "\\{x\\}"]);
    await editor.pressSequentially("$z$");
    await expect(editor.locator(".inknest-math")).toHaveCount(4);
    await expect.poll(() => readFile(notePath, "utf8")).toContain("$z$");
    await reopen(window);
    await expect(editor.locator(".katex")).toHaveCount(4);
  } finally { await app.close(); }
});

test("code formatting cannot erase math and find/replace does not alter LaTeX", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "alpha $\\alpha$ alpha\n");
  try {
    await editor.click(); await editor.press("Control+Home"); await editor.press("Control+a");
    await window.getByRole("button", { name: "Code", exact: true }).click();
    await window.getByRole("button", { name: "Code block", exact: true }).click();
    await expect(editor.locator(".katex")).toHaveCount(1);
    await editor.press("ArrowRight"); await editor.press("Control+h");
    const panel = window.getByRole("region", { name: "Find in note", exact: true });
    await panel.getByRole("textbox", { name: "Find in note", exact: true }).fill("alpha");
    await panel.getByRole("textbox", { name: "Replace with", exact: true }).fill("beta");
    await panel.getByRole("button", { name: "Replace all", exact: true }).click();
    await expect.poll(() => readFile(notePath, "utf8")).toContain("beta $\\alpha$ beta");
    await reopen(window);
    await expect(editor.locator(".inknest-math")).toHaveAttribute("data-math-source", "\\alpha");
  } finally { await app.close(); }
});

test("untrusted LaTeX cannot create links, images or HTML and does not affect other formulas", async ({}, info) => {
  const { app, window, editor } = await launch(info, "$\\href{javascript:alert(1)}{click}$\n\n$\\htmlClass{evil}{x}$\n\n$\\includegraphics{https://example.com/tracker}$\n\n$<script>alert(1)</script>$\n\n$x^2$\n");
  try {
    await expect(editor.locator(".inknest-math")).toHaveCount(5);
    await expect(editor.locator(".inknest-math a, .inknest-math img, .inknest-math script, .evil")).toHaveCount(0);
    await expect(editor.locator(".inknest-math").last().locator(".katex")).toHaveCount(1);
    await reopen(window);
    await expect(editor.locator(".inknest-math")).toHaveCount(5);
  } finally { await app.close(); }
});

test("copying and pasting a rendered equation preserves editable LaTeX", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "Before $\\sqrt{x}$ after\n\nDestination\n");
  try {
    // A previous test's clipboard must never satisfy the copy assertion.
    await app.evaluate(({ clipboard }) => clipboard.clear());
    await editor.locator("p").first().click();
    await editor.press("Control+Home"); await editor.press("Control+a");
    await expect.poll(() => editor.evaluate(() => window.getSelection()?.toString() ?? ""))
      .toContain("Destination");
    await editor.press("Control+c");
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toContain("$\\sqrt{x}$");
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readHTML()))
      .toContain('data-math-source="\\sqrt{x}"');
    await info.attach("equation-clipboard", {
      body: JSON.stringify(await app.evaluate(({ clipboard }) => ({ text: clipboard.readText(), html: clipboard.readHTML() }))),
      contentType: "application/json"
    });

    // Preserve the real keyboard navigation that triggered the CI failure.
    // Native document navigation and selectionchange can arrive separately.
    const destination = editor.locator("p").filter({ hasText: "Destination" });
    await editor.press("Control+End");
    await expect.poll(() => destination.evaluate((element) => {
      const selection = window.getSelection();
      return selection?.isCollapsed && element.contains(selection.anchorNode);
    })).toBe(true);
    await editor.press("Enter");
    await expect(editor.locator("p").last()).toBeEmpty();
    await expect(editor.locator(".katex")).toHaveCount(1);
    await expect(editor).toBeFocused();
    await editor.press("Control+v");
    await expect(editor.locator(".katex")).toHaveCount(2);
    await expect(editor.locator(".inknest-math")).toHaveCount(2);
    await editor.getByRole("button", { name: "Edit inline equation" }).last().click();
    await expect(editor.getByRole("textbox", { name: "Inline equation source" })).toHaveValue("\\sqrt{x}");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect.poll(() => readFile(notePath, "utf8")).toMatch(/\$\\sqrt\{x\}\$[\s\S]*\$\\sqrt\{x\}\$/);
    await reopen(window);
    await expect(editor.locator(".katex")).toHaveCount(2);
  } finally { await app.close(); }
});

test("select-all copy followed by immediate keyboard navigation and paste retains both equations", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "Before $\\sqrt{x}$ after\n\nDestination\n");
  try {
    await app.evaluate(({ clipboard }) => clipboard.clear());
    await editor.click(); await editor.press("Control+Home"); await editor.press("Control+a");
    await editor.press("Control+c");
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toContain("$\\sqrt{x}$");
    // No selection waits between navigation and edits: commands must reconcile
    // native caret movement even if selectionchange has not arrived yet.
    await editor.press("Control+End"); await editor.press("Enter"); await editor.press("Control+v");
    await expect(editor.locator(".katex")).toHaveCount(2);
    await expect.poll(() => readFile(notePath, "utf8")).toMatch(/\$\\sqrt\{x\}\$[\s\S]*\$\\sqrt\{x\}\$/);
    await reopen(window);
    await expect(editor.locator(".katex")).toHaveCount(2);
  } finally { await app.close(); }
});

test("large display equations scroll and render in both light and dark themes", async ({}, info) => {
  const equation = Array.from({ length: 70 }, (_, i) => `x_{${i}}`).join(" + ");
  const { app, window, editor } = await launch(info, `$$\n${equation}\n$$\n`);
  try {
    const preview = editor.locator(".inknest-math-preview");
    await expect.poll(() => preview.evaluate((n) => n.scrollWidth > n.clientWidth)).toBe(true);
    for (const theme of ["light", "dark"] as const) {
      await window.evaluate(async (theme) => { await window.inknest.settings.save({ theme }); }, theme);
      await window.reload();
      await window.locator(".note-open-area").filter({ hasText: "Math" }).click();
      await expect(editor.locator(".katex-display")).toBeVisible();
      await expect(editor.locator(".katex")).toHaveCSS("color", await editor.evaluate((n) => getComputedStyle(n).color));
      await window.screenshot({ path: info.outputPath(`math-${theme}.png`) });
    }
  } finally { await app.close(); }
});

test("Markdown input rules do not rewrite TeX while a math fence is unfinished", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "");
  try {
    await editor.click();
    await editor.pressSequentially("$\\text{**bold** and *italic* and -- and ...}$");
    await expect(editor.locator(".inknest-math")).toHaveAttribute("data-math-source", "\\text{**bold** and *italic* and -- and ...}");
    await expect(editor.locator("strong, em")).toHaveCount(0);
    await expect.poll(() => readFile(notePath, "utf8")).toContain("\\text{**bold** and *italic* and -- and ...}");
    await reopen(window);
    await expect(editor.locator(".katex")).toHaveCount(1);
  } finally { await app.close(); }
});

test("escaped dollars and unfinished inline math stay literal when saved and reopened", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "");
  try {
    await editor.click(); await editor.pressSequentially("Price \\$5 and \\$10. Incomplete $x^2");
    await expect(editor.locator(".inknest-math")).toHaveCount(0);
    await expect.poll(() => readFile(notePath, "utf8")).toContain("x^2");
    await reopen(window);
    await expect(editor.locator(".inknest-math")).toHaveCount(0);
    await expect(editor).toContainText("Incomplete $x^2");
  } finally { await app.close(); }
});

test("math slash command, keyboard source editing and deleting a math-only note", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "");
  try {
    await editor.click(); await editor.pressSequentially("/math"); await editor.press("Enter");
    const source = window.getByRole("textbox", { name: "Display equation source" });
    await expect(source).toBeFocused();
    await source.fill("a"); await source.press("End"); await source.press("Enter"); await source.press("Tab");
    await source.pressSequentially("+ b");
    await expect(source).toHaveValue("a\n  + b");
    await source.press("Control+z");
    await source.press("Control+y");
    await expect(source).toHaveValue("a\n  + b");
    await source.press("Control+Enter");
    await editor.press("Control+Home"); await editor.press("Control+a"); await editor.press("Backspace");
    await expect(editor.locator(".inknest-math")).toHaveCount(0);
    await editor.pressSequentially("Still editable");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("Still editable");
    await reopen(window);
    await expect(editor).toHaveText("Still editable");
  } finally { await app.close(); }
});

test("display insertion inside a table cannot destroy its cells", async ({}, info) => {
  const { app, window, editor } = await launch(info, "| Header | Other |\n| --- | --- |\n| Cell | Data |\n");
  try {
    await editor.locator("td").first().click();
    await window.getByRole("button", { name: "Display math", exact: true }).click();
    await expect(editor.locator(".inknest-math-block")).toHaveCount(0);
    await expect(editor.locator("td")).toHaveText(["Cell", "Data"]);
    await window.getByRole("button", { name: "Inline math", exact: true }).click();
    const source = window.getByRole("textbox", { name: "Inline equation source" });
    await source.fill("x"); await source.press("Escape");
    await reopen(window);
    await expect(editor.locator("td .katex")).toHaveCount(1);
    await expect(editor.locator("td").last()).toHaveText("Data");
  } finally { await app.close(); }
});

for (const [syntax, source, display] of [
  ["\\(\\frac{a}{b}\\)", "\\frac{a}{b}", false],
  ["\\[\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\\]", "\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}", true],
  ["$$E = mc^2$$", "E = mc^2", true],
  ["\\sqrt{x^2+y^2}", "\\sqrt{x^2+y^2}", true]
] as const) {
  test(`paste automatically renders ${syntax.slice(0, 25)}, saves and supports undo`, async ({}, info) => {
    const { app, window, editor, notePath } = await launch(info, "");
    try {
      await editor.click(); await paste(window, syntax);
      await expect(editor.locator(display ? ".inknest-math-block" : ".inknest-math-inline")).toHaveAttribute("data-math-source", source);
      await expect(editor.locator(".katex")).toHaveCount(1);
      await editor.press("Control+z"); await expect(editor.locator(".inknest-math")).toHaveCount(0);
      await editor.press("Control+Shift+z"); await expect(editor.locator(".katex")).toHaveCount(1);
      await expect.poll(() => readFile(notePath, "utf8")).toContain(source);
      await reopen(window); await expect(editor.locator(".katex")).toHaveCount(1);
    } finally { await app.close(); }
  });
}

test("rich HTML paste formats math while preserving surrounding bold and links", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "");
  try {
    await editor.click();
    await paste(window, "Bold $x^2$ and \\(y^2\\). Linked $z$", '<p><strong>Bold $x^2$</strong> and \\(y^2\\).</p><p><a href="https://example.com">Linked $z$</a></p>');
    await expect(editor.locator(".katex")).toHaveCount(3);
    await expect(editor.locator("strong .inknest-math")).toHaveCount(1);
    await expect(editor.locator('a[href="https://example.com"] .inknest-math')).toHaveCount(1);
    await expect.poll(() => readFile(notePath, "utf8")).toContain("$y^2$");
    await reopen(window); await expect(editor.locator(".katex")).toHaveCount(3);
    await expect(editor.locator("strong .inknest-math")).toHaveCount(1);
  } finally { await app.close(); }
});

test("pasting rendered browser equations recovers their original LaTeX without duplicate text", async ({}, info) => {
  const { app, window, editor, notePath } = await launch(info, "");
  try {
    await editor.click();
    await paste(window, "a over b; c squared", '<p>Before <span class="katex"><span class="katex-mathml"><math><semantics><mfrac><mi>a</mi><mi>b</mi></mfrac><annotation encoding="application/x-tex">\\frac{a}{b}</annotation></semantics></math></span><span class="katex-html">DUPLICATE</span></span> after</p><span class="katex-display"><span class="katex"><math display="block"><semantics><msup><mi>c</mi><mn>2</mn></msup><annotation encoding="application/x-tex">c^2</annotation></semantics></math></span></span>');
    await expect(editor.locator(".katex")).toHaveCount(2);
    await expect(editor.locator(".inknest-math-inline")).toHaveAttribute("data-math-source", "\\frac{a}{b}");
    await expect(editor.locator(".inknest-math-block")).toHaveAttribute("data-math-source", "c^2");
    await expect(editor).not.toContainText("DUPLICATE");
    await expect.poll(() => readFile(notePath, "utf8")).toContain("$\\frac{a}{b}$");
    await reopen(window); await expect(editor.locator(".katex")).toHaveCount(2);
  } finally { await app.close(); }
});

test("pasted math preserves literal code, escaped dollars, incomplete delimiters and paths", async ({}, info) => {
  const { app, window, editor } = await launch(info, "");
  try {
    await editor.click();
    await paste(window, '`\\(x\\)`\n\n```latex\n\\[x\\]\n$$x$$\n```\n\nPrice \\$5. Unclosed \\(x.\n\nC:\\folder\\file');
    await expect(editor.locator(".inknest-math")).toHaveCount(0);
    await expect(editor.locator("pre code")).toContainText("$$x$$");
    await reopen(window); await expect(editor.locator(".inknest-math")).toHaveCount(0);
    await editor.press("Control+End"); await editor.press("Enter");
    await window.getByRole("button", { name: "Code", exact: true }).click();
    await paste(window, "$x$", "<span>$x$</span>");
    await expect(editor.locator(".inknest-math")).toHaveCount(0);
    await expect(editor.locator("code").last()).toHaveText("$x$");
  } finally { await app.close(); }
});

test("rich paste separates display math from surrounding prose and preserves table cells", async ({}, info) => {
  const { app, window, editor } = await launch(info, "");
  try {
    await editor.click();
    await paste(window, "Before \\[x^2\\] after", "<p><strong>Before</strong> \\[x^2\\] <em>after</em></p><table><tr><th>Header</th></tr><tr><td>\\[y^2\\]</td></tr></table>");
    await expect(editor.locator(".inknest-math-block")).toHaveAttribute("data-math-source", "x^2");
    await expect(editor.locator("td .inknest-math-inline")).toHaveAttribute("data-math-source", "y^2");
    await expect(editor.locator("strong")).toHaveText("Before");
    await expect(editor.locator("em")).toHaveText("after");
    await reopen(window);
    await expect(editor.locator(".katex")).toHaveCount(2);
    await expect(editor.locator("table tr")).toHaveCount(2);
  } finally { await app.close(); }
});

for (const [label, html] of [
  ["paragraphs", "<p><strong>These bounds assume</strong></p><p>$$</p><p>1\\le a_i\\le n,</p><p>$$</p>"],
  ["line breaks", "<p><strong>These bounds assume</strong><br><br>$$<br>1\\le a_i\\le n,<br>$$</p>"],
  ["plain text", ""]
]) {
  test(`pasted display math split across ${label} renders and survives reopening`, async ({}, info) => {
    const { app, window, editor } = await launch(info, "");
    try {
      await editor.click();
      await paste(window, "These bounds assume\n\n$$\n1\\le a_i\\le n,\n$$", html);
      await expect(editor.locator(".inknest-math-block")).toHaveCount(1);
      await expect(editor.locator(".inknest-math-block")).toHaveAttribute("data-math-source", "1\\le a_i\\le n,");
      await expect(editor.locator(".katex")).toHaveCount(1);
      if (html) await expect(editor.locator("strong")).toHaveText("These bounds assume");
      await window.keyboard.press("Control+z");
      await expect(editor.locator(".katex")).toHaveCount(0);
      await window.keyboard.press("Control+Shift+z");
      await expect(editor.locator(".katex")).toHaveCount(1);
      await reopen(window);
      await expect(editor.locator(".inknest-math-block")).toHaveAttribute("data-math-source", "1\\le a_i\\le n,");
      await expect(editor).toContainText("These bounds assume");
    } finally { await app.close(); }
  });
}
