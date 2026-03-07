"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { mergeAttributes } from "@tiptap/core";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorToolbar } from "./editor-toolbar";

// Extend Link to strip the `target` attribute from ALL rendered anchors.
// Two sources can introduce target="_blank":
//   1. Per-link stored attrs (e.g. from old imported content) — stripped from HTMLAttributes.
//   2. TipTap's Link extension default HTMLAttributes (target:"_blank") — stripped from
//      this.options.HTMLAttributes before merging.
const SafeLink = Link.extend({
  renderHTML({ HTMLAttributes }) {
    const { target: _perLink, ...safePerLink } = HTMLAttributes;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { target: _default, ...safeDefaults } = (this.options as any)
      .HTMLAttributes as Record<string, unknown>;
    return ["a", mergeAttributes(safeDefaults, safePerLink), 0];
  },
});

interface TiptapEditorProps {
  content: Record<string, unknown> | null;
  onChange?: (content: Record<string, unknown>) => void;
  placeholder?: string;
  editable?: boolean;
  onInsertImage?: () => void;
  /** Called when the link toolbar button is clicked; parent opens node picker */
  onInsertLink?: () => void;
  editorRef?: React.MutableRefObject<Editor | null>;
  /** Called when a link is clicked; href is the raw href value from the anchor */
  onLinkClick?: (href: string) => void;
}

export function TiptapEditor({
  content,
  onChange,
  placeholder,
  editable = true,
  onInsertImage,
  onInsertLink,
  editorRef,
  onLinkClick,
}: TiptapEditorProps) {
  const t = useTranslations("editor");
  const placeholderText = placeholder ?? t("placeholder");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      SafeLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: "cursor-pointer underline text-primary" },
      }),
      Placeholder.configure({
        placeholder: placeholderText,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
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

  // Expose editor instance to parent via ref
  React.useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

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

  const editableRef = React.useRef(editable);
  editableRef.current = editable;

  // Attach a native capture-phase listener to the stable outer container div.
  // Using the container ref (not editor.view.dom) ensures the listener is always
  // attached regardless of editor re-initialization. Capture phase fires before
  // any inner handlers (ProseMirror, browser link navigation, etc.).
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !onLinkClick) return;
    const handleClick = (e: MouseEvent) => {
      const eventTarget = e.target;
      if (!(eventTarget instanceof Node)) return;

      const targetElement =
        eventTarget instanceof Element
          ? eventTarget
          : eventTarget.parentElement;
      if (!targetElement) return;

      const anchor = targetElement.closest("a");
      if (!anchor || !container.contains(anchor)) return;
      if (editableRef.current) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const href = anchor.getAttribute("href");
      if (href && href !== "#") {
        onLinkClick(href);
      }
    };
    container.addEventListener("click", handleClick, { capture: true });
    return () =>
      container.removeEventListener("click", handleClick, { capture: true });
  }, [onLinkClick]);

  // Toolbar is rendered as a flex-shrink-0 header; EditorContent gets its own
  // overflow-y-auto scroll container so the toolbar always stays pinned at top.
  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full"
      data-testid="tiptap-editor"
    >
      <EditorToolbar
        editor={editor}
        onInsertImage={onInsertImage}
        onInsertLink={onInsertLink}
      />
      <div className="flex-1 overflow-y-auto">
        <EditorContent
          editor={editor}
          className="prose dark:prose-invert max-w-none p-4 outline-none ring-0 border-0 focus:outline-none focus:ring-0 focus:border-0 focus-within:outline-none focus-within:ring-0 focus-within:border-0 [&_.tiptap]:outline-none [&_.tiptap]:ring-0 [&_.tiptap]:border-0 [&_.tiptap]:shadow-none [&_.tiptap:focus]:outline-none [&_.tiptap:focus]:ring-0 [&_.tiptap:focus]:border-0 [&_.tiptap]:min-h-[280px] [&_*:focus]:outline-none [&_*:focus]:ring-0 [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none"
        />
      </div>
    </div>
  );
}
