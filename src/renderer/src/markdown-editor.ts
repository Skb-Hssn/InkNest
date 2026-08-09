const blockSeparator = "\n\n";

type MarkdownRenderOptions = {
  workspacePath?: string | null;
  notePath?: string | null;
};

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
  | "code-block"
  | "divider"
  | "table"
  | "table-add-row"
  | "table-delete-row"
  | "table-add-column"
  | "table-delete-column"
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
  previewSrc?: string;
  language?: string;
  width?: string;
  equation?: string;
};

export function markdownToHtml(
  markdown: string,
  options: MarkdownRenderOptions = {}
) {
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
      blocks.push(
        `<h${level}>${inlineMarkdownToHtml(heading[2], options)}</h${level}>`
      );
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

      blocks.push(blockquoteMarkdownToHtml(quoteLines, options));
      continue;
    }

    if (isTableStart(lines, index)) {
      const tableLines: string[] = [];

      while (index < lines.length && isTableLine(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }

      blocks.push(tableMarkdownToHtml(tableLines, options));
      continue;
    }

    if (isListLine(line)) {
      const listLines: string[] = [];

      while (index < lines.length && isListLine(lines[index])) {
        listLines.push(lines[index]);
        index += 1;
      }

      blocks.push(listMarkdownToHtml(listLines, options));
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length && lines[index].trim()) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(`<p>${inlineMarkdownToHtml(paragraphLines.join(" "), options)}</p>`);
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
      `<blockquote data-callout="${escapeAttribute(type)}"><p><br></p></blockquote>`
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
    insertTableAtSelection(
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

  if (command === "link") {
    const url = options.url?.trim();
    const label = options.label?.trim() || getSelectedText() || "Link";

    if (url) {
      insertHtmlAtSelection(
        `<a href="${escapeAttribute(sanitizeMarkdownHref(url))}">${escapeHtml(label)}</a>`
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
    const previewSrc = options.previewSrc?.trim() || src || "";

    if (src) {
      insertHtmlAtSelection(
        `<img src="${escapeAttribute(previewSrc)}" alt="${escapeAttribute(alt)}" data-markdown-src="${escapeAttribute(src)}">`
      );
    }

    return;
  }

  if (command === "image-resize") {
    resizeImageAtSelection(options.width);
    return;
  }

  if (command === "inline-math") {
    insertHtmlAtSelection(`${mathToHtml(options.equation?.trim() || "x = y", false)} `);
    return;
  }

  if (command === "block-math") {
    insertHtmlAtSelection(`${mathToHtml(options.equation?.trim() || "x = y", true)}<p><br></p>`);
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

  if (command === "task-list") {
    const taskList = document.createElement("ul");
    taskList.innerHTML = '<li data-task="true"><input type="checkbox"> Task</li>';
    block.replaceWith(taskList);
    placeCaretInside(taskList.querySelector("li") ?? taskList);
    return command;
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

export function exitInlineAtomAtSelection() {
  const element = getSelectionElement();
  const inlineAtom = element?.closest("code,[data-math-display='inline']");

  if (!(inlineAtom instanceof HTMLElement) || inlineAtom.closest("pre")) {
    return false;
  }

  const spacer = document.createTextNode(" ");
  inlineAtom.insertAdjacentElement("afterend", document.createElement("span"));
  const placeholder = inlineAtom.nextElementSibling;

  if (!placeholder) {
    return false;
  }

  placeholder.replaceWith(spacer);
  const range = document.createRange();
  const selection = window.getSelection();

  range.setStart(spacer, spacer.textContent?.length ?? 0);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);

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

  if (key === "Enter" && listItem.dataset.task === "true" && !isVisiblyEmpty(listItem)) {
    insertTaskListItemAfter(listItem);
    return true;
  }

  if (key === "Enter" && isVisiblyEmpty(listItem)) {
    exitEmptyListItem(listItem);
    return true;
  }

  return false;
}

function insertTaskListItemAfter(listItem: HTMLLIElement) {
  const nextItem = document.createElement("li");
  const checkbox = document.createElement("input");
  const textAnchor = document.createTextNode("\u200b");

  nextItem.dataset.task = "true";
  checkbox.type = "checkbox";
  nextItem.append(checkbox, document.createTextNode(" "), textAnchor);
  listItem.insertAdjacentElement("afterend", nextItem);

  const range = document.createRange();
  const selection = window.getSelection();

  range.setStart(textAnchor, textAnchor.textContent?.length ?? 0);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function exitEmptyListItem(listItem: HTMLLIElement) {
  const currentList = listItem.parentElement;

  if (!(currentList instanceof HTMLOListElement || currentList instanceof HTMLUListElement)) {
    return;
  }

  const parentListItem = currentList.parentElement?.closest("li");

  if (parentListItem instanceof HTMLLIElement) {
    const parentList = parentListItem.parentElement;
    const nextItem = document.createElement("li");

    nextItem.append(document.createElement("br"));
    parentListItem.insertAdjacentElement("afterend", nextItem);
    listItem.remove();

    if (currentList.children.length === 0) {
      currentList.remove();
    }

    if (parentList instanceof HTMLOListElement) {
      normalizeOrderedListStarts(parentList);
    }

    placeCaretInside(nextItem);
    return;
  }

  const paragraph = document.createElement("p");
  paragraph.append(document.createElement("br"));
  currentList.insertAdjacentElement("afterend", paragraph);
  listItem.remove();

  if (currentList.children.length === 0) {
    currentList.remove();
  }

  placeCaretInside(paragraph);
}

function normalizeOrderedListStarts(list: HTMLOListElement) {
  const orderedLists = Array.from(list.parentElement?.children ?? []).filter(
    (element): element is HTMLOListElement => element instanceof HTMLOListElement
  );

  let nextStart = 1;

  for (const orderedList of orderedLists) {
    orderedList.start = nextStart;
    nextStart += orderedList.querySelectorAll(":scope > li").length;
  }
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
    return `${"#".repeat(Number(tagName[1]))} ${inlineNodeToMarkdown(node).trim()}`;
  }

  if (node.dataset.math && node.dataset.mathDisplay === "block") {
    return `$$\n${node.dataset.math}\n$$`;
  }

  if (tagName === "p") {
    return inlineNodeToMarkdown(node).trim();
  }

  if (tagName === "blockquote") {
    const calloutType = node.dataset.callout;

    if (calloutType && ["note", "warning", "info", "success"].includes(calloutType)) {
      return calloutElementToMarkdown(node, calloutType);
    }

    return quoteMarkdownLines(blockElementChildrenToMarkdown(node));
  }

  if (tagName === "ul" || tagName === "ol") {
    const startIndex = node instanceof HTMLOListElement ? node.start - 1 : 0;

    return Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child, childIndex) =>
        listItemToMarkdown(child as HTMLElement, tagName, startIndex + childIndex)
      )
      .join("\n");
  }

  if (tagName === "pre") {
    return codeBlockElementToMarkdown(node);
  }

  if (tagName === "table") {
    return tableElementToMarkdown(node);
  }

  if (tagName === "hr") {
    return "---";
  }

  if (tagName === "div") {
    return Array.from(node.childNodes)
      .map((child) => blockNodeToMarkdown(child))
      .filter(Boolean)
      .join(blockSeparator);
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

function blockElementChildrenToMarkdown(element: HTMLElement) {
  return Array.from(element.childNodes)
    .map((child) => blockNodeToMarkdown(child))
    .join(blockSeparator)
    .trim();
}

function calloutElementToMarkdown(element: HTMLElement, type: string) {
  const marker = `> [!${type.toUpperCase()}]`;
  const body = blockElementChildrenToMarkdown(element);

  return body ? `${marker}\n${quoteMarkdownLines(body)}` : marker;
}

function quoteMarkdownLines(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

function codeBlockElementToMarkdown(element: HTMLElement) {
  const code = element.querySelector("code");
  const language = code?.getAttribute("data-language") ?? "";
  const codeText = code?.textContent ?? "";

  return `\`\`\`${language}\n${codeText.replace(/\n$/, "")}\n\`\`\``;
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

  if (tagName === "pre") {
    return codeBlockElementToMarkdown(node);
  }

  if (tagName === "table") {
    return tableElementToMarkdown(node);
  }

  if (tagName === "blockquote") {
    const calloutType = node.dataset.callout;

    if (calloutType && ["note", "warning", "info", "success"].includes(calloutType)) {
      return calloutElementToMarkdown(node, calloutType);
    }

    return quoteMarkdownLines(blockElementChildrenToMarkdown(node));
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
    const src = node.dataset.markdownSrc ?? node.getAttribute("src") ?? "";
    const width = node.getAttribute("width") ?? node.style.width.replace("px", "");

    return width
      ? `<img src="${src}" alt="${alt}" width="${width}">`
      : `![${alt}](${src})`;
  }

  if (node.dataset.brokenImage === "true") {
    const alt = node.dataset.imageAlt ?? "Missing image";
    const src = node.dataset.markdownSrc ?? "";
    return `![${alt}](${src})`;
  }

  return inlineChildrenToMarkdown(node);
}

function inlineChildrenToMarkdown(element: HTMLElement) {
  return Array.from(element.childNodes).map(inlineNodeToMarkdown).join("");
}

function getSelectedText() {
  return window.getSelection()?.toString().trim() ?? "";
}

function insertHtmlAtSelection(html: string) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const fragment = template.content;
  const lastInsertedNode = fragment.lastChild;
  const range = selection.getRangeAt(0);

  range.deleteContents();
  range.insertNode(fragment);

  if (lastInsertedNode) {
    range.setStartAfter(lastInsertedNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  return lastInsertedNode;
}

function insertTableAtSelection(html: string) {
  const selectionElement = getSelectionElement();
  const currentTable = selectionElement?.closest("table");

  if (currentTable instanceof HTMLTableElement) {
    const template = document.createElement("template");
    template.innerHTML = html;
    const table = template.content.firstElementChild;

    if (!(table instanceof HTMLTableElement)) {
      return;
    }

    currentTable.insertAdjacentElement("afterend", table);
    placeCaretInside(table.querySelector("th,td") ?? table);
    return;
  }

  const insertedNode = insertHtmlAtSelection(html);

  if (insertedNode instanceof HTMLTableElement) {
    placeCaretInside(insertedNode.querySelector("th,td") ?? insertedNode);
  }
}

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;

  if (!parent) {
    return;
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  element.remove();
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

  const range = selection.getRangeAt(0);
  const fragment = range.extractContents();
  const startMarker = document.createTextNode("");
  const endMarker = document.createTextNode("");

  stripFormattingFromFragment(fragment);
  fragment.prepend(startMarker);
  fragment.append(endMarker);
  range.insertNode(fragment);

  const nextRange = document.createRange();
  nextRange.setStartAfter(startMarker);
  nextRange.setEndBefore(endMarker);
  selection.removeAllRanges();
  selection.addRange(nextRange);
  startMarker.remove();
  endMarker.remove();
}

function stripFormattingFromFragment(fragment: DocumentFragment) {
  for (const element of Array.from(
    fragment.querySelectorAll("strong,b,em,i,s,strike,del,code,mark,span,a")
  )) {
    unwrapElement(element as HTMLElement);
  }
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

  if (!nextEquation) {
    return;
  }

  if (!(mathElement instanceof HTMLElement)) {
    insertHtmlAtSelection(`${mathToHtml(nextEquation, false)} `);
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

function blockquoteMarkdownToHtml(
  quoteLines: string[],
  options: MarkdownRenderOptions
) {
  const callout = quoteLines[0]?.trim().match(/^\[!(NOTE|WARNING|INFO|SUCCESS)\]\s*(.*)$/i);

  if (!callout) {
    return `<blockquote>${markdownToHtml(quoteLines.join("\n"), options)}</blockquote>`;
  }

  const type = callout[1].toLowerCase();
  const title = callout[2].trim();
  const bodyLines = title ? [title, ...quoteLines.slice(1)] : quoteLines.slice(1);
  const body = bodyLines.join("\n").trim();

  return `<blockquote data-callout="${type}">${body ? markdownToHtml(body, options) : "<p><br></p>"}</blockquote>`;
}

const codeBlockLanguages = [
  { value: "", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "tsx", label: "TSX" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "python", label: "Python" },
  { value: "bash", label: "Bash" },
  { value: "markdown", label: "Markdown" }
];

function codeBlockToHtml(code: string, language: string) {
  const safeLanguage = escapeAttribute(language);
  return `<pre>${codeLanguageSelectToHtml(language)}<button type="button" class="code-copy-button" contenteditable="false" data-code-copy="true">Copy</button><code data-language="${safeLanguage}" class="language-${safeLanguage}">${highlightCode(
    code,
    language
  )}</code></pre>`;
}

function codeLanguageSelectToHtml(language: string) {
  const normalizedLanguage = language.trim().toLowerCase();
  const hasKnownLanguage = codeBlockLanguages.some(
    (codeLanguage) => codeLanguage.value === normalizedLanguage
  );
  const selectedLanguage = hasKnownLanguage ? normalizedLanguage : "";

  return `<select class="code-language-select" contenteditable="false" data-code-language="true" aria-label="Code block language">${codeBlockLanguages
    .map(
      (codeLanguage) =>
        `<option value="${escapeAttribute(codeLanguage.value)}"${codeLanguage.value === selectedLanguage ? " selected" : ""}>${escapeHtml(codeLanguage.label)}</option>`
    )
    .join("")}</select>`;
}

export function updateCodeBlockLanguageFromSelect(select: HTMLSelectElement) {
  const pre = select.closest("pre");
  const code = pre?.querySelector("code");

  if (!pre || !code) {
    return false;
  }

  const language = select.value.trim();
  const codeText = code.textContent ?? "";

  code.dataset.language = language;
  code.className = language ? `language-${language}` : "language-";
  code.innerHTML = highlightCode(codeText, language);

  return true;
}

function highlightCode(code: string, language: string) {
  const safeCode = escapeHtml(code);
  const normalizedLanguage = language.toLowerCase();

  if (!language.trim()) {
    return safeCode;
  }

  if (/^(js|jsx|ts|tsx|javascript|typescript)$/.test(normalizedLanguage)) {
    return safeCode
      .replace(
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|type|interface|async|await|new|try|catch|throw|extends|implements)\b/g,
        '<span class="syntax-keyword">$1</span>'
      )
      .replace(/(&quot;.*?&quot;|'.*?'|`.*?`)/g, '<span class="syntax-string">$1</span>')
      .replace(/\/\/.*$/gm, '<span class="syntax-comment">$&</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="syntax-number">$1</span>');
  }

  if (/^(html|xml)$/.test(normalizedLanguage)) {
    return safeCode.replace(
      /(&lt;\/?[\w-]+|\/?&gt;|[\w-]+(?==))/g,
      '<span class="syntax-keyword">$1</span>'
    );
  }

  if (/^(css|scss)$/.test(normalizedLanguage)) {
    return safeCode
      .replace(/([.#]?[\w-]+)(\s*\{)/g, '<span class="syntax-keyword">$1</span>$2')
      .replace(/([\w-]+)(\s*:)/g, '<span class="syntax-attribute">$1</span>$2')
      .replace(/(:\s*)([^;{}]+)/g, '$1<span class="syntax-string">$2</span>');
  }

  if (/^(json)$/.test(normalizedLanguage)) {
    return safeCode
      .replace(/(&quot;[^&]+&quot;)(\s*:)/g, '<span class="syntax-attribute">$1</span>$2')
      .replace(/(:\s*)(&quot;.*?&quot;)/g, '$1<span class="syntax-string">$2</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="syntax-keyword">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="syntax-number">$1</span>');
  }

  if (/^(py|python)$/.test(normalizedLanguage)) {
    return safeCode
      .replace(
        /\b(def|class|return|if|elif|else|for|while|in|import|from|as|try|except|with|lambda|True|False|None|async|await)\b/g,
        '<span class="syntax-keyword">$1</span>'
      )
      .replace(/(&quot;.*?&quot;|'.*?')/g, '<span class="syntax-string">$1</span>')
      .replace(/#.*$/gm, '<span class="syntax-comment">$&</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="syntax-number">$1</span>');
  }

  if (/^(sh|bash|zsh|shell)$/.test(normalizedLanguage)) {
    return safeCode
      .replace(/\b(cd|ls|echo|export|npm|git|pnpm|yarn|if|then|else|fi|for|do|done)\b/g, '<span class="syntax-keyword">$1</span>')
      .replace(/(&quot;.*?&quot;|'.*?')/g, '<span class="syntax-string">$1</span>')
      .replace(/#.*$/gm, '<span class="syntax-comment">$&</span>');
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

function inlineMarkdownToHtml(
  markdown: string,
  options: MarkdownRenderOptions = {}
) {
  const tokens: string[] = [];
  let source = escapeHtml(markdown);

  source = restoreLimitedImageHtml(source, tokens, options);
  source = source.replace(/(?<!\$)\$([^$\n]+)\$(?!\$)/g, (_, equation) => {
    tokens.push(mathToHtml(String(equation), false));
    return `\u0000${tokens.length - 1}\u0000`;
  });
  source = source.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    tokens.push(imageToHtml(String(src), String(alt), undefined, options));
    return `\u0000${tokens.length - 1}\u0000`;
  });
  source = source.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeHref = sanitizeMarkdownHref(String(href));
    const linkKind = /^https?:\/\//i.test(safeHref) ? "external" : "local";
    tokens.push(
      `<a href="${escapeAttribute(safeHref)}" data-link-kind="${linkKind}">${label}</a>`
    );
    return `\u0000${tokens.length - 1}\u0000`;
  });
  source = source.replace(/`([^`]+)`/g, "<code>$1</code>");
  source = source.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  source = source.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  source = source.replace(/~~([^~]+)~~/g, "<s>$1</s>");

  return source.replace(/\u0000(\d+)\u0000/g, (_, tokenIndex) => tokens[Number(tokenIndex)]);
}

function restoreLimitedImageHtml(
  source: string,
  tokens: string[],
  options: MarkdownRenderOptions
) {
  return source.replace(
    /&lt;img src=&quot;([^"]+)&quot; alt=&quot;([^"]*)&quot; width=&quot;([\d.]+)&quot;&gt;/g,
    (_, src, alt, width) => {
      tokens.push(
        imageToHtml(String(src), String(alt), String(width), options)
      );
      return `\u0000${tokens.length - 1}\u0000`;
    }
  );
}

function imageToHtml(
  markdownSrc: string,
  alt: string,
  width: string | undefined,
  options: MarkdownRenderOptions
) {
  const displaySrc = resolveImageDisplaySrc(markdownSrc, options);
  const widthAttributes = width
    ? ` width="${escapeAttribute(width)}" style="width: ${escapeAttribute(width)}px; height: auto;"`
    : "";

  return `<img src="${escapeAttribute(displaySrc)}" alt="${escapeAttribute(alt)}" data-markdown-src="${escapeAttribute(markdownSrc)}" data-local-image="true"${widthAttributes}>`;
}

function resolveImageDisplaySrc(
  src: string,
  options: MarkdownRenderOptions
) {
  if (/^(?:data:|https?:|file:|blob:)/i.test(src) || src.startsWith("/")) {
    return src;
  }

  if (!options.workspacePath || !isSafeWorkspaceRelativePath(src, options.notePath)) {
    return src;
  }

  const workspaceUrl = `${workspacePathToFileUrl(options.workspacePath)}/`;
  const noteDirectory = options.notePath
    ? options.notePath.split(/[\\/]/).slice(0, -1).join("/")
    : "";

  return new URL(encodeURI(src), `${workspaceUrl}${encodeURI(noteDirectory)}/`).toString();
}

function sanitizeMarkdownHref(value: string) {
  const href = value.trim();

  if (/^(?:javascript|data|vbscript):/i.test(href)) {
    return "#";
  }

  return href || "#";
}

function isSafeWorkspaceRelativePath(src: string, notePath?: string | null) {
  if (/^(?:data:|https?:|file:|blob:)/i.test(src) || src.startsWith("/")) {
    return false;
  }

  const segments = [
    ...(notePath ? notePath.split(/[\\/]/).slice(0, -1) : []),
    ...src.split(/[\\/]/)
  ];
  let depth = 0;

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      depth -= 1;
    } else {
      depth += 1;
    }

    if (depth < 0) {
      return false;
    }
  }

  return true;
}

function workspacePathToFileUrl(workspacePath: string) {
  const normalizedPath = workspacePath.replace(/\\/g, "/").replace(/\/+$/g, "");
  const pathWithLeadingSlash = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;

  return `file://${encodeURI(pathWithLeadingSlash)}`;
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
    /\\(sin|cos|tan|log|ln|lim|max|min)\b/g,
    '<span class="math-fn">$1</span>'
  );
  rendered = rendered.replace(
    /\^(\{([^{}]+)\}|[A-Za-z0-9+-]+)/g,
    (_, __, grouped, plain) => `<sup>${grouped ?? plain}</sup>`
  );
  rendered = rendered.replace(
    /_(\{([^{}]+)\}|[A-Za-z0-9+-]+)/g,
    (_, __, grouped, plain) => `<sub>${grouped ?? plain}</sub>`
  );
  rendered = rendered.replace(
    /\\([A-Za-z]+)\b/g,
    (_, symbol) => mathSymbols[symbol] ?? symbol
  );

  return rendered;
}

const mathSymbols: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  omicron: "ο",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
  pm: "±",
  times: "×",
  div: "÷",
  cdot: "·",
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  neq: "≠",
  approx: "≈",
  equiv: "≡",
  infty: "∞",
  sum: "∑",
  prod: "∏",
  int: "∫",
  partial: "∂",
  nabla: "∇",
  rightarrow: "→",
  to: "→",
  leftarrow: "←",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  leftrightarrow: "↔",
  forall: "∀",
  exists: "∃",
  in: "∈",
  notin: "∉",
  subset: "⊂",
  subseteq: "⊆",
  cup: "∪",
  cap: "∩",
  land: "∧",
  lor: "∨",
  emptyset: "∅"
};

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

function listMarkdownToHtml(lines: string[], options: MarkdownRenderOptions) {
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
      `<li${taskAttribute}>${checkbox}${inlineMarkdownToHtml(line.content, options)}</li>`
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

function tableMarkdownToHtml(lines: string[], options: MarkdownRenderOptions) {
  const rows = lines
    .filter((_, index) => index !== 1)
    .map((line, rowIndex) => {
      const cells = splitTableCells(line);
      const cellTag = rowIndex === 0 ? "th" : "td";
      return `<tr>${cells
        .map(
          (cell) =>
            `<${cellTag}>${inlineMarkdownToHtml(cell.trim(), options)}</${cellTag}>`
        )
        .join("")}</tr>`;
    });

  return `<table><tbody>${rows.join("")}</tbody></table>`;
}

function tableElementToMarkdown(table: HTMLElement) {
  const rows = Array.from((table as HTMLTableElement).rows);
  const columnCount = Math.max(...rows.map((row) => row.cells.length), 0);
  const markdownRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, cellIndex) =>
      tableCellToMarkdown(row.cells[cellIndex] ?? null)
    )
  );

  if (markdownRows.length === 0 || columnCount === 0) {
    return "";
  }

  const header = markdownRows[0];
  const separator = header.map(() => "---");
  const body = markdownRows.slice(1);

  return [header, separator, ...body]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function tableCellToMarkdown(cell: HTMLTableCellElement | null) {
  if (!cell) {
    return "";
  }

  return escapeTableCellMarkdown(inlineNodeToMarkdown(cell).trim());
}

function escapeTableCellMarkdown(markdown: string) {
  return markdown
    .replace(/\n+/g, "<br>")
    .replace(/(?<!\\)\|/g, "\\|");
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
  const table = cell?.closest("table") as HTMLTableElement | null;

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

  const insertIndex = Math.max(...Array.from(table.rows, (row) => row.cells.length));
  for (const row of Array.from(table.rows)) {
    const sourceCell = row.cells[row.cells.length - 1];

    if (!sourceCell) {
      continue;
    }

    const newCell = document.createElement(sourceCell.tagName.toLowerCase());
    newCell.textContent = "";
    row.insertBefore(newCell, row.cells[insertIndex] ?? null);
  }

  const rowIndex =
    cell.parentElement instanceof HTMLTableRowElement
      ? cell.parentElement.rowIndex
      : 0;
  placeCaretInside(table.rows[rowIndex].cells[insertIndex]);
}

function deleteTableColumnAtSelection() {
  const cell = getSelectionTableCellFromWindow();
  const table = cell?.closest("table") as HTMLTableElement | null;

  if (!cell || !table || table.rows[0].cells.length <= 1) {
    return;
  }

  const deleteIndex = cell.cellIndex;
  const nextIndex = Math.max(0, deleteIndex - 1);

  for (const row of Array.from(table.rows)) {
    row.cells[deleteIndex]?.remove();
  }

  const rowIndex =
    cell.parentElement instanceof HTMLTableRowElement
      ? cell.parentElement.rowIndex
      : 0;
  placeCaretInside(table.rows[rowIndex].cells[nextIndex]);
}

function getSelectionTableCellFromWindow() {
  const selection = window.getSelection();
  return selection && selection.rangeCount > 0 ? getSelectionTableCell(selection) : null;
}

function splitTableCells(line: string) {
  const cells: string[] = [];
  let currentCell = "";
  const trimmedLine = line.trim().replace(/^\|/, "").replace(/\|$/, "");

  for (let index = 0; index < trimmedLine.length; index += 1) {
    const character = trimmedLine[index];
    const nextCharacter = trimmedLine[index + 1];

    if (character === "\\" && nextCharacter === "|") {
      currentCell += "|";
      index += 1;
      continue;
    }

    if (character === "|") {
      cells.push(currentCell);
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  cells.push(currentCell);
  return cells;
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
