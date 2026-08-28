import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef
} from "react";
import type { Editor } from "@milkdown/kit/core";
import { editorViewCtx } from "@milkdown/kit/core";
import { replaceAll } from "@milkdown/kit/utils";
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "@milkdown/kit/prose/tables/style/tables.css";
import "./editor.css";
import { createMarkdownEditor, setEditorEditable } from "./create-editor";
import {
  collectActiveEditorCommands,
  getEditorLinkDetails,
  getEditorMarkdown,
  runEditorCommand
} from "./editor-controller";
import {
  joinMarkdownDocument,
  splitMarkdownDocument,
  type MarkdownDocumentEnvelope
} from "./document-envelope";
import type { MarkdownEditorHandle, MarkdownEditorProps } from "./types";

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  MarkdownEditorProps
>(function MarkdownEditor(props, ref) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const propsRef = useRef(props);
  const envelopeRef = useRef<MarkdownDocumentEnvelope>(
    splitMarkdownDocument(props.markdown)
  );
  const lastEmittedMarkdownRef = useRef(props.markdown);
  const latestMarkdownRef = useRef(props.markdown);
  const replacingExternallyRef = useRef(false);

  propsRef.current = props;
  latestMarkdownRef.current = props.markdown;

  useImperativeHandle(ref, () => ({
    runCommand(command, options) {
      const editor = editorRef.current;
      if (!editor) {
        return false;
      }

      const didRun = runEditorCommand(editor, command, options);
      propsRef.current.onSelectionFormatChange(collectActiveEditorCommands(editor));
      return didRun;
    },
    getLinkDetails() {
      const editor = editorRef.current;
      return editor
        ? getEditorLinkDetails(editor)
        : { text: "", url: "", isEditing: false };
    },
    getMarkdown() {
      const editor = editorRef.current;
      if (!editor) {
        return latestMarkdownRef.current;
      }

      return joinMarkdownDocument(envelopeRef.current, getEditorMarkdown(editor));
    },
    focus() {
      const editor = editorRef.current;
      if (editor) {
        editor.action((ctx) => {
          ctx.get(editorViewCtx).focus();
        });
      }
    }
  }));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const initialEnvelope = splitMarkdownDocument(latestMarkdownRef.current);
    envelopeRef.current = initialEnvelope;
    let disposed = false;
    const editor = createMarkdownEditor({
      root,
      body: initialEnvelope.body,
      workspacePath: props.notePath ? props.workspacePath : null,
      notePath: props.notePath,
      disabled: props.disabled,
      onBodyChange(body) {
        if (disposed || replacingExternallyRef.current) {
          return;
        }

        const markdown = joinMarkdownDocument(envelopeRef.current, body);
        lastEmittedMarkdownRef.current = markdown;
        latestMarkdownRef.current = markdown;
        propsRef.current.onChange(markdown);
      },
      onSelectionFormatChange(commands) {
        propsRef.current.onSelectionFormatChange(commands);
      },
      onLinkDialogRequest(details) {
        propsRef.current.onLinkDialogRequest(details);
      },
      onImagePaste(payload) {
        propsRef.current.onImagePaste(payload);
      },
      onLocalLinkRequest(url) {
        propsRef.current.onLocalLinkRequest(url);
      }
    });

    void editor.create().then(() => {
      if (disposed) {
        return editor.destroy();
      }

      editorRef.current = editor;
      setEditorEditable(editor, !propsRef.current.disabled);
      propsRef.current.onSelectionFormatChange(collectActiveEditorCommands(editor));
    });

    return () => {
      disposed = true;
      if (editorRef.current === editor) {
        editorRef.current = null;
      }
      propsRef.current.onSelectionFormatChange(new Set());
      void editor.destroy();
    };
  }, [props.notePath, props.workspacePath]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      setEditorEditable(editor, !props.disabled);
    }
  }, [props.disabled]);

  useEffect(() => {
    const nextEnvelope = splitMarkdownDocument(props.markdown);
    envelopeRef.current = nextEnvelope;

    if (props.markdown === lastEmittedMarkdownRef.current) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const currentBody = getEditorMarkdown(editor);
    if (currentBody !== nextEnvelope.body) {
      replacingExternallyRef.current = true;
      try {
        editor.action(replaceAll(nextEnvelope.body, true));
      } finally {
        replacingExternallyRef.current = false;
      }
    }
  }, [props.markdown]);

  return (
    <div
      ref={rootRef}
      className={`inknest-editor ${props.lineWrap ? "" : "inknest-editor-no-wrap"}`}
      data-placeholder="Start writing..."
    />
  );
});
