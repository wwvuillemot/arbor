import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AgentModeDialog } from "@/components/agent-mode-dialog";
import * as trpcModule from "@/lib/trpc";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock MarkdownEditor component (uses TipTap which doesn't work well in jsdom)
vi.mock("@/components/markdown-editor", () => ({
  MarkdownEditor: ({ value, onChange, placeholder }: any) => (
    <textarea
      data-testid="markdown-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

// Mock ToolSelector component (simplify for testing)
vi.mock("@/components/tool-selector", () => ({
  ToolSelector: ({ value, onChange }: any) => (
    <div data-testid="tool-selector">
      {["create_node", "update_node", "delete_node"].map((tool) => (
        <label key={tool}>
          {tool}
          <input
            type="checkbox"
            checked={value.includes(tool)}
            onChange={(e) => {
              if (e.target.checked) {
                onChange([...value, tool]);
              } else {
                onChange(value.filter((t: string) => t !== tool));
              }
            }}
          />
        </label>
      ))}
    </div>
  ),
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
    // Overview tab is default
    expect(screen.getByLabelText(/form\.name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/form\.displayName/)).toBeInTheDocument();
    expect(screen.getByLabelText(/form\.description/)).toBeInTheDocument();
    // Guidelines now uses TipTap editor (mocked as textarea with testid)
    expect(screen.getByLabelText(/form\.temperature/)).toBeInTheDocument();

    // Click Guidelines tab to see markdown editor
    fireEvent.click(screen.getByRole("tab", { name: /Guidelines/i }));
    expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();
  });

  it("should render edit form when mode is provided", () => {
    render(
      <AgentModeDialog open={true} mode={mockMode} onClose={mockOnClose} />,
    );

    expect(screen.getByText("editMode")).toBeInTheDocument();
    expect(screen.queryByLabelText(/form\.name/)).not.toBeInTheDocument(); // Name field hidden in edit mode
    expect(screen.getByDisplayValue("Custom Mode")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A custom mode")).toBeInTheDocument();

    // Click Guidelines tab to see guidelines
    fireEvent.click(screen.getByRole("tab", { name: /Guidelines/i }));
    expect(screen.getByDisplayValue("Custom guidelines")).toBeInTheDocument();
  });

  it("should populate form fields with mode data in edit mode", () => {
    render(
      <AgentModeDialog open={true} mode={mockMode} onClose={mockOnClose} />,
    );

    expect(screen.getByDisplayValue("Custom Mode")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A custom mode")).toBeInTheDocument();

    // Click Guidelines tab to see guidelines
    fireEvent.click(screen.getByRole("tab", { name: /Guidelines/i }));
    expect(screen.getByDisplayValue("Custom guidelines")).toBeInTheDocument();

    // Click Tools tab to see tool checkboxes
    fireEvent.click(screen.getByRole("tab", { name: /Tools/i }));
    expect(screen.getByLabelText(/create_node/)).toBeChecked();
    expect(screen.getByLabelText(/update_node/)).toBeChecked();
  });

  it("should call createMutation when creating new mode", async () => {
    mockCreateMutation.mockResolvedValue({});

    render(<AgentModeDialog open={true} mode={null} onClose={mockOnClose} />);

    // Fill in Overview tab fields
    fireEvent.change(screen.getByLabelText(/form\.name/), {
      target: { value: "new-mode" },
    });
    fireEvent.change(screen.getByLabelText(/form\.displayName/), {
      target: { value: "New Mode" },
    });
    fireEvent.change(screen.getByLabelText(/form\.description/), {
      target: { value: "New description" },
    });

    // Click Guidelines tab and fill in guidelines
    fireEvent.click(screen.getByRole("tab", { name: /Guidelines/i }));
    fireEvent.change(screen.getByTestId("markdown-editor"), {
      target: { value: "New guidelines" },
    });

    // Submit form (find form element from the markdown editor)
    const form = screen.getByTestId("markdown-editor").closest("form");
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

    // Fill in Overview tab fields
    fireEvent.change(screen.getByLabelText(/form\.name/), {
      target: { value: "new-mode" },
    });
    fireEvent.change(screen.getByLabelText(/form\.displayName/), {
      target: { value: "New Mode" },
    });
    fireEvent.change(screen.getByLabelText(/form\.description/), {
      target: { value: "Description" },
    });

    // Click Guidelines tab and fill in guidelines
    fireEvent.click(screen.getByRole("tab", { name: /Guidelines/i }));
    fireEvent.change(screen.getByTestId("markdown-editor"), {
      target: { value: "Guidelines" },
    });

    // Submit form (find form element from the markdown editor)
    const form = screen.getByTestId("markdown-editor").closest("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });
  });
});
