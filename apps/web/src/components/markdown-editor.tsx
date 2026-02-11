"use client";

import * as React from "react";
import { Eye, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  className?: string;
}

/**
 * Simple markdown editor with preview mode
 * Uses basic markdown rendering for preview
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  required = false,
  className,
}: MarkdownEditorProps) {
  const [mode, setMode] = React.useState<"edit" | "preview">("edit");

  // Simple markdown to HTML conversion (basic support)
  const renderMarkdown = (text: string): string => {
    let html = text;

    // Headers
    html = html.replace(/^### (.*$)/gim, "<h3 class='text-base font-semibold mt-3 mb-2'>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2 class='text-lg font-semibold mt-4 mb-2'>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1 class='text-xl font-bold mt-4 mb-3'>$1</h1>");

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold'>$1</strong>");
    html = html.replace(/__(.*?)__/g, "<strong class='font-semibold'>$1</strong>");

    // Italic
    html = html.replace(/\*(.*?)\*/g, "<em class='italic'>$1</em>");
    html = html.replace(/_(.*?)_/g, "<em class='italic'>$1</em>");

    // Code inline
    html = html.replace(/`(.*?)`/g, "<code class='bg-muted px-1 py-0.5 rounded text-sm font-mono'>$1</code>");

    // Lists
    html = html.replace(/^\* (.*$)/gim, "<li class='ml-4'>• $1</li>");
    html = html.replace(/^- (.*$)/gim, "<li class='ml-4'>• $1</li>");

    // Line breaks
    html = html.replace(/\n/g, "<br />");

    return html;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            mode === "edit"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => setMode("preview")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            mode === "preview"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <Eye className="w-3.5 h-3.5" />
          Preview
        </button>
      </div>

      {/* Editor / Preview */}
      {mode === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={rows}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "placeholder:text-muted-foreground resize-none",
          )}
        />
      ) : (
        <div
          className={cn(
            "w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm min-h-[150px]",
            "prose prose-sm max-w-none",
          )}
          dangerouslySetInnerHTML={{
            __html: value ? renderMarkdown(value) : "<span class='text-muted-foreground italic'>No content to preview</span>",
          }}
        />
      )}

      {/* Markdown Hints */}
      {mode === "edit" && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="font-medium">Markdown formatting:</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <div><code className="bg-muted px-1 rounded"># Heading</code> - Large heading</div>
            <div><code className="bg-muted px-1 rounded">**bold**</code> - Bold text</div>
            <div><code className="bg-muted px-1 rounded">## Heading</code> - Medium heading</div>
            <div><code className="bg-muted px-1 rounded">*italic*</code> - Italic text</div>
            <div><code className="bg-muted px-1 rounded">- item</code> - List item</div>
            <div><code className="bg-muted px-1 rounded">`code`</code> - Inline code</div>
          </div>
        </div>
      )}
    </div>
  );
}

