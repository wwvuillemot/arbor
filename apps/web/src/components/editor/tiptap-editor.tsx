"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Mark, mergeAttributes } from "@tiptap/core";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { ResizableImage } from "./resizable-image";
import Link from "@tiptap/extension-link";
import { trpc } from "@/lib/trpc";
import { EditorToolbar } from "./editor-toolbar";

const AI_ATTRIBUTION_MARK_TYPE = "aiAttribution";
const EMPTY_NODE_ID = "00000000-0000-0000-0000-000000000000";
const EMPTY_TIPTAP_DOC: Record<string, unknown> = { type: "doc", content: [] };

type TiptapMarkJson = {
  type?: string;
  attrs?: Record<string, unknown>;
};

type TiptapNodeJson = Record<string, unknown> & {
  type?: string;
  text?: string;
  marks?: TiptapMarkJson[];
  content?: TiptapNodeJson[];
};

type ProvenanceHistoryEntry = {
  actorType?: string;
  actorId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown> | null;
  contentBefore?: unknown;
  contentAfter?: unknown;
};

type AiAttributionSource = {
  modelName: string;
  timestamp: string;
  tooltipText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toTiptapDoc(content: unknown): Record<string, unknown> {
  if (!isRecord(content) || content.type !== "doc") {
    return cloneJson(EMPTY_TIPTAP_DOC);
  }

  return cloneJson(content);
}

function getTopLevelBlocks(content: unknown): TiptapNodeJson[] {
  if (!isRecord(content) || !Array.isArray(content.content)) {
    return [];
  }

  return content.content.filter(isRecord) as TiptapNodeJson[];
}

function stripAiAttributionFromNode(node: TiptapNodeJson): TiptapNodeJson {
  const strippedNode: TiptapNodeJson = { ...node };

  if (Array.isArray(node.marks)) {
    const remainingMarks = node.marks.filter(
      (mark) => mark.type !== AI_ATTRIBUTION_MARK_TYPE,
    );

    if (remainingMarks.length > 0) {
      strippedNode.marks = remainingMarks;
    } else {
      delete strippedNode.marks;
    }
  }

  if (Array.isArray(node.content)) {
    strippedNode.content = node.content.map(stripAiAttributionFromNode);
  }

  return strippedNode;
}

function stripAiAttributionFromContent(
  content: Record<string, unknown>,
): Record<string, unknown> {
  return stripAiAttributionFromNode(content as TiptapNodeJson);
}

function getComparableNodeKey(node: unknown): string | null {
  if (!isRecord(node)) {
    return null;
  }

  return JSON.stringify(
    stripAiAttributionFromNode(cloneJson(node) as TiptapNodeJson),
  );
}

function getModelName(historyEntry: ProvenanceHistoryEntry): string {
  const metadataModel = historyEntry.metadata?.model;
  if (typeof metadataModel === "string" && metadataModel.trim().length > 0) {
    return metadataModel;
  }

  if (
    typeof historyEntry.actorId === "string" &&
    historyEntry.actorId.startsWith("llm:")
  ) {
    return historyEntry.actorId.slice(4);
  }

  return "AI";
}

function getTooltipText(modelName: string, timestamp: string): string {
  const parsedTimestamp = new Date(timestamp);
  const displayTimestamp = Number.isNaN(parsedTimestamp.getTime())
    ? timestamp
    : parsedTimestamp.toISOString();

  return `${modelName} • ${displayTimestamp}`;
}

function addAiAttributionMark(
  node: TiptapNodeJson,
  source: AiAttributionSource,
): TiptapNodeJson {
  if (
    node.type === "text" &&
    typeof node.text === "string" &&
    node.text.length > 0
  ) {
    const preservedMarks = (node.marks ?? []).filter(
      (mark) => mark.type !== AI_ATTRIBUTION_MARK_TYPE,
    );

    return {
      ...node,
      marks: [
        ...preservedMarks,
        {
          type: AI_ATTRIBUTION_MARK_TYPE,
          attrs: {
            modelName: source.modelName,
            timestamp: source.timestamp,
            tooltipText: source.tooltipText,
          },
        },
      ],
    };
  }

  if (!Array.isArray(node.content)) {
    return node;
  }

  return {
    ...node,
    content: node.content.map((childNode) =>
      addAiAttributionMark(childNode, source),
    ),
  };
}

function buildChangedBlockCounts(
  historyEntry: ProvenanceHistoryEntry,
): Map<string, number> {
  const beforeBlocks = getTopLevelBlocks(historyEntry.contentBefore);
  const afterBlocks = getTopLevelBlocks(historyEntry.contentAfter);
  const maxLength = Math.max(beforeBlocks.length, afterBlocks.length);
  const changedBlockCounts = new Map<string, number>();

  for (let index = 0; index < maxLength; index += 1) {
    const beforeKey = getComparableNodeKey(beforeBlocks[index]);
    const afterKey = getComparableNodeKey(afterBlocks[index]);

    if (!afterKey || beforeKey === afterKey) {
      continue;
    }

    changedBlockCounts.set(
      afterKey,
      (changedBlockCounts.get(afterKey) ?? 0) + 1,
    );
  }

  return changedBlockCounts;
}

function deriveAiAttributedContent(
  content: Record<string, unknown> | null,
  historyEntries: ProvenanceHistoryEntry[],
): Record<string, unknown> | null {
  if (!content) {
    return null;
  }

  const cleanContent = stripAiAttributionFromContent(toTiptapDoc(content));
  const currentBlocks = getTopLevelBlocks(cleanContent);
  if (currentBlocks.length === 0) {
    return cleanContent;
  }

  const llmSources = historyEntries
    .filter((historyEntry) => historyEntry.actorType === "llm")
    .map((historyEntry) => {
      const modelName = getModelName(historyEntry);
      const timestamp = historyEntry.createdAt ?? "";

      return {
        counts: buildChangedBlockCounts(historyEntry),
        source: {
          modelName,
          timestamp,
          tooltipText: getTooltipText(modelName, timestamp),
        },
      };
    })
    .filter((entry) => entry.counts.size > 0);

  if (llmSources.length === 0) {
    return cleanContent;
  }

  const attributedContent = cloneJson(cleanContent);
  const attributedBlocks = Array.isArray(attributedContent.content)
    ? (attributedContent.content as TiptapNodeJson[])
    : [];

  currentBlocks.forEach((currentBlock, index) => {
    const blockKey = getComparableNodeKey(currentBlock);
    if (!blockKey) {
      return;
    }

    const matchedEntry = llmSources.find((entry) => {
      const remainingCount = entry.counts.get(blockKey) ?? 0;
      if (remainingCount < 1) {
        return false;
      }

      entry.counts.set(blockKey, remainingCount - 1);
      return true;
    });

    if (!matchedEntry || !attributedBlocks[index]) {
      return;
    }

    attributedBlocks[index] = addAiAttributionMark(
      attributedBlocks[index],
      matchedEntry.source,
    );
  });

  return attributedContent;
}

// Mark extension for AI-authored text spans. Renders as <span class="ai-attributed">
// with data attributes so CSS can style them when attribution display is active.
const AiAttributionMark = Mark.create({
  name: AI_ATTRIBUTION_MARK_TYPE,
  addAttributes() {
    return {
      modelName: { default: null },
      timestamp: { default: null },
      tooltipText: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-ai-model]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "ai-attributed",
        "data-ai-model": HTMLAttributes.modelName,
        "data-ai-timestamp": HTMLAttributes.timestamp,
        "data-ai-tooltip": HTMLAttributes.tooltipText,
        title: HTMLAttributes.tooltipText,
      }),
      0,
    ];
  },
});

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
  nodeId?: string;
  onChange?: (content: Record<string, unknown>) => void;
  placeholder?: string;
  editable?: boolean;
  onInsertImage?: () => void;
  /** Called when the link toolbar button is clicked; parent opens node picker */
  onInsertLink?: () => void;
  editorRef?: React.RefObject<Editor | null>;
  /** Called when a link is clicked; href is the raw href value from the anchor */
  onLinkClick?: (href: string) => void;
}

export function TiptapEditor({
  content,
  nodeId,
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
  const [showAiAttribution, setShowAiAttribution] = React.useState(false);
  const historyQuery = trpc.provenance.getHistory.useQuery(
    { nodeId: nodeId ?? EMPTY_NODE_ID, limit: 50 },
    {
      enabled: Boolean(nodeId),
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  );
  const renderedContent = React.useMemo(
    () =>
      deriveAiAttributedContent(
        content,
        (historyQuery.data ?? []) as ProvenanceHistoryEntry[],
      ),
    [content, historyQuery.data],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      AiAttributionMark,
      SafeLink.configure({
        openOnClick: false,
        HTMLAttributes: { class: "cursor-pointer underline text-primary" },
      }),
      Placeholder.configure({
        placeholder: placeholderText,
      }),
      ResizableImage,
    ],
    content: renderedContent ?? undefined,
    editable,
    onUpdate: ({ editor: currentEditor }) => {
      if (onChange) {
        onChange(
          stripAiAttributionFromContent(
            currentEditor.getJSON() as Record<string, unknown>,
          ),
        );
      }
    },
  });

  // Expose editor instance to parent via ref
  React.useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  // Sync derived content when the selected node changes or history arrives.
  React.useEffect(() => {
    if (!editor) return;

    const nextContent = renderedContent ?? EMPTY_TIPTAP_DOC;
    const currentJson = JSON.stringify(editor.getJSON());
    const nextJson = JSON.stringify(nextContent);

    if (currentJson !== nextJson) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [editor, renderedContent]);

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
      className={`flex flex-col h-full${showAiAttribution ? " ai-attribution-visible" : ""}`}
      data-testid="tiptap-editor"
    >
      <EditorToolbar
        editor={editor}
        onInsertImage={onInsertImage}
        onInsertLink={onInsertLink}
        showAiAttribution={showAiAttribution}
        onToggleAttribution={() => setShowAiAttribution((v) => !v)}
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
