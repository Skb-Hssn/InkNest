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

const slashCommands = new Set([
  "/heading",
  "/table",
  "/code",
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

  view.dispatch(view.state.tr.delete($from.start(), $from.pos));
  const commands = ctx.get(commandsCtx);

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
  view.dispatch(view.state.tr.insertText(`[!${type}]`));
  commands.call(wrapInBlockquoteCommand.key);
  return true;
}
