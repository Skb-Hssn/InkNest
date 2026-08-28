import type { SaveImagePayload } from "../../../shared/ipc";

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

export type LinkDialogDetails = {
  text: string;
  url: string;
  isEditing: boolean;
  position?: {
    left: number;
    top: number;
  };
};

export type MarkdownEditorHandle = {
  runCommand: (
    command: MarkdownEditorCommand,
    options?: MarkdownEditorCommandOptions
  ) => boolean;
  getLinkDetails: () => Omit<LinkDialogDetails, "position">;
  getMarkdown: () => string;
  focus: () => void;
};

export type MarkdownEditorProps = {
  markdown: string;
  workspacePath: string | null;
  notePath: string;
  disabled: boolean;
  lineWrap: boolean;
  onChange: (markdown: string) => void;
  onSelectionFormatChange: (commands: Set<MarkdownEditorCommand>) => void;
  onLinkDialogRequest: (details: LinkDialogDetails) => void;
  onImagePaste: (payload: SaveImagePayload) => void;
  onLocalLinkRequest: (url: string) => void;
};
