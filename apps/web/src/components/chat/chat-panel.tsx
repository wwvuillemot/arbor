"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Send, MessageSquare, Bot } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ChatMessage, type ChatMessageData } from "./chat-message";
import { ModelSelector } from "./model-selector";
import { AgentModeSelector } from "./agent-mode-selector";

export interface ChatPanelProps {
  className?: string;
  showThreadSidebar?: boolean;
}

/**
 * ChatPanel - Full chat interface with thread list sidebar, message area, and input.
 *
 * Layout:
 * - Left sidebar: Thread list with new thread button (optional, controlled by showThreadSidebar)
 * - Main area: Message history (scrollable, auto-scroll to bottom)
 * - Bottom: Input box with send button and mode selector
 */
export function ChatPanel({
  className,
  showThreadSidebar = true,
}: ChatPanelProps) {
  const t = useTranslations("chat");

  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(
    null,
  );
  const [inputValue, setInputValue] = React.useState("");
  const [agentMode, setAgentMode] = React.useState<string>("assistant");
  const [selectedModel, setSelectedModel] = React.useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = React.useState<string | null>(null);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Get master key for API key decryption
  const [masterKey, setMasterKey] = React.useState<string | null>(null);

  // Get master key on mount
  React.useEffect(() => {
    async function getMasterKey() {
      try {
        if (typeof window !== "undefined" && "__TAURI__" in window) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tauri = (window as any).__TAURI__;
            if (tauri && tauri.core && tauri.core.invoke) {
              const key = (await tauri.core.invoke(
                "get_or_generate_master_key",
              )) as string;
              setMasterKey(key);
            } else {
              throw new Error("Tauri invoke not available");
            }
          } catch (importError) {
            console.warn("Tauri API not available:", importError);
            setMasterKey("YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=");
          }
        } else {
          // Development mode: use a test key
          console.warn("Not in Tauri environment, using test master key");
          setMasterKey("YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=");
        }
      } catch (error) {
        console.error("Failed to get master key:", error);
      }
    }

    getMasterKey();
  }, []);

  // ─── Queries ─────────────────────────────────────────────────────────
  const threadsQuery = trpc.chat.listThreads.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const messagesQuery = trpc.chat.getMessages.useQuery(
    { threadId: selectedThreadId! },
    { enabled: !!selectedThreadId, refetchOnWindowFocus: false },
  );

  // ─── Mutations ───────────────────────────────────────────────────────
  const createThread = trpc.chat.createThread.useMutation({
    onSuccess: (thread) => {
      setSelectedThreadId(thread.id);
      threadsQuery.refetch();
    },
  });

  const deleteThread = trpc.chat.deleteThread.useMutation({
    onSuccess: () => {
      setSelectedThreadId(null);
      threadsQuery.refetch();
    },
  });

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      console.log("Message sent successfully:", data);
      messagesQuery.refetch();
      setInputValue("");
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
    },
  });

  // ─── Auto-scroll ─────────────────────────────────────────────────────
  React.useEffect(() => {
    if (
      messagesEndRef.current &&
      typeof messagesEndRef.current.scrollIntoView === "function"
    ) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesQuery.data]);

  // ─── Auto-send after thread creation ─────────────────────────────────
  React.useEffect(() => {
    // If we have a pending message and a thread was just created, send it
    if (pendingMessage && selectedThreadId && masterKey) {
      sendMessage.mutate({
        threadId: selectedThreadId,
        content: pendingMessage,
        masterKey,
      });
      setPendingMessage(null); // Clear pending message
    }
  }, [pendingMessage, selectedThreadId, masterKey, sendMessage]);

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleNewThread = React.useCallback(() => {
    createThread.mutate({
      name: `${t(`mode.${agentMode}`)} - ${new Date().toLocaleDateString()}`,
      agentMode: agentMode as "assistant" | "planner" | "editor" | "researcher",
      model: selectedModel,
    });
  }, [createThread, agentMode, selectedModel, t]);

  const handleDeleteThread = React.useCallback(
    (threadId: string) => {
      deleteThread.mutate({ id: threadId });
    },
    [deleteThread],
  );

  const handleSend = React.useCallback(() => {
    if (!inputValue.trim() || !masterKey) return;

    // If no thread is selected, create one first and save the message as pending
    if (!selectedThreadId) {
      setPendingMessage(inputValue.trim());
      setInputValue(""); // Clear input immediately
      createThread.mutate({
        name: `${t(`mode.${agentMode}`)} - ${new Date().toLocaleDateString()}`,
        agentMode: agentMode as "assistant" | "planner" | "editor" | "researcher",
        model: selectedModel,
      });
      // The message will be sent after the thread is created (see useEffect above)
      return;
    }

    sendMessage.mutate({
      threadId: selectedThreadId,
      content: inputValue.trim(),
      masterKey,
    });
  }, [inputValue, selectedThreadId, masterKey, sendMessage, createThread, agentMode, selectedModel, t]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const threads = threadsQuery.data ?? [];
  const messages: ChatMessageData[] = (messagesQuery.data ?? []).map(
    (msg: Record<string, unknown>) => ({
      id: msg.id as string,
      role: msg.role as string,
      content: (msg.content as string) ?? null,
      model: (msg.model as string) ?? null,
      tokensUsed: (msg.tokensUsed as number) ?? null,
      toolCalls: msg.toolCalls,
      createdAt: (msg.createdAt as string) ?? new Date().toISOString(),
    }),
  );

  return (
    <div data-testid="chat-panel" className={cn("flex h-full", className)}>
      {/* ─── Thread Sidebar ──────────────────────────────────────────── */}
      {showThreadSidebar && (
        <div
          data-testid="thread-sidebar"
          className="w-64 border-r flex flex-col bg-muted/30"
        >
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold">{t("threads")}</span>
            <button
              data-testid="new-thread-btn"
              onClick={handleNewThread}
              className="p-1 rounded hover:bg-muted transition-colors"
              title={t("newThread")}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div
                data-testid="no-threads"
                className="p-4 text-center text-sm text-muted-foreground"
              >
                {t("noThreads")}
              </div>
            ) : (
              threads.map(
                (thread: {
                  id: string;
                  name: string;
                  agentMode: string;
                  updatedAt: string;
                }) => (
                  <div
                    key={thread.id}
                    data-testid="thread-item"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={cn(
                      "p-3 cursor-pointer border-b hover:bg-muted/50 transition-colors flex items-center gap-2",
                      selectedThreadId === thread.id && "bg-muted",
                    )}
                  >
                    <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {thread.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {thread.agentMode}
                      </div>
                    </div>
                    <button
                      data-testid="delete-thread-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteThread(thread.id);
                      }}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ),
              )
            )}
          </div>
        </div>
      )}

      {/* ─── Main Chat Area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Message history */}
        <div
          data-testid="message-area"
          className="flex-1 overflow-y-auto p-4 space-y-2"
        >
          {!selectedThreadId ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Bot className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">{t("title")}</p>
              <p className="text-sm">{t("description")}</p>
            </div>
          ) : messages.length === 0 ? (
            <div
              data-testid="no-messages"
              className="flex items-center justify-center h-full text-sm text-muted-foreground"
            >
              {t("noMessages")}
            </div>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ─── Input Area ──────────────────────────────────────────── */}
        <div
          data-testid="input-area"
          className="border-t p-3 flex flex-col gap-2"
        >
          {/* Text input and send button */}
          <div className="flex items-end gap-2">
            {/* Text input */}
            <textarea
              data-testid="chat-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("inputPlaceholder")}
              rows={3}
              className="flex-1 text-sm border rounded px-3 py-2 resize-none bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />

            {/* Send button */}
            <button
              data-testid="send-btn"
              onClick={handleSend}
              disabled={
                !inputValue.trim() ||
                !masterKey ||
                sendMessage.isPending ||
                createThread.isPending
              }
              className="p-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={t("send")}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Selectors row */}
          <div className="flex items-center gap-2">
            {/* Agent mode selector */}
            <AgentModeSelector
              value={agentMode}
              onChange={setAgentMode}
            />

            {/* Model selector */}
            <ModelSelector value={selectedModel} onChange={setSelectedModel} />
          </div>
        </div>
      </div>
    </div>
  );
}
