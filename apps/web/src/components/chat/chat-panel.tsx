"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  Send,
  MessageSquare,
  Bot,
  Loader2,
  X,
  FileText,
  Folder,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";
import { ChatMessage, type ChatMessageData } from "./chat-message";
import { ModelSelector } from "./model-selector";
import { AgentModeSelector } from "./agent-mode-selector";
import { McpToolsPanel } from "./mcp-tools-panel";

export interface ChatPanelProps {
  className?: string;
  showThreadSidebar?: boolean;
  projectId?: string | null;
  projectName?: string | null;
  contextNodes?: { id: string; name: string; type: string }[];
  onRemoveContext?: (id: string) => void;
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
  projectId,
  projectName,
  contextNodes = [],
  onRemoveContext,
}: ChatPanelProps) {
  const t = useTranslations("chat");
  const { addToast } = useToast();
  const utils = trpc.useUtils();

  // Persist selected thread ID in localStorage
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(
    () => {
      if (typeof window !== "undefined") {
        return localStorage.getItem("arbor:selectedThreadId");
      }
      return null;
    },
  );

  const [sidebarTab, setSidebarTab] = React.useState<"threads" | "tools">(
    "threads",
  );
  const [inputValue, setInputValue] = React.useState("");
  const [agentMode, setAgentMode] = React.useState<string>("assistant");
  const [selectedModel, setSelectedModel] = React.useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = React.useState<string | null>(
    null,
  );

  // Save selected thread ID to localStorage whenever it changes
  React.useEffect(() => {
    if (selectedThreadId) {
      localStorage.setItem("arbor:selectedThreadId", selectedThreadId);
    } else {
      localStorage.removeItem("arbor:selectedThreadId");
    }
  }, [selectedThreadId]);

  // Clear selected thread when project changes (threads are project-scoped)
  const prevProjectIdRef = React.useRef(projectId);
  React.useEffect(() => {
    if (prevProjectIdRef.current !== projectId) {
      prevProjectIdRef.current = projectId;
      setSelectedThreadId(null);
    }
  }, [projectId]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Get master key for API key decryption
  const [masterKey, setMasterKey] = React.useState<string | null>(null);

  // Get master key from database via tRPC
  const masterKeyQuery = trpc.preferences.getMasterKey.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (masterKeyQuery.data?.masterKey) {
      setMasterKey(masterKeyQuery.data.masterKey);
    }
  }, [masterKeyQuery.data]);

  // ─── Queries ─────────────────────────────────────────────────────────
  const threadsQuery = trpc.chat.listThreads.useQuery(
    projectId ? { projectId } : undefined,
    { refetchOnWindowFocus: false },
  );

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

  const updateThread = trpc.chat.updateThread.useMutation({
    onSuccess: () => {
      threadsQuery.refetch();
    },
  });

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      messagesQuery.refetch();
      setInputValue("");
      // Invalidate node cache so UI reflects any node changes made by LLM tools
      utils.nodes.getById.invalidate();
      utils.nodes.getChildren.invalidate();
    },
    onError: (error) => {
      addToast(error.message || t("error"), "error");
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
  }, [messagesQuery.data, sendMessage.isPending]);

  // ─── Sync model selector with current thread ────────────────────────
  React.useEffect(() => {
    if (selectedThreadId && threadsQuery.data) {
      const currentThread = threadsQuery.data.find(
        (t: { id: string; model?: string | null }) => t.id === selectedThreadId,
      );
      if (currentThread) {
        setSelectedModel(currentThread.model ?? null);
      }
    }
  }, [selectedThreadId, threadsQuery.data]);

  // ─── Update thread model when changed ────────────────────────────────
  const handleModelChange = React.useCallback(
    (modelId: string | null) => {
      setSelectedModel(modelId);
      // If a thread is selected, update its model in the database
      if (selectedThreadId) {
        updateThread.mutate({
          id: selectedThreadId,
          model: modelId,
        });
      }
    },
    [selectedThreadId, updateThread],
  );

  // ─── Auto-send after thread creation ─────────────────────────────────
  React.useEffect(() => {
    // If we have a pending message and a thread was just created, send it
    if (pendingMessage && selectedThreadId && masterKey) {
      sendMessage.mutate({
        threadId: selectedThreadId,
        content: pendingMessage,
        masterKey,
        projectId: projectId ?? null,
        contextNodeIds: contextNodes.map((n) => n.id),
      });
      setPendingMessage(null); // Clear pending message
    }
  }, [
    pendingMessage,
    selectedThreadId,
    masterKey,
    sendMessage,
    projectId,
    contextNodes,
  ]);

  // ─── Handlers ────────────────────────────────────────────────────────
  const handleNewThread = React.useCallback(() => {
    createThread.mutate({
      name: `${t(`mode.${agentMode}`)} - ${new Date().toLocaleDateString()}`,
      agentMode: agentMode as "assistant" | "planner" | "editor" | "researcher",
      model: selectedModel,
      projectId: projectId ?? null,
    });
  }, [createThread, agentMode, selectedModel, projectId, t]);

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
        agentMode: agentMode as
          | "assistant"
          | "planner"
          | "editor"
          | "researcher",
        model: selectedModel,
        projectId: projectId ?? null,
      });
      // The message will be sent after the thread is created (see useEffect above)
      return;
    }

    sendMessage.mutate({
      threadId: selectedThreadId,
      content: inputValue.trim(),
      masterKey,
      projectId: projectId ?? null,
      contextNodeIds: contextNodes.map((n) => n.id),
    });
  }, [
    inputValue,
    selectedThreadId,
    masterKey,
    sendMessage,
    createThread,
    agentMode,
    selectedModel,
    t,
    projectId,
    contextNodes,
  ]);

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
      toolName: (msg.metadata as Record<string, unknown> | null)?.toolName as
        | string
        | undefined,
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
          {/* Tab bar */}
          <div className="flex border-b">
            <button
              onClick={() => setSidebarTab("threads")}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                sidebarTab === "threads"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("threads")}
            </button>
            <button
              onClick={() => setSidebarTab("tools")}
              className={cn(
                "flex-1 px-3 py-2 text-xs font-medium transition-colors",
                sidebarTab === "tools"
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Tools
            </button>
          </div>

          {sidebarTab === "tools" ? (
            <div className="flex-1 overflow-y-auto p-3">
              <McpToolsPanel />
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 border-b flex items-center justify-end">
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
            </>
          )}
        </div>
      )}

      {/* ─── Main Chat Area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact thread bar (when thread sidebar is hidden) */}
        {!showThreadSidebar && (
          <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/20 shrink-0">
            <select
              value={selectedThreadId ?? ""}
              onChange={(e) => setSelectedThreadId(e.target.value || null)}
              className="flex-1 min-w-0 text-xs bg-transparent border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring truncate"
            >
              <option value="">
                {threads.length === 0 ? t("noThreads") : t("selectThread")}
              </option>
              {threads.map((thread: { id: string; name: string }) => (
                <option key={thread.id} value={thread.id}>
                  {thread.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleNewThread}
              className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
              title={t("newThread")}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {selectedThreadId && (
              <button
                onClick={() => handleDeleteThread(selectedThreadId)}
                className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                title="Delete thread"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

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
          {sendMessage.isPending && (
            <div className="flex gap-3 p-3 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Thinking…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ─── Input Area ──────────────────────────────────────────── */}
        <div
          data-testid="input-area"
          className="border-t p-3 flex flex-col gap-2"
        >
          {/* Context chips */}
          {(projectId || contextNodes.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {projectId && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  <Folder className="w-3 h-3" />
                  {projectName ?? "Project"}
                </span>
              )}
              {contextNodes.map((node) => (
                <span
                  key={node.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border"
                >
                  {node.type === "folder" ? (
                    <Folder className="w-3 h-3" />
                  ) : (
                    <FileText className="w-3 h-3" />
                  )}
                  {node.name}
                  {onRemoveContext && (
                    <button
                      onClick={() => onRemoveContext(node.id)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                      title="Remove from context"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Processing status bar */}
          {sendMessage.isPending && (
            <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded border border-green-200 dark:border-green-800">
              <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
              <span>Processing your message…</span>
            </div>
          )}

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

            {/* Send button — shows spinner while pending */}
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
              {sendMessage.isPending || createThread.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Selectors row */}
          <div className="flex items-center gap-2">
            {/* Agent mode selector */}
            <AgentModeSelector value={agentMode} onChange={setAgentMode} />

            {/* Model selector */}
            <ModelSelector value={selectedModel} onChange={handleModelChange} />
          </div>
        </div>
      </div>
    </div>
  );
}
