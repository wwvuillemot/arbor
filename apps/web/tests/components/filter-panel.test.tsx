import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterPanel } from "@/components/navigation/filter-panel";

type TranslationEntry = string | TranslationMap;

interface TranslationMap {
  [key: string]: TranslationEntry;
}

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  trpc: {
    tags: {
      getAll: {
        useQuery: vi.fn(() => ({
          data: [
            { id: "tag-1", name: "Fantasy", color: "#3b82f6", type: "general" },
            {
              id: "tag-2",
              name: "Character",
              color: "#10b981",
              type: "character",
            },
            {
              id: "tag-3",
              name: "Location",
              color: "#f59e0b",
              type: "location",
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
  useTranslations: (namespace?: string) => (key: string) => {
    const translations: TranslationMap = {
      fileTree: {
        filterPanel: {
          search: "Search nodes...",
          tags: "Tags",
          attribution: "Attribution",
          clearAll: "Clear all",
          and: "AND",
          or: "OR",
          selectTags: "Select tags...",
        },
        attributionFilter: {
          all: "Any",
          human: "Human",
          aiGenerated: "AI-generated",
          aiAssisted: "AI-assisted",
        },
      },
    };

    // Support nested namespaces like "fileTree.filterPanel"
    if (namespace) {
      const parts = namespace.split(".");
      let current: TranslationEntry = translations;
      for (const part of parts) {
        if (typeof current === "string") {
          return key;
        }

        current = current[part];
        if (!current) return key;
      }

      if (typeof current === "string") {
        return current;
      }

      const translatedValue = current[key];
      return typeof translatedValue === "string" ? translatedValue : key;
    }
    return key;
  },
}));

describe("FilterPanel", () => {
  const mockOnSearchChange = vi.fn();
  const mockOnTagsChange = vi.fn();
  const mockOnAttributionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render search input", () => {
    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    expect(screen.getByPlaceholderText("Search nodes...")).toBeInTheDocument();
  });

  it("should call onSearchChange with debounced value", async () => {
    vi.useFakeTimers();

    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search nodes...");
    fireEvent.change(searchInput, { target: { value: "dragon" } });

    // Should not call immediately
    expect(mockOnSearchChange).not.toHaveBeenCalled();

    // Fast-forward 300ms (debounce delay)
    await vi.advanceTimersByTimeAsync(300);

    // Check that it was called
    expect(mockOnSearchChange).toHaveBeenCalledWith("dragon");

    vi.useRealTimers();
  });

  it("should render tag selector", () => {
    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    expect(screen.getByTestId("filter-panel-tag-selector")).toBeInTheDocument();
    expect(screen.getByTestId("filter-panel-tag-selector")).toHaveClass(
      "w-full",
    );
  });

  it("should call onTagsChange when tags selected", () => {
    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    // Click to open tag selector
    const tagButton = screen.getByTestId("filter-panel-tag-selector");
    fireEvent.click(tagButton);

    // Select a tag
    const tag1 = screen.getByTestId("tag-option-tag-1");
    fireEvent.click(tag1);

    expect(mockOnTagsChange).toHaveBeenCalledWith(["tag-1"], "OR");
  });

  it("should toggle tag operator AND/OR", () => {
    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    // Select two tags first
    const tagButton = screen.getByTestId("filter-panel-tag-selector");
    fireEvent.click(tagButton);

    const tag1 = screen.getByTestId("tag-option-tag-1");
    fireEvent.click(tag1);

    const tag2 = screen.getByTestId("tag-option-tag-2");
    fireEvent.click(tag2);

    // Toggle operator
    const operatorToggle = screen.getByTestId("filter-panel-operator-toggle");
    fireEvent.click(operatorToggle);

    expect(mockOnTagsChange).toHaveBeenCalledWith(["tag-1", "tag-2"], "AND");
  });

  it("should render selected tags below the selector", () => {
    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    const tagSelectorButton = screen.getByTestId("filter-panel-tag-selector");
    fireEvent.click(tagSelectorButton);
    fireEvent.click(screen.getByTestId("tag-option-tag-1"));

    const selectedTagsContainer = screen.getByTestId(
      "filter-panel-selected-tags",
    );

    expect(selectedTagsContainer).toHaveTextContent("Fantasy");
    expect(
      tagSelectorButton.compareDocumentPosition(selectedTagsContainer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("should render attribution filter buttons", () => {
    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    expect(screen.getByText("Any")).toBeInTheDocument();
    expect(screen.getByText("Human")).toBeInTheDocument();
    expect(screen.getByText("AI-generated")).toBeInTheDocument();
    expect(screen.getByText("AI-assisted")).toBeInTheDocument();
  });

  it("should call onAttributionChange when filter clicked", () => {
    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    const humanButton = screen.getByTestId("attribution-filter-human");
    fireEvent.click(humanButton);

    expect(mockOnAttributionChange).toHaveBeenCalledWith("human");
  });

  it("should highlight selected attribution filter", () => {
    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    const humanButton = screen.getByTestId("attribution-filter-human");
    fireEvent.click(humanButton);

    expect(humanButton).toHaveClass("bg-primary");
  });

  it("should toggle attribution filter off when clicked again", () => {
    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    const humanButton = screen.getByTestId("attribution-filter-human");

    // Click to activate
    fireEvent.click(humanButton);
    expect(mockOnAttributionChange).toHaveBeenCalledWith("human");

    // Click again to deactivate (reset to "all")
    fireEvent.click(humanButton);
    expect(mockOnAttributionChange).toHaveBeenCalledWith("all");
  });

  it("should clear search and tags when clear button clicked", async () => {
    vi.useFakeTimers();

    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    // Set some filters
    const searchInput = screen.getByPlaceholderText("Search nodes...");
    fireEvent.change(searchInput, { target: { value: "test" } });

    // Advance timers to trigger debounced search
    await vi.advanceTimersByTimeAsync(300);

    // Select a tag
    const tagButton = screen.getByTestId("filter-panel-tag-selector");
    fireEvent.click(tagButton);
    const tag1 = screen.getByTestId("tag-option-tag-1");
    fireEvent.click(tag1);

    // Clear the mocks to start fresh
    mockOnSearchChange.mockClear();
    mockOnTagsChange.mockClear();
    mockOnAttributionChange.mockClear();

    // Click clear all
    const clearButton = screen.getByTestId("filter-panel-clear-all");
    fireEvent.click(clearButton);

    // Advance timers to trigger debounced search for empty string
    await vi.advanceTimersByTimeAsync(300);

    expect(mockOnSearchChange).toHaveBeenCalledWith("");
    expect(mockOnTagsChange).toHaveBeenCalledWith([], "OR");
    // Attribution filter should NOT be cleared (it's a toggle now)
    expect(mockOnAttributionChange).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("should show clear button only when search or tags are active", () => {
    const { rerender } = render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    // Initially no clear button (no filters)
    expect(
      screen.queryByTestId("filter-panel-clear-all"),
    ).not.toBeInTheDocument();

    // Add a search filter
    const searchInput = screen.getByPlaceholderText("Search nodes...");
    fireEvent.change(searchInput, { target: { value: "test" } });

    // Now clear button should appear
    rerender(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    expect(screen.getByTestId("filter-panel-clear-all")).toBeInTheDocument();
  });

  it("should NOT show clear button when only attribution filter is active", () => {
    render(
      <FilterPanel
        onSearchChange={mockOnSearchChange}
        onTagsChange={mockOnTagsChange}
        onAttributionChange={mockOnAttributionChange}
      />,
    );

    // Click attribution filter
    const humanButton = screen.getByTestId("attribution-filter-human");
    fireEvent.click(humanButton);

    // Clear button should NOT appear (attribution is a toggle)
    expect(
      screen.queryByTestId("filter-panel-clear-all"),
    ).not.toBeInTheDocument();
  });
});
