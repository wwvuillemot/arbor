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
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render when open", () => {
    render(<ChatSidebar isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByTestId("chat-sidebar")).toBeInTheDocument();
  });

  it("should not render when closed", () => {
    render(<ChatSidebar isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByTestId("chat-sidebar")).not.toBeInTheDocument();
  });

  it("should render close button", () => {
    render(<ChatSidebar isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByTestId("chat-sidebar-close")).toBeInTheDocument();
  });

  it("should call onClose when close button clicked", () => {
    render(<ChatSidebar isOpen={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByTestId("chat-sidebar-close"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should render chat panel content", () => {
    render(<ChatSidebar isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
  });

  it("should have fixed width", () => {
    render(<ChatSidebar isOpen={true} onClose={mockOnClose} />);
    const sidebar = screen.getByTestId("chat-sidebar");
    expect(sidebar).toHaveClass("w-96"); // 384px = 96 * 4px
  });

  it("should be positioned on the right", () => {
    render(<ChatSidebar isOpen={true} onClose={mockOnClose} />);
    const sidebar = screen.getByTestId("chat-sidebar");
    expect(sidebar).toHaveClass("right-0");
  });

  it("should have shadow and border", () => {
    render(<ChatSidebar isOpen={true} onClose={mockOnClose} />);
    const sidebar = screen.getByTestId("chat-sidebar");
    expect(sidebar).toHaveClass("shadow-lg");
    expect(sidebar).toHaveClass("border-l");
  });
});

