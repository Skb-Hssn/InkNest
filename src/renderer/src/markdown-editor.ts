const blockSeparator = "\n\n";

export type MarkdownEditorCommand =
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "heading-5"
  | "heading-6"
  | "bold"
  | "italic"
  | "strikethrough"
  | "unordered-list"
  | "ordered-list"
  | "task-list"
  | "blockquote"
  | "callout-note"
  | "callout-warning"
  | "callout-info"
  | "callout-success"
  | "inline-code"
  | "clear-format"
  | "highlight"
  | "text-color"
  | "background-color"
  | "align-left"
  | "align-center"
  | "align-right"
  | "code-block"
  | "divider"
  | "table"
  | "table-add-row"
  | "table-delete-row"
  | "table-add-column"
  | "table-delete-column"
  | "table-align-left"
  | "table-align-center"
  | "table-align-right"
  | "link"
  | "link-edit"
  | "link-remove"
  | "image"
  | "image-resize"
  | "inline-math"
  | "block-math"
  | "math-edit";

export type MarkdownEditorCommandOptions = {
  label?: string;
  url?: string;
  alt?: string;
  src?: string;
  color?: string;
  language?: string;
  width?: string;
  equation?: string;
};

export function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      index += 1;
      continue;
    }

    const alignedHtmlBlock = htmlAlignedBlockToHtml(trimmedLine);
    if (alignedHtmlBlock) {
      blocks.push(alignedHtmlBlock);
      index += 1;
      continue;
    }

    if (trimmedLine.startsWith("```")) {
      const language = trimmedLine.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push(codeBlockToHtml(codeLines.join("\n"), language));
      continue;
    }

    if (trimmedLine.startsWith("$$")) {
      const mathLines: string[] = [];
      const firstLineMath = trimmedLine.replace(/^\$\$\s?/, "");

      if (firstLineMath.trim().endsWith("$$")) {
        blocks.push(mathToHtml(firstLineMath.replace(/\s?\$\$$/, "").trim(), true));
        index += 1;
        continue;
      }

      if (firstLineMath.trim()) {
        mathLines.push(firstLineMath);
      }

      index += 1;

      while (index < lines.length && !lines[index].trim().endsWith("$$")) {
        mathLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        const closingLine = lines[index].trim().replace(/\s?\$\$$/, "");

        if (closingLine) {
          mathLines.push(closingLine);
        }

        index += 1;
      }

      blocks.push(mathToHtml(mathLines.join("\n").trim(), true));
      continue;
    }

    const heading = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmedLine)) {
      blocks.push("<hr>");
      index += 1;
      continue;
    }

    if (trimmedLine.startsWith(">")) {
      const quoteLines: string[] = [];

      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push(blockquoteMarkdownToHtml(quoteLines));
      continue;
    }

    if (isTableStart(lines, index)) {
      const tableLines: string[] = [];

      while (index < lines.length && isTableLine(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }

      blocks.push(tableMarkdownToHtml(tableLines));
      continue;
    }

    if (isListLine(line)) {
      const listLines: string[] = [];

      while (index < lines.length && isListLine(lines[index])) {
        listLines.push(lines[index]);
        index += 1;
      }

      blocks.push(listMarkdownToHtml(listLines));
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length && lines[index].trim()) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(`<p>${inlineMarkdownToHtml(paragraphLines.join(" "))}</p>`);
  }

  return blocks.join("");
}

export function editorDomToMarkdown(root: HTMLElement) {
  const blocks = Array.from(root.childNodes)
    .map((node) => blockNodeToMarkdown(node))
    .filter(Boolean);

  return `${blocks.join(blockSeparator).trimEnd()}\n`;
}

export function insertPlainTextAtSelection(text: string) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function applyMarkdownEditorCommand(
  command: MarkdownEditorCommand,
  options: MarkdownEditorCommandOptions = {}
) {
  if (command.startsWith("heading-")) {
    document.execCommand("formatBlock", false, `h${command.at(-1)}`);
    return;
  }

  if (command === "bold") {
    document.execCommand("bold");
    return;
  }

  if (command === "italic") {
    document.execCommand("italic");
    return;
  }

  if (command === "strikethrough") {
    document.execCommand("strikeThrough");
    return;
  }

  if (command === "unordered-list") {
    document.execCommand("insertUnorderedList");
    return;
  }

  if (command === "ordered-list") {
    document.execCommand("insertOrderedList");
    return;
  }

  if (command === "blockquote") {
    document.execCommand("formatBlock", false, "blockquote");
    return;
  }

  if (command.startsWith("callout-")) {
    const type = command.replace("callout-", "");
    insertHtmlAtSelection(
      `<blockquote data-callout="${escapeAttribute(type)}"><p>[!${type.toUpperCase()}] Callout</p></blockquote>`
    );
    return;
  }

  if (command === "task-list") {
    insertHtmlAtSelection('<ul><li data-task="true"><input type="checkbox"> Task</li></ul>');
    return;
  }

  if (command === "inline-code") {
    const selectedText = getSelectedText() || "code";
    insertHtmlAtSelection(`<code>${escapeHtml(selectedText)}</code>`);
    return;
  }

  if (command === "clear-format") {
    removeFormattingAtSelection();
    return;
  }

  if (command === "highlight") {
    applyInlineStyleAtSelection("background-color", options.color ?? "#fef08a", "mark");
    return;
  }

  if (command === "text-color") {
    applyInlineStyleAtSelection("color", options.color ?? "#0f766e");
    return;
  }

  if (command === "background-color") {
    applyInlineStyleAtSelection("background-color", options.color ?? "#dbeafe");
    return;
  }

  if (command === "align-left") {
    document.execCommand("justifyLeft");
    return;
  }

  if (command === "align-center") {
    document.execCommand("justifyCenter");
    return;
  }

  if (command === "align-right") {
    document.execCommand("justifyRight");
    return;
  }

  if (command === "code-block") {
    const selectedText = getSelectedText() || "code";
    const language = options.language?.trim() ?? "";
    insertHtmlAtSelection(
      codeBlockToHtml(selectedText, language)
    );
    return;
  }

  if (command === "divider") {
    insertHtmlAtSelection("<hr><p><br></p>");
    return;
  }

  if (command === "table") {
    insertHtmlAtSelection(
      [
        "<table><tbody>",
        "<tr><th>Column 1</th><th>Column 2</th></tr>",
        "<tr><td>Value</td><td>Value</td></tr>",
        "</tbody></table>"
      ].join("")
    );
    return;
  }

  if (command === "table-add-row") {
    addTableRowAtSelection();
    return;
  }

  if (command === "table-delete-row") {
    deleteTableRowAtSelection();
    return;
  }

  if (command === "table-add-column") {
    addTableColumnAtSelection();
    return;
  }

  if (command === "table-delete-column") {
    deleteTableColumnAtSelection();
    return;
  }

  if (command === "table-align-left") {
    alignTableColumnAtSelection("left");
    return;
  }

  if (command === "table-align-center") {
    alignTableColumnAtSelection("center");
    return;
  }

  if (command === "table-align-right") {
    alignTableColumnAtSelection("right");
    return;
  }

  if (command === "link") {
    const url = options.url?.trim();
    const label = options.label?.trim() || getSelectedText() || "Link";

    if (url) {
      insertHtmlAtSelection(
        `<a href="${escapeAttribute(url)}">${escapeHtml(label)}</a>`
      );
    }

    return;
  }

  if (command === "link-edit") {
    editLinkAtSelection(options);
    return;
  }

  if (command === "link-remove") {
    removeLinkAtSelection();
    return;
  }

  if (command === "image") {
    const src = options.src?.trim();
    const alt = options.alt?.trim() || "Image";

    if (src) {
      insertHtmlAtSelection(
        `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}">`
      );
    }

    return;
  }

  if (command === "image-resize") {
    resizeImageAtSelection(options.width);
    return;
  }

  if (command === "inline-math") {
    insertHtmlAtSelection(mathToHtml(options.equation?.trim() || "x = y", false));
    return;
  }

  if (command === "block-math") {
    insertHtmlAtSelection(mathToHtml(options.equation?.trim() || "x = y", true));
    return;
  }

  if (command === "math-edit") {
    editMathAtSelection(options.equation);
  }
}

export function applySlashCommandAtSelection() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  if (isSelectionInsideCodeBlock()) {
    return null;
  }

  const block = getSelectionBlock(selection);
  const slashCommand = block?.textContent?.trim().toLowerCase() ?? "";
  const command = slashCommands[slashCommand];

  if (!block || !command) {
    return null;
  }

  block.innerHTML = "";
  placeCaretInside(block);
  applyMarkdownEditorCommand(command);

  return command;
}

export function exitCurrentEditorBlock() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const anchorNode = selection.anchorNode;
  const element =
    anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
  return exitEditorBlockFromElement(element);
}

export function exitEditorBlockFromElement(element: Element | null | undefined) {
  const block = element?.closest("pre,blockquote");

  if (!(block instanceof HTMLElement)) {
    return false;
  }

  const paragraph = document.createElement("p");
  paragraph.append(document.createElement("br"));
  block.insertAdjacentElement("afterend", paragraph);
  placeCaretInside(paragraph);

  return true;
}

export function normalizeEmptyBlockAtSelection() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const block = getSelectionBlock(selection);

  if (!(block instanceof HTMLElement) || block.tagName.toLowerCase() === "p") {
    return false;
  }

  if (!isVisiblyEmpty(block)) {
    return false;
  }

  const paragraph = document.createElement("p");
  paragraph.append(document.createElement("br"));
  block.replaceWith(paragraph);
  placeCaretInside(paragraph);

  return true;
}

export function handleListKeyAtSelection(key: string, shiftKey: boolean) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  if (isSelectionInsideCodeBlock()) {
    return false;
  }

  const listItem = getSelectionListItem(selection);

  if (!listItem) {
    return false;
  }

  if (key === "Tab") {
    document.execCommand(shiftKey ? "outdent" : "indent");
    return true;
  }

  if (key === "Enter" && isVisiblyEmpty(listItem)) {
    document.execCommand("outdent");
    document.execCommand("formatBlock", false, "p");
    return true;
  }

  return false;
}

export function moveTableSelection(forward: boolean) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const cell = getSelectionTableCell(selection);
  const table = cell?.closest("table");

  if (!cell || !table) {
    return false;
  }

  const cells = Array.from(table.querySelectorAll("th,td"));
  const cellIndex = cells.indexOf(cell);
  const nextCell = cells[cellIndex + (forward ? 1 : -1)];

  if (!(nextCell instanceof HTMLElement)) {
    return false;
  }

  placeCaretInside(nextCell);
  return true;
}

export function isSelectionInsideCodeBlock() {
  return getSelectionElement()?.closest("pre,code") !== null;
}

export function insertCodeIndentAtSelection() {
  if (!isSelectionInsideCodeBlock()) {
    return false;
  }

  insertPlainTextAtSelection("  ");
  return true;
}

const slashCommands: Record<string, MarkdownEditorCommand> = {
  "/heading": "heading-1",
  "/table": "table",
  "/code": "code-block",
  "/todo": "task-list",
  "/note": "callout-note",
  "/warning": "callout-warning",
  "/info": "callout-info",
  "/success": "callout-success",
  "/math": "block-math"
};

function blockNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const tagName = node.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tagName)) {
    return blockWithAlignment(
      node,
      `${"#".repeat(Number(tagName[1]))} ${inlineNodeToMarkdown(node).trim()}`
    );
  }

  if (node.dataset.math && node.dataset.mathDisplay === "block") {
    return `$$\n${node.dataset.math}\n$$`;
  }

  if (tagName === "p") {
    return blockWithAlignment(node, inlineNodeToMarkdown(node).trim());
  }

  if (tagName === "blockquote") {
    const calloutType = node.dataset.callout;
    const quoteMarkdown = Array.from(node.childNodes)
      .map((child) => blockNodeToMarkdown(child))
      .join(blockSeparator)
      .split("\n")
      .map((line) => `> ${line}`.trimEnd())
      .join("\n");

    if (calloutType && ["note", "warning", "info", "success"].includes(calloutType)) {
      const calloutBody = quoteMarkdown
        .split("\n")
        .map((line, lineIndex) =>
          lineIndex === 0
            ? line.replace(/^>\s*\[!(NOTE|WARNING|INFO|SUCCESS)\]\s*/i, "> ")
            : line
        )
        .filter((line) => line.trim() !== ">")
        .join("\n");

      return `> [!${calloutType.toUpperCase()}]\n${calloutBody}`;
    }

    return quoteMarkdown;
  }

  if (tagName === "ul" || tagName === "ol") {
    return Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child, childIndex) => listItemToMarkdown(child as HTMLElement, tagName, childIndex))
      .join("\n");
  }

  if (tagName === "pre") {
    const code = node.querySelector("code");
    const language = code?.getAttribute("data-language") ?? "";
    const codeText = code?.textContent ?? node.textContent ?? "";
    return `\`\`\`${language}\n${codeText.replace(/\n$/, "")}\n\`\`\``;
  }

  if (tagName === "table") {
    return tableElementToMarkdown(node);
  }

  if (tagName === "hr") {
    return "---";
  }

  if (tagName === "div") {
    const markdown = Array.from(node.childNodes)
      .map((child) => blockNodeToMarkdown(child))
      .filter(Boolean)
      .join(blockSeparator);

    return blockWithAlignment(node, markdown, "div");
  }

  return inlineNodeToMarkdown(node).trim();
}

function listItemToMarkdown(item: HTMLElement, listTagName: string, index: number) {
  const checkbox = item.querySelector(":scope > input[type='checkbox']");
  const marker =
    listTagName === "ol"
      ? `${index + 1}.`
      : checkbox instanceof HTMLInputElement
        ? `- [${checkbox.checked ? "x" : " "}]`
        : "-";

  const content = Array.from(item.childNodes)
    .filter((child) => {
      if (!(child instanceof HTMLElement)) {
        return true;
      }

      const childTagName = child.tagName.toLowerCase();
      return childTagName !== "ul" && childTagName !== "ol" && childTagName !== "input";
    })
    .map(inlineNodeToMarkdown)
    .join("")
    .trim();
  const nestedListMarkdown = Array.from(item.children)
    .filter((child) => ["ul", "ol"].includes(child.tagName.toLowerCase()))
    .map((child) => blockNodeToMarkdown(child))
    .filter(Boolean)
    .join("\n")
    .split("\n")
    .filter(Boolean)
    .map((line) => `  ${line}`)
    .join("\n");
  const currentLine = `${marker} ${content}`;

  return nestedListMarkdown ? `${currentLine}\n${nestedListMarkdown}` : currentLine;
}

function inlineNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof HTMLElement)) {
    return "";
  }

  const tagName = node.tagName.toLowerCase();

  if (tagName === "br") {
    return "\n";
  }

  if (node.dataset.math) {
    return node.dataset.mathDisplay === "block"
      ? `$$\n${node.dataset.math}\n$$`
      : `$${node.dataset.math}$`;
  }

  if (tagName === "input") {
    return "";
  }

  if (tagName === "strong" || tagName === "b") {
    return `**${inlineChildrenToMarkdown(node)}**`;
  }

  if (tagName === "em" || tagName === "i") {
    return `*${inlineChildrenToMarkdown(node)}*`;
  }

  if (tagName === "code") {
    return `\`${node.textContent ?? ""}\``;
  }

  if (tagName === "s" || tagName === "strike" || tagName === "del") {
    return `~~${inlineChildrenToMarkdown(node)}~~`;
  }

  if (tagName === "a") {
    return `[${inlineChildrenToMarkdown(node)}](${node.getAttribute("href") ?? ""})`;
  }

  if (tagName === "img") {
    const alt = node.getAttribute("alt") ?? "";
    const src = node.getAttribute("src") ?? "";
    const width = node.getAttribute("width") ?? node.style.width.replace("px", "");

    return width
      ? `<img src="${src}" alt="${alt}" width="${width}">`
      : `![${alt}](${src})`;
  }

  const childrenMarkdown = inlineChildrenToMarkdown(node);
  const color = node.style.color || node.getAttribute("color") || "";
  const backgroundColor = node.style.backgroundColor;

  if (tagName === "mark") {
    return backgroundColor
      ? `<mark style="background-color: ${escapeAttribute(backgroundColor)}">${childrenMarkdown}</mark>`
      : `<mark>${childrenMarkdown}</mark>`;
  }

  if (color || backgroundColor) {
    const styles = [
      color ? `color: ${escapeAttribute(color)}` : "",
      backgroundColor
        ? `background-color: ${escapeAttribute(backgroundColor)}`
        : ""
    ].filter(Boolean);

    return `<span style="${styles.join("; ")}">${childrenMarkdown}</span>`;
  }

  return childrenMarkdown;
}

function inlineChildrenToMarkdown(element: HTMLElement) {
  return Array.from(element.childNodes).map(inlineNodeToMarkdown).join("");
}

function getSelectedText() {
  return window.getSelection()?.toString().trim() ?? "";
}

function insertHtmlAtSelection(html: string) {
  document.execCommand("insertHTML", false, html);
}

function applyInlineStyleAtSelection(
  property: "color" | "background-color",
  value: string,
  tagName = "span"
) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const wrapper = document.createElement(tagName);
  const selectedContent = range.extractContents();

  wrapper.append(
    selectedContent.childNodes.length > 0
      ? selectedContent
      : document.createTextNode("text")
  );
  wrapper.setAttribute("style", `${property}: ${value}`);
  range.insertNode(wrapper);
  range.selectNodeContents(wrapper);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getSelectionElement() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const anchorNode = selection.anchorNode;
  return anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement ?? null;
}

function getSelectedOrNearbyLink() {
  return getSelectionElement()?.closest("a") ?? null;
}

function editLinkAtSelection(options: MarkdownEditorCommandOptions) {
  const link = getSelectedOrNearbyLink();
  const url = options.url?.trim();
  const label = options.label?.trim();

  if (!link || !url) {
    return;
  }

  link.setAttribute("href", url);

  if (label) {
    link.textContent = label;
  }
}

function removeLinkAtSelection() {
  const link = getSelectedOrNearbyLink();

  if (!link) {
    document.execCommand("unlink");
    return;
  }

  link.replaceWith(document.createTextNode(link.textContent ?? ""));
}

function removeFormattingAtSelection() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  if (!selection.toString()) {
    const element = getSelectionElement();
    const formattedElement = element?.closest(
      "strong,b,em,i,s,strike,del,code,mark,span,a"
    );

    if (formattedElement) {
      formattedElement.replaceWith(
        document.createTextNode(formattedElement.textContent ?? "")
      );
    }

    return;
  }

  document.execCommand("removeFormat");
  document.execCommand("unlink");
}

function getSelectedOrNearbyImage() {
  const element = getSelectionElement();

  if (element instanceof HTMLImageElement) {
    return element;
  }

  return element?.querySelector("img") ?? element?.closest("img") ?? null;
}

function resizeImageAtSelection(width: string | undefined) {
  const image = getSelectedOrNearbyImage();
  const normalizedWidth = width?.trim();

  if (!image || !normalizedWidth) {
    return;
  }

  const numericWidth = normalizedWidth.replace(/[^\d.]/g, "");

  if (!numericWidth) {
    return;
  }

  image.setAttribute("width", numericWidth);
  image.style.width = `${numericWidth}px`;
  image.style.height = "auto";
}

function editMathAtSelection(equation: string | undefined) {
  const mathElement = getSelectionElement()?.closest("[data-math]");
  const nextEquation = equation?.trim();

  if (!(mathElement instanceof HTMLElement) || !nextEquation) {
    return;
  }

  const isBlock = mathElement.dataset.mathDisplay === "block";
  mathElement.outerHTML = mathToHtml(nextEquation, isBlock);
}

function getSelectionBlock(selection: Selection) {
  const anchorNode = selection.anchorNode;
  const element =
    anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;

  return (
    element?.closest("p,h1,h2,h3,h4,h5,h6,li,blockquote,div") ?? null
  );
}

function getSelectionListItem(selection: Selection) {
  const anchorNode = selection.anchorNode;
  const element =
    anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
  const listItem = element?.closest("li");

  return listItem instanceof HTMLLIElement ? listItem : null;
}

function getSelectionTableCell(selection: Selection) {
  const anchorNode = selection.anchorNode;
  const element =
    anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement;
  const cell = element?.closest("th,td");

  return cell instanceof HTMLTableCellElement ? cell : null;
}

function isVisiblyEmpty(element: HTMLElement) {
  return element.textContent?.replace(/\u200b/g, "").trim() === "";
}

function blockquoteMarkdownToHtml(quoteLines: string[]) {
  const callout = quoteLines[0]?.trim().match(/^\[!(NOTE|WARNING|INFO|SUCCESS)\]\s*(.*)$/i);

  if (!callout) {
    return `<blockquote>${markdownToHtml(quoteLines.join("\n"))}</blockquote>`;
  }

  const type = callout[1].toLowerCase();
  const title = callout[2] || type;
  const body = [title, ...quoteLines.slice(1)].join("\n");

  return `<blockquote data-callout="${type}">${markdownToHtml(body)}</blockquote>`;
}

function codeBlockToHtml(code: string, language: string) {
  const safeLanguage = escapeAttribute(language);
  return `<pre><button type="button" class="code-copy-button" contenteditable="false" data-code-copy="true">Copy</button><code data-language="${safeLanguage}" class="language-${safeLanguage}">${highlightCode(
    code,
    language
  )}</code></pre>`;
}

function highlightCode(code: string, language: string) {
  const safeCode = escapeHtml(code);

  if (!language.trim()) {
    return safeCode;
  }

  if (/^(js|jsx|ts|tsx|javascript|typescript)$/.test(language.toLowerCase())) {
    return safeCode
      .replace(
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|type|interface|async|await)\b/g,
        '<span class="syntax-keyword">$1</span>'
      )
      .replace(/(&quot;.*?&quot;|'.*?'|`.*?`)/g, '<span class="syntax-string">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="syntax-number">$1</span>');
  }

  if (/^(html|xml)$/.test(language.toLowerCase())) {
    return safeCode.replace(
      /(&lt;\/?[\w-]+|\/?&gt;)/g,
      '<span class="syntax-keyword">$1</span>'
    );
  }

  return safeCode;
}

function placeCaretInside(element: Element) {
  const range = document.createRange();
  const selection = window.getSelection();

  range.selectNodeContents(element);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function inlineMarkdownToHtml(markdown: string) {
  const tokens: string[] = [];
  let source = escapeHtml(markdown);

  source = restoreLimitedInlineHtml(source, tokens);
  source = restoreLimitedImageHtml(source, tokens);
  source = source.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_, equation) => {
    tokens.push(mathToHtml(String(equation), false));
    return `\u0000${tokens.length - 1}\u0000`;
  });
  source = source.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    tokens.push(`<img src="${src}" alt="${alt}">`);
    return `\u0000${tokens.length - 1}\u0000`;
  });
  source = source.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    tokens.push(`<a href="${href}">${label}</a>`);
    return `\u0000${tokens.length - 1}\u0000`;
  });
  source = source.replace(/`([^`]+)`/g, "<code>$1</code>");
  source = source.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  source = source.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  source = source.replace(/~~([^~]+)~~/g, "<s>$1</s>");

  return source.replace(/\u0000(\d+)\u0000/g, (_, tokenIndex) => tokens[Number(tokenIndex)]);
}

function restoreLimitedInlineHtml(source: string, tokens: string[]) {
  let nextSource = source;

  nextSource = nextSource.replace(
    /&lt;mark&gt;([\s\S]*?)&lt;\/mark&gt;/g,
    (_, content) => {
      tokens.push(`<mark>${content}</mark>`);
      return `\u0000${tokens.length - 1}\u0000`;
    }
  );

  nextSource = nextSource.replace(
    /&lt;mark style=&quot;background-color:\s*([^;&]+);?&quot;&gt;([\s\S]*?)&lt;\/mark&gt;/g,
    (_, color, content) => {
      tokens.push(
        `<mark style="background-color: ${escapeAttribute(String(color).trim())}">${content}</mark>`
      );
      return `\u0000${tokens.length - 1}\u0000`;
    }
  );

  nextSource = nextSource.replace(
    /&lt;span style=&quot;((?:color|background-color):\s*[^;&]+(?:;\s*)?(?:(?:color|background-color):\s*[^;&]+;?\s*)?)&quot;&gt;([\s\S]*?)&lt;\/span&gt;/g,
    (_, style, content) => {
      tokens.push(
        `<span style="${escapeAttribute(String(style).trim())}">${content}</span>`
      );
      return `\u0000${tokens.length - 1}\u0000`;
    }
  );

  return nextSource;
}

function restoreLimitedImageHtml(source: string, tokens: string[]) {
  return source.replace(
    /&lt;img src=&quot;([^"]+)&quot; alt=&quot;([^"]*)&quot; width=&quot;([\d.]+)&quot;&gt;/g,
    (_, src, alt, width) => {
      tokens.push(
        `<img src="${escapeAttribute(String(src))}" alt="${escapeAttribute(
          String(alt)
        )}" width="${escapeAttribute(String(width))}" style="width: ${escapeAttribute(
          String(width)
        )}px; height: auto;">`
      );
      return `\u0000${tokens.length - 1}\u0000`;
    }
  );
}

function mathToHtml(equation: string, display: boolean) {
  const validationError = validateMath(equation);
  const tagName = display ? "div" : "span";
  const displayValue = display ? "block" : "inline";
  const className = validationError ? "math-node math-invalid" : "math-node";
  const renderedMath = validationError
    ? `${escapeHtml(equation)} (${validationError})`
    : renderMathExpression(equation);

  return `<${tagName} class="${className}" data-math="${escapeAttribute(
    equation
  )}" data-math-display="${displayValue}">${renderedMath}</${tagName}>`;
}

function validateMath(equation: string) {
  let braceBalance = 0;

  for (const character of equation) {
    if (character === "{") {
      braceBalance += 1;
    }

    if (character === "}") {
      braceBalance -= 1;
    }

    if (braceBalance < 0) {
      return "invalid math syntax";
    }
  }

  return braceBalance === 0 ? null : "invalid math syntax";
}

function renderMathExpression(equation: string) {
  let rendered = escapeHtml(equation);

  rendered = rendered.replace(
    /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
    '<span class="math-frac"><span>$1</span><span>$2</span></span>'
  );
  rendered = rendered.replace(/\\sqrt\{([^{}]+)\}/g, '<span class="math-sqrt">$1</span>');
  rendered = rendered.replace(
    /\^(\{([^{}]+)\}|[A-Za-z0-9+-]+)/g,
    (_, __, grouped, plain) => `<sup>${grouped ?? plain}</sup>`
  );
  rendered = rendered.replace(
    /_(\{([^{}]+)\}|[A-Za-z0-9+-]+)/g,
    (_, __, grouped, plain) => `<sub>${grouped ?? plain}</sub>`
  );
  rendered = rendered.replace(
    /\\(alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega)\b/g,
    (_, symbol) => mathSymbols[symbol] ?? symbol
  );

  return rendered;
}

const mathSymbols: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  theta: "θ",
  lambda: "λ",
  mu: "μ",
  pi: "π",
  sigma: "σ",
  omega: "ω"
};

function htmlAlignedBlockToHtml(markdown: string) {
  const match = markdown.match(
    /^<(p|h[1-6]|div) style="text-align: (left|center|right)">([\s\S]*)<\/\1>$/
  );

  if (!match) {
    return null;
  }

  const [, tagName, textAlign, content] = match;
  return `<${tagName} style="text-align: ${textAlign}">${inlineMarkdownToHtml(
    content
  )}</${tagName}>`;
}

function blockWithAlignment(
  element: HTMLElement,
  markdown: string,
  fallbackTagName = element.tagName.toLowerCase()
) {
  const textAlign = element.style.textAlign;

  if (!["left", "center", "right"].includes(textAlign)) {
    return markdown;
  }

  return `<${fallbackTagName} style="text-align: ${textAlign}">${markdown}</${fallbackTagName}>`;
}

function isTableStart(lines: string[], index: number) {
  return (
    isTableLine(lines[index]) &&
    index + 1 < lines.length &&
    /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

function isTableLine(line: string) {
  return line.includes("|") && line.trim().length > 0;
}

function isListLine(line: string) {
  return /^\s*(?:[-*+]|\d+\.)\s+/.test(line);
}

type ListLine = {
  indent: number;
  ordered: boolean;
  checked: boolean | null;
  content: string;
};

function listMarkdownToHtml(lines: string[]) {
  const parsedLines = lines.map(parseListLine).filter((line): line is ListLine => line !== null);
  const root = { indent: -1, html: "" };
  const stack: Array<{ indent: number; ordered: boolean; items: string[] }> = [];

  for (const line of parsedLines) {
    while (stack.length > 0 && line.indent < stack[stack.length - 1].indent) {
      closeList(stack, root);
    }

    if (
      stack.length === 0 ||
      line.indent > stack[stack.length - 1].indent ||
      line.ordered !== stack[stack.length - 1].ordered
    ) {
      stack.push({ indent: line.indent, ordered: line.ordered, items: [] });
    }

    while (stack.length > 0 && line.indent < stack[stack.length - 1].indent) {
      closeList(stack, root);
    }

    const checkbox =
      line.checked === null
        ? ""
        : `<input type="checkbox"${line.checked ? " checked" : ""}> `;
    const taskAttribute = line.checked === null ? "" : ' data-task="true"';
    stack[stack.length - 1].items.push(
      `<li${taskAttribute}>${checkbox}${inlineMarkdownToHtml(line.content)}</li>`
    );
  }

  while (stack.length > 0) {
    closeList(stack, root);
  }

  return root.html;
}

function closeList(
  stack: Array<{ indent: number; ordered: boolean; items: string[] }>,
  root: { html: string }
) {
  const list = stack.pop();

  if (!list) {
    return;
  }

  const tagName = list.ordered ? "ol" : "ul";
  const html = `<${tagName}>${list.items.join("")}</${tagName}>`;
  const parent = stack[stack.length - 1];

  if (parent && parent.items.length > 0) {
    const lastItem = parent.items.pop() ?? "";
    parent.items.push(lastItem.replace(/<\/li>$/, `${html}</li>`));
  } else {
    root.html += html;
  }
}

function parseListLine(line: string): ListLine | null {
  const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);

  if (!match) {
    return null;
  }

  const task = match[3].match(/^\[([ xX])\]\s+(.*)$/);

  return {
    indent: match[1].replace(/\t/g, "  ").length,
    ordered: /\d+\./.test(match[2]),
    checked: task ? task[1].toLowerCase() === "x" : null,
    content: task ? task[2] : match[3]
  };
}

function tableMarkdownToHtml(lines: string[]) {
  const alignments = splitTableCells(lines[1] ?? "").map(parseTableAlignment);
  const rows = lines
    .filter((_, index) => index !== 1)
    .map((line, rowIndex) => {
      const cells = splitTableCells(line);
      const cellTag = rowIndex === 0 ? "th" : "td";
      return `<tr>${cells
        .map((cell, cellIndex) => {
          const alignment = alignments[cellIndex] ?? "left";
          return `<${cellTag} style="text-align: ${alignment}" data-align="${alignment}">${inlineMarkdownToHtml(cell.trim())}</${cellTag}>`;
        })
        .join("")}</tr>`;
    });

  return `<table><tbody>${rows.join("")}</tbody></table>`;
}

function tableElementToMarkdown(table: HTMLElement) {
  const rows = Array.from(table.querySelectorAll("tr"));
  const markdownRows = rows.map((row) =>
    Array.from(row.children).map((cell) => inlineNodeToMarkdown(cell).trim())
  );

  if (markdownRows.length === 0) {
    return "";
  }

  const header = markdownRows[0];
  const separator = Array.from(rows[0].children).map((cell) =>
    tableAlignmentSeparator((cell as HTMLElement).dataset.align || (cell as HTMLElement).style.textAlign)
  );
  const body = markdownRows.slice(1);

  return [header, separator, ...body]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function parseTableAlignment(separator: string) {
  const trimmed = separator.trim();

  if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
    return "center";
  }

  if (trimmed.endsWith(":")) {
    return "right";
  }

  return "left";
}

function tableAlignmentSeparator(alignment: string | undefined) {
  if (alignment === "center") {
    return ":---:";
  }

  if (alignment === "right") {
    return "---:";
  }

  return ":---";
}

function addTableRowAtSelection() {
  const cell = getSelectionTableCellFromWindow();
  const row = cell?.parentElement;

  if (!cell || !(row instanceof HTMLTableRowElement)) {
    return;
  }

  const newRow = row.cloneNode(true) as HTMLTableRowElement;
  for (const clonedCell of Array.from(newRow.children)) {
    clonedCell.textContent = "";
  }
  row.insertAdjacentElement("afterend", newRow);
  placeCaretInside(newRow.cells[Math.min(cell.cellIndex, newRow.cells.length - 1)]);
}

function deleteTableRowAtSelection() {
  const cell = getSelectionTableCellFromWindow();
  const row = cell?.parentElement;
  const table = cell?.closest("table");

  if (!cell || !(row instanceof HTMLTableRowElement) || !table || table.rows.length <= 1) {
    return;
  }

  const nextRow = table.rows[row.rowIndex + 1] ?? table.rows[row.rowIndex - 1];
  row.remove();
  placeCaretInside(nextRow.cells[Math.min(cell.cellIndex, nextRow.cells.length - 1)]);
}

function addTableColumnAtSelection() {
  const cell = getSelectionTableCellFromWindow();
  const table = cell?.closest("table");

  if (!cell || !table) {
    return;
  }

  const insertIndex = cell.cellIndex + 1;
  for (const row of Array.from(table.rows)) {
    const sourceCell = row.cells[Math.min(cell.cellIndex, row.cells.length - 1)];
    const newCell = document.createElement(sourceCell.tagName.toLowerCase());
    newCell.setAttribute("data-align", sourceCell.getAttribute("data-align") ?? "left");
    newCell.style.textAlign = sourceCell.style.textAlign || "left";
    newCell.textContent = "";
    row.insertBefore(newCell, row.cells[insertIndex] ?? null);
  }

  placeCaretInside(table.rows[cell.parentElement?.rowIndex ?? 0].cells[insertIndex]);
}

function deleteTableColumnAtSelection() {
  const cell = getSelectionTableCellFromWindow();
  const table = cell?.closest("table");

  if (!cell || !table || table.rows[0].cells.length <= 1) {
    return;
  }

  const deleteIndex = cell.cellIndex;
  const nextIndex = Math.max(0, deleteIndex - 1);

  for (const row of Array.from(table.rows)) {
    row.cells[deleteIndex]?.remove();
  }

  placeCaretInside(table.rows[cell.parentElement?.rowIndex ?? 0].cells[nextIndex]);
}

function alignTableColumnAtSelection(alignment: "left" | "center" | "right") {
  const cell = getSelectionTableCellFromWindow();
  const table = cell?.closest("table");

  if (!cell || !table) {
    return;
  }

  for (const row of Array.from(table.rows)) {
    const targetCell = row.cells[cell.cellIndex];

    if (targetCell) {
      targetCell.dataset.align = alignment;
      targetCell.style.textAlign = alignment;
    }
  }
}

function getSelectionTableCellFromWindow() {
  const selection = window.getSelection();
  return selection && selection.rangeCount > 0 ? getSelectionTableCell(selection) : null;
}

function splitTableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
