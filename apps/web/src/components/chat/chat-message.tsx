"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Copy,
  User,
  Bot,
  Cpu,
  Wrench,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Tag,
  FileText,
  List,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { getMediaAttachmentUrl } from "@/lib/media-url";

export interface ChatMessageData {
  id: string;
  role: string;
  content: string | null;
  model?: string | null;
  tokensUsed?: number | null;
  toolCalls?: unknown;
  /** Tool name, set on role:"tool" messages from metadata.toolName */
  toolName?: string | null;
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

type NodeRecord = {
  id: string;
  type: string;
  name: string;
  parentId?: string | null;
};
type TagRecord = { id: string; name: string; type?: string };

function ToolResultDisplay({ content }: { content: string }) {
  const parsed = React.useMemo(() => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }, [content]);

  // Deletion confirmation
  if (parsed && parsed.deleted === true) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          Deleted node{" "}
          <code className="font-mono">{String(parsed.id).slice(0, 8)}…</code>
        </span>
      </div>
    );
  }

  // Tag added
  if (parsed && parsed.tagged === true) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
        <Tag className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          Added tag <strong>{parsed.tag?.name}</strong> to node
        </span>
      </div>
    );
  }

  // Tag removed
  if (parsed && "removed" in parsed) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-xs",
          parsed.removed
            ? "text-green-700 dark:text-green-400"
            : "text-amber-700 dark:text-amber-400",
        )}
      >
        {parsed.removed ? (
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        <span>
          {parsed.removed ? `Removed tag "${parsed.tagName}"` : parsed.reason}
        </span>
      </div>
    );
  }

  // Export result
  if (parsed && parsed.content && parsed.format) {
    const preview = String(parsed.content).slice(0, 300);
    return (
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-1 text-purple-700 dark:text-purple-300 font-medium">
          <FileText className="w-3.5 h-3.5" />
          <span>Exported as {parsed.format}</span>
        </div>
        <pre className="whitespace-pre-wrap break-all p-2 bg-purple-100/50 dark:bg-purple-900/20 rounded font-mono text-xs max-h-40 overflow-y-auto">
          {preview}
          {String(parsed.content).length > 300 ? "\n…" : ""}
        </pre>
      </div>
    );
  }

  // Array of nodes
  if (
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    parsed[0]?.type &&
    parsed[0]?.name
  ) {
    const nodeList = parsed as NodeRecord[];
    return (
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-1 text-purple-700 dark:text-purple-300 font-medium">
          <List className="w-3.5 h-3.5" />
          <span>
            {nodeList.length} node{nodeList.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {nodeList.map((node) => (
            <div
              key={node.id}
              className="flex items-center gap-2 px-2 py-1 rounded bg-purple-100/40 dark:bg-purple-900/20"
            >
              <span className="font-mono text-purple-600 dark:text-purple-400 text-xs w-14 flex-shrink-0 truncate">
                {node.type}
              </span>
              <span className="truncate">{node.name}</span>
              <span className="text-muted-foreground font-mono ml-auto flex-shrink-0">
                {node.id.slice(0, 6)}…
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Array of tags
  if (
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    parsed[0]?.name &&
    !parsed[0]?.type?.match(
      /^(project|folder|note|link|ai_suggestion|audio_note)$/,
    )
  ) {
    const tagList = parsed as TagRecord[];
    return (
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-1 text-purple-700 dark:text-purple-300 font-medium">
          <Tag className="w-3.5 h-3.5" />
          <span>
            {tagList.length} tag{tagList.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {tagList.map((tag) => (
            <span
              key={tag.id}
              className="px-1.5 py-0.5 bg-purple-100/50 dark:bg-purple-900/30 rounded text-purple-800 dark:text-purple-200 font-mono"
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Single node (create/update/move result)
  if (parsed && parsed.id && parsed.type && parsed.name) {
    const node = parsed as NodeRecord;
    return (
      <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          <span className="font-mono text-purple-600 dark:text-purple-400">
            {node.type}
          </span>{" "}
          <strong>{node.name}</strong>{" "}
          <span className="text-muted-foreground font-mono">
            {node.id.slice(0, 8)}…
          </span>
        </span>
      </div>
    );
  }

  // Generated image (MediaAttachment with mimeType image/*)
  if (parsed && parsed.id && parsed.mimeType?.startsWith("image/")) {
    return (
      <div className="space-y-2">
        <img
          src={getMediaAttachmentUrl(parsed.id)}
          alt={parsed.filename ?? "Generated image"}
          className="rounded-md max-w-full max-h-96 object-contain border border-border"
        />
        {parsed.metadata?.prompt && (
          <p className="text-xs text-muted-foreground italic">
            {String(parsed.metadata.prompt)}
          </p>
        )}
      </div>
    );
  }

  // Error response
  if (parsed && parsed.error) {
    return (
      <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
        <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>{parsed.error}</span>
      </div>
    );
  }

  // Empty array
  if (Array.isArray(parsed) && parsed.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">No results</div>
    );
  }

  // Fallback: raw JSON
  return (
    <pre className="whitespace-pre-wrap break-all text-xs p-2 bg-purple-100/50 dark:bg-purple-900/20 rounded font-mono max-h-48 overflow-y-auto max-w-full">
      {content}
    </pre>
  );
}

/**
 * ChatMessage - Renders a single chat message with role badge, content, and metadata.
 */
export function ChatMessage({ message, className }: ChatMessageProps) {
  const t = useTranslations("chat");
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);
  const [showReasoning, setShowReasoning] = React.useState(false);
  const [expandedToolCalls, setExpandedToolCalls] = React.useState<Set<string>>(
    new Set(),
  );

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

  const toggleToolCall = React.useCallback((toolCallId: string) => {
    setExpandedToolCalls((prev) => {
      const next = new Set(prev);
      if (next.has(toolCallId)) {
        next.delete(toolCallId);
      } else {
        next.add(toolCallId);
      }
      return next;
    });
  }, []);

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

        {/* Message text — skip raw content for tool results (rendered below) */}
        {message.content && message.role !== "tool" && (
          <div data-testid="message-content" className="text-sm min-w-0">
            {message.role === "assistant" ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(value) => value}
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-bold mt-3 mb-1">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 mb-2 space-y-0.5">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 mb-2 space-y-0.5">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed">{children}</li>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isBlock = className?.includes("language-");
                    return isBlock ? (
                      <code
                        className={cn(
                          "block text-xs font-mono bg-muted p-2 rounded my-1 whitespace-pre-wrap break-all",
                          className,
                        )}
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code
                        className="text-xs font-mono bg-muted px-1 py-0.5 rounded"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="my-1 overflow-x-auto">{children}</pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground my-2">
                      {children}
                    </blockquote>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      className="text-primary underline underline-offset-2 cursor-pointer"
                      onClick={(e) => {
                        if (!href) return;
                        e.preventDefault();
                        // Handle full URLs that may point to this app (e.g. http://app.arbor.local/projects?node=uuid)
                        try {
                          const url = new URL(href, window.location.href);
                          const nodeId = url.searchParams.get("node");
                          if (nodeId) {
                            router.push(`/projects?node=${nodeId}`);
                            return;
                          }
                          if (url.origin === window.location.origin) {
                            router.push(url.pathname + url.search);
                            return;
                          }
                        } catch {
                          /* not a URL */
                        }
                        if (href.startsWith("?") || href.startsWith("/")) {
                          router.push(
                            href.startsWith("?") ? `/projects${href}` : href,
                          );
                          return;
                        }
                        window.location.href = href;
                      }}
                    >
                      {children}
                    </a>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                  hr: () => <hr className="my-2 border-border" />,
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="text-xs border-collapse w-full">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border px-2 py-1 bg-muted font-medium text-left">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-2 py-1">
                      {children}
                    </td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <div className="whitespace-pre-wrap break-words leading-relaxed">
                {message.content}
              </div>
            )}
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
          <div data-testid="message-tool-calls" className="mt-2 space-y-2">
            {toolCallsArray.map(
              (
                tc: {
                  id?: string;
                  type?: string;
                  function?: {
                    name?: string;
                    arguments?: string;
                  };
                },
                idx: number,
              ) => {
                const toolCallId = tc.id || `tool-${idx}`;
                const isExpanded = expandedToolCalls.has(toolCallId);
                const toolName = tc.function?.name || "unknown_tool";
                let parsedArgs: Record<string, unknown> = {};

                try {
                  if (tc.function?.arguments) {
                    parsedArgs = JSON.parse(tc.function.arguments);
                  }
                } catch {
                  // If parsing fails, show raw arguments
                }

                return (
                  <div
                    key={toolCallId}
                    className="border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden bg-purple-50/50 dark:bg-purple-950/20"
                  >
                    <button
                      onClick={() => toggleToolCall(toolCallId)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-sm font-mono font-medium text-purple-900 dark:text-purple-100">
                          {toolName}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-3 py-2 border-t border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/10">
                        <div className="text-xs text-purple-900 dark:text-purple-100">
                          <div className="font-semibold mb-1">Arguments:</div>
                          <pre className="whitespace-pre-wrap break-all p-2 bg-purple-100/50 dark:bg-purple-900/20 rounded font-mono text-xs max-w-full">
                            {JSON.stringify(parsedArgs, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}

        {/* Tool result (for role: "tool" messages) */}
        {message.role === "tool" && message.content && (
          <div className="mt-1 space-y-1">
            {message.toolName && (
              <div className="flex items-center gap-1 text-xs font-mono text-purple-700 dark:text-purple-300">
                <Wrench className="w-3 h-3" />
                <span>{message.toolName}</span>
              </div>
            )}
            <ToolResultDisplay content={message.content} />
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
