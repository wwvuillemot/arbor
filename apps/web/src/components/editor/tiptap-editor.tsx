"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorToolbar } from "./editor-toolbar";

interface TiptapEditorProps {
  content: Record<string, unknown> | null;
  onChange?: (content: Record<string, unknown>) => void;
  placeholder?: string;
  editable?: boolean;
}

export function TiptapEditor({
  content,
  onChange,
  placeholder,
  editable = true,
}: TiptapEditorProps) {
  const t = useTranslations("editor");
  const placeholderText = placeholder ?? t("placeholder");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholderText,
      }),
    ],
    content: content ?? undefined,
    editable,
    onUpdate: ({ editor: currentEditor }) => {
      if (onChange) {
        onChange(currentEditor.getJSON() as Record<string, unknown>);
      }
    },
  });

  // Sync content when it changes externally (e.g. selecting a different node)
  const contentRef = React.useRef(content);
  React.useEffect(() => {
    if (!editor) return;
    // Only update if content reference changed (different node selected)
    if (contentRef.current !== content) {
      contentRef.current = content;
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(content);
      if (currentJson !== newJson) {
        editor.commands.setContent(content ?? { type: "doc", content: [] });
      }
    }
  }, [editor, content]);

  // Sync editable prop
  React.useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return (
    <div
      className="flex flex-col rounded-md overflow-hidden"
      data-testid="tiptap-editor"
    >
      <EditorToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose dark:prose-invert max-w-none p-4 min-h-[300px] outline-none ring-0 border-0 focus:outline-none focus:ring-0 focus:border-0 focus-within:outline-none focus-within:ring-0 focus-within:border-0 [&_.tiptap]:outline-none [&_.tiptap]:ring-0 [&_.tiptap]:border-0 [&_.tiptap]:shadow-none [&_.tiptap:focus]:outline-none [&_.tiptap:focus]:ring-0 [&_.tiptap:focus]:border-0 [&_.tiptap]:min-h-[280px] [&_*:focus]:outline-none [&_*:focus]:ring-0 [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  );
}
