import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const chatMessageRenderCounts = vi.hoisted(() => new Map<string, number>());

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/contexts/toast-context", () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), toasts: [] }),
}));

vi.mock("@/components/chat/agent-mode-selector", () => ({
  AgentModeSelector: () => <div data-testid="agent-mode-selector" />,
}));

vi.mock("@/components/chat/model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

vi.mock("@/components/chat/mcp-tools-panel", () => ({
  McpToolsPanel: () => <div data-testid="mcp-tools-panel" />,
}));

vi.mock("@/components/chat/chat-message", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    ChatMessage: ({
      message,
    }: {
      message: { id: string; content: string | null };
    }) => {
      chatMessageRenderCounts.set(
        message.id,
        (chatMessageRenderCounts.get(message.id) ?? 0) + 1,
      );

      return React.createElement(
        "div",
        { "data-testid": `chat-message-${message.id}` },
        message.content,
      );
    },
  };
});

const mockThreads = [
  {
    id: "thread-1",
    name: "Assistant - 1/1/2024",
    agentMode: "assistant",
    updatedAt: "2024-01-01T12:00:00Z",
  },
];

const mockMessages = [
  {
    id: "msg-1",
    role: "user",
    content: "First message",
    model: null,
    tokensUsed: null,
    toolCalls: null,
    metadata: {},
    createdAt: "2024-01-01T10:00:00Z",
  },
  {
    id: "msg-2",
    role: "assistant",
    content: "Second message",
    model: "gpt-4o",
    tokensUsed: 42,
    toolCalls: null,
    metadata: {},
    createdAt: "2024-01-01T10:01:00Z",
  },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    chat: {
      listThreads: {
        useQuery: vi.fn(() => ({
          data: mockThreads,
          isLoading: false,
          refetch: vi.fn(),
        })),
      },
      getMessages: {
        useQuery: vi.fn(() => ({
          data: mockMessages,
          isLoading: false,
          refetch: vi.fn(),
        })),
      },
      createThread: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      deleteThread: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      updateThread: {
        useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
      },
      sendMessage: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
          variables: undefined,
        })),
      },
    },
    preferences: {
      getMasterKey: {
        useQuery: vi.fn(() => ({
          data: { masterKey: "test-master-key" },
          isLoading: false,
        })),
      },
    },
    useUtils: vi.fn(() => ({
      nodes: {
        getById: { invalidate: vi.fn() },
        getChildren: { invalidate: vi.fn() },
      },
    })),
  },
}));

import { ChatPanel } from "@/components/chat/chat-panel";

describe("ChatPanel composer behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatMessageRenderCounts.clear();
  });

  it("does not rerender existing messages while typing in the composer", () => {
    render(<ChatPanel />);

    fireEvent.click(screen.getByTestId("thread-item"));

    expect(chatMessageRenderCounts.get("msg-1")).toBe(1);
    expect(chatMessageRenderCounts.get("msg-2")).toBe(1);

    fireEvent.change(screen.getByTestId("chat-input"), {
      target: { value: "A painful prompt to type" },
    });

    expect(chatMessageRenderCounts.get("msg-1")).toBe(1);
    expect(chatMessageRenderCounts.get("msg-2")).toBe(1);
  });

  it("grows the composer up to a capped height and enables scrolling for overflow", () => {
    render(<ChatPanel />);

    const input = screen.getByTestId("chat-input") as HTMLTextAreaElement;

    Object.defineProperty(input, "scrollHeight", {
      configurable: true,
      get: () => 240,
    });

    fireEvent.change(input, {
      target: {
        value: "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7",
      },
    });

    expect(input.style.maxHeight).toBe("192px");
    expect(input.style.height).toBe("192px");
    expect(input.style.overflowY).toBe("auto");
  });
});
