/**
 * Phase 2.2: Tag UI Component Tests
 *
 * Tests for TagBadge and TagManager components.
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
const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockAddToNodeMutate = vi.fn();
const mockRemoveFromNodeMutate = vi.fn();

const mockTagsData = [
  {
    id: "tag-1",
    name: "Character",
    color: "#6366f1",
    icon: null,
    type: "character",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-2",
    name: "Location",
    color: "#10b981",
    icon: "📍",
    type: "location",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

// Mock tRPC
vi.mock("@/lib/trpc", () => {
  const makeMutation = (mutateFn: any) => ({
    mutate: mutateFn,
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isLoading: false,
    error: null,
  });

  const mockTrpc = {
    tags: {
      getAll: {
        useQuery: vi.fn(() => ({
          data: mockTagsData,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })),
      },
      create: {
        useMutation: vi.fn((opts: any) => {
          const mut = makeMutation((...args: any[]) => {
            mockCreateMutate(...args);
            opts?.onSuccess?.();
          });
          return mut;
        }),
      },
      update: {
        useMutation: vi.fn((opts: any) => {
          const mut = makeMutation((...args: any[]) => {
            mockUpdateMutate(...args);
            opts?.onSuccess?.();
          });
          return mut;
        }),
      },
      delete: {
        useMutation: vi.fn((opts: any) => {
          const mut = makeMutation((...args: any[]) => {
            mockDeleteMutate(...args);
            opts?.onSuccess?.();
          });
          return mut;
        }),
      },
      getNodeTags: {
        useQuery: vi.fn(() => ({
          data: [mockTagsData[0]],
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })),
      },
      addToNode: {
        useMutation: vi.fn((opts: any) => {
          const mut = makeMutation((...args: any[]) => {
            mockAddToNodeMutate(...args);
            opts?.onSuccess?.();
          });
          return mut;
        }),
      },
      removeFromNode: {
        useMutation: vi.fn((opts: any) => {
          const mut = makeMutation((...args: any[]) => {
            mockRemoveFromNodeMutate(...args);
            opts?.onSuccess?.();
          });
          return mut;
        }),
      },
    },
    useUtils: vi.fn(() => ({
      tags: {
        getAll: { invalidate: vi.fn() },
        getNodeTags: { invalidate: vi.fn() },
      },
    })),
  };

  return { trpc: mockTrpc, getTRPCClient: vi.fn() };
});

import { TagBadge, type TagBadgeTag } from "@/components/tags/tag-badge";
import { TagManager } from "@/components/tags/tag-manager";
import { TagPicker } from "@/components/tags/tag-picker";

// === TagBadge Tests ===

describe("TagBadge", () => {
  const baseTag: TagBadgeTag = {
    id: "tag-1",
    name: "Character",
    color: "#6366f1",
    icon: null,
    type: "character",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render tag name", () => {
    render(<TagBadge tag={baseTag} />);
    expect(screen.getByText("Character")).toBeInTheDocument();
  });

  it("should render with data-testid", () => {
    render(<TagBadge tag={baseTag} />);
    expect(screen.getByTestId("tag-badge-tag-1")).toBeInTheDocument();
  });

  it("should apply custom color style when color is valid hex", () => {
    render(<TagBadge tag={baseTag} />);
    const badge = screen.getByTestId("tag-badge-tag-1");
    expect(badge.style.backgroundColor).toBeTruthy();
    // jsdom converts hex to rgb, so check it's set rather than exact value
    expect(badge.style.color).toBeTruthy();
  });

  it("should not apply custom color style when color is null", () => {
    const tagNoColor = { ...baseTag, color: null };
    render(<TagBadge tag={tagNoColor} />);
    const badge = screen.getByTestId("tag-badge-tag-1");
    expect(badge.style.color).toBe("");
  });

  it("should render icon when tag has icon", () => {
    const tagWithIcon = { ...baseTag, icon: "📍" };
    render(<TagBadge tag={tagWithIcon} />);
    expect(screen.getByText("📍")).toBeInTheDocument();
  });

  it("should be clickable when onClick is provided", () => {
    const handleClick = vi.fn();
    render(<TagBadge tag={baseTag} onClick={handleClick} />);
    const badge = screen.getByTestId("tag-badge-tag-1");
    expect(badge).toHaveAttribute("role", "button");
    fireEvent.click(badge);
    expect(handleClick).toHaveBeenCalledWith(baseTag);
  });

  it("should not have button role when onClick is not provided", () => {
    render(<TagBadge tag={baseTag} />);
    const badge = screen.getByTestId("tag-badge-tag-1");
    expect(badge).not.toHaveAttribute("role");
  });

  it("should show remove button when onRemove is provided", () => {
    const handleRemove = vi.fn();
    render(<TagBadge tag={baseTag} onRemove={handleRemove} />);
    const removeBtn = screen.getByTestId("tag-badge-remove-tag-1");
    expect(removeBtn).toBeInTheDocument();
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledWith(baseTag);
  });

  it("should support md size variant", () => {
    render(<TagBadge tag={baseTag} size="md" />);
    const badge = screen.getByTestId("tag-badge-tag-1");
    expect(badge.className).toContain("text-sm");
  });

  it("should support keyboard activation when onClick is provided", () => {
    const handleClick = vi.fn();
    render(<TagBadge tag={baseTag} onClick={handleClick} />);
    const badge = screen.getByTestId("tag-badge-tag-1");
    fireEvent.keyDown(badge, { key: "Enter" });
    expect(handleClick).toHaveBeenCalledWith(baseTag);
  });
});

// === TagManager Tests ===

describe("TagManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render tag manager container", () => {
    render(<TagManager />);
    expect(screen.getByTestId("tag-manager")).toBeInTheDocument();
  });

  it("should render title", () => {
    render(<TagManager />);
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("should render create button", () => {
    render(<TagManager />);
    expect(screen.getByTestId("tag-create-button")).toBeInTheDocument();
  });

  it("should render type filter dropdown", () => {
    render(<TagManager />);
    expect(screen.getByTestId("tag-type-filter")).toBeInTheDocument();
  });

  it("should render tag list with existing tags", () => {
    render(<TagManager />);
    expect(screen.getByTestId("tag-list")).toBeInTheDocument();
    expect(screen.getByText("Character")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
  });

  it("should render tag icon when present", () => {
    render(<TagManager />);
    expect(screen.getByText("📍")).toBeInTheDocument();
  });

  it("should show create form when create button is clicked", () => {
    render(<TagManager />);
    fireEvent.click(screen.getByTestId("tag-create-button"));
    expect(screen.getByTestId("tag-form")).toBeInTheDocument();
    expect(screen.getByTestId("tag-form-name")).toBeInTheDocument();
    expect(screen.getByTestId("tag-form-type")).toBeInTheDocument();
    expect(screen.getByTestId("tag-form-submit")).toBeInTheDocument();
  });

  it("should close create form when cancel is clicked", () => {
    render(<TagManager />);
    fireEvent.click(screen.getByTestId("tag-create-button"));
    expect(screen.getByTestId("tag-form")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tag-form-cancel"));
    expect(screen.queryByTestId("tag-form")).not.toBeInTheDocument();
  });

  it("should call create mutation when form is submitted", () => {
    render(<TagManager />);
    fireEvent.click(screen.getByTestId("tag-create-button"));
    const nameInput = screen.getByTestId("tag-form-name");
    fireEvent.change(nameInput, { target: { value: "New Tag" } });
    fireEvent.click(screen.getByTestId("tag-form-submit"));
    expect(mockCreateMutate).toHaveBeenCalledWith({
      name: "New Tag",
      color: "#6366f1",
      type: "general",
    });
  });

  it("should call create mutation when Enter is pressed in name field", () => {
    render(<TagManager />);
    fireEvent.click(screen.getByTestId("tag-create-button"));
    const nameInput = screen.getByTestId("tag-form-name");
    fireEvent.change(nameInput, { target: { value: "Enter Tag" } });
    fireEvent.keyDown(nameInput, { key: "Enter" });
    expect(mockCreateMutate).toHaveBeenCalledWith({
      name: "Enter Tag",
      color: "#6366f1",
      type: "general",
    });
  });

  it("should not submit when name is empty", () => {
    render(<TagManager />);
    fireEvent.click(screen.getByTestId("tag-create-button"));
    fireEvent.click(screen.getByTestId("tag-form-submit"));
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it("should open edit form when tag badge is clicked", () => {
    render(<TagManager />);
    const characterBadge = screen.getByTestId("tag-badge-tag-1");
    fireEvent.click(characterBadge);
    expect(screen.getByTestId("tag-form")).toBeInTheDocument();
    const nameInput = screen.getByTestId("tag-form-name") as HTMLInputElement;
    expect(nameInput.value).toBe("Character");
  });

  it("should call update mutation when editing and submitting", () => {
    render(<TagManager />);
    // Click tag to edit
    fireEvent.click(screen.getByTestId("tag-badge-tag-1"));
    const nameInput = screen.getByTestId("tag-form-name");
    fireEvent.change(nameInput, { target: { value: "Updated Character" } });
    fireEvent.click(screen.getByTestId("tag-form-submit"));
    expect(mockUpdateMutate).toHaveBeenCalledWith({
      id: "tag-1",
      name: "Updated Character",
      color: "#6366f1",
      type: "character",
    });
  });

  it("should show delete confirmation when delete button is clicked", () => {
    render(<TagManager />);
    const deleteBtn = screen.getByTestId("tag-delete-tag-1");
    fireEvent.click(deleteBtn);
    expect(screen.getByTestId("tag-delete-confirm")).toBeInTheDocument();
  });

  it("should call delete mutation when confirming delete", () => {
    render(<TagManager />);
    fireEvent.click(screen.getByTestId("tag-delete-tag-1"));
    fireEvent.click(screen.getByTestId("tag-delete-confirm-yes"));
    expect(mockDeleteMutate).toHaveBeenCalledWith({ id: "tag-1" });
  });

  it("should close delete confirmation when cancel is clicked", () => {
    render(<TagManager />);
    fireEvent.click(screen.getByTestId("tag-delete-tag-1"));
    expect(screen.getByTestId("tag-delete-confirm")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tag-delete-confirm-no"));
    expect(screen.queryByTestId("tag-delete-confirm")).not.toBeInTheDocument();
  });

  it("should show color picker in create form", () => {
    render(<TagManager />);
    fireEvent.click(screen.getByTestId("tag-create-button"));
    // Check for at least one color button
    expect(screen.getByTestId("tag-color-#6366f1")).toBeInTheDocument();
    expect(screen.getByTestId("tag-color-#10b981")).toBeInTheDocument();
  });

  it("should select a color when color button is clicked", () => {
    render(<TagManager />);
    fireEvent.click(screen.getByTestId("tag-create-button"));
    const greenColor = screen.getByTestId("tag-color-#10b981");
    fireEvent.click(greenColor);
    // Submit with the green color
    const nameInput = screen.getByTestId("tag-form-name");
    fireEvent.change(nameInput, { target: { value: "Green Tag" } });
    fireEvent.click(screen.getByTestId("tag-form-submit"));
    expect(mockCreateMutate).toHaveBeenCalledWith({
      name: "Green Tag",
      color: "#10b981",
      type: "general",
    });
  });

  it("should show toast on successful create", () => {
    render(<TagManager />);
    fireEvent.click(screen.getByTestId("tag-create-button"));
    const nameInput = screen.getByTestId("tag-form-name");
    fireEvent.change(nameInput, { target: { value: "Toast Tag" } });
    fireEvent.click(screen.getByTestId("tag-form-submit"));
    expect(mockAddToast).toHaveBeenCalledWith("createSuccess", "success");
  });
});

// === TagPicker Tests ===

describe("TagPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render tag picker container", () => {
    render(<TagPicker nodeId="node-1" />);
    expect(screen.getByTestId("tag-picker")).toBeInTheDocument();
  });

  it("should render assigned tag badges", () => {
    render(<TagPicker nodeId="node-1" />);
    // nodeTagsQuery returns [mockTagsData[0]] = Character tag
    expect(screen.getByTestId("tag-badge-tag-1")).toBeInTheDocument();
    expect(screen.getByText("Character")).toBeInTheDocument();
  });

  it("should show remove button on assigned tags", () => {
    render(<TagPicker nodeId="node-1" />);
    expect(screen.getByTestId("tag-badge-remove-tag-1")).toBeInTheDocument();
  });

  it("should call removeFromNode when remove is clicked", () => {
    render(<TagPicker nodeId="node-1" />);
    fireEvent.click(screen.getByTestId("tag-badge-remove-tag-1"));
    expect(mockRemoveFromNodeMutate).toHaveBeenCalledWith({
      nodeId: "node-1",
      tagId: "tag-1",
    });
  });

  it("should show add tag button", () => {
    render(<TagPicker nodeId="node-1" />);
    expect(screen.getByTestId("tag-picker-add-button")).toBeInTheDocument();
  });

  it("should open dropdown when add button is clicked", () => {
    render(<TagPicker nodeId="node-1" />);
    fireEvent.click(screen.getByTestId("tag-picker-add-button"));
    expect(screen.getByTestId("tag-picker-dropdown")).toBeInTheDocument();
    expect(screen.getByTestId("tag-picker-search")).toBeInTheDocument();
  });

  it("should show unassigned tags in dropdown", () => {
    render(<TagPicker nodeId="node-1" />);
    fireEvent.click(screen.getByTestId("tag-picker-add-button"));
    // tag-2 (Location) is not assigned, so it should appear
    expect(screen.getByTestId("tag-picker-option-tag-2")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    // tag-1 (Character) is already assigned, so it should NOT appear
    expect(
      screen.queryByTestId("tag-picker-option-tag-1"),
    ).not.toBeInTheDocument();
  });

  it("should call addToNode when dropdown option is clicked", () => {
    render(<TagPicker nodeId="node-1" />);
    fireEvent.click(screen.getByTestId("tag-picker-add-button"));
    fireEvent.click(screen.getByTestId("tag-picker-option-tag-2"));
    expect(mockAddToNodeMutate).toHaveBeenCalledWith({
      nodeId: "node-1",
      tagId: "tag-2",
    });
  });

  it("should filter tags by search", () => {
    render(<TagPicker nodeId="node-1" />);
    fireEvent.click(screen.getByTestId("tag-picker-add-button"));
    const searchInput = screen.getByTestId("tag-picker-search");
    fireEvent.change(searchInput, { target: { value: "zzz" } });
    // No matches
    expect(screen.getByTestId("tag-picker-empty")).toBeInTheDocument();
  });

  it("should show toast on successful add", () => {
    render(<TagPicker nodeId="node-1" />);
    fireEvent.click(screen.getByTestId("tag-picker-add-button"));
    fireEvent.click(screen.getByTestId("tag-picker-option-tag-2"));
    expect(mockAddToast).toHaveBeenCalledWith("tagAdded", "success");
  });

  it("should show toast on successful remove", () => {
    render(<TagPicker nodeId="node-1" />);
    fireEvent.click(screen.getByTestId("tag-badge-remove-tag-1"));
    expect(mockAddToast).toHaveBeenCalledWith("tagRemoved", "success");
  });

  it("should close dropdown when add button is clicked again", () => {
    render(<TagPicker nodeId="node-1" />);
    fireEvent.click(screen.getByTestId("tag-picker-add-button"));
    expect(screen.getByTestId("tag-picker-dropdown")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tag-picker-add-button"));
    expect(screen.queryByTestId("tag-picker-dropdown")).not.toBeInTheDocument();
  });
});
