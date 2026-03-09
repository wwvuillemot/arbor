import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  AgentModeManager,
  type AgentModeConfig,
} from "@/components/agent-mode-manager";
import * as trpcModule from "@/lib/trpc";

interface MockAgentModeDialogProps {
  open: boolean;
  onClose: (saved: boolean) => void;
}

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock AgentModeDialog
vi.mock("@/components/agent-mode-dialog", () => ({
  AgentModeDialog: ({ open, onClose }: MockAgentModeDialogProps) =>
    open ? (
      <div data-testid="agent-mode-dialog">
        <button onClick={() => onClose(false)}>Cancel</button>
        <button onClick={() => onClose(true)}>Save</button>
      </div>
    ) : null,
}));

describe("AgentModeManager", () => {
  const isoTimestamp = new Date().toISOString();

  const mockModes: AgentModeConfig[] = [
    {
      id: "1",
      name: "assistant",
      displayName: "Assistant",
      description: "General purpose assistant",
      allowedTools: [],
      guidelines: "Be helpful",
      temperature: 0.7,
      isBuiltIn: true,
      createdAt: isoTimestamp,
      updatedAt: isoTimestamp,
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
      createdAt: isoTimestamp,
      updatedAt: isoTimestamp,
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
    } as unknown as typeof trpcModule.trpc);
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
    } as unknown as typeof trpcModule.trpc);

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

  it("should show edit buttons for all modes, delete only for custom modes", () => {
    render(<AgentModeManager />);

    const editButtons = screen.getAllByText("edit");
    const deleteButtons = screen.getAllByText("delete");

    // Both built-in and custom modes can be edited now
    expect(editButtons).toHaveLength(2);
    // Only custom modes can be deleted
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

    const editButtons = screen.getAllByText("edit");
    // Click the first edit button (built-in mode)
    fireEvent.click(editButtons[0]);

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
