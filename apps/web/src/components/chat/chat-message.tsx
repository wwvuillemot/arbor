"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Copy,
  User,
  Bot,
  Cpu,
  Wrench,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessageData {
  id: string;
  role: string;
  content: string | null;
  model?: string | null;
  tokensUsed?: number | null;
  toolCalls?: unknown;
  createdAt: string;
  /** Reasoning/thinking content from reasoning models */
  reasoning?: string | null;
  /** Number of tokens used for reasoning/thinking */
  reasoningTokens?: number | null;
  /** Number of tokens used for output (excluding reasoning) */
  outputTokens?: number | null;
}

export interface ChatMessageProps {
  message: ChatMessageData;
  className?: string;
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  user: User,
  assistant: Bot,
  system: Cpu,
  tool: Wrench,
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  assistant:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  system: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  tool: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

/**
 * ChatMessage - Renders a single chat message with role badge, content, and metadata.
 */
export function ChatMessage({ message, className }: ChatMessageProps) {
  const t = useTranslations("chat");
  const [copied, setCopied] = React.useState(false);
  const [showReasoning, setShowReasoning] = React.useState(false);

  const RoleIcon = ROLE_ICONS[message.role] || User;
  const roleColor = ROLE_COLORS[message.role] || ROLE_COLORS.user;
  const roleLabel =
    message.role === "user"
      ? t("role.user")
      : message.role === "assistant"
        ? t("role.assistant")
        : message.role === "system"
          ? t("role.system")
          : t("role.tool");

  const handleCopy = React.useCallback(() => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [message.content]);

  const formattedTime = React.useMemo(() => {
    try {
      return new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [message.createdAt]);

  // Tool calls rendering
  const toolCallsArray = React.useMemo(() => {
    if (!message.toolCalls) return [];
    if (Array.isArray(message.toolCalls)) return message.toolCalls;
    return [];
  }, [message.toolCalls]);

  return (
    <div
      data-testid="chat-message"
      data-role={message.role}
      className={cn(
        "flex gap-3 p-3 rounded-lg",
        message.role === "user" ? "bg-muted/50" : "bg-background",
        className,
      )}
    >
      {/* Role icon */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          roleColor,
        )}
      >
        <RoleIcon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span data-testid="message-role" className="text-sm font-medium">
            {roleLabel}
          </span>
          {message.model && (
            <span
              data-testid="message-model"
              className="text-xs text-muted-foreground"
            >
              {message.model}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{formattedTime}</span>
        </div>

        {/* Message text */}
        {message.content && (
          <div
            data-testid="message-content"
            className="text-sm whitespace-pre-wrap break-words"
          >
            {message.content}
          </div>
        )}

        {/* Reasoning / Thinking section (collapsible) */}
        {message.reasoning && (
          <div className="mt-2" data-testid="reasoning-section">
            <button
              data-testid="reasoning-toggle"
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showReasoning ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {showReasoning ? t("hideReasoning") : t("showReasoning")}
            </button>
            {showReasoning && (
              <div
                data-testid="reasoning-content"
                className="mt-1 p-2 bg-muted/50 rounded text-sm italic text-muted-foreground whitespace-pre-wrap"
              >
                {message.reasoning}
              </div>
            )}
          </div>
        )}

        {/* Tool calls */}
        {toolCallsArray.length > 0 && (
          <div data-testid="message-tool-calls" className="mt-2">
            {toolCallsArray.map(
              (tc: { name?: string; id?: string }, idx: number) => (
                <div
                  key={tc.id || idx}
                  className="text-xs bg-muted rounded px-2 py-1 mt-1 font-mono"
                >
                  🔧 {tc.name || "tool_call"}
                </div>
              ),
            )}
          </div>
        )}

        {/* Footer: tokens + copy */}
        <div className="flex items-center gap-2 mt-1">
          {message.reasoningTokens != null && message.reasoningTokens > 0 ? (
            <span
              data-testid="message-token-breakdown"
              className="text-xs text-muted-foreground"
            >
              {message.reasoningTokens} {t("reasoningTokens")},{" "}
              {message.outputTokens ?? 0} {t("outputTokens")}
            </span>
          ) : (
            message.tokensUsed != null &&
            message.tokensUsed > 0 && (
              <span
                data-testid="message-tokens"
                className="text-xs text-muted-foreground"
              >
                {message.tokensUsed} {t("tokens")}
              </span>
            )
          )}
          {message.content && (
            <button
              data-testid="copy-message"
              onClick={handleCopy}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Copy"
            >
              <Copy className="w-3 h-3 inline" />
              {copied && <span className="ml-1">✓</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
