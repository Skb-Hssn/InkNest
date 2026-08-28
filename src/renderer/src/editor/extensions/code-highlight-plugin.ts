import { Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

type HighlightRule = {
  expression: RegExp;
  className: string;
};

const commonRules: HighlightRule[] = [
  { expression: /\/\/.*$/gm, className: "syntax-comment" },
  { expression: /#.*$/gm, className: "syntax-comment" },
  { expression: /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, className: "syntax-string" },
  { expression: /\b\d+(?:\.\d+)?\b/g, className: "syntax-number" }
];

const languageKeywords: Record<string, RegExp> = {
  javascript: /\b(?:const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|try|catch|throw|extends)\b/g,
  js: /\b(?:const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|try|catch|throw|extends)\b/g,
  typescript: /\b(?:const|let|var|function|return|if|else|for|while|class|import|export|from|type|interface|async|await|new|try|catch|throw|extends|implements)\b/g,
  ts: /\b(?:const|let|var|function|return|if|else|for|while|class|import|export|from|type|interface|async|await|new|try|catch|throw|extends|implements)\b/g,
  tsx: /\b(?:const|let|var|function|return|if|else|for|while|class|import|export|from|type|interface|async|await|new|try|catch|throw|extends|implements)\b/g,
  python: /\b(?:def|class|return|if|elif|else|for|while|in|import|from|as|try|except|with|lambda|True|False|None|async|await)\b/g,
  py: /\b(?:def|class|return|if|elif|else|for|while|in|import|from|as|try|except|with|lambda|True|False|None|async|await)\b/g,
  bash: /\b(?:cd|ls|echo|export|if|then|else|fi|for|do|done)\b/g,
  sh: /\b(?:cd|ls|echo|export|if|then|else|fi|for|do|done)\b/g
};

export const codeHighlightPlugin = $prose(() =>
  new Plugin({
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];

        state.doc.descendants((node, position) => {
          if (node.type.name !== "code_block" || !node.textContent) {
            return;
          }

          const language = String(node.attrs.language ?? "").toLowerCase();
          const rules = [...commonRules];
          const keywords = languageKeywords[language];
          if (keywords) {
            rules.push({ expression: keywords, className: "syntax-keyword" });
          }

          for (const rule of rules) {
            rule.expression.lastIndex = 0;
            for (const match of node.textContent.matchAll(rule.expression)) {
              const start = match.index;
              if (start === undefined || !match[0]) {
                continue;
              }

              decorations.push(
                Decoration.inline(
                  position + 1 + start,
                  position + 1 + start + match[0].length,
                  { class: rule.className }
                )
              );
            }
          }
        });

        return DecorationSet.create(state.doc, decorations);
      }
    }
  })
);
