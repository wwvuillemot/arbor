import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgentModeManager } from "@/components/agent-mode-manager";
import * as trpcModule from "@/lib/trpc";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock AgentModeDialog
vi.mock("@/components/agent-mode-dialog", () => ({
  AgentModeDialog: ({ open, onClose }: any) =>
    open ? (
      <div data-testid="agent-mode-dialog">
        <button onClick={() => onClose(false)}>Cancel</button>
        <button onClick={() => onClose(true)}>Save</button>
      </div>
    ) : null,
}));

describe("AgentModeManager", () => {
  const mockModes = [
    {
      id: "1",
      name: "assistant",
      displayName: "Assistant",
      description: "General purpose assistant",
      allowedTools: [],
      guidelines: "Be helpful",
      temperature: 0.7,
      isBuiltIn: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "2",
      name: "custom-mode",
      displayName: "Custom Mode",
      description: "A custom mode",
      allowedTools: ["create_node", "update_node"],
      guidelines: "Custom guidelines",
      temperature: 0.5,
      isBuiltIn: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockRefetch = vi.fn();
  const mockDeleteMutation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(trpcModule, "trpc", "get").mockReturnValue({
      chat: {
        listAgentModes: {
          useQuery: vi.fn(() => ({
            data: mockModes,
            isLoading: false,
            refetch: mockRefetch,
          })),
        },
        deleteAgentMode: {
          useMutation: vi.fn(() => ({
            mutateAsync: mockDeleteMutation,
          })),
        },
      },
    } as any);
  });

  it("should render loading state", () => {
    vi.spyOn(trpcModule, "trpc", "get").mockReturnValue({
      chat: {
        listAgentModes: {
          useQuery: vi.fn(() => ({
            data: undefined,
            isLoading: true,
            refetch: mockRefetch,
          })),
        },
        deleteAgentMode: {
          useMutation: vi.fn(() => ({
            mutateAsync: mockDeleteMutation,
          })),
        },
      },
    } as any);

    render(<AgentModeManager />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("should render list of agent modes", () => {
    render(<AgentModeManager />);

    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("Custom Mode")).toBeInTheDocument();
    expect(screen.getByText("General purpose assistant")).toBeInTheDocument();
    expect(screen.getByText("A custom mode")).toBeInTheDocument();
  });

  it("should show built-in badge for built-in modes", () => {
    render(<AgentModeManager />);

    const builtInBadges = screen.getAllByText("builtIn");
    expect(builtInBadges).toHaveLength(1);
  });

  it("should show edit and delete buttons only for custom modes", () => {
    render(<AgentModeManager />);

    const editButtons = screen.getAllByText("edit");
    const deleteButtons = screen.getAllByText("delete");

    expect(editButtons).toHaveLength(1);
    expect(deleteButtons).toHaveLength(1);
  });

  it("should open create dialog when create button is clicked", () => {
    render(<AgentModeManager />);

    const createButton = screen.getByText("createMode");
    fireEvent.click(createButton);

    expect(screen.getByTestId("agent-mode-dialog")).toBeInTheDocument();
  });

  it("should open edit dialog when edit button is clicked", () => {
    render(<AgentModeManager />);

    const editButton = screen.getByText("edit");
    fireEvent.click(editButton);

    expect(screen.getByTestId("agent-mode-dialog")).toBeInTheDocument();
  });

  it("should require confirmation for delete", async () => {
    render(<AgentModeManager />);

    const deleteButton = screen.getByText("delete");

    // First click - show confirmation
    fireEvent.click(deleteButton);
    expect(screen.getByText("confirmDelete")).toBeInTheDocument();

    // Second click - actually delete
    fireEvent.click(screen.getByText("confirmDelete"));

    await waitFor(() => {
      expect(mockDeleteMutation).toHaveBeenCalledWith({ id: "2" });
    });
  });

  it("should refetch modes after successful save", async () => {
    render(<AgentModeManager />);

    const createButton = screen.getByText("createMode");
    fireEvent.click(createButton);

    const saveButton = screen.getByText("Save");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
