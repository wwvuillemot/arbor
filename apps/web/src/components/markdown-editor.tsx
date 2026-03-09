"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  minHeight?: string;
}

/**
 * TipTap-based markdown editor.
 * Uses tiptap-markdown for proper round-trip: markdown string → rich editor
 * display → markdown string. Bold, headings, lists, etc. are preserved verbatim.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  required: _required = false,
  className,
  minHeight = "200px",
}: MarkdownEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn("prose prose-sm max-w-none focus:outline-none", "px-3 py-2"),
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      // tiptap-markdown adds .storage.markdown.getMarkdown()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (currentEditor as any).storage?.markdown?.getMarkdown?.();
      onChange(typeof md === "string" ? md : currentEditor.getText());
    },
  });

  // Sync when value changes externally (e.g. dialog reset to a different mode)
  React.useEffect(() => {
    if (!editor) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (editor as any).storage?.markdown?.getMarkdown?.();
    if (typeof current === "string" && current === value) return;
    editor.commands.setContent(value, false);
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    isActive,
    title,
    children,
  }: {
    onClick: () => void;
    isActive?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );

  const iconSize = 16;

  return (
    <div
      className={cn(
        "border border-input rounded-md bg-background flex flex-col",
        className,
      )}
    >
      {/* Toolbar — pinned, never scrolls */}
      <div className="flex-shrink-0 flex items-center gap-1 p-2 border-b bg-muted/30 flex-wrap">
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          isActive={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          title="Inline Code"
        >
          <Code size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered size={iconSize} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <Quote size={iconSize} />
        </ToolbarButton>
      </div>

      {/* Editor Content — scrolls */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight }}>
        <EditorContent editor={editor} className="markdown-editor-content h-full" />
      </div>

      {/* Markdown Hints — pinned */}
      <div className="flex-shrink-0 text-xs text-muted-foreground px-3 py-2 border-t bg-muted/10">
        <div className="font-medium mb-1">Markdown shortcuts:</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <div>
            <code className="bg-muted px-1 rounded"># Space</code> - Heading 1
          </div>
          <div>
            <code className="bg-muted px-1 rounded">**text**</code> - Bold
          </div>
          <div>
            <code className="bg-muted px-1 rounded">## Space</code> - Heading 2
          </div>
          <div>
            <code className="bg-muted px-1 rounded">*text*</code> - Italic
          </div>
          <div>
            <code className="bg-muted px-1 rounded">- Space</code> - Bullet list
          </div>
          <div>
            <code className="bg-muted px-1 rounded">`code`</code> - Inline code
          </div>
        </div>
      </div>
    </div>
  );
}
