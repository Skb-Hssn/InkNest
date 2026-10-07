import { commandsCtx } from "@milkdown/kit/core";
import type { Ctx } from "@milkdown/kit/ctx";
import {
  createCodeBlockCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand
} from "@milkdown/kit/preset/commonmark";
import { insertTableCommand } from "@milkdown/kit/preset/gfm";
import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { focusCalloutBody } from "./callout-plugin";
import { canInsertMath, insertMath } from "./math-plugin";
import type { MarkdownEditorCommand } from "../types";

export const slashOptions: Array<{ command: MarkdownEditorCommand; label: string; aliases: string[] }> = [
  { command: "heading-1", label: "Heading 1", aliases: ["heading", "h1", "heading1"] },
  { command: "heading-2", label: "Heading 2", aliases: ["h2", "heading2"] },
  { command: "heading-3", label: "Heading 3", aliases: ["h3", "heading3"] },
  { command: "heading-4", label: "Heading 4", aliases: ["h4", "heading4"] },
  { command: "heading-5", label: "Heading 5", aliases: ["h5", "heading5"] },
  { command: "heading-6", label: "Heading 6", aliases: ["h6", "heading6"] },
  { command: "bold", label: "Bold", aliases: ["bold"] },
  { command: "italic", label: "Italic", aliases: ["italic"] },
  { command: "strikethrough", label: "Strikethrough", aliases: ["strike", "strikethrough"] },
  { command: "inline-code", label: "Inline code", aliases: ["inline-code"] },
  { command: "clear-format", label: "Clear formatting", aliases: ["clear", "plain", "text"] },
  { command: "unordered-list", label: "Bullet list", aliases: ["bullet", "list"] },
  { command: "ordered-list", label: "Numbered list", aliases: ["numbered", "ordered"] },
  { command: "task-list", label: "Task list", aliases: ["todo", "task", "checklist"] },
  { command: "blockquote", label: "Quote", aliases: ["quote", "blockquote"] },
  { command: "callout-note", label: "Note callout", aliases: ["note", "callout"] },
  { command: "callout-warning", label: "Warning callout", aliases: ["warning"] },
  { command: "callout-info", label: "Info callout", aliases: ["info"] },
  { command: "callout-success", label: "Success callout", aliases: ["success"] },
  { command: "code-block", label: "Code block", aliases: ["code"] },
  { command: "inline-math", label: "Inline math", aliases: ["inline-math", "latex"] },
  { command: "block-math", label: "Display math", aliases: ["math", "equation"] },
  { command: "table", label: "Insert table", aliases: ["table"] },
  { command: "table-add-row", label: "Add table row", aliases: ["add-row"] },
  { command: "table-delete-row", label: "Delete table row", aliases: ["delete-row"] },
  { command: "table-add-column", label: "Add table column", aliases: ["add-column"] },
  { command: "table-delete-column", label: "Delete table column", aliases: ["delete-column"] },
  { command: "table-delete", label: "Delete table", aliases: ["delete-table"] },
  { command: "link", label: "Link", aliases: ["link"] },
  { command: "image", label: "Image", aliases: ["image", "picture"] },
  { command: "divider", label: "Divider", aliases: ["divider", "rule"] }
];

type SlashMatch = { from: number; to: number; query: string; key: string };
function getSlashMatch(view: EditorView): SlashMatch | null {
  const { selection } = view.state;
  const { $from } = selection;
  if (!view.editable || !selection.empty || !$from.parent.isTextblock || $from.parent.type.spec.code ||
      (view.state.storedMarks ?? $from.marks()).some((mark) => mark.type.spec.code)) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(before);
  if (!match) return null;
  const query = match[1].toLocaleLowerCase();
  const from = $from.pos - match[1].length - 1;
  return { from, to: $from.pos, query, key: `${from}:${$from.pos}:${query}` };
}

type SlashController = { handle: (event: KeyboardEvent) => boolean; dismissed: () => boolean };
const controllers = new WeakMap<EditorView, SlashController>();
let menuSequence = 0;
export function handleSlashSuggestionsKey(view: EditorView, event: KeyboardEvent) {
  return controllers.get(view)?.handle(event) ?? false;
}

export function createSlashSuggestionsPlugin(onCommand: (command: MarkdownEditorCommand) => void) {
  return $prose((ctx) => new Plugin({
    view(view) {
      const menu = document.createElement("div");
      const heading = document.createElement("div");
      const list = document.createElement("div");
      const footer = document.createElement("div");
      menu.className = "inknest-slash-menu";
      menu.id = `inknest-slash-menu-${++menuSequence}`;
      menu.hidden = true;
      list.className = "inknest-slash-options";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", "Formatting suggestions");
      heading.className = "inknest-slash-heading";
      footer.className = "inknest-slash-footer";
      footer.textContent = "↑ ↓ Navigate · Enter Select · Esc Close";
      menu.append(heading, list, footer);
      document.body.append(menu);
      let current: SlashMatch | null = null;
      let dismissedKey: string | null = null;
      let selected = 0;
      let navigated = false;
      let options = slashOptions;
      let destroyed = false;

      function hide() {
        menu.hidden = true;
        view.dom.removeAttribute("aria-controls");
        view.dom.removeAttribute("aria-activedescendant");
      }
      function enabled(command: MarkdownEditorCommand) {
        if (command.startsWith("table-") && command !== "table") {
          const { $from } = view.state.selection;
          let inTable = false;
          for (let depth = $from.depth; depth > 0; depth--) if ($from.node(depth).type.name === "table") inTable = true;
          return inTable;
        }
        if (command === "block-math" || command === "inline-math") return canInsertMath(view.state, command === "block-math");
        return true;
      }
      function highlight() {
        const buttons = [...list.querySelectorAll<HTMLButtonElement>("button")];
        buttons.forEach((button, index) => button.setAttribute("aria-selected", String(index === selected)));
        if (buttons[selected]) {
          view.dom.setAttribute("aria-activedescendant", buttons[selected].id);
          buttons[selected].scrollIntoView({ block: "nearest" });
        }
      }
      function execute(index: number, legacy = false) {
        const match = getSlashMatch(view);
        const option = options[index];
        if (!match || !option || !enabled(option.command)) return;
        hide();
        // Preserve the existing exact shortcuts, including their task placeholder.
        if (legacy && slashCommands.has(`/${match.query}`)) {
          runSlashCommand(ctx, view, new KeyboardEvent("keydown", { key: "Enter" }));
          return;
        }
        view.dispatch(view.state.tr.delete(match.from, match.to));
        view.focus();
        onCommand(option.command);
      }
      function position() {
        if (!current || menu.hidden) return;
        const caret = view.coordsAtPos(current.to);
        const scroll = view.dom.closest(".note-writing-scroll")?.getBoundingClientRect();
        if (scroll && (caret.bottom < scroll.top || caret.top > scroll.bottom)) { hide(); return; }
        menu.style.left = `${Math.max(8, Math.min(caret.left, window.innerWidth - 296))}px`;
        const height = menu.offsetHeight;
        menu.style.top = `${Math.max(8, caret.bottom + height + 6 > window.innerHeight - 8 ? caret.top - height - 6 : caret.bottom + 6)}px`;
      }
      function update() {
        if (destroyed) return;
        const match = getSlashMatch(view);
        if (!match) { current = null; dismissedKey = null; hide(); return; }
        if (!view.hasFocus()) { current = null; hide(); return; }
        // The menu is attached to body, outside the note's font-setting scope.
        menu.style.fontFamily = getComputedStyle(view.dom).fontFamily;
        if (match.key === dismissedKey) { hide(); return; }
        if (current?.key !== match.key || menu.hidden) {
          current = match;
          selected = 0;
          navigated = false;
          options = slashOptions.filter((option) => !match.query ||
            `${option.label} ${option.command} ${option.aliases.join(" ")}`.toLocaleLowerCase().includes(match.query))
            .sort((a, b) => Number(b.aliases.includes(match.query)) - Number(a.aliases.includes(match.query)));
          list.replaceChildren();
          heading.textContent = options.length ? "Formatting" : "No matching formatting options";
          options.forEach((option, index) => {
            const button = document.createElement("button");
            const label = document.createElement("span");
            const alias = document.createElement("small");
            button.type = "button";
            button.tabIndex = -1;
            button.id = `${menu.id}-${index}`;
            button.setAttribute("role", "option");
            button.setAttribute("aria-label", option.label);
            button.disabled = !enabled(option.command);
            if (option.command.startsWith("table-delete")) button.className = "danger";
            label.textContent = option.label;
            alias.textContent = `/${option.aliases[0]}`;
            button.append(label, alias);
            button.addEventListener("mousedown", event => event.preventDefault());
            button.addEventListener("mouseenter", () => {
              if (button.disabled) return;
              selected = index; navigated = true; highlight();
            });
            button.addEventListener("click", () => execute(index));
            list.append(button);
          });
          const firstEnabled = options.findIndex(option => enabled(option.command));
          selected = firstEnabled < 0 ? 0 : firstEnabled;
          menu.hidden = false;
          view.dom.setAttribute("aria-controls", menu.id);
          position();
          highlight();
        }
        position();
      }
      function dismiss() { dismissedKey = getSlashMatch(view)?.key ?? null; hide(); }
      function pointerDown(event: Event) {
        if (event.target instanceof Node && (menu.contains(event.target) || view.dom.contains(event.target))) return;
        dismiss();
      }
      function scroll(event: Event) { if (!(event.target instanceof Node) || !menu.contains(event.target)) position(); }
      const focus = () => requestAnimationFrame(update);
      view.dom.addEventListener("focus", focus);
      view.dom.addEventListener("blur", dismiss);
      document.addEventListener("pointerdown", pointerDown);
      document.addEventListener("scroll", scroll, true);
      window.addEventListener("resize", dismiss);
      controllers.set(view, {
        dismissed: () => dismissedKey !== null && getSlashMatch(view)?.key === dismissedKey,
        handle(event) {
          if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
          update();
          if (menu.hidden) return false;
          if (event.key === "Escape") { event.preventDefault(); dismiss(); return true; }
          if (event.key === "Tab" && event.shiftKey) { dismiss(); return false; }
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault(); navigated = true;
            const choices = options.map((option, index) => enabled(option.command) ? index : -1).filter(index => index >= 0);
            if (!choices.length) return true;
            const index = choices.indexOf(selected);
            selected = event.key === "Home" ? choices[0] : event.key === "End" ? choices.at(-1)!
              : choices[(index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length] ?? 0;
            highlight(); return true;
          }
          if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
            if (!options.length || !enabled(options[selected]?.command)) { dismiss(); return false; }
            event.preventDefault(); execute(selected, !navigated && event.key === "Enter"); return true;
          }
          return false;
        }
      });
      update();
      return {
        update,
        destroy() {
          destroyed = true;
          controllers.delete(view);
          view.dom.removeEventListener("focus", focus);
          view.dom.removeEventListener("blur", dismiss);
          document.removeEventListener("pointerdown", pointerDown);
          document.removeEventListener("scroll", scroll, true);
          window.removeEventListener("resize", dismiss);
          hide(); menu.remove();
        }
      };
    }
  }));
}

const slashCommands = new Set([
  "/heading",
  "/table",
  "/code",
  "/math",
  "/todo",
  "/note",
  "/warning",
  "/info",
  "/success"
]);

export const slashCommandPlugin = $prose((ctx) =>
  new Plugin({
    props: {
      handleKeyDown(view, event) {
        return runSlashCommand(ctx, view, event);
      }
    }
  })
);

export function runSlashCommand(ctx: Ctx, view: EditorView, event: KeyboardEvent) {
  if (!view.editable || controllers.get(view)?.dismissed()) return false;
  if (event.key !== "Enter" && event.key !== " ") {
    return false;
  }

  const { $from } = view.state.selection;
  const command = $from.parent.textContent.trim().toLowerCase();
  if (
    $from.parent.type.name !== "paragraph" ||
    $from.parentOffset !== $from.parent.content.size ||
    !slashCommands.has(command)
  ) {
    return false;
  }

  if (command === "/math" && !canInsertMath(view.state, true)) return false;
  view.dispatch(view.state.tr.delete($from.start(), $from.pos));
  const commands = ctx.get(commandsCtx);

  if (command === "/math") return insertMath(view, true);

  if (command === "/heading") {
    commands.call(wrapInHeadingCommand.key, 1);
    return true;
  }

  if (command === "/table") {
    commands.call(insertTableCommand.key, { row: 2, col: 2 });
    return true;
  }

  if (command === "/code") {
    commands.call(createCodeBlockCommand.key, "");
    return true;
  }

  if (command === "/todo") {
    commands.call(wrapInBulletListCommand.key);
    const selection = view.state.selection.$from;
    for (let depth = selection.depth; depth > 0; depth -= 1) {
      const node = selection.node(depth);
      if (node.type.name === "list_item") {
        view.dispatch(
          view.state.tr.setNodeMarkup(selection.before(depth), undefined, {
            ...node.attrs,
            checked: false
          })
        );
        break;
      }
    }
    view.dispatch(view.state.tr.insertText("Task"));
    return true;
  }

  const type = command.slice(1).toUpperCase();
  view.dispatch(view.state.tr.insertText(`[!${type}] `));
  commands.call(wrapInBlockquoteCommand.key);
  focusCalloutBody(view);
  return true;
}
