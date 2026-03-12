"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { tiptapToMarkdown } from "@/lib/tiptap-utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import { AttributionBadge, type ActorType } from "./attribution-badge";
import { buildCurrentComparisonData, DiffViewer } from "./diff-viewer";

const PAGE_SIZE = 10;

interface HistoryEntry {
  id: string;
  nodeId: string;
  version: number;
  actorType: string;
  actorId: string | null;
  action: string;
  contentAfter?: unknown;
  createdAt: string;
}

interface CompareVersions {
  versionA: number;
  versionB: number;
}

function getHistoryEntryContent(contentAfter: unknown): string {
  if (typeof contentAfter === "string") {
    return contentAfter.trim() || "—";
  }

  if (contentAfter && typeof contentAfter === "object") {
    const markdownContent = tiptapToMarkdown(
      contentAfter,
      Number.MAX_SAFE_INTEGER,
    ).trim();
    if (markdownContent) {
      return markdownContent;
    }

    try {
      return JSON.stringify(contentAfter, null, 2) || "—";
    } catch {
      return "—";
    }
  }

  return "—";
}

export interface VersionHistoryProps {
  nodeId: string;
  onCheckout?: (version: number) => void;
  onCompare?: (versionA: number, versionB: number) => void;
  onRestoreSuccess?: (
    restoredContent: unknown,
    restoredVersion: number,
  ) => void;
  compareVersions?: CompareVersions | null;
  onClearCompare?: () => void;
  currentContent?: unknown;
  currentVersionLabel?: string;
  className?: string;
}

function formatRelativeTime(timestamp: string): string {
  const eventTime = new Date(timestamp).getTime();
  const timeDifferenceMs = eventTime - Date.now();
  const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  });

  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (Math.abs(timeDifferenceMs) < minuteMs) {
    return relativeTimeFormatter.format(
      Math.round(timeDifferenceMs / 1_000),
      "second",
    );
  }

  if (Math.abs(timeDifferenceMs) < hourMs) {
    return relativeTimeFormatter.format(
      Math.round(timeDifferenceMs / minuteMs),
      "minute",
    );
  }

  if (Math.abs(timeDifferenceMs) < dayMs) {
    return relativeTimeFormatter.format(
      Math.round(timeDifferenceMs / hourMs),
      "hour",
    );
  }

  if (Math.abs(timeDifferenceMs) < weekMs) {
    return relativeTimeFormatter.format(
      Math.round(timeDifferenceMs / dayMs),
      "day",
    );
  }

  if (Math.abs(timeDifferenceMs) < yearMs) {
    return relativeTimeFormatter.format(
      Math.round(timeDifferenceMs / monthMs),
      "month",
    );
  }

  return relativeTimeFormatter.format(
    Math.round(timeDifferenceMs / yearMs),
    "year",
  );
}

/**
 * VersionHistory - Displays a timeline of changes for a node
 *
 * Shows version history with actor badges, action types, timestamps,
 * and actions for checkout, rollback, and compare.
 */
export function VersionHistory({
  nodeId,
  onCheckout,
  onCompare,
  onRestoreSuccess,
  compareVersions,
  onClearCompare,
  currentContent,
  currentVersionLabel,
  className,
}: VersionHistoryProps) {
  const t = useTranslations("provenance.versionHistory");
  const { addToast } = useToast();
  const [page, setPage] = React.useState(0);
  const [selectedVersion, setSelectedVersion] = React.useState<number | null>(
    null,
  );

  const utils = trpc.useUtils();
  const historyQueryInput = React.useMemo(
    () => ({
      nodeId,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [nodeId, page],
  );

  const historyQuery = trpc.provenance.getHistory.useQuery(historyQueryInput);

  const versionCountQuery = trpc.provenance.getVersionCount.useQuery({
    nodeId,
  });

  const rollbackMutation = trpc.provenance.rollback.useMutation({
    onSuccess: (result) => {
      utils.provenance.getHistory.invalidate(historyQueryInput);
      utils.provenance.getVersionCount.invalidate({ nodeId });
      onRestoreSuccess?.(result.contentAfter, result.version);
      addToast(t("rollbackSuccess"), "success");
    },
    onError: () => {
      addToast(t("rollbackError"), "error");
    },
  });

  const deleteVersionMutation = trpc.provenance.deleteVersion.useMutation({
    onSuccess: (result) => {
      utils.provenance.getHistory.invalidate(historyQueryInput);
      utils.provenance.getVersionCount.invalidate({ nodeId });
      onClearCompare?.();
      setSelectedVersion((currentVersion) =>
        currentVersion === result.version ? null : currentVersion,
      );
      if (history.length === 1 && page > 0) {
        setPage((currentPage) => Math.max(0, currentPage - 1));
      }
      addToast(t("deleteSuccess"), "success");
    },
    onError: () => {
      addToast(t("deleteError"), "error");
    },
  });

  const totalPages = Math.ceil((versionCountQuery.data ?? 0) / PAGE_SIZE);

  const history = historyQuery.data ?? [];
  const latestVersion = (history as HistoryEntry[])[0]?.version ?? null;
  const areVersionActionsPending =
    rollbackMutation.isPending || deleteVersionMutation.isPending;

  React.useEffect(() => {
    if (history.length === 0) {
      return;
    }

    const selectedEntryStillVisible = history.some(
      (entry) => entry.version === selectedVersion,
    );

    if (!selectedEntryStillVisible) {
      setSelectedVersion(history[0]?.version ?? null);
    }
  }, [history, selectedVersion]);

  if (historyQuery.isLoading) {
    return (
      <div
        className={cn("p-4", className)}
        data-testid="version-history-loading"
      >
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={cn("p-4", className)} data-testid="version-history-empty">
        <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
      </div>
    );
  }

  const selectedEntry =
    (history as HistoryEntry[]).find(
      (entry) => entry.version === selectedVersion,
    ) ??
    (history as HistoryEntry[])[0] ??
    null;

  function handleSelectEntry(version: number) {
    setSelectedVersion(version);
    onClearCompare?.();
  }

  function handleCompareClick(version: number) {
    if (latestVersion !== null && version !== latestVersion) {
      setSelectedVersion(version);
      onCompare?.(version, latestVersion);
    }
  }

  const activeCompareVersion = compareVersions?.versionA ?? null;
  const comparedHistoryEntry =
    activeCompareVersion === null
      ? null
      : ((history as HistoryEntry[]).find(
          (entry) => entry.version === activeCompareVersion,
        ) ?? null);
  const currentComparisonData =
    compareVersions && comparedHistoryEntry && currentContent !== undefined
      ? buildCurrentComparisonData(
          comparedHistoryEntry.version,
          comparedHistoryEntry.contentAfter,
          compareVersions.versionB,
          currentContent,
        )
      : null;

  async function handleRestoreClick(version: number) {
    try {
      await rollbackMutation.mutateAsync({ nodeId, targetVersion: version });
    } catch {
      // Handled by mutation onError.
    }
  }

  async function handleDeleteClick(version: number) {
    try {
      await deleteVersionMutation.mutateAsync({ nodeId, version });
    } catch {
      // Handled by mutation onError.
    }
  }

  return (
    <div
      className={cn(
        "grid h-full min-h-0 min-w-0 grid-cols-1 overflow-hidden rounded-md border sm:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[20rem_minmax(0,1fr)]",
        className,
      )}
      data-testid="version-history"
    >
      <div
        className="flex min-h-0 flex-col overflow-hidden border-b bg-muted/10 sm:border-b-0 sm:border-r"
        data-testid="version-history-list-pane"
      >
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
          data-testid="version-history-list"
        >
          {(history as HistoryEntry[]).map((entry) => {
            const isSelected = selectedEntry?.version === entry.version;
            const isInActiveCompare =
              currentComparisonData != null
                ? compareVersions?.versionA === entry.version
                : compareVersions?.versionA === entry.version ||
                  compareVersions?.versionB === entry.version;
            const canCompareEntry =
              latestVersion !== null && entry.version !== latestVersion;

            return (
              <div
                key={entry.id}
                className={cn(
                  "cursor-pointer rounded-md border bg-background p-3 text-xs transition-colors hover:border-primary/50 hover:bg-accent/30",
                  isSelected && "border-primary bg-accent/40",
                  isInActiveCompare && "border-primary/60",
                )}
                data-testid={`version-entry-${entry.version}`}
                onClick={() => handleSelectEntry(entry.version)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelectEntry(entry.version);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        v{entry.version}
                      </span>
                      <AttributionBadge
                        actorType={entry.actorType as ActorType}
                        actorId={entry.actorId ?? undefined}
                        size="sm"
                      />
                    </div>
                    <div className="text-muted-foreground">
                      {t(`action.${entry.action}`)}
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-muted-foreground">
                    <div>{new Date(entry.createdAt).toLocaleString()}</div>
                    <div>{formatRelativeTime(entry.createdAt)}</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {onCheckout && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onCheckout(entry.version);
                      }}
                      className="rounded bg-secondary px-2 py-1 text-secondary-foreground transition-colors hover:bg-secondary/80"
                      data-testid={`version-checkout-${entry.version}`}
                      disabled={rollbackMutation.isPending}
                    >
                      {t("checkout")}
                    </button>
                  )}

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRestoreClick(entry.version);
                    }}
                    className="rounded bg-secondary px-2 py-1 text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
                    data-testid={`version-restore-${entry.version}`}
                    disabled={areVersionActionsPending}
                  >
                    {t("rollback")}
                  </button>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCompareClick(entry.version);
                    }}
                    className={cn(
                      "rounded px-2 py-1 transition-colors disabled:opacity-50",
                      isInActiveCompare
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                    )}
                    data-testid={`version-compare-${entry.version}`}
                    disabled={areVersionActionsPending || !canCompareEntry}
                  >
                    {t("compare")}
                  </button>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteClick(entry.version);
                    }}
                    className="rounded bg-destructive px-2 py-1 text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                    data-testid={`version-delete-${entry.version}`}
                    disabled={areVersionActionsPending}
                  >
                    {t("deleteVersion")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div
            className="flex items-center justify-center gap-2 border-t px-3 py-3 text-xs"
            data-testid="version-history-pagination"
          >
            <button
              onClick={() =>
                setPage((currentPage) => Math.max(0, currentPage - 1))
              }
              disabled={page === 0}
              className="rounded bg-secondary px-2 py-1 text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
              data-testid="version-history-prev"
            >
              ←
            </button>
            <span className="text-muted-foreground">
              {t("page")} {page + 1} {t("of")} {totalPages}
            </span>
            <button
              onClick={() =>
                setPage((currentPage) =>
                  Math.min(totalPages - 1, currentPage + 1),
                )
              }
              disabled={page >= totalPages - 1}
              className="rounded bg-secondary px-2 py-1 text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
              data-testid="version-history-next"
            >
              →
            </button>
          </div>
        )}
      </div>

      <div
        className="min-h-0 min-w-0 overflow-y-auto bg-background p-4 lg:p-6"
        data-testid="version-history-detail-pane"
      >
        <div
          className="mx-auto flex w-full max-w-3xl flex-col gap-4"
          data-testid="version-history-detail-content"
        >
          {compareVersions ? (
            <DiffViewer
              nodeId={nodeId}
              versionA={compareVersions.versionA}
              versionB={compareVersions.versionB}
              compareData={currentComparisonData}
              versionBLabel={
                currentComparisonData ? currentVersionLabel : undefined
              }
            />
          ) : selectedEntry ? (
            <div
              className="flex flex-col gap-4"
              data-testid="version-history-preview-pane"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="space-y-1">
                  <div
                    className="font-mono text-lg font-semibold"
                    data-testid="version-history-preview-version"
                  >
                    v{selectedEntry.version}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t(`action.${selectedEntry.action}`)}
                  </div>
                </div>

                <AttributionBadge
                  actorType={selectedEntry.actorType as ActorType}
                  actorId={selectedEntry.actorId ?? undefined}
                  size="sm"
                />

                <div className="ml-auto text-right text-xs text-muted-foreground">
                  <div data-testid="version-history-preview-timestamp">
                    {new Date(selectedEntry.createdAt).toLocaleString()}
                  </div>
                  <div data-testid="version-history-preview-relative-time">
                    {formatRelativeTime(selectedEntry.createdAt)}
                  </div>
                </div>
              </div>

              <div
                className="rounded-md border bg-muted/20 p-4"
                data-testid="version-history-preview-content"
              >
                <div className="prose prose-sm prose-neutral max-w-none whitespace-pre-wrap break-words dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>
                    {getHistoryEntryContent(selectedEntry.contentAfter)}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
