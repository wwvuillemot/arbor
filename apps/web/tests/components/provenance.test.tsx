/**
 * Phase 5.4: Attribution UI Component Tests
 *
 * Tests for AttributionBadge, VersionHistory, and DiffViewer components.
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

// Mock tRPC - data must be inside factory since vi.mock is hoisted
vi.mock("@/lib/trpc", () => {
  const historyEntries = [
    {
      id: "entry-1",
      nodeId: "node-1",
      version: 3,
      actorType: "user",
      actorId: "user:alice",
      action: "update",
      contentBefore: { text: "v2 content" },
      contentAfter: { text: "v3 content" },
      diff: null,
      metadata: null,
      createdAt: "2024-06-15T12:00:00Z",
    },
    {
      id: "entry-2",
      nodeId: "node-1",
      version: 2,
      actorType: "llm",
      actorId: "llm:gpt-4o",
      action: "update",
      contentBefore: { text: "v1 content" },
      contentAfter: { text: "v2 content" },
      diff: null,
      metadata: { model: "gpt-4o" },
      createdAt: "2024-06-15T11:00:00Z",
    },
    {
      id: "entry-3",
      nodeId: "node-1",
      version: 1,
      actorType: "user",
      actorId: "user:alice",
      action: "create",
      contentBefore: null,
      contentAfter: { text: "v1 content" },
      diff: null,
      metadata: null,
      createdAt: "2024-06-15T10:00:00Z",
    },
  ];

  const compareResult = {
    versionA: historyEntries[2],
    versionB: historyEntries[0],
    diff: [
      [-1, "v1"],
      [0, " content"],
      [1, " updated"],
    ],
  };

  const makeQuery = (data: any, isLoading = false) => ({
    useQuery: vi.fn(() => ({
      data,
      isLoading,
      error: null,
      refetch: vi.fn(),
    })),
  });

  // Audit log entries (cross-node)
  const auditLogEntries = [
    {
      id: "audit-1",
      nodeId: "node-1",
      version: 3,
      actorType: "user",
      actorId: "user:alice",
      action: "update",
      contentBefore: { text: "old" },
      contentAfter: { text: "new" },
      diff: null,
      metadata: null,
      createdAt: "2024-06-15T14:00:00Z",
    },
    {
      id: "audit-2",
      nodeId: "node-2",
      version: 1,
      actorType: "llm",
      actorId: "llm:gpt-4o",
      action: "create",
      contentBefore: null,
      contentAfter: { text: "generated" },
      diff: null,
      metadata: null,
      createdAt: "2024-06-15T13:00:00Z",
    },
    {
      id: "audit-3",
      nodeId: "node-1",
      version: 2,
      actorType: "system",
      actorId: "system:auto",
      action: "move",
      contentBefore: null,
      contentAfter: null,
      diff: null,
      metadata: { oldParentId: "p1", newParentId: "p2" },
      createdAt: "2024-06-15T12:30:00Z",
    },
  ];

  const mockTrpc = {
    provenance: {
      getHistory: makeQuery(historyEntries),
      getVersionCount: makeQuery(3),
      getVersion: makeQuery(historyEntries[0]),
      getLatestVersion: makeQuery(historyEntries[0]),
      compareVersions: makeQuery(compareResult),
      checkout: makeQuery({ version: 1, content: { text: "v1 content" } }),
      rollback: {
        useMutation: vi.fn(({ onSuccess }: any) => ({
          mutate: vi.fn((...args: any[]) => {
            if (onSuccess) onSuccess();
          }),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
          isLoading: false,
          error: null,
        })),
      },
      getAuditLog: makeQuery(auditLogEntries),
      getAuditLogCount: makeQuery(3),
      searchHistory: makeQuery(auditLogEntries.slice(0, 1)),
      exportAuditReport: {
        useQuery: vi.fn(() => ({
          data: "csv-data",
          isLoading: false,
          error: null,
          refetch: vi.fn().mockResolvedValue({ data: "id,nodeId\n1,node-1" }),
        })),
      },
    },
    useUtils: vi.fn(() => ({
      provenance: {
        getHistory: { invalidate: vi.fn() },
        getVersionCount: { invalidate: vi.fn() },
      },
    })),
  };

  return { trpc: mockTrpc, getTRPCClient: vi.fn() };
});

import {
  AttributionBadge,
  type ActorType,
} from "@/components/provenance/attribution-badge";
import { VersionHistory } from "@/components/provenance/version-history";
import { DiffViewer } from "@/components/provenance/diff-viewer";
import { AuditLog } from "@/components/provenance/audit-log";

// === AttributionBadge Tests ===

describe("AttributionBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render badge for user actor type", () => {
    render(<AttributionBadge actorType="user" />);
    expect(screen.getByTestId("attribution-badge-user")).toBeInTheDocument();
    expect(screen.getByTestId("attribution-badge-label")).toHaveTextContent(
      "humanCreated",
    );
    expect(screen.getByTestId("attribution-badge-icon")).toHaveTextContent(
      "👤",
    );
  });

  it("should render badge for llm actor type", () => {
    render(<AttributionBadge actorType="llm" />);
    expect(screen.getByTestId("attribution-badge-llm")).toBeInTheDocument();
    expect(screen.getByTestId("attribution-badge-label")).toHaveTextContent(
      "aiGenerated",
    );
    expect(screen.getByTestId("attribution-badge-icon")).toHaveTextContent(
      "🤖",
    );
  });

  it("should render badge for system actor type", () => {
    render(<AttributionBadge actorType="system" />);
    expect(screen.getByTestId("attribution-badge-system")).toBeInTheDocument();
    expect(screen.getByTestId("attribution-badge-label")).toHaveTextContent(
      "system",
    );
  });

  it("should show tooltip on hover when actorId is provided", () => {
    render(<AttributionBadge actorType="llm" actorId="llm:gpt-4o" />);
    const badge = screen.getByTestId("attribution-badge-llm");

    // Tooltip not visible by default
    expect(
      screen.queryByTestId("attribution-badge-tooltip"),
    ).not.toBeInTheDocument();

    // Hover to show tooltip
    fireEvent.mouseEnter(badge);
    expect(screen.getByTestId("attribution-badge-tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("attribution-badge-tooltip")).toHaveTextContent(
      "gpt-4o",
    );

    // Leave to hide tooltip
    fireEvent.mouseLeave(badge);
    expect(
      screen.queryByTestId("attribution-badge-tooltip"),
    ).not.toBeInTheDocument();
  });

  it("should not show tooltip when no actorId", () => {
    render(<AttributionBadge actorType="user" />);
    const badge = screen.getByTestId("attribution-badge-user");
    fireEvent.mouseEnter(badge);
    expect(
      screen.queryByTestId("attribution-badge-tooltip"),
    ).not.toBeInTheDocument();
  });

  it("should render different sizes", () => {
    const { rerender } = render(
      <AttributionBadge actorType="user" size="sm" />,
    );
    expect(screen.getByTestId("attribution-badge-user")).toBeInTheDocument();

    rerender(<AttributionBadge actorType="user" size="md" />);
    expect(screen.getByTestId("attribution-badge-user")).toBeInTheDocument();

    rerender(<AttributionBadge actorType="user" size="lg" />);
    expect(screen.getByTestId("attribution-badge-user")).toBeInTheDocument();
  });

  it("should extract display name from actorId with colon", () => {
    render(<AttributionBadge actorType="llm" actorId="llm:claude-3" />);
    const badge = screen.getByTestId("attribution-badge-llm");
    fireEvent.mouseEnter(badge);
    expect(screen.getByTestId("attribution-badge-tooltip")).toHaveTextContent(
      "claude-3",
    );
  });

  it("should have correct aria-label", () => {
    render(<AttributionBadge actorType="llm" actorId="llm:gpt-4o" />);
    const badge = screen.getByTestId("attribution-badge-llm");
    expect(badge).toHaveAttribute("aria-label", "aiGenerated - gpt-4o");
  });
});

// === VersionHistory Tests ===

describe("VersionHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render version history container", () => {
    render(<VersionHistory nodeId="node-1" />);
    expect(screen.getByTestId("version-history")).toBeInTheDocument();
  });

  it("should render title", () => {
    render(<VersionHistory nodeId="node-1" />);
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("should render version entries", () => {
    render(<VersionHistory nodeId="node-1" />);
    expect(screen.getByTestId("version-history-list")).toBeInTheDocument();
    expect(screen.getByTestId("version-entry-3")).toBeInTheDocument();
    expect(screen.getByTestId("version-entry-2")).toBeInTheDocument();
    expect(screen.getByTestId("version-entry-1")).toBeInTheDocument();
  });

  it("should display version numbers", () => {
    render(<VersionHistory nodeId="node-1" />);
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });

  it("should display action labels", () => {
    render(<VersionHistory nodeId="node-1" />);
    // action.update and action.create are the mock i18n keys
    const updateLabels = screen.getAllByText("action.update");
    expect(updateLabels.length).toBe(2);
    expect(screen.getByText("action.create")).toBeInTheDocument();
  });

  it("should render attribution badges in version entries", () => {
    render(<VersionHistory nodeId="node-1" />);
    // Entry 2 has actorType "llm"
    expect(screen.getByTestId("attribution-badge-llm")).toBeInTheDocument();
    // Entry 1 and 3 have actorType "user"
    const userBadges = screen.getAllByTestId("attribution-badge-user");
    expect(userBadges.length).toBe(2);
  });

  it("should render checkout buttons when onCheckout is provided", () => {
    const mockCheckout = vi.fn();
    render(<VersionHistory nodeId="node-1" onCheckout={mockCheckout} />);
    expect(screen.getByTestId("version-checkout-3")).toBeInTheDocument();
    expect(screen.getByTestId("version-checkout-2")).toBeInTheDocument();
    expect(screen.getByTestId("version-checkout-1")).toBeInTheDocument();
  });

  it("should not render checkout buttons when onCheckout is not provided", () => {
    render(<VersionHistory nodeId="node-1" />);
    expect(screen.queryByTestId("version-checkout-3")).not.toBeInTheDocument();
  });

  it("should call onCheckout when checkout button is clicked", () => {
    const mockCheckout = vi.fn();
    render(<VersionHistory nodeId="node-1" onCheckout={mockCheckout} />);
    fireEvent.click(screen.getByTestId("version-checkout-2"));
    expect(mockCheckout).toHaveBeenCalledWith(2);
  });

  it("should render compare buttons", () => {
    render(<VersionHistory nodeId="node-1" />);
    expect(screen.getByTestId("version-compare-3")).toBeInTheDocument();
    expect(screen.getByTestId("version-compare-2")).toBeInTheDocument();
    expect(screen.getByTestId("version-compare-1")).toBeInTheDocument();
  });

  it("should handle compare selection flow", () => {
    const mockCompare = vi.fn();
    render(<VersionHistory nodeId="node-1" onCompare={mockCompare} />);

    // First click selects version for comparison
    fireEvent.click(screen.getByTestId("version-compare-3"));

    // Second click triggers compare callback
    fireEvent.click(screen.getByTestId("version-compare-1"));
    expect(mockCompare).toHaveBeenCalledWith(1, 3);
  });

  it("should show loading state", async () => {
    const { trpc } = (await import("@/lib/trpc")) as any;
    trpc.provenance.getHistory.useQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<VersionHistory nodeId="node-1" />);
    expect(screen.getByTestId("version-history-loading")).toBeInTheDocument();
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("should show empty state", async () => {
    const { trpc } = (await import("@/lib/trpc")) as any;
    trpc.provenance.getHistory.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<VersionHistory nodeId="node-1" />);
    expect(screen.getByTestId("version-history-empty")).toBeInTheDocument();
    expect(screen.getByText("noHistory")).toBeInTheDocument();
  });
});

// === DiffViewer Tests ===

describe("DiffViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render diff viewer container", () => {
    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
  });

  it("should render title", () => {
    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    expect(screen.getByText("title")).toBeInTheDocument();
  });

  it("should display version labels", () => {
    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    expect(screen.getByTestId("diff-viewer-version-a")).toHaveTextContent("v1");
    expect(screen.getByTestId("diff-viewer-version-b")).toHaveTextContent("v3");
  });

  it("should render diff content area", () => {
    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    expect(screen.getByTestId("diff-viewer-content")).toBeInTheDocument();
  });

  it("should render diff segments with correct test ids", () => {
    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    // Mock diff has 3 segments: deletion, equal, insertion
    expect(screen.getByTestId("diff-segment-0")).toBeInTheDocument();
    expect(screen.getByTestId("diff-segment-1")).toBeInTheDocument();
    expect(screen.getByTestId("diff-segment-2")).toBeInTheDocument();
  });

  it("should display diff summary with character counts", () => {
    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    const summary = screen.getByTestId("diff-viewer-summary");
    expect(summary).toBeInTheDocument();
    // additions text from mock diff: " updated" = 8 chars
    expect(summary).toHaveTextContent("additions");
    // deletions text from mock diff: "v1" = 2 chars
    expect(summary).toHaveTextContent("deletions");
    // unchanged text from mock diff: " content" = 8 chars
    expect(summary).toHaveTextContent("unchanged");
  });

  it("should show loading state", async () => {
    const { trpc } = (await import("@/lib/trpc")) as any;
    trpc.provenance.compareVersions.useQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    expect(screen.getByTestId("diff-viewer-loading")).toBeInTheDocument();
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("should show empty state when no data", async () => {
    const { trpc } = (await import("@/lib/trpc")) as any;
    trpc.provenance.compareVersions.useQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    expect(screen.getByTestId("diff-viewer-empty")).toBeInTheDocument();
    expect(screen.getByText("noDiff")).toBeInTheDocument();
  });
});

// === AuditLog Tests ===

describe("AuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock browser APIs not available in jsdom
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("should render the audit log container with title", () => {
    render(<AuditLog />);
    expect(screen.getByTestId("audit-log")).toBeInTheDocument();
    expect(screen.getByTestId("audit-log-title")).toHaveTextContent("title");
  });

  it("should render filter controls", () => {
    render(<AuditLog />);
    expect(screen.getByTestId("audit-log-filters")).toBeInTheDocument();
    expect(screen.getByTestId("audit-filter-actor")).toBeInTheDocument();
    expect(screen.getByTestId("audit-filter-action")).toBeInTheDocument();
    expect(screen.getByTestId("audit-clear-filters")).toBeInTheDocument();
  });

  it("should render search input and button", () => {
    render(<AuditLog />);
    expect(screen.getByTestId("audit-log-search")).toBeInTheDocument();
    expect(screen.getByTestId("audit-search-input")).toBeInTheDocument();
    expect(screen.getByTestId("audit-search-button")).toBeInTheDocument();
  });

  it("should render export buttons", () => {
    render(<AuditLog />);
    expect(screen.getByTestId("audit-log-export")).toBeInTheDocument();
    expect(screen.getByTestId("audit-export-csv")).toBeInTheDocument();
    expect(screen.getByTestId("audit-export-pdf")).toBeInTheDocument();
  });

  it("should render timeline entries from audit log data", () => {
    render(<AuditLog />);
    expect(screen.getByTestId("audit-log-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("audit-entry-audit-1")).toBeInTheDocument();
    expect(screen.getByTestId("audit-entry-audit-2")).toBeInTheDocument();
    expect(screen.getByTestId("audit-entry-audit-3")).toBeInTheDocument();
  });

  it("should display version numbers for each entry", () => {
    render(<AuditLog />);
    const entry1 = screen.getByTestId("audit-entry-audit-1");
    expect(entry1).toHaveTextContent("v3");
    const entry2 = screen.getByTestId("audit-entry-audit-2");
    expect(entry2).toHaveTextContent("v1");
  });

  it("should allow changing actor type filter", () => {
    render(<AuditLog />);
    const actorFilter = screen.getByTestId(
      "audit-filter-actor",
    ) as HTMLSelectElement;
    fireEvent.change(actorFilter, { target: { value: "llm" } });
    expect(actorFilter.value).toBe("llm");
  });

  it("should allow changing action filter", () => {
    render(<AuditLog />);
    const actionFilterEl = screen.getByTestId(
      "audit-filter-action",
    ) as HTMLSelectElement;
    fireEvent.change(actionFilterEl, { target: { value: "create" } });
    expect(actionFilterEl.value).toBe("create");
  });

  it("should clear filters when clear button is clicked", () => {
    render(<AuditLog />);
    const actorFilter = screen.getByTestId(
      "audit-filter-actor",
    ) as HTMLSelectElement;
    fireEvent.change(actorFilter, { target: { value: "user" } });
    expect(actorFilter.value).toBe("user");

    fireEvent.click(screen.getByTestId("audit-clear-filters"));
    expect(actorFilter.value).toBe("");
  });

  it("should trigger search when search button is clicked", () => {
    render(<AuditLog />);
    const searchInput = screen.getByTestId("audit-search-input");
    fireEvent.change(searchInput, { target: { value: "test query" } });
    fireEvent.click(screen.getByTestId("audit-search-button"));
    // After search, the search query should be used
    // (search mock returns 1 entry)
    expect(searchInput).toHaveValue("test query");
  });

  it("should show loading state", async () => {
    const { trpc } = (await import("@/lib/trpc")) as any;
    trpc.provenance.getAuditLog.useQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<AuditLog />);
    expect(screen.getByTestId("audit-log-loading")).toBeInTheDocument();
    expect(screen.getByText("timeline.loading")).toBeInTheDocument();
  });

  it("should show empty state when no entries", async () => {
    const { trpc } = (await import("@/lib/trpc")) as any;
    trpc.provenance.getAuditLog.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    render(<AuditLog />);
    expect(screen.getByTestId("audit-log-empty")).toBeInTheDocument();
    expect(screen.getByText("timeline.empty")).toBeInTheDocument();
  });

  it("should trigger CSV export on button click", () => {
    render(<AuditLog />);
    const csvButton = screen.getByTestId("audit-export-csv");
    fireEvent.click(csvButton);
    // CSV export refetch should be called
    expect(csvButton).toBeInTheDocument();
  });

  it("should trigger HTML/PDF export on button click", () => {
    render(<AuditLog />);
    const pdfButton = screen.getByTestId("audit-export-pdf");
    fireEvent.click(pdfButton);
    expect(pdfButton).toBeInTheDocument();
  });
});
