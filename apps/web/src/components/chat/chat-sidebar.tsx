"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";

export interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * ChatSidebar - Right-hand sidebar for AI chat that pushes content left
 *
 * Features:
 * - Slides in/out from right side
 * - Sticky tab on right edge when closed
 * - Pushes content left when open (not overlay)
 * - Fixed width (384px / w-96) when open
 * - Tab width (40px) when closed
 */
export function ChatSidebar({ isOpen, onToggle, className }: ChatSidebarProps) {
  const t = useTranslations("chat");

  return (
    <div
      data-testid="chat-sidebar"
      className={cn(
        "h-full bg-background border-l flex flex-col transition-all duration-300 ease-in-out",
        isOpen ? "w-96" : "w-10",
        className,
      )}
    >
      {isOpen ? (
        <>
          {/* Header with close button */}
          <div className="flex items-center justify-between p-3 border-b">
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <button
              data-testid="chat-sidebar-close"
              onClick={onToggle}
              className="p-1 rounded hover:bg-muted transition-colors"
              title={t("close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat panel content */}
          <div className="flex-1 min-h-0">
            <ChatPanel className="h-full" showThreadSidebar={false} />
          </div>
        </>
      ) : (
        /* Sticky tab when closed */
        <button
          data-testid="chat-sidebar-tab"
          onClick={onToggle}
          className="h-full w-full flex items-center justify-center hover:bg-accent transition-colors group"
          title={t("title")}
        >
          <MessageSquare className="w-5 h-5 text-muted-foreground group-hover:text-accent-foreground" />
        </button>
      )}
    </div>
  );
}
