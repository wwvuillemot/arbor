/**
 * Phase 5.4: Attribution UI Component Tests
 *
 * Tests for AttributionBadge, VersionHistory, and DiffViewer components.
 */
import * as React from "react";
import diff_match_patch from "diff-match-patch";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

function createStoredPatchDiff(beforeText: string, afterText: string) {
  const diffEngine = new diff_match_patch();
  const rawDiffs = diffEngine.diff_main(beforeText, afterText) as Array<
    [number, string]
  >;

  diffEngine.diff_cleanupSemantic(rawDiffs);

  const patches = diffEngine.patch_make(beforeText, rawDiffs);
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const [operation, text] of rawDiffs) {
    if (operation === 1) additions += text.length;
    else if (operation === -1) deletions += text.length;
    else unchanged += text.length;
  }

  return {
    type: "diff-match-patch" as const,
    patches: diffEngine.patch_toText(patches),
    summary: { additions, deletions, unchanged },
  };
}

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// Mock toast context
const mockAddToast = vi.fn();
const mockInvalidateHistory = vi.fn();
const mockInvalidateVersionCount = vi.fn();
const mockDeleteVersionMutateAsync = vi.fn().mockResolvedValue({ version: 2 });
vi.mock("@/contexts/toast-context", () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
    toasts: [],
  }),
}));

type MutationOptions = {
  onSuccess?: (...successArgs: unknown[]) => void;
};

async function getMockTrpc() {
  const trpcModule =
    (await import("@/lib/trpc")) as typeof import("@/lib/trpc");
  return trpcModule.trpc;
}

function mockProcedureQueryResult<
  TProcedure extends { useQuery: (...queryArgs: never[]) => unknown },
>(procedure: TProcedure, result: unknown) {
  vi.mocked(procedure.useQuery).mockReturnValue(
    result as ReturnType<TProcedure["useQuery"]>,
  );
}

function buildDefaultVersionHistoryEntries() {
  return [
    {
      id: "entry-1",
      nodeId: "node-1",
      version: 3,
      actorType: "user",
      actorId: "user:alice",
      action: "update",
      contentBefore: "v2 content",
      contentAfter: "v3 content updated",
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
      contentBefore: "v1 content",
      contentAfter: "v2 content",
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
      contentAfter: "v1 content",
      diff: null,
      metadata: null,
      createdAt: "2024-06-15T10:00:00Z",
    },
  ];
}

function buildDefaultCompareResult() {
  const historyEntries = buildDefaultVersionHistoryEntries();

  return {
    versionA: historyEntries[2],
    versionB: historyEntries[0],
    diff: createStoredPatchDiff("v1 content", "v3 content updated"),
  };
}

function buildDefaultAuditLogEntries() {
  return [
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
}

async function resetDefaultVersionHistoryQueryResult() {
  const trpc = await getMockTrpc();
  mockProcedureQueryResult(trpc.provenance.getHistory, {
    data: buildDefaultVersionHistoryEntries(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
}

async function resetDefaultCompareVersionsQueryResult() {
  const trpc = await getMockTrpc();
  mockProcedureQueryResult(trpc.provenance.compareVersions, {
    data: buildDefaultCompareResult(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
}

async function resetDefaultAuditLogQueryResult() {
  const trpc = await getMockTrpc();
  mockProcedureQueryResult(trpc.provenance.getAuditLog, {
    data: buildDefaultAuditLogEntries(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
}

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
      contentBefore: "v2 content",
      contentAfter: "v3 content updated",
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
      contentBefore: "v1 content",
      contentAfter: "v2 content",
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
      contentAfter: "v1 content",
      diff: null,
      metadata: null,
      createdAt: "2024-06-15T10:00:00Z",
    },
  ];

  const compareResult = {
    versionA: historyEntries[2],
    versionB: historyEntries[0],
    diff: createStoredPatchDiff("v1 content", "v3 content updated"),
  };

  const makeQuery = <T,>(data: T, isLoading = false) => ({
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
        useMutation: vi.fn((options?: MutationOptions) => ({
          mutate: vi.fn((..._mutationArgs: unknown[]) => {
            options?.onSuccess?.();
          }),
          mutateAsync: vi.fn().mockResolvedValue({}),
          isPending: false,
          isLoading: false,
          error: null,
        })),
      },
      deleteVersion: {
        useMutation: vi.fn((options?: MutationOptions) => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(
            async (input: { nodeId: string; version: number }) => {
              const result = await mockDeleteVersionMutateAsync(input);
              options?.onSuccess?.(result);
              return result;
            },
          ),
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
        getHistory: { invalidate: mockInvalidateHistory },
        getVersionCount: { invalidate: mockInvalidateVersionCount },
      },
    })),
  };

  return { trpc: mockTrpc, getTRPCClient: vi.fn() };
});

import { AttributionBadge } from "@/components/provenance/attribution-badge";
import { VersionHistory } from "@/components/provenance/version-history";
import { DiffViewer } from "@/components/provenance/diff-viewer";
import { AuditLog } from "@/components/provenance/audit-log";
import { NodeAttribution } from "@/components/provenance/node-attribution";

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
  beforeEach(async () => {
    vi.clearAllMocks();
    mockDeleteVersionMutateAsync.mockResolvedValue({ version: 2 });
    await resetDefaultVersionHistoryQueryResult();
  });

  it("should render version history container", () => {
    render(<VersionHistory nodeId="node-1" />);
    expect(screen.getByTestId("version-history")).toBeInTheDocument();
  });

  it("should use a constrained split layout for the history dialog", () => {
    render(<VersionHistory nodeId="node-1" />);

    expect(screen.getByTestId("version-history").className).toContain(
      "sm:grid-cols-[18rem_minmax(0,1fr)]",
    );
    expect(screen.getByTestId("version-history").className).toContain(
      "lg:grid-cols-[20rem_minmax(0,1fr)]",
    );
    expect(
      screen.getByTestId("version-history-detail-pane").className,
    ).toContain("min-w-0");
    expect(
      screen.getByTestId("version-history-detail-content").className,
    ).toContain("max-w-3xl");
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

  it("should render the latest version preview in the right pane by default", () => {
    render(<VersionHistory nodeId="node-1" />);

    expect(
      screen.getByTestId("version-history-preview-pane"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("version-history-preview-version"),
    ).toHaveTextContent("v3");
    expect(
      screen.getByTestId("version-history-preview-content"),
    ).toHaveTextContent("v3 content updated");
  });

  it("should render full TipTap content in the right-hand detail pane", async () => {
    const trpc = await getMockTrpc();
    const detailPaneTailMarker = "FINAL_TAIL_MARKER";

    mockProcedureQueryResult(trpc.provenance.getHistory, {
      data: [
        {
          id: "entry-long-preview",
          nodeId: "node-1",
          version: 4,
          actorType: "user",
          actorId: "user:alice",
          action: "update",
          contentAfter: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: `${"Long preview body ".repeat(24)}${detailPaneTailMarker}`,
                  },
                ],
              },
            ],
          },
          createdAt: "2024-06-15T13:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<VersionHistory nodeId="node-1" />);

    const previewContent = screen.getByTestId(
      "version-history-preview-content",
    );
    expect(previewContent.textContent).toContain("Long preview body");
    expect(previewContent.textContent).toContain(detailPaneTailMarker);
  });

  it("should display version numbers", () => {
    render(<VersionHistory nodeId="node-1" />);

    expect(screen.getByTestId("version-entry-3")).toHaveTextContent("v3");
    expect(screen.getByTestId("version-entry-2")).toHaveTextContent("v2");
    expect(screen.getByTestId("version-entry-1")).toHaveTextContent("v1");
  });

  it("should display action labels", () => {
    render(<VersionHistory nodeId="node-1" />);

    expect(screen.getByTestId("version-entry-3")).toHaveTextContent(
      "action.update",
    );
    expect(screen.getByTestId("version-entry-2")).toHaveTextContent(
      "action.update",
    );
    expect(screen.getByTestId("version-entry-1")).toHaveTextContent(
      "action.create",
    );
  });

  it("should update the right-hand preview when a version entry is selected", () => {
    render(<VersionHistory nodeId="node-1" />);

    fireEvent.click(screen.getByTestId("version-entry-2"));

    expect(
      screen.getByTestId("version-history-preview-version"),
    ).toHaveTextContent("v2");
    expect(
      screen.getByTestId("version-history-preview-content"),
    ).toHaveTextContent("v2 content");
  });

  it("should render attribution badges in version entries", () => {
    render(<VersionHistory nodeId="node-1" />);
    // Entry 2 has actorType "llm"
    expect(screen.getByTestId("attribution-badge-llm")).toBeInTheDocument();
    // Entry 1 and 3 have actorType "user", plus the preview pane badge.
    const userBadges = screen.getAllByTestId("attribution-badge-user");
    expect(userBadges.length).toBe(3);
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

  it("should request compare for a historical version", () => {
    const mockCompare = vi.fn();
    render(<VersionHistory nodeId="node-1" onCompare={mockCompare} />);

    fireEvent.click(screen.getByTestId("version-compare-2"));

    expect(mockCompare).toHaveBeenCalledWith(2, 3);
  });

  it("should disable compare for the latest version entry", () => {
    render(<VersionHistory nodeId="node-1" />);

    expect(screen.getByTestId("version-compare-3")).toBeDisabled();
    expect(screen.getByTestId("version-compare-2")).not.toBeDisabled();
  });

  it("should delete a version and invalidate provenance queries", async () => {
    render(<VersionHistory nodeId="node-1" />);

    fireEvent.click(screen.getByTestId("version-delete-2"));

    await waitFor(() => {
      expect(mockDeleteVersionMutateAsync).toHaveBeenCalledWith({
        nodeId: "node-1",
        version: 2,
      });
    });

    expect(mockInvalidateHistory).toHaveBeenCalledWith({
      nodeId: "node-1",
      limit: 10,
      offset: 0,
    });
    expect(mockInvalidateVersionCount).toHaveBeenCalledWith({
      nodeId: "node-1",
    });
    expect(mockAddToast).toHaveBeenCalledWith("deleteSuccess", "success");
  });

  it("should render the diff viewer in the detail pane when compare is active", () => {
    render(
      <VersionHistory
        nodeId="node-1"
        compareVersions={{ versionA: 1, versionB: 3 }}
      />,
    );

    expect(screen.getByTestId("diff-viewer")).toBeInTheDocument();
  });

  it("should show loading state", async () => {
    const trpc = await getMockTrpc();
    mockProcedureQueryResult(trpc.provenance.getHistory, {
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<VersionHistory nodeId="node-1" />);
    expect(screen.getByTestId("version-history-loading")).toBeInTheDocument();
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("should show empty state", async () => {
    const trpc = await getMockTrpc();
    mockProcedureQueryResult(trpc.provenance.getHistory, {
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
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetDefaultCompareVersionsQueryResult();
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

  it("should render provided current comparison data", () => {
    render(
      <DiffViewer
        nodeId="node-1"
        versionA={2}
        versionB={3}
        versionBLabel="current"
        compareData={{
          versionA: { version: 2, contentAfter: "draft content" },
          versionB: { version: 3, contentAfter: "current unsaved content" },
          diff: createStoredPatchDiff(
            "draft content",
            "current unsaved content",
          ),
        }}
      />,
    );

    expect(screen.getByTestId("diff-viewer-version-a")).toHaveTextContent("v2");
    expect(screen.getByTestId("diff-viewer-version-b")).toHaveTextContent(
      "current",
    );
    expect(
      screen.getByTestId("diff-viewer-version-a-content"),
    ).toHaveTextContent("draft content");
    expect(
      screen.getByTestId("diff-viewer-version-b-content"),
    ).toHaveTextContent("current unsaved content");
  });

  it("should render diff content area", () => {
    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    expect(screen.getByTestId("diff-viewer-content")).toBeInTheDocument();
  });

  it("should render diff segments with correct test ids", () => {
    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    expect(screen.getByTestId("diff-segment-0")).toBeInTheDocument();
    expect(screen.getByTestId("diff-segment-1")).toBeInTheDocument();
    expect(screen.getByTestId("diff-segment-2")).toBeInTheDocument();
  });

  it("should display diff summary and render stored patch differences", () => {
    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);

    const summary = screen.getByTestId("diff-viewer-summary");
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent("additions");
    expect(summary).toHaveTextContent("deletions");
    expect(summary).toHaveTextContent("unchanged");
    expect(
      screen.getByTestId("diff-viewer-version-a-content"),
    ).toHaveTextContent("v1 content");
    expect(
      screen.getByTestId("diff-viewer-version-b-content"),
    ).toHaveTextContent("v3 content updated");
  });

  it("should show loading state", async () => {
    const trpc = await getMockTrpc();
    mockProcedureQueryResult(trpc.provenance.compareVersions, {
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<DiffViewer nodeId="node-1" versionA={1} versionB={3} />);
    expect(screen.getByTestId("diff-viewer-loading")).toBeInTheDocument();
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("should show empty state when no data", async () => {
    const trpc = await getMockTrpc();
    mockProcedureQueryResult(trpc.provenance.compareVersions, {
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
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetDefaultAuditLogQueryResult();
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
    const trpc = await getMockTrpc();
    mockProcedureQueryResult(trpc.provenance.getAuditLog, {
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<AuditLog />);
    expect(screen.getByTestId("audit-log-loading")).toBeInTheDocument();
    expect(screen.getByText("timeline.loading")).toBeInTheDocument();
  });

  it("should show empty state when no entries", async () => {
    const trpc = await getMockTrpc();
    mockProcedureQueryResult(trpc.provenance.getAuditLog, {
      data: [],
      isLoading: false,
      error: null,
    });

    render(<AuditLog />);
    expect(screen.getByTestId("audit-log-empty")).toBeInTheDocument();
    expect(screen.getByText("timeline.empty")).toBeInTheDocument();
  });

  it("should trigger CSV export on button click", async () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:audit-csv-url");
    const mockRevokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string) => {
        if (tagName === "a") {
          const anchor = originalCreateElement("a");
          anchor.click = mockClick;
          return anchor;
        }

        return originalCreateElement(tagName);
      });

    render(<AuditLog />);
    const csvButton = screen.getByTestId("audit-export-csv");
    fireEvent.click(csvButton);

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:audit-csv-url");
    });

    createElementSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("should trigger HTML/PDF export on button click", async () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:audit-html-url");
    const mockRevokeObjectURL = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const mockPrint = vi.fn();
    const mockFocus = vi.fn();
    const mockAddEventListener = vi.fn(
      (eventName: string, listener: EventListenerOrEventListenerObject) => {
        if (eventName === "load") {
          if (typeof listener === "function") {
            listener(new Event("load"));
          } else {
            listener.handleEvent(new Event("load"));
          }
        }
      },
    );
    const mockRemoveEventListener = vi.fn();
    const originalOpen = window.open;
    const mockOpen = vi.fn().mockReturnValue({
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      focus: mockFocus,
      print: mockPrint,
    });
    Object.defineProperty(window, "open", {
      value: mockOpen,
      writable: true,
      configurable: true,
    });

    render(<AuditLog />);
    const pdfButton = screen.getByTestId("audit-export-pdf");
    fireEvent.click(pdfButton);

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockOpen).toHaveBeenCalledWith("blob:audit-html-url", "_blank");
      expect(mockFocus).toHaveBeenCalled();
      expect(mockPrint).toHaveBeenCalled();
    });

    Object.defineProperty(window, "open", {
      value: originalOpen,
      writable: true,
      configurable: true,
    });
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });
});

// === NodeAttribution Tests ===

describe("NodeAttribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render nothing when no updatedBy is provided", () => {
    const { container } = render(<NodeAttribution />);
    expect(
      container.querySelector("[data-testid='node-attribution']"),
    ).toBeNull();
  });

  it("should render nothing when updatedBy is empty string", () => {
    const { container } = render(<NodeAttribution updatedBy="" />);
    expect(
      container.querySelector("[data-testid='node-attribution']"),
    ).toBeNull();
  });

  it("should render AI-generated label when both createdBy and updatedBy are llm", () => {
    render(
      <NodeAttribution
        createdBy="llm:gpt-4o"
        updatedBy="llm:gpt-4o"
        updatedAt="2024-06-15T12:00:00Z"
      />,
    );
    expect(screen.getByTestId("node-attribution")).toBeInTheDocument();
    expect(screen.getByTestId("node-attribution-level")).toHaveTextContent(
      "aiGenerated",
    );
  });

  it("should render AI-assisted label when createdBy is user but updatedBy is llm", () => {
    render(
      <NodeAttribution
        createdBy="user:alice"
        updatedBy="llm:gpt-4o"
        updatedAt="2024-06-15T12:00:00Z"
      />,
    );
    expect(screen.getByTestId("node-attribution")).toBeInTheDocument();
    expect(screen.getByTestId("node-attribution-level")).toHaveTextContent(
      "aiAssisted",
    );
  });

  it("should render human-edited label when updatedBy is user", () => {
    render(
      <NodeAttribution
        createdBy="user:alice"
        updatedBy="user:alice"
        updatedAt="2024-06-15T12:00:00Z"
      />,
    );
    expect(screen.getByTestId("node-attribution")).toBeInTheDocument();
    expect(screen.getByTestId("node-attribution-level")).toHaveTextContent(
      "humanEdited",
    );
  });

  it("should display timestamp when updatedAt is provided", () => {
    render(
      <NodeAttribution
        createdBy="user:alice"
        updatedBy="llm:gpt-4o"
        updatedAt="2024-06-15T12:00:00Z"
      />,
    );
    const timeEl = screen.getByTestId("node-attribution-time");
    expect(timeEl).toBeInTheDocument();
    expect(timeEl.textContent).toBeTruthy();
  });

  it("should not display timestamp when updatedAt is not provided", () => {
    render(<NodeAttribution createdBy="user:alice" updatedBy="llm:gpt-4o" />);
    expect(
      screen.queryByTestId("node-attribution-time"),
    ).not.toBeInTheDocument();
  });

  it("should include AttributionBadge for the actor type", () => {
    render(<NodeAttribution createdBy="user:alice" updatedBy="llm:gpt-4o" />);
    // AttributionBadge renders with data-testid="attribution-badge-llm"
    expect(screen.getByTestId("attribution-badge-llm")).toBeInTheDocument();
  });

  it("should render with system actor type", () => {
    render(
      <NodeAttribution
        createdBy="system:migration"
        updatedBy="system:auto-save"
      />,
    );
    expect(screen.getByTestId("node-attribution")).toBeInTheDocument();
    expect(screen.getByTestId("node-attribution-level")).toHaveTextContent(
      "humanEdited",
    );
    expect(screen.getByTestId("attribution-badge-system")).toBeInTheDocument();
  });

  it("should render AI-assisted when createdBy is undefined but updatedBy is llm", () => {
    render(<NodeAttribution updatedBy="llm:claude-3" />);
    expect(screen.getByTestId("node-attribution")).toBeInTheDocument();
    // When createdBy is undefined, parseActorType returns null, so it's "ai-assisted"
    expect(screen.getByTestId("node-attribution-level")).toHaveTextContent(
      "aiAssisted",
    );
  });

  it("should apply custom className", () => {
    render(
      <NodeAttribution
        createdBy="user:alice"
        updatedBy="user:alice"
        className="my-custom-class"
      />,
    );
    const el = screen.getByTestId("node-attribution");
    expect(el.className).toContain("my-custom-class");
  });
});
