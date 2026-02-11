/**
 * Phase 4.5: Chat UI Component Tests
 *
 * Tests for ChatMessage and ChatPanel components.
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// Mock toast context
const mockAddToast = vi.fn();
vi.mock("@/contexts/toast-context", () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
    toasts: [],
  }),
}));

// Track mutation calls
const mockCreateThreadMutate = vi.fn();
const mockDeleteThreadMutate = vi.fn();
const mockAddMessageMutate = vi.fn();
const mockSendMessageMutate = vi.fn();

// Mock data
const mockThreads = [
  {
    id: "thread-1",
    name: "Assistant - 1/1/2024",
    agentMode: "assistant",
    projectId: null,
    createdAt: "2024-01-01T10:00:00Z",
    updatedAt: "2024-01-01T12:00:00Z",
  },
  {
    id: "thread-2",
    name: "Researcher Session",
    agentMode: "researcher",
    projectId: null,
    createdAt: "2024-01-02T10:00:00Z",
    updatedAt: "2024-01-02T12:00:00Z",
  },
];

const mockMessages = [
  {
    id: "msg-1",
    threadId: "thread-1",
    role: "user",
    content: "Hello, can you help me?",
    model: null,
    tokensUsed: null,
    toolCalls: null,
    metadata: {},
    createdAt: "2024-01-01T10:00:00Z",
  },
  {
    id: "msg-2",
    threadId: "thread-1",
    role: "assistant",
    content: "Of course! How can I assist you today?",
    model: "gpt-4o",
    tokensUsed: 42,
    toolCalls: null,
    metadata: {},
    createdAt: "2024-01-01T10:01:00Z",
  },
  {
    id: "msg-3",
    threadId: "thread-1",
    role: "assistant",
    content: "Using a tool to search...",
    model: "gpt-4o",
    tokensUsed: 15,
    toolCalls: [{ id: "tc-1", name: "search_nodes" }],
    metadata: {},
    createdAt: "2024-01-01T10:02:00Z",
  },
];

// Mock tRPC
vi.mock("@/lib/trpc", () => {
  const mockRefetchThreads = vi.fn();
  const mockRefetchMessages = vi.fn();

  const mockTrpc = {
    chat: {
      listThreads: {
        useQuery: vi.fn(() => ({
          data: mockThreads,
          isLoading: false,
          error: null,
          refetch: mockRefetchThreads,
        })),
      },
      getMessages: {
        useQuery: vi.fn(() => ({
          data: mockMessages,
          isLoading: false,
          error: null,
          refetch: mockRefetchMessages,
        })),
      },
      createThread: {
        useMutation: vi.fn((opts: any) => ({
          mutate: (...args: any[]) => {
            mockCreateThreadMutate(...args);
            opts?.onSuccess?.({
              id: "new-thread",
              name: "New Thread",
              agentMode: "assistant",
            });
          },
          isPending: false,
        })),
      },
      deleteThread: {
        useMutation: vi.fn((opts: any) => ({
          mutate: (...args: any[]) => {
            mockDeleteThreadMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: false,
        })),
      },
      addMessage: {
        useMutation: vi.fn((opts: any) => ({
          mutate: (...args: any[]) => {
            mockAddMessageMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: false,
        })),
      },
      sendMessage: {
        useMutation: vi.fn((opts: any) => ({
          mutate: (...args: any[]) => {
            mockSendMessageMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: false,
        })),
      },
    },
    llm: {
      listAvailableModels: {
        useQuery: vi.fn(() => ({
          data: [
            {
              id: "gpt-4o",
              name: "GPT-4o",
              provider: "openai",
              contextWindow: 128000,
              supportsTools: true,
              supportsVision: true,
              supportsStreaming: true,
            },
          ],
          isLoading: false,
          error: null,
        })),
      },
    },
    useUtils: vi.fn(() => ({})),
  };

  return { trpc: mockTrpc, getTRPCClient: vi.fn() };
});

// Import components AFTER mocks
import {
  ChatMessage,
  type ChatMessageData,
} from "@/components/chat/chat-message";
import { ChatPanel } from "@/components/chat/chat-panel";

// ═══════════════════════════════════════════════════════════════════════
// ChatMessage Tests
// ═══════════════════════════════════════════════════════════════════════

describe("ChatMessage", () => {
  const baseMessage: ChatMessageData = {
    id: "msg-1",
    role: "user",
    content: "Hello, how are you?",
    model: null,
    tokensUsed: null,
    createdAt: "2024-01-01T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render a message with content", () => {
    render(<ChatMessage message={baseMessage} />);
    expect(screen.getByTestId("chat-message")).toBeInTheDocument();
    expect(screen.getByTestId("message-content")).toHaveTextContent(
      "Hello, how are you?",
    );
  });

  it("should display user role label", () => {
    render(<ChatMessage message={baseMessage} />);
    expect(screen.getByTestId("message-role")).toHaveTextContent("role.user");
  });

  it("should display assistant role label", () => {
    const assistantMsg: ChatMessageData = {
      ...baseMessage,
      id: "msg-2",
      role: "assistant",
      content: "I'm doing well!",
    };
    render(<ChatMessage message={assistantMsg} />);
    expect(screen.getByTestId("message-role")).toHaveTextContent(
      "role.assistant",
    );
  });

  it("should display system role label", () => {
    const systemMsg: ChatMessageData = {
      ...baseMessage,
      id: "msg-3",
      role: "system",
      content: "System prompt",
    };
    render(<ChatMessage message={systemMsg} />);
    expect(screen.getByTestId("message-role")).toHaveTextContent("role.system");
  });

  it("should display tool role label", () => {
    const toolMsg: ChatMessageData = {
      ...baseMessage,
      id: "msg-4",
      role: "tool",
      content: "Tool result",
    };
    render(<ChatMessage message={toolMsg} />);
    expect(screen.getByTestId("message-role")).toHaveTextContent("role.tool");
  });

  it("should show model name when present", () => {
    const msgWithModel: ChatMessageData = {
      ...baseMessage,
      model: "gpt-4o",
    };
    render(<ChatMessage message={msgWithModel} />);
    expect(screen.getByTestId("message-model")).toHaveTextContent("gpt-4o");
  });

  it("should not show model when null", () => {
    render(<ChatMessage message={baseMessage} />);
    expect(screen.queryByTestId("message-model")).not.toBeInTheDocument();
  });

  it("should show token count when present", () => {
    const msgWithTokens: ChatMessageData = {
      ...baseMessage,
      tokensUsed: 42,
    };
    render(<ChatMessage message={msgWithTokens} />);
    expect(screen.getByTestId("message-tokens")).toHaveTextContent("42");
  });

  it("should not show token count when null", () => {
    render(<ChatMessage message={baseMessage} />);
    expect(screen.queryByTestId("message-tokens")).not.toBeInTheDocument();
  });

  it("should show copy button for messages with content", () => {
    render(<ChatMessage message={baseMessage} />);
    expect(screen.getByTestId("copy-message")).toBeInTheDocument();
  });

  it("should show tool calls when present", () => {
    const msgWithTools: ChatMessageData = {
      ...baseMessage,
      toolCalls: [{ id: "tc-1", name: "search_nodes" }],
    };
    render(<ChatMessage message={msgWithTools} />);
    expect(screen.getByTestId("message-tool-calls")).toBeInTheDocument();
  });

  it("should not show tool calls when empty", () => {
    render(<ChatMessage message={baseMessage} />);
    expect(screen.queryByTestId("message-tool-calls")).not.toBeInTheDocument();
  });

  it("should have data-role attribute matching message role", () => {
    render(<ChatMessage message={baseMessage} />);
    expect(screen.getByTestId("chat-message")).toHaveAttribute(
      "data-role",
      "user",
    );
  });

  // ─── Reasoning / Thinking Display ──────────────────────────────────

  it("should show reasoning toggle when reasoning is present", () => {
    const msgWithReasoning: ChatMessageData = {
      ...baseMessage,
      role: "assistant",
      reasoning: "Let me think step by step...",
    };
    render(<ChatMessage message={msgWithReasoning} />);
    expect(screen.getByTestId("reasoning-section")).toBeInTheDocument();
    expect(screen.getByTestId("reasoning-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("reasoning-toggle")).toHaveTextContent(
      "showReasoning",
    );
  });

  it("should not show reasoning section when reasoning is null", () => {
    render(<ChatMessage message={baseMessage} />);
    expect(screen.queryByTestId("reasoning-section")).not.toBeInTheDocument();
  });

  it("should toggle reasoning content on click", () => {
    const msgWithReasoning: ChatMessageData = {
      ...baseMessage,
      role: "assistant",
      reasoning: "Step 1: analyze\nStep 2: solve",
    };
    render(<ChatMessage message={msgWithReasoning} />);

    // Initially hidden
    expect(screen.queryByTestId("reasoning-content")).not.toBeInTheDocument();

    // Click to show
    fireEvent.click(screen.getByTestId("reasoning-toggle"));
    expect(screen.getByTestId("reasoning-content")).toBeInTheDocument();
    expect(screen.getByTestId("reasoning-content")).toHaveTextContent(
      "Step 1: analyze",
    );
    expect(screen.getByTestId("reasoning-toggle")).toHaveTextContent(
      "hideReasoning",
    );

    // Click to hide
    fireEvent.click(screen.getByTestId("reasoning-toggle"));
    expect(screen.queryByTestId("reasoning-content")).not.toBeInTheDocument();
  });

  it("should show token breakdown when reasoningTokens present", () => {
    const msgWithBreakdown: ChatMessageData = {
      ...baseMessage,
      role: "assistant",
      tokensUsed: 80,
      reasoningTokens: 50,
      outputTokens: 30,
    };
    render(<ChatMessage message={msgWithBreakdown} />);
    expect(screen.getByTestId("message-token-breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("message-token-breakdown")).toHaveTextContent(
      "50",
    );
    expect(screen.getByTestId("message-token-breakdown")).toHaveTextContent(
      "30",
    );
    expect(screen.getByTestId("message-token-breakdown")).toHaveTextContent(
      "reasoningTokens",
    );
    expect(screen.getByTestId("message-token-breakdown")).toHaveTextContent(
      "outputTokens",
    );
  });

  it("should show regular token count when no reasoningTokens", () => {
    const msgWithTokens: ChatMessageData = {
      ...baseMessage,
      tokensUsed: 42,
    };
    render(<ChatMessage message={msgWithTokens} />);
    expect(screen.getByTestId("message-tokens")).toBeInTheDocument();
    expect(
      screen.queryByTestId("message-token-breakdown"),
    ).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ChatPanel Tests
// ═══════════════════════════════════════════════════════════════════════

describe("ChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the chat panel", () => {
    render(<ChatPanel />);
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("should render thread sidebar", () => {
    render(<ChatPanel />);
    expect(screen.getByTestId("thread-sidebar")).toBeInTheDocument();
  });

  it("should render threads header with label", () => {
    render(<ChatPanel />);
    expect(screen.getByText("threads")).toBeInTheDocument();
  });

  it("should render new thread button", () => {
    render(<ChatPanel />);
    expect(screen.getByTestId("new-thread-btn")).toBeInTheDocument();
  });

  it("should render thread items from data", () => {
    render(<ChatPanel />);
    const items = screen.getAllByTestId("thread-item");
    expect(items).toHaveLength(2);
  });

  it("should display thread name and mode", () => {
    render(<ChatPanel />);
    expect(screen.getByText("Assistant - 1/1/2024")).toBeInTheDocument();
    expect(screen.getByText("Researcher Session")).toBeInTheDocument();
  });

  it("should render message area", () => {
    render(<ChatPanel />);
    expect(screen.getByTestId("message-area")).toBeInTheDocument();
  });

  it("should render input area", () => {
    render(<ChatPanel />);
    expect(screen.getByTestId("input-area")).toBeInTheDocument();
  });

  it("should render mode selector with all 4 modes", () => {
    render(<ChatPanel />);
    const selector = screen.getByTestId("mode-selector") as HTMLSelectElement;
    expect(selector).toBeInTheDocument();
    expect(selector.options).toHaveLength(4);
  });

  it("should render chat input", () => {
    render(<ChatPanel />);
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });

  it("should render send button", () => {
    render(<ChatPanel />);
    expect(screen.getByTestId("send-btn")).toBeInTheDocument();
  });

  it("should enable chat input even when no thread is selected", () => {
    render(<ChatPanel />);
    // Input should be enabled to allow users to start typing immediately
    expect(screen.getByTestId("chat-input")).not.toBeDisabled();
  });

  it("should create a new thread when new thread button is clicked", () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTestId("new-thread-btn"));
    expect(mockCreateThreadMutate).toHaveBeenCalledTimes(1);
    expect(mockCreateThreadMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        agentMode: "assistant",
      }),
    );
  });

  it("should select a thread when clicked", () => {
    render(<ChatPanel />);
    const items = screen.getAllByTestId("thread-item");
    fireEvent.click(items[0]);
    // After click, the input should become enabled (since we selected a thread)
    expect(screen.getByTestId("chat-input")).not.toBeDisabled();
  });

  it("should display messages after selecting a thread", () => {
    render(<ChatPanel />);
    const items = screen.getAllByTestId("thread-item");
    fireEvent.click(items[0]);
    const messages = screen.getAllByTestId("chat-message");
    expect(messages.length).toBeGreaterThan(0);
  });

  it("should delete a thread when delete button is clicked", () => {
    render(<ChatPanel />);
    const deleteButtons = screen.getAllByTestId("delete-thread-btn");
    fireEvent.click(deleteButtons[0]);
    expect(mockDeleteThreadMutate).toHaveBeenCalledTimes(1);
    expect(mockDeleteThreadMutate).toHaveBeenCalledWith({ id: "thread-1" });
  });

  it("should send a message when send button is clicked", () => {
    render(<ChatPanel />);
    // Select a thread first
    const items = screen.getAllByTestId("thread-item");
    fireEvent.click(items[0]);
    // Type a message
    const input = screen.getByTestId("chat-input");
    fireEvent.change(input, { target: { value: "Hello AI!" } });
    // Click send
    fireEvent.click(screen.getByTestId("send-btn"));
    expect(mockSendMessageMutate).toHaveBeenCalledTimes(1);
    expect(mockSendMessageMutate).toHaveBeenCalledWith({
      threadId: "thread-1",
      content: "Hello AI!",
      masterKey: "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=",
    });
  });

  it("should send a message on Enter key", () => {
    render(<ChatPanel />);
    // Select a thread first
    const items = screen.getAllByTestId("thread-item");
    fireEvent.click(items[0]);
    // Type a message
    const input = screen.getByTestId("chat-input");
    fireEvent.change(input, { target: { value: "Hello from Enter!" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockSendMessageMutate).toHaveBeenCalledTimes(1);
  });

  it("should not send on Shift+Enter", () => {
    render(<ChatPanel />);
    const items = screen.getAllByTestId("thread-item");
    fireEvent.click(items[0]);
    const input = screen.getByTestId("chat-input");
    fireEvent.change(input, { target: { value: "Hello!" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(mockSendMessageMutate).not.toHaveBeenCalled();
  });

  it("should not send empty messages", () => {
    render(<ChatPanel />);
    const items = screen.getAllByTestId("thread-item");
    fireEvent.click(items[0]);
    fireEvent.click(screen.getByTestId("send-btn"));
    expect(mockSendMessageMutate).not.toHaveBeenCalled();
  });

  it("should change agent mode via selector", () => {
    render(<ChatPanel />);
    const selector = screen.getByTestId("mode-selector") as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: "researcher" } });
    expect(selector.value).toBe("researcher");
  });

  it("should create thread with selected mode", () => {
    render(<ChatPanel />);
    const selector = screen.getByTestId("mode-selector") as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: "planner" } });
    fireEvent.click(screen.getByTestId("new-thread-btn"));
    expect(mockCreateThreadMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        agentMode: "planner",
      }),
    );
  });

  it("should show welcome message when no thread selected", () => {
    render(<ChatPanel />);
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("description")).toBeInTheDocument();
  });
});
