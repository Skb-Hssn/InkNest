export type MarkdownDocumentEnvelope = {
  frontmatter: string;
  body: string;
  newline: "\n" | "\r\n";
};

const frontmatterBoundary = /^(?:---|\.\.\.)[\t ]*$/;

export function splitMarkdownDocument(markdown: string): MarkdownDocumentEnvelope {
  const newline = markdown.includes("\r\n") ? "\r\n" : "\n";
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const bom = normalized.startsWith("\uFEFF") ? "\uFEFF" : "";
  const source = bom ? normalized.slice(1) : normalized;

  if (!source.startsWith("---\n")) {
    return {
      frontmatter: bom,
      body: source,
      newline
    };
  }

  const lines = source.split("\n");
  let closingLine = -1;

  for (let index = 1; index < lines.length; index += 1) {
    if (frontmatterBoundary.test(lines[index])) {
      closingLine = index;
      break;
    }
  }

  if (closingLine < 0) {
    return {
      frontmatter: bom,
      body: source,
      newline
    };
  }

  const frontmatter = `${bom}${lines.slice(0, closingLine + 1).join("\n")}\n`;
  const body = lines.slice(closingLine + 1).join("\n");

  return { frontmatter, body, newline };
}

export function joinMarkdownDocument(
  envelope: Pick<MarkdownDocumentEnvelope, "frontmatter" | "newline">,
  body: string
) {
  const normalizedBody = body.replace(/\r\n?/g, "\n");
  const markdown = `${envelope.frontmatter}${normalizedBody}`;

  return envelope.newline === "\r\n"
    ? markdown.replace(/\n/g, "\r\n")
    : markdown;
}
