import { refractor } from "refractor/all";
import type { Root, RootContent } from "hast";

export type CodeHighlight = { from: number; to: number; className: string };
const aliases: Record<string, string> = {
  "c++": "cpp", "c#": "csharp", "f#": "fsharp", golang: "go", ps1: "powershell", proto: "protobuf"
};
const tokenClasses: Record<string, string> = {
  keyword: "syntax-keyword", comment: "syntax-comment", string: "syntax-string", number: "syntax-number"
};

export function supportsCodeLanguage(language: string) {
  const normalized = language.trim().toLocaleLowerCase();
  return Boolean(normalized && refractor.registered(aliases[normalized] ?? normalized));
}

/** Highlight as text ranges, never HTML, keeping the editable code untouched. */
export function highlightCode(code: string, language: string): CodeHighlight[] {
  const normalized = language.trim().toLocaleLowerCase();
  if (!code || code.length > 100_000 || !supportsCodeLanguage(normalized)) return [];
  let tree: Root;
  try { tree = refractor.highlight(code, aliases[normalized] ?? normalized); }
  catch { return []; }
  const highlights: CodeHighlight[] = [];
  let offset = 0;
  function visit(node: Root | RootContent, inherited: string[] = []) {
    if (node.type === "text") {
      const from = offset;
      offset += node.value.length;
      if (inherited.length && offset > from) highlights.push({ from, to: offset, className: inherited.join(" ") });
      return;
    }
    if (node.type !== "root" && node.type !== "element") return;
    const classes = node.type === "element" && Array.isArray(node.properties.className)
      ? node.properties.className.filter((token): token is string => typeof token === "string" && token !== "token")
        .map(token => tokenClasses[token] ?? `syntax-${token}`) : [];
    node.children.forEach(child => visit(child, classes.length ? classes : inherited));
  }
  visit(tree);
  return highlights;
}
