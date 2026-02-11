import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgentModeDialog } from "@/components/agent-mode-dialog";
import * as trpcModule from "@/lib/trpc";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("AgentModeDialog", () => {
  const mockOnClose = vi.fn();
  const mockCreateMutation = vi.fn();
  const mockUpdateMutation = vi.fn();

  const mockMode = {
    id: "1",
    name: "custom-mode",
    displayName: "Custom Mode",
    description: "A custom mode",
    allowedTools: ["create_node", "update_node"],
    guidelines: "Custom guidelines",
    temperature: 0.5,
    isBuiltIn: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(trpcModule, "trpc", "get").mockReturnValue({
      chat: {
        createAgentMode: {
          useMutation: vi.fn(() => ({
            mutateAsync: mockCreateMutation,
            isPending: false,
          })),
        },
        updateAgentMode: {
          useMutation: vi.fn(() => ({
            mutateAsync: mockUpdateMutation,
            isPending: false,
          })),
        },
      },
    } as any);
  });

  it("should not render when closed", () => {
    render(<AgentModeDialog open={false} mode={null} onClose={mockOnClose} />);
    expect(screen.queryByText("form.save")).not.toBeInTheDocument();
  });

  it("should render create form when mode is null", () => {
    render(<AgentModeDialog open={true} mode={null} onClose={mockOnClose} />);

    expect(screen.getByText("createMode")).toBeInTheDocument();
    expect(screen.getByLabelText(/form\.name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/form\.displayName/)).toBeInTheDocument();
    expect(screen.getByLabelText(/form\.description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/form\.guidelines/)).toBeInTheDocument();
    expect(screen.getByLabelText(/form\.temperature/)).toBeInTheDocument();
  });

  it("should render edit form when mode is provided", () => {
    render(
      <AgentModeDialog open={true} mode={mockMode} onClose={mockOnClose} />,
    );

    expect(screen.getByText("editMode")).toBeInTheDocument();
    expect(screen.queryByLabelText(/form\.name/)).not.toBeInTheDocument(); // Name field hidden in edit mode
    expect(screen.getByDisplayValue("Custom Mode")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A custom mode")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Custom guidelines")).toBeInTheDocument();
  });

  it("should populate form fields with mode data in edit mode", () => {
    render(
      <AgentModeDialog open={true} mode={mockMode} onClose={mockOnClose} />,
    );

    expect(screen.getByDisplayValue("Custom Mode")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A custom mode")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Custom guidelines")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("create_node, update_node"),
    ).toBeInTheDocument();
  });

  it("should call createMutation when creating new mode", async () => {
    mockCreateMutation.mockResolvedValue({});

    render(<AgentModeDialog open={true} mode={null} onClose={mockOnClose} />);

    // Fill in form
    fireEvent.change(screen.getByLabelText(/form\.name/), {
      target: { value: "new-mode" },
    });
    fireEvent.change(screen.getByLabelText(/form\.displayName/), {
      target: { value: "New Mode" },
    });
    fireEvent.change(screen.getByLabelText(/form\.description/), {
      target: { value: "New description" },
    });
    fireEvent.change(screen.getByLabelText(/form\.guidelines/), {
      target: { value: "New guidelines" },
    });

    // Submit form
    const form = screen.getByLabelText(/form\.name/).closest("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockCreateMutation).toHaveBeenCalledWith({
        name: "new-mode",
        displayName: "New Mode",
        description: "New description",
        guidelines: "New guidelines",
        temperature: 0.7,
        allowedTools: [],
      });
      expect(mockOnClose).toHaveBeenCalledWith(true);
    });
  });

  it("should call updateMutation when editing existing mode", async () => {
    mockUpdateMutation.mockResolvedValue({});

    render(
      <AgentModeDialog open={true} mode={mockMode} onClose={mockOnClose} />,
    );

    // Change display name
    const displayNameInput = screen.getByDisplayValue("Custom Mode");
    fireEvent.change(displayNameInput, {
      target: { value: "Updated Mode" },
    });

    // Submit form
    const form = displayNameInput.closest("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockUpdateMutation).toHaveBeenCalledWith({
        id: "1",
        displayName: "Updated Mode",
        description: "A custom mode",
        guidelines: "Custom guidelines",
        temperature: 0.5,
        allowedTools: ["create_node", "update_node"],
      });
      expect(mockOnClose).toHaveBeenCalledWith(true);
    });
  });

  it("should handle cancel button", () => {
    render(<AgentModeDialog open={true} mode={null} onClose={mockOnClose} />);

    const cancelButton = screen.getByText("form.cancel");
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledWith(false);
  });

  it("should show error message on save failure", async () => {
    mockCreateMutation.mockRejectedValue(new Error("Save failed"));

    render(<AgentModeDialog open={true} mode={null} onClose={mockOnClose} />);

    // Fill in required fields
    fireEvent.change(screen.getByLabelText(/form\.name/), {
      target: { value: "new-mode" },
    });
    fireEvent.change(screen.getByLabelText(/form\.displayName/), {
      target: { value: "New Mode" },
    });
    fireEvent.change(screen.getByLabelText(/form\.description/), {
      target: { value: "Description" },
    });
    fireEvent.change(screen.getByLabelText(/form\.guidelines/), {
      target: { value: "Guidelines" },
    });

    // Submit form
    const form = screen.getByLabelText(/form\.name/).closest("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });
  });
});
