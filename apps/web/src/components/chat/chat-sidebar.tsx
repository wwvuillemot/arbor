"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ChatPanel } from "./chat-panel";

const PREF_KEY = "chat:sidebarWidth";
const DEFAULT_WIDTH = 384; // px
const MIN_WIDTH = 280;
const MAX_WIDTH = 900;
const CLOSED_WIDTH = 32; // width when collapsed — shows open button

export interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  projectId?: string | null;
  projectName?: string | null;
  contextNodes?: { id: string; name: string; type: string }[];
  onRemoveContext?: (id: string) => void;
  onSelectedThreadIdChange?: (threadId: string | null) => void;
  onAgentResponseSuccess?: () => void;
}

/**
 * ChatSidebar - Inline right-hand panel for AI chat.
 * Sits inside the page flex row and pushes content left when open.
 * Width is resizable via drag handle and persisted as an app-scoped preference.
 */
export function ChatSidebar({
  isOpen,
  onToggle,
  className,
  projectId,
  projectName,
  contextNodes,
  onRemoveContext,
  onSelectedThreadIdChange,
  onAgentResponseSuccess,
}: ChatSidebarProps) {
  const t = useTranslations("chat");
  const [width, setWidth] = React.useState(DEFAULT_WIDTH);
  const isDragging = React.useRef(false);
  const startX = React.useRef(0);
  const startWidth = React.useRef(DEFAULT_WIDTH);
  const currentWidth = React.useRef(DEFAULT_WIDTH);

  React.useEffect(() => {
    currentWidth.current = width;
  }, [width]);

  // Load persisted width
  const widthPref = trpc.preferences.getAppPreference.useQuery(
    { key: PREF_KEY },
    { refetchOnWindowFocus: false },
  );
  const setWidthPref = trpc.preferences.setAppPreference.useMutation();

  React.useEffect(() => {
    if (widthPref.data?.value != null) {
      const saved = Number(widthPref.data.value);
      if (!isNaN(saved) && saved >= MIN_WIDTH && saved <= MAX_WIDTH) {
        setWidth(saved);
      }
    }
  }, [widthPref.data]);

  // Drag-to-resize: window listeners so fast drags don't lose the handle
  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      setWidth(
        Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)),
      );
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setWidthPref.mutate({
        key: PREF_KEY,
        value: String(Math.round(currentWidth.current)),
      });
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [setWidthPref]);

  const handleDragStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = currentWidth.current;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, []);

  const totalWidth = isOpen ? width : CLOSED_WIDTH;

  return (
    <div
      data-testid="chat-sidebar"
      style={{
        width: `${totalWidth}px`,
        minWidth: `${totalWidth}px`,
        transition: isDragging.current
          ? "none"
          : "width 300ms ease-in-out, min-width 300ms ease-in-out",
      }}
      className={cn(
        "h-full flex-none border-l bg-background overflow-hidden flex flex-col relative",
        className,
      )}
    >
      {isOpen ? (
        <>
          {/* Drag handle strip — full-height left edge, doesn't overlap content */}
          <div
            onMouseDown={handleDragStart}
            className="absolute left-0 top-0 h-full w-5 cursor-ew-resize z-10 flex items-center justify-center group"
            style={{ transform: "translateX(0)" }}
          >
            <GripVertical className="w-3 h-4 text-border group-hover:text-muted-foreground transition-colors" />
          </div>

          {/* Header — title left, X button right */}
          <div className="flex items-center justify-between pl-8 pr-3 py-3 border-b shrink-0">
            <h2 className="text-sm font-semibold">{t("title")}</h2>
            <button
              data-testid="chat-sidebar-close"
              onClick={onToggle}
              className="p-1 rounded hover:bg-muted transition-colors"
              title={t("close")}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Chat panel */}
          <div className="flex-1 min-h-0">
            <ChatPanel
              className="h-full"
              showThreadSidebar={false}
              projectId={projectId}
              projectName={projectName}
              contextNodes={contextNodes}
              onRemoveContext={onRemoveContext}
              onSelectedThreadIdChange={onSelectedThreadIdChange}
              onAgentResponseSuccess={onAgentResponseSuccess}
            />
          </div>
        </>
      ) : (
        /* Collapsed — just the open button */
        <div className="h-full flex items-center justify-center">
          <button
            data-testid="chat-sidebar-tab"
            onClick={onToggle}
            className="p-1 rounded hover:bg-muted transition-colors"
            title={t("title")}
          >
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
