/**
 * Phase 3.5: Search UI Component Tests
 *
 * Tests for SearchPanel and SearchResultCard components.
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key.split(".").pop() ?? key,
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

// Mock tRPC - data must be inside factory since vi.mock is hoisted
vi.mock("@/lib/trpc", () => {
  const searchResults = [
    {
      node: {
        id: "node-1",
        name: "Chapter One",
        type: "note",
        content:
          "This is the beginning of an epic tale about heroes and their adventures in a fantastical world full of wonder and mystery.",
        updatedAt: "2024-06-15T10:00:00Z",
      },
      score: 0.92,
      matchType: "hybrid",
    },
    {
      node: {
        id: "node-2",
        name: "World Building Notes",
        type: "folder",
        content: "Geography, cultures, and languages of the realm.",
        updatedAt: "2024-05-10T08:30:00Z",
      },
      score: 0.75,
      matchType: "keyword",
    },
    {
      node: {
        id: "node-3",
        name: "Alpha Project",
        type: "project",
        content: "Main project for the novel series.",
        updatedAt: "2024-07-01T12:00:00Z",
      },
      score: 0.6,
      matchType: "vector",
    },
  ];

  const makeQuery = <T,>(data: T, isLoading = false) => ({
    useQuery: vi.fn(() => ({
      data,
      isLoading,
      error: null,
      refetch: vi.fn(),
    })),
  });

  const mockTrpc = {
    search: {
      hybridSearch: makeQuery(searchResults),
      vectorSearch: makeQuery(searchResults),
      keywordSearch: makeQuery(searchResults),
    },
    nodes: {
      getAllProjects: makeQuery([]),
    },
    tags: {
      getAll: makeQuery([]),
    },
    useUtils: vi.fn(() => ({})),
  };

  return { trpc: mockTrpc, getTRPCClient: vi.fn() };
});

import { SearchPanel } from "@/components/search/search-panel";
import {
  SearchResultCard,
  type SearchResultItem,
} from "@/components/search/search-result-card";

// === SearchResultCard Tests ===

describe("SearchResultCard", () => {
  const baseResult: SearchResultItem = {
    nodeId: "node-1",
    name: "Chapter One",
    nodeType: "note",
    score: 0.92,
    matchType: "hybrid",
    content: "This is the beginning of an epic tale about heroes.",
    updatedAt: "2024-06-15T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render result name", () => {
    render(<SearchResultCard result={baseResult} />);
    expect(screen.getByTestId("result-name")).toHaveTextContent("Chapter One");
  });

  it("should render match type badge", () => {
    render(<SearchResultCard result={baseResult} />);
    expect(screen.getByTestId("result-match-type")).toHaveTextContent("hybrid");
  });

  it("should render content snippet", () => {
    render(<SearchResultCard result={baseResult} />);
    expect(screen.getByTestId("result-snippet")).toHaveTextContent(
      "This is the beginning of an epic tale about heroes.",
    );
  });

  it("should truncate long content to 150 chars with ellipsis", () => {
    const longContent = "A".repeat(200);
    const longResult = { ...baseResult, content: longContent };
    render(<SearchResultCard result={longResult} />);
    const snippet = screen.getByTestId("result-snippet");
    expect(snippet.textContent).toHaveLength(151); // 150 chars + ellipsis
  });

  it("should render score percentage", () => {
    render(<SearchResultCard result={baseResult} />);
    expect(screen.getByTestId("result-score")).toHaveTextContent("92%");
  });

  it("should render node type", () => {
    render(<SearchResultCard result={baseResult} />);
    expect(screen.getByTestId("result-type")).toHaveTextContent("note");
  });

  it("should render formatted date", () => {
    render(<SearchResultCard result={baseResult} />);
    const dateEl = screen.getByTestId("result-date");
    // The date should contain "Jun" and "2024" (locale-dependent)
    expect(dateEl.textContent).toContain("2024");
  });

  it("should call onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<SearchResultCard result={baseResult} onClick={handleClick} />);
    fireEvent.click(screen.getByTestId("search-result-card"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("should not render snippet when content is empty", () => {
    const emptyResult = { ...baseResult, content: "" };
    render(<SearchResultCard result={emptyResult} />);
    expect(screen.queryByTestId("result-snippet")).not.toBeInTheDocument();
  });

  it("should render score bar with correct width", () => {
    render(<SearchResultCard result={baseResult} />);
    const scoreContainer = screen.getByTestId("result-score");
    const bar = scoreContainer.querySelector("[style]");
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute("style")).toContain("width: 92%");
  });

  it("should render different node types correctly", () => {
    const folderResult = { ...baseResult, nodeType: "folder" };
    render(<SearchResultCard result={folderResult} />);
    expect(screen.getByTestId("result-type")).toHaveTextContent("folder");
  });
});

// === SearchPanel Tests ===

describe("SearchPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render search panel with input", () => {
    render(<SearchPanel />);
    expect(screen.getByTestId("search-panel")).toBeInTheDocument();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("should render prompt message when no search query", () => {
    render(<SearchPanel />);
    expect(screen.getByTestId("search-prompt")).toBeInTheDocument();
  });

  it("should render search mode buttons", () => {
    render(<SearchPanel />);
    expect(screen.getByTestId("search-mode-hybrid")).toBeInTheDocument();
    expect(screen.getByTestId("search-mode-vector")).toBeInTheDocument();
    expect(screen.getByTestId("search-mode-keyword")).toBeInTheDocument();
  });

  it("should render sort selector", () => {
    render(<SearchPanel />);
    expect(screen.getByTestId("search-sort")).toBeInTheDocument();
  });

  it("should render filter toggle", () => {
    render(<SearchPanel />);
    expect(screen.getByTestId("search-filter-toggle")).toBeInTheDocument();
  });

  it("should show clear button when query has text", () => {
    render(<SearchPanel />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "test query" } });
    expect(screen.getByTestId("search-clear")).toBeInTheDocument();
  });

  it("should clear query when clear button is clicked", () => {
    render(<SearchPanel />);
    const input = screen.getByTestId("search-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.click(screen.getByTestId("search-clear"));
    expect(input.value).toBe("");
  });

  it("should switch search modes on click", () => {
    render(<SearchPanel />);
    const vectorBtn = screen.getByTestId("search-mode-vector");
    fireEvent.click(vectorBtn);
    // The active mode gets primary styling
    expect(vectorBtn.className).toContain("bg-primary");
  });

  it("should toggle filter panel on click", () => {
    render(<SearchPanel />);
    expect(screen.queryByTestId("search-filters")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("search-filter-toggle"));
    expect(screen.getByTestId("search-filters")).toBeInTheDocument();
  });

  it("should show node type filter buttons when filters open", () => {
    render(<SearchPanel />);
    fireEvent.click(screen.getByTestId("search-filter-toggle"));
    expect(screen.getByTestId("filter-type-note")).toBeInTheDocument();
    expect(screen.getByTestId("filter-type-folder")).toBeInTheDocument();
    expect(screen.getByTestId("filter-type-project")).toBeInTheDocument();
  });

  it("should toggle node type filter on click", () => {
    render(<SearchPanel />);
    fireEvent.click(screen.getByTestId("search-filter-toggle"));
    const noteBtn = screen.getByTestId("filter-type-note");
    fireEvent.click(noteBtn);
    expect(noteBtn.className).toContain("bg-primary");
    // Click again to deselect
    fireEvent.click(noteBtn);
    expect(noteBtn.className).not.toContain("bg-primary");
  });

  it("should call onSelectNode when a result card is clicked", () => {
    const handleSelectNode = vi.fn();
    render(<SearchPanel onSelectNode={handleSelectNode} />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "heroes" } });
    // Advance debounce timer
    act(() => {
      vi.advanceTimersByTime(350);
    });
    // Should now show results
    const cards = screen.getAllByTestId("search-result-card");
    expect(cards.length).toBeGreaterThan(0);
    fireEvent.click(cards[0]);
    expect(handleSelectNode).toHaveBeenCalledWith("node-1");
  });

  it("should show result count when results are present", () => {
    render(<SearchPanel />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "heroes" } });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(screen.getByTestId("search-count")).toBeInTheDocument();
  });

  it("should change sort order when selector changes", () => {
    render(<SearchPanel />);
    const sortSelect = screen.getByTestId("search-sort") as HTMLSelectElement;
    fireEvent.change(sortSelect, { target: { value: "name" } });
    expect(sortSelect.value).toBe("name");
  });

  it("should render results sorted by name when name sort is selected", () => {
    render(<SearchPanel />);
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "test" } });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    const sortSelect = screen.getByTestId("search-sort");
    fireEvent.change(sortSelect, { target: { value: "name" } });
    const names = screen
      .getAllByTestId("result-name")
      .map((el) => el.textContent);
    const sortedNames = [...names].sort();
    expect(names).toEqual(sortedNames);
  });

  it("should hide clear button when query is empty", () => {
    render(<SearchPanel />);
    expect(screen.queryByTestId("search-clear")).not.toBeInTheDocument();
  });
});
