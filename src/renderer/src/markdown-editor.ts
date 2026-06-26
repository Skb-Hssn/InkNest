const blockSeparator = "\n\n";

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

      blocks.push(
        `<pre><code data-language="${escapeHtml(language)}">${escapeHtml(
          codeLines.join("\n")
        )}</code></pre>`
      );
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

      blocks.push(`<blockquote>${markdownToHtml(quoteLines.join("\n"))}</blockquote>`);
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

    if (/^[-*+]\s+/.test(trimmedLine) || /^[-*+]\s+\[[ xX]\]\s+/.test(trimmedLine)) {
      const items: string[] = [];

      while (
        index < lines.length &&
        (/^[-*+]\s+/.test(lines[index].trim()) ||
          /^[-*+]\s+\[[ xX]\]\s+/.test(lines[index].trim()))
      ) {
        const item = lines[index].trim().replace(/^[-*+]\s+/, "");
        const task = item.match(/^\[([ xX])\]\s+(.*)$/);

        if (task) {
          const checked = task[1].toLowerCase() === "x" ? " checked" : "";
          items.push(
            `<li data-task="true"><input type="checkbox"${checked}> ${inlineMarkdownToHtml(
              task[2]
            )}</li>`
          );
        } else {
          items.push(`<li>${inlineMarkdownToHtml(item)}</li>`);
        }

        index += 1;
      }

      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmedLine)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(
          `<li>${inlineMarkdownToHtml(lines[index].trim().replace(/^\d+\.\s+/, ""))}</li>`
        );
        index += 1;
      }

      blocks.push(`<ol>${items.join("")}</ol>`);
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

  if (tagName === "p") {
    return inlineNodeToMarkdown(node).trim();
  }

  if (tagName === "blockquote") {
    return Array.from(node.childNodes)
      .map((child) => blockNodeToMarkdown(child))
      .join(blockSeparator)
      .split("\n")
      .map((line) => `> ${line}`.trimEnd())
      .join("\n");
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

  return `${marker} ${inlineNodeToMarkdown(item).trim()}`;
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

  if (tagName === "a") {
    return `[${inlineChildrenToMarkdown(node)}](${node.getAttribute("href") ?? ""})`;
  }

  if (tagName === "img") {
    return `![${node.getAttribute("alt") ?? ""}](${node.getAttribute("src") ?? ""})`;
  }

  return inlineChildrenToMarkdown(node);
}

function inlineChildrenToMarkdown(element: HTMLElement) {
  return Array.from(element.childNodes).map(inlineNodeToMarkdown).join("");
}

function inlineMarkdownToHtml(markdown: string) {
  const tokens: string[] = [];
  let source = escapeHtml(markdown);

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

  return source.replace(/\u0000(\d+)\u0000/g, (_, tokenIndex) => tokens[Number(tokenIndex)]);
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

function tableMarkdownToHtml(lines: string[]) {
  const rows = lines
    .filter((_, index) => index !== 1)
    .map((line, rowIndex) => {
      const cells = splitTableCells(line);
      const cellTag = rowIndex === 0 ? "th" : "td";
      return `<tr>${cells
        .map((cell) => `<${cellTag}>${inlineMarkdownToHtml(cell.trim())}</${cellTag}>`)
        .join("")}</tr>`;
    });

  return `<table><tbody>${rows.join("")}</tbody></table>`;
}

function tableElementToMarkdown(table: HTMLElement) {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.children).map((cell) => inlineNodeToMarkdown(cell).trim())
  );

  if (rows.length === 0) {
    return "";
  }

  const header = rows[0];
  const separator = header.map(() => "---");
  const body = rows.slice(1);

  return [header, separator, ...body]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
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
