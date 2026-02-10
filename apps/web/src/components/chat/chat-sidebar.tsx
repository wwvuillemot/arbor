"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";

export interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * ChatSidebar - Right-hand flyout sidebar for AI chat
 *
 * Features:
 * - Flyout from right side of screen
 * - Fixed width (384px / w-96)
 * - Close button in header
 * - Reuses ChatPanel component for chat functionality
 * - Positioned absolutely on right side
 */
export function ChatSidebar({ isOpen, onClose, className }: ChatSidebarProps) {
  const t = useTranslations("chat");

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-testid="chat-sidebar"
      className={cn(
        "fixed top-0 right-0 bottom-0 w-96 bg-background border-l shadow-lg z-50 flex flex-col",
        className,
      )}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <button
          data-testid="chat-sidebar-close"
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
          title={t("close")}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Chat panel content */}
      <div className="flex-1 min-h-0">
        <ChatPanel className="h-full" />
      </div>
    </div>
  );
}
