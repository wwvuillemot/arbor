"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import { AttributionBadge, type ActorType } from "./attribution-badge";

const PAGE_SIZE = 10;

interface HistoryEntry {
  id: string;
  nodeId: string;
  version: number;
  actorType: string;
  actorId: string | null;
  action: string;
  createdAt: string;
}

export interface VersionHistoryProps {
  nodeId: string;
  onCheckout?: (version: number) => void;
  onCompare?: (versionA: number, versionB: number) => void;
  className?: string;
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
  className,
}: VersionHistoryProps) {
  const t = useTranslations("provenance.versionHistory");
  const { addToast } = useToast();
  const [page, setPage] = React.useState(0);
  const [compareSelection, setCompareSelection] = React.useState<number | null>(
    null,
  );

  const utils = trpc.useUtils();

  const historyQuery = trpc.provenance.getHistory.useQuery({
    nodeId,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const versionCountQuery = trpc.provenance.getVersionCount.useQuery({
    nodeId,
  });

  const _rollbackMutation = trpc.provenance.rollback.useMutation({
    onSuccess: () => {
      utils.provenance.getHistory.invalidate({ nodeId });
      utils.provenance.getVersionCount.invalidate({ nodeId });
      addToast(t("rollbackSuccess"), "success");
    },
    onError: () => {
      addToast(t("rollbackError"), "error");
    },
  });

  const totalPages = Math.ceil((versionCountQuery.data ?? 0) / PAGE_SIZE);

  const history = historyQuery.data ?? [];

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

  function handleCompareClick(version: number) {
    if (compareSelection === null) {
      setCompareSelection(version);
    } else {
      if (onCompare) {
        onCompare(
          Math.min(compareSelection, version),
          Math.max(compareSelection, version),
        );
      }
      setCompareSelection(null);
    }
  }

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-testid="version-history"
    >
      <h3 className="text-sm font-semibold">{t("title")}</h3>

      <div className="flex flex-col gap-1" data-testid="version-history-list">
        {(history as HistoryEntry[]).map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded border text-xs",
              compareSelection === entry.version && "ring-2 ring-primary",
            )}
            data-testid={`version-entry-${entry.version}`}
          >
            <span className="font-mono font-bold min-w-[3rem]">
              v{entry.version}
            </span>

            <AttributionBadge
              actorType={entry.actorType as ActorType}
              actorId={entry.actorId ?? undefined}
              size="sm"
            />

            <span className="text-muted-foreground">
              {t(`action.${entry.action}`)}
            </span>

            <span className="text-muted-foreground ml-auto whitespace-nowrap">
              {new Date(entry.createdAt).toLocaleString()}
            </span>

            <div className="flex gap-1 ml-2">
              {onCheckout && (
                <button
                  onClick={() => onCheckout(entry.version)}
                  className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  data-testid={`version-checkout-${entry.version}`}
                >
                  {t("checkout")}
                </button>
              )}

              <button
                onClick={() => handleCompareClick(entry.version)}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  compareSelection === entry.version
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                )}
                data-testid={`version-compare-${entry.version}`}
              >
                {t("compare")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-2 text-xs"
          data-testid="version-history-pagination"
        >
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            data-testid="version-history-prev"
          >
            ←
          </button>
          <span className="text-muted-foreground">
            {t("page")} {page + 1} {t("of")} {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            data-testid="version-history-next"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
