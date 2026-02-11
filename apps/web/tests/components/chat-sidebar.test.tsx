import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  trpc: {
    chat: {
      listThreads: {
        useQuery: vi.fn(() => ({
          data: [
            {
              id: "thread-1",
              name: "Test Thread 1",
              agentMode: "assistant",
              updatedAt: new Date().toISOString(),
            },
          ],
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })),
      },
      getMessages: {
        useQuery: vi.fn(() => ({
          data: [],
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })),
      },
      createThread: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
        })),
      },
      deleteThread: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
        })),
      },
      addMessage: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
        })),
      },
      sendMessage: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
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
  },
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: "AI Chat",
      close: "Close",
      minimize: "Minimize",
      threads: "Threads",
      newThread: "New Thread",
      noThreads: "No threads yet",
      noMessages: "No messages yet",
      inputPlaceholder: "Type a message...",
      send: "Send",
      "mode.assistant": "Assistant",
      "mode.planner": "Planner",
      "mode.editor": "Editor",
      "mode.researcher": "Researcher",
      "role.user": "You",
      "role.assistant": "Assistant",
      "role.system": "System",
      "role.tool": "Tool",
    };
    return translations[key] || key;
  },
}));

describe("ChatSidebar", () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should always render (open or closed)", () => {
    const { rerender } = render(
      <ChatSidebar isOpen={true} onToggle={mockOnToggle} />,
    );
    expect(screen.getByTestId("chat-sidebar")).toBeInTheDocument();

    rerender(<ChatSidebar isOpen={false} onToggle={mockOnToggle} />);
    expect(screen.getByTestId("chat-sidebar")).toBeInTheDocument();
  });

  it("should render close button when open", () => {
    render(<ChatSidebar isOpen={true} onToggle={mockOnToggle} />);
    expect(screen.getByTestId("chat-sidebar-close")).toBeInTheDocument();
  });

  it("should render sticky tab when closed", () => {
    render(<ChatSidebar isOpen={false} onToggle={mockOnToggle} />);
    expect(screen.getByTestId("chat-sidebar-tab")).toBeInTheDocument();
  });

  it("should call onToggle when close button clicked", () => {
    render(<ChatSidebar isOpen={true} onToggle={mockOnToggle} />);
    fireEvent.click(screen.getByTestId("chat-sidebar-close"));
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it("should call onToggle when tab clicked", () => {
    render(<ChatSidebar isOpen={false} onToggle={mockOnToggle} />);
    fireEvent.click(screen.getByTestId("chat-sidebar-tab"));
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it("should render chat panel content when open", () => {
    render(<ChatSidebar isOpen={true} onToggle={mockOnToggle} />);
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("should have full width when open", () => {
    render(<ChatSidebar isOpen={true} onToggle={mockOnToggle} />);
    const sidebar = screen.getByTestId("chat-sidebar");
    expect(sidebar).toHaveClass("w-96"); // 384px = 96 * 4px
  });

  it("should have tab width when closed", () => {
    render(<ChatSidebar isOpen={false} onToggle={mockOnToggle} />);
    const sidebar = screen.getByTestId("chat-sidebar");
    expect(sidebar).toHaveClass("w-10"); // 40px tab width
  });
});
