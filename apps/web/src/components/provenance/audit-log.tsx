"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { downloadTextFile, openHtmlPrintWindow } from "@/lib/browser-export";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AttributionBadge, type ActorType } from "./attribution-badge";

const PAGE_SIZE = 20;

type ActorTypeFilter = "user" | "llm" | "system";
type ActionFilter = "create" | "update" | "delete" | "move" | "restore";

interface AuditEntry {
  id: string;
  nodeId: string;
  version: number;
  actorType: string;
  actorId: string | null;
  action: string;
  contentBefore: unknown;
  contentAfter: unknown;
  diff: unknown;
  metadata: unknown;
  createdAt: string;
}

export interface AuditLogProps {
  className?: string;
}

/**
 * AuditLog - Timeline view of all changes across nodes/projects.
 *
 * Features:
 * - Filters: actor type, action type, date range, node ID
 * - Search within changes
 * - Export audit report (CSV, HTML/PDF)
 * - Pagination
 */
export function AuditLog({ className }: AuditLogProps) {
  const t = useTranslations("provenance.auditLog");
  const tAction = useTranslations("provenance.versionHistory.action");

  // Filter state
  const [actorTypeFilter, setActorTypeFilter] = React.useState<string>("");
  const [actionFilter, setActionFilter] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeSearch, setActiveSearch] = React.useState<string>("");
  const [offset, setOffset] = React.useState(0);

  // Choose between audit log and search
  const useSearch = activeSearch.length > 0;

  const auditQuery = trpc.provenance.getAuditLog.useQuery(
    {
      limit: PAGE_SIZE,
      offset,
      ...(actorTypeFilter
        ? { actorType: actorTypeFilter as ActorTypeFilter }
        : {}),
      ...(actionFilter ? { action: actionFilter as ActionFilter } : {}),
    },
    { enabled: !useSearch },
  );
  const searchResultsQuery = trpc.provenance.searchHistory.useQuery(
    { query: activeSearch, limit: PAGE_SIZE, offset },
    { enabled: useSearch },
  );
  const countQuery = trpc.provenance.getAuditLogCount.useQuery(
    {
      ...(actorTypeFilter
        ? { actorType: actorTypeFilter as ActorTypeFilter }
        : {}),
      ...(actionFilter ? { action: actionFilter as ActionFilter } : {}),
    },
    { enabled: !useSearch },
  );

  const entries = useSearch
    ? (searchResultsQuery.data ?? [])
    : (auditQuery.data ?? []);
  const totalCount = countQuery.data ?? 0;
  const isLoading = useSearch
    ? searchResultsQuery.isLoading
    : auditQuery.isLoading;

  const handleSearch = () => {
    setOffset(0);
    setActiveSearch(searchQuery);
  };

  const handleClearFilters = () => {
    setActorTypeFilter("");
    setActionFilter("");
    setSearchQuery("");
    setActiveSearch("");
    setOffset(0);
  };

  // Export queries (triggered on demand)
  const csvExportQuery = trpc.provenance.exportAuditReport.useQuery(
    {
      format: "csv" as const,
      ...(actorTypeFilter
        ? { actorType: actorTypeFilter as ActorTypeFilter }
        : {}),
      ...(actionFilter ? { action: actionFilter as ActionFilter } : {}),
    },
    { enabled: false },
  );
  const htmlExportQuery = trpc.provenance.exportAuditReport.useQuery(
    {
      format: "html" as const,
      ...(actorTypeFilter
        ? { actorType: actorTypeFilter as ActorTypeFilter }
        : {}),
      ...(actionFilter ? { action: actionFilter as ActionFilter } : {}),
    },
    { enabled: false },
  );

  const handleExportCsv = async () => {
    const result = await csvExportQuery.refetch();
    if (result.data) {
      downloadTextFile(result.data, "audit-report.csv", "text/csv");
    }
  };

  const handleExportHtml = async () => {
    const result = await htmlExportQuery.refetch();
    if (result.data) {
      openHtmlPrintWindow(result.data);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div data-testid="audit-log" className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold" data-testid="audit-log-title">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex gap-2" data-testid="audit-log-export">
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            data-testid="audit-export-csv"
          >
            {t("export.csv")}
          </button>
          <button
            onClick={handleExportHtml}
            className="px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            data-testid="audit-export-pdf"
          >
            {t("export.pdf")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-end gap-3 p-3 rounded border bg-muted/50"
        data-testid="audit-log-filters"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">
            {t("filters.actorType")}
          </label>
          <select
            value={actorTypeFilter}
            onChange={(e) => {
              setActorTypeFilter(e.target.value);
              setOffset(0);
            }}
            className="text-xs rounded border px-2 py-1 bg-background"
            data-testid="audit-filter-actor"
          >
            <option value="">{t("filters.all")}</option>
            <option value="user">👤 Human</option>
            <option value="llm">🤖 AI</option>
            <option value="system">⚙️ System</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">
            {t("filters.actionType")}
          </label>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setOffset(0);
            }}
            className="text-xs rounded border px-2 py-1 bg-background"
            data-testid="audit-filter-action"
          >
            <option value="">{t("filters.all")}</option>
            <option value="create">{tAction("create")}</option>
            <option value="update">{tAction("update")}</option>
            <option value="delete">{tAction("delete")}</option>
            <option value="move">{tAction("move")}</option>
            <option value="restore">{tAction("restore")}</option>
          </select>
        </div>

        <button
          onClick={handleClearFilters}
          className="px-2 py-1 text-xs rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          data-testid="audit-clear-filters"
        >
          {t("filters.clear")}
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2" data-testid="audit-log-search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t("search.placeholder")}
          className="flex-1 text-sm rounded border px-3 py-1.5 bg-background"
          data-testid="audit-search-input"
        />
        <button
          onClick={handleSearch}
          className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          data-testid="audit-search-button"
        >
          🔍
        </button>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div
          className="text-center text-sm text-muted-foreground py-8"
          data-testid="audit-log-loading"
        >
          {t("timeline.loading")}
        </div>
      ) : entries.length === 0 ? (
        <div
          className="text-center text-sm text-muted-foreground py-8"
          data-testid="audit-log-empty"
        >
          {useSearch ? t("search.noResults") : t("timeline.empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-1" data-testid="audit-log-timeline">
          {(entries as AuditEntry[]).map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 p-2 rounded border text-xs"
              data-testid={`audit-entry-${entry.id}`}
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
                {tAction(entry.action)}
              </span>

              <span
                className="text-muted-foreground truncate max-w-[12rem]"
                title={entry.nodeId}
              >
                {entry.nodeId?.slice(0, 8)}…
              </span>

              <span className="text-muted-foreground ml-auto whitespace-nowrap">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!useSearch && totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-2 text-xs"
          data-testid="audit-log-pagination"
        >
          <button
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            data-testid="audit-page-prev"
          >
            ←
          </button>
          <span className="text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            data-testid="audit-page-next"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
