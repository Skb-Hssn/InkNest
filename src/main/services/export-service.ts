import { constants } from "node:fs";
import { access as accessFile, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BrowserWindow } from "electron";
import type { ExportFormat, ExportNoteResult } from "../../shared/ipc";
import { exportFailed, invalidPayload } from "../ipc/errors";
import {
  isInsideWorkspace,
  resolveInsideWorkspace
} from "./path-utils";

const exportExtensionByFormat: Record<ExportFormat, string> = {
  markdown: ".md",
  html: ".html",
  pdf: ".pdf"
};

export async function exportMarkdownNote(
  workspaceRoot: string,
  notePath: string,
  format: ExportFormat,
  destinationPath: string
): Promise<ExportNoteResult> {
  const root = resolveInsideWorkspace(workspaceRoot);
  const sourcePath = resolveInsideWorkspace(root, notePath);
  const sourceStats = await stat(sourcePath).catch(() => null);

  if (
    !sourceStats?.isFile() ||
    path.extname(sourcePath).toLowerCase() !== ".md"
  ) {
    throw invalidPayload("The note to export must be an existing Markdown file.");
  }

  const targetPath = await validateExportDestination(
    root,
    sourcePath,
    destinationPath,
    format
  );
  const markdown = await readFile(sourcePath, "utf8");

  try {
    if (format === "markdown") {
      await writeFile(targetPath, markdown, "utf8");
    } else {
      const html = markdownToHtmlDocument(markdown, sourcePath, root);

      if (format === "html") {
        await writeFile(targetPath, html, "utf8");
      } else {
        await writeHtmlAsPdf(html, targetPath);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("EXPORT_FAILED:")) {
      throw error;
    }

    throw exportFailed(
      `Export failed. Check the destination folder and try again. ${getErrorMessage(error)}`
    );
  }

  return {
    exported: true,
    format,
    path: targetPath
  };
}

export const exportNote = exportMarkdownNote;

export function getExportExtension(format: ExportFormat) {
  return exportExtensionByFormat[format];
}

export function getDefaultExportPath(
  workspaceRoot: string,
  notePath: string,
  format: ExportFormat
) {
  const sourceName = path.basename(notePath, path.extname(notePath));
  return path.join(
    workspaceRoot,
    `${sourceName}-export${exportExtensionByFormat[format]}`
  );
}

export function assertExportFormat(value: unknown): ExportFormat {
  if (value === "markdown" || value === "html" || value === "pdf") {
    return value;
  }

  throw invalidPayload("format must be markdown, html, or pdf.");
}

function validateExportDestination(
  workspaceRoot: string,
  sourcePath: string,
  destinationPath: string,
  format: ExportFormat
) {
  const targetPath = path.resolve(destinationPath);
  const expectedExtension = exportExtensionByFormat[format];

  if (path.extname(targetPath).toLowerCase() !== expectedExtension) {
    throw invalidPayload(`Export destination must use the ${expectedExtension} extension.`);
  }

  if (path.resolve(targetPath) === path.resolve(sourcePath)) {
    throw invalidPayload("Export destination cannot overwrite the active note.");
  }

  const parentPath = path.dirname(targetPath);

  return accessFile(parentPath, constants.W_OK)
    .then(async () => {
      const parentStats = await stat(parentPath);

      if (!parentStats.isDirectory()) {
        throw invalidPayload("Export destination must be inside a folder.");
      }

      return targetPath;
    })
    .catch((error) => {
      if (error instanceof Error && error.message.startsWith("Export destination")) {
        throw error;
      }

      throw exportFailed(
        "Export failed. The destination folder does not exist or is not writable."
      );
    });
}

async function writeHtmlAsPdf(html: string, targetPath: string) {
  const exportWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  try {
    await exportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await exportWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true
    });
    await writeFile(targetPath, pdf);
  } finally {
    if (!exportWindow.isDestroyed()) {
      exportWindow.destroy();
    }
  }
}

export function markdownToHtmlDocument(
  markdown: string,
  notePath: string,
  workspaceRoot: string
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
      const language = escapeAttribute(trimmedLine.slice(3).trim());
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
        `<pre><code${language ? ` class="language-${language}"` : ""}>${escapeHtml(
          codeLines.join("\n")
        )}</code></pre>`
      );
      continue;
    }

    const heading = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push(
        `<h${heading[1].length}>${inlineMarkdownToHtml(
          heading[2],
          notePath,
          workspaceRoot
        )}</h${heading[1].length}>`
      );
      index += 1;
      continue;
    }

    if (/^(---+|\*\*\*+|___+)$/.test(trimmedLine)) {
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

      blocks.push(
        `<blockquote>${inlineMarkdownToHtml(
          quoteLines.join(" "),
          notePath,
          workspaceRoot
        )}</blockquote>`
      );
      continue;
    }

    if (isTableStart(lines, index)) {
      const tableLines: string[] = [];

      while (index < lines.length && isTableLine(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }

      blocks.push(tableToHtml(tableLines, notePath, workspaceRoot));
      continue;
    }

    if (/^(?:[-*+]\s+|\d+\.\s+)/.test(line)) {
      const listLines: string[] = [];
      const ordered = /^\d+\.\s+/.test(line);

      while (
        index < lines.length &&
        new RegExp(ordered ? "^\\d+\\.\\s+" : "^[-*+]\\s+").test(lines[index])
      ) {
        listLines.push(lines[index]);
        index += 1;
      }

      const listItems = listLines
        .map((listLine) => listLine.replace(ordered ? /^\d+\.\s+/ : /^[-*+]\s+/, ""))
        .map((item) => `<li>${inlineMarkdownToHtml(item, notePath, workspaceRoot)}</li>`)
        .join("");
      blocks.push(`<${ordered ? "ol" : "ul"}>${listItems}</${ordered ? "ol" : "ul"}>`);
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push(
      `<p>${inlineMarkdownToHtml(
        paragraphLines.join(" "),
        notePath,
        workspaceRoot
      )}</p>`
    );
  }

  const body = sanitizeExportedHtml(blocks.join("\n"));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(path.basename(notePath, path.extname(notePath)))}</title>
    <style>
      :root { color-scheme: light; font-family: Inter, Arial, sans-serif; color: #202522; background: #fff; }
      body { max-width: 860px; margin: 0 auto; padding: 48px 56px; line-height: 1.65; }
      h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.4em 0 .55em; }
      h1 { font-size: 2em; } h2 { font-size: 1.6em; } h3 { font-size: 1.3em; }
      blockquote { margin: 1em 0; padding: .5em 1em; border-left: 4px solid #82958a; background: #f3f6f3; }
      pre { overflow-x: auto; padding: 16px; border-radius: 8px; background: #f1f3f1; }
      code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      :not(pre) > code { padding: .15em .35em; border-radius: 4px; background: #eef1ee; }
      table { width: 100%; border-collapse: collapse; margin: 1em 0; }
      th, td { border: 1px solid #b9c2bc; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #f1f3f1; }
      img { max-width: 100%; height: auto; border-radius: 6px; }
      a { color: #295f47; }
      hr { border: 0; border-top: 2px solid #b9c2bc; margin: 2em 0; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

export const renderMarkdownToHtml = markdownToHtmlDocument;

function inlineMarkdownToHtml(
  markdown: string,
  notePath: string,
  workspaceRoot: string
) {
  const tokens: string[] = [];
  let source = escapeHtml(markdown);

  source = source.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const safeSrc = resolveExportImageSource(String(src), notePath, workspaceRoot);
    tokens.push(
      `<img src="${escapeAttribute(safeSrc)}" alt="${escapeAttribute(String(alt))}">`
    );
    return `\u0000${tokens.length - 1}\u0000`;
  });
  source = source.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const safeHref = resolveExportLink(String(href), notePath, workspaceRoot);
    tokens.push(
      `<a href="${escapeAttribute(safeHref)}">${label}</a>`
    );
    return `\u0000${tokens.length - 1}\u0000`;
  });
  source = source.replace(/`([^`]+)`/g, "<code>$1</code>");
  source = source.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  source = source.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  source = source.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return source.replace(/\u0000(\d+)\u0000/g, (_, tokenIndex) => tokens[Number(tokenIndex)]);
}

function tableToHtml(lines: string[], notePath: string, workspaceRoot: string) {
  const rows = lines
    .filter((line) => !/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
    .map((line) => splitTableCells(line));
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  return `<table><thead><tr>${header
    .map((cell) => `<th>${inlineMarkdownToHtml(cell, notePath, workspaceRoot)}</th>`)
    .join("")}</tr></thead><tbody>${body
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${inlineMarkdownToHtml(cell, notePath, workspaceRoot)}</td>`)
          .join("")}</tr>`
    )
    .join("")}</tbody></table>`;
}

function splitTableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableStart(lines: string[], index: number) {
  return (
    index + 1 < lines.length &&
    isTableLine(lines[index]) &&
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

function isTableLine(line: string) {
  return line.includes("|");
}

function resolveExportImageSource(
  source: string,
  notePath: string,
  workspaceRoot: string
) {
  if (/^(?:https?:|data:)/i.test(source)) {
    return source;
  }

  if (/^(?:file:|blob:|javascript:)/i.test(source)) {
    return "#";
  }

  try {
    const decodedSource = decodeURIComponent(source);
    const resolvedPath = path.resolve(path.dirname(notePath), decodedSource);

    if (!isInsideWorkspace(workspaceRoot, resolvedPath)) {
      return "#";
    }

    return pathToFileURL(resolvedPath).toString();
  } catch {
    return "#";
  }
}

function resolveExportLink(source: string, notePath: string, workspaceRoot: string) {
  const trimmedSource = source.trim();

  if (/^(?:https?:|mailto:)/i.test(trimmedSource)) {
    return trimmedSource;
  }

  if (/^(?:javascript:|data:|file:|blob:|\/\/)/i.test(trimmedSource)) {
    return "#";
  }

  try {
    const [pathPart] = decodeURIComponent(trimmedSource).split("#", 1);
    const resolvedPath = path.resolve(path.dirname(notePath), pathPart || ".");

    if (!isInsideWorkspace(workspaceRoot, resolvedPath)) {
      return "#";
    }

    return pathToFileURL(resolvedPath).toString();
  } catch {
    return "#";
  }
}

export function sanitizeExportedHtml(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\b(?:href|src)\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown filesystem error.";
}
