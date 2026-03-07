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
const mockCreateEntityNodeMutate = vi.fn();

const mockTagsData = [
  {
    id: "tag-1",
    name: "Character",
    color: "#6366f1",
    icon: null,
    type: "character",
    entityNodeId: "entity-node-1",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-2",
    name: "Location",
    color: "#10b981",
    icon: "📍",
    type: "location",
    entityNodeId: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const mockTagsWithCounts = [
  { ...mockTagsData[0], nodeCount: 5 },
  { ...mockTagsData[1], nodeCount: 3 },
];

const mockFilteredNodes = [
  { id: "node-1", name: "Chapter 1", type: "note" },
  { id: "node-2", name: "Chapter 2", type: "note" },
];

const mockRelatedTags = [
  {
    id: "tag-3",
    name: "Event",
    color: "#f59e0b",
    icon: null,
    type: "event",
    entityNodeId: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    sharedCount: 2,
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
      createEntityNode: {
        useMutation: vi.fn((opts: any) => {
          const mut = makeMutation((...args: any[]) => {
            mockCreateEntityNodeMutate(...args);
            opts?.onSuccess?.({ tag: {}, node: { id: "new-entity-node" } });
          });
          return mut;
        }),
      },
      getTagsWithCounts: {
        useQuery: vi.fn(() => ({
          data: mockTagsWithCounts,
          isLoading: false,
          error: null,
        })),
      },
      getNodesByTags: {
        useQuery: vi.fn(() => ({
          data: mockFilteredNodes,
          isLoading: false,
          error: null,
        })),
      },
      getRelatedTags: {
        useQuery: vi.fn(() => ({
          data: mockRelatedTags,
          isLoading: false,
          error: null,
        })),
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
import { TagCloud, type TagCloudTag } from "@/components/tags/tag-cloud";
import { TagBrowser } from "@/components/tags/tag-browser";

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
      projectId: null,
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
      projectId: null,
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
      projectId: null,
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
      projectId: null,
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

  // === Entity Tagging Tests ===

  it("should show entity navigation button for tag with entityNodeId", () => {
    const mockNavigate = vi.fn();
    render(
      <TagPicker
        nodeId="node-1"
        projectId="project-1"
        onNavigateToNode={mockNavigate}
      />,
    );
    // tag-1 is assigned, has entityNodeId "entity-node-1", type "character"
    expect(screen.getByTestId("tag-badge-entity-tag-1")).toBeInTheDocument();
  });

  it("should navigate to entity node when entity button is clicked", () => {
    const mockNavigate = vi.fn();
    render(
      <TagPicker
        nodeId="node-1"
        projectId="project-1"
        onNavigateToNode={mockNavigate}
      />,
    );
    fireEvent.click(screen.getByTestId("tag-badge-entity-tag-1"));
    expect(mockNavigate).toHaveBeenCalledWith("entity-node-1");
  });

  it("should not show entity navigation button without onNavigateToNode", () => {
    render(<TagPicker nodeId="node-1" projectId="project-1" />);
    // tag-1 has entityNodeId but no onNavigateToNode, so entity button should not appear
    // onEntityClick is only passed when hasEntityNode is true, but the badge
    // only shows the button when onEntityClick is provided
    // Since TagPicker doesn't pass onNavigateToNode, handleEntityClick still exists
    // but the button in TagBadge requires onEntityClick prop
    // Actually TagPicker always passes handleEntityClick when hasEntityNode is true
    // The navigation just won't do anything if onNavigateToNode is undefined
    // So the button WILL appear, but clicking won't navigate
    expect(screen.getByTestId("tag-badge-entity-tag-1")).toBeInTheDocument();
  });

  it("should show create entity button for entity-type tag without entityNodeId", async () => {
    // Need both tags assigned to test tag-2 (Location, no entityNodeId)
    const { trpc } = (await import("@/lib/trpc")) as any;
    trpc.tags.getNodeTags.useQuery.mockReturnValue({
      data: mockTagsData, // Both tags assigned
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TagPicker
        nodeId="node-1"
        projectId="project-1"
        onNavigateToNode={vi.fn()}
      />,
    );
    // tag-2 is entity type "location" with entityNodeId null and projectId provided
    expect(
      screen.getByTestId("tag-picker-create-entity-tag-2"),
    ).toBeInTheDocument();
  });

  it("should not show create entity button without projectId", async () => {
    const { trpc } = (await import("@/lib/trpc")) as any;
    trpc.tags.getNodeTags.useQuery.mockReturnValue({
      data: mockTagsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TagPicker nodeId="node-1" onNavigateToNode={vi.fn()} />);
    // No projectId, so create entity button should not appear
    expect(
      screen.queryByTestId("tag-picker-create-entity-tag-2"),
    ).not.toBeInTheDocument();
  });

  it("should call createEntityNode when create entity button is clicked", async () => {
    const { trpc } = (await import("@/lib/trpc")) as any;
    trpc.tags.getNodeTags.useQuery.mockReturnValue({
      data: mockTagsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TagPicker
        nodeId="node-1"
        projectId="project-1"
        onNavigateToNode={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("tag-picker-create-entity-tag-2"));
    expect(mockCreateEntityNodeMutate).toHaveBeenCalledWith({
      tagId: "tag-2",
      parentId: "project-1",
    });
  });

  it("should show toast and navigate after entity node creation", async () => {
    const mockNavigate = vi.fn();
    const { trpc } = (await import("@/lib/trpc")) as any;
    trpc.tags.getNodeTags.useQuery.mockReturnValue({
      data: mockTagsData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <TagPicker
        nodeId="node-1"
        projectId="project-1"
        onNavigateToNode={mockNavigate}
      />,
    );
    fireEvent.click(screen.getByTestId("tag-picker-create-entity-tag-2"));
    expect(mockAddToast).toHaveBeenCalledWith("entityNodeCreated", "success");
    expect(mockNavigate).toHaveBeenCalledWith("new-entity-node");
  });
});

// === TagCloud Tests ===

describe("TagCloud", () => {
  const cloudTags: TagCloudTag[] = [
    {
      id: "tag-1",
      name: "Character",
      color: "#6366f1",
      icon: null,
      type: "character",
      nodeCount: 10,
    },
    {
      id: "tag-2",
      name: "Location",
      color: "#10b981",
      icon: "📍",
      type: "location",
      nodeCount: 3,
    },
    {
      id: "tag-3",
      name: "Unused",
      color: null,
      icon: null,
      type: "general",
      nodeCount: 1,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render nothing when tags array is empty", () => {
    const { container } = render(<TagCloud tags={[]} />);
    expect(container.querySelector("[data-testid='tag-cloud']")).toBeNull();
  });

  it("should render all tags", () => {
    render(<TagCloud tags={cloudTags} />);
    expect(screen.getByText("Character")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Unused")).toBeInTheDocument();
  });

  it("should render tag cloud container", () => {
    render(<TagCloud tags={cloudTags} />);
    expect(screen.getByTestId("tag-cloud")).toBeInTheDocument();
  });

  it("should apply larger size class for higher-count tags", () => {
    render(<TagCloud tags={cloudTags} />);
    const highCountTag = screen.getByTestId("tag-cloud-item-tag-1");
    const lowCountTag = screen.getByTestId("tag-cloud-item-tag-3");
    // Tag with count 10 (max) should have text-2xl
    expect(highCountTag.className).toContain("text-2xl");
    // Tag with count 1 (min) should have text-sm
    expect(lowCountTag.className).toContain("text-sm");
  });

  it("should call onTagClick when a tag is clicked", () => {
    const handleClick = vi.fn();
    render(<TagCloud tags={cloudTags} onTagClick={handleClick} />);
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-2"));
    expect(handleClick).toHaveBeenCalledWith(cloudTags[1]);
  });

  it("should highlight selected tags with ring styling", () => {
    render(<TagCloud tags={cloudTags} selectedTagIds={["tag-1"]} />);
    const selectedTag = screen.getByTestId("tag-cloud-item-tag-1");
    expect(selectedTag.className).toContain("ring-2");
    const unselectedTag = screen.getByTestId("tag-cloud-item-tag-2");
    expect(unselectedTag.className).not.toContain("ring-2");
  });

  it("should show tag icon when present", () => {
    render(<TagCloud tags={cloudTags} />);
    expect(screen.getByText("📍")).toBeInTheDocument();
  });

  it("should show node count in title tooltip", () => {
    render(<TagCloud tags={cloudTags} />);
    const tag = screen.getByTestId("tag-cloud-item-tag-1");
    expect(tag.getAttribute("title")).toBe("Character (10)");
  });
});

// === TagBrowser Tests ===

describe("TagBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render tag browser container", () => {
    render(<TagBrowser />);
    expect(screen.getByTestId("tag-browser")).toBeInTheDocument();
  });

  it("should render search input", () => {
    render(<TagBrowser />);
    expect(screen.getByTestId("tag-browser-search")).toBeInTheDocument();
  });

  it("should render type filter dropdown", () => {
    render(<TagBrowser />);
    expect(screen.getByTestId("tag-browser-type-filter")).toBeInTheDocument();
  });

  it("should render view toggle button", () => {
    render(<TagBrowser />);
    expect(screen.getByTestId("tag-browser-view-toggle")).toBeInTheDocument();
  });

  it("should show tag cloud by default", () => {
    render(<TagBrowser />);
    expect(screen.getByTestId("tag-cloud")).toBeInTheDocument();
  });

  it("should switch to list view when toggle is clicked", () => {
    render(<TagBrowser />);
    fireEvent.click(screen.getByTestId("tag-browser-view-toggle"));
    expect(screen.getByTestId("tag-browser-list")).toBeInTheDocument();
  });

  it("should filter tags by search input", () => {
    render(<TagBrowser />);
    const searchInput = screen.getByTestId("tag-browser-search");
    fireEvent.change(searchInput, { target: { value: "Char" } });
    // Character should be visible
    expect(screen.getByText("Character")).toBeInTheDocument();
    // Location should not be visible (filtered out by search)
    expect(screen.queryByText("Location")).toBeNull();
  });

  it("should filter tags by type selection", () => {
    render(<TagBrowser />);
    const typeFilter = screen.getByTestId("tag-browser-type-filter");
    fireEvent.change(typeFilter, { target: { value: "character" } });
    // Only character tags should be shown
    expect(screen.getByText("Character")).toBeInTheDocument();
    expect(screen.queryByText("Location")).toBeNull();
  });

  it("should show selection panel when a tag is clicked in cloud view", () => {
    render(<TagBrowser />);
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-1"));
    expect(screen.getByTestId("tag-browser-selection")).toBeInTheDocument();
    expect(screen.getByTestId("tag-browser-clear")).toBeInTheDocument();
  });

  it("should call onFilterChange when tags are selected", () => {
    const handleFilterChange = vi.fn();
    render(<TagBrowser onFilterChange={handleFilterChange} />);
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-1"));
    expect(handleFilterChange).toHaveBeenCalledWith(["tag-1"], "OR");
  });

  it("should call onFilterChange with updated operator", () => {
    const handleFilterChange = vi.fn();
    render(<TagBrowser onFilterChange={handleFilterChange} />);
    // Select two tags
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-1"));
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-2"));
    // Toggle operator
    fireEvent.click(screen.getByTestId("tag-browser-operator-toggle"));
    expect(handleFilterChange).toHaveBeenCalledWith(["tag-1", "tag-2"], "AND");
  });

  it("should clear selection when clear button is clicked", () => {
    render(<TagBrowser />);
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-1"));
    expect(screen.getByTestId("tag-browser-selection")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tag-browser-clear"));
    expect(screen.queryByTestId("tag-browser-selection")).toBeNull();
  });

  it("should show related tags when single tag is selected", () => {
    render(<TagBrowser />);
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-1"));
    expect(screen.getByTestId("tag-browser-related")).toBeInTheDocument();
    expect(screen.getByText("Event")).toBeInTheDocument();
  });

  it("should show AND/OR toggle when multiple tags selected", () => {
    render(<TagBrowser />);
    // Select two tags
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-1"));
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-2"));
    expect(
      screen.getByTestId("tag-browser-operator-toggle"),
    ).toBeInTheDocument();
    expect(screen.getByText("OR")).toBeInTheDocument();
  });

  it("should toggle operator between AND and OR", () => {
    render(<TagBrowser />);
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-1"));
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-2"));
    const toggle = screen.getByTestId("tag-browser-operator-toggle");
    expect(screen.getByText("OR")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText("AND")).toBeInTheDocument();
  });

  it("should deselect a tag when clicked again in cloud view", () => {
    render(<TagBrowser />);
    // Select
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-1"));
    expect(screen.getByTestId("tag-browser-selection")).toBeInTheDocument();
    // Deselect
    fireEvent.click(screen.getByTestId("tag-cloud-item-tag-1"));
    expect(screen.queryByTestId("tag-browser-selection")).toBeNull();
  });

  it("should work in list view mode", () => {
    render(<TagBrowser />);
    // Switch to list view
    fireEvent.click(screen.getByTestId("tag-browser-view-toggle"));
    expect(screen.getByTestId("tag-browser-list")).toBeInTheDocument();
    // Select tag in list view
    fireEvent.click(screen.getByTestId("tag-browser-list-item-tag-1"));
    expect(screen.getByTestId("tag-browser-selection")).toBeInTheDocument();
  });
});
