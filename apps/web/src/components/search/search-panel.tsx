"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { SearchResultCard, type SearchResultItem } from "./search-result-card";

export type SearchMode = "hybrid" | "vector" | "keyword";
export type SortBy = "relevance" | "date" | "name";

export interface SearchPanelProps {
  /** Called when user clicks a result to navigate to the node */
  onSelectNode?: (nodeId: string) => void;
  className?: string;
}

/**
 * SearchPanel - Full search interface with search bar, filters, and results.
 *
 * Features:
 * - Search bar with debounced input
 * - Search mode selector (hybrid, vector, keyword)
 * - Filter panel (project, node type)
 * - Result cards with title, path, tags, snippet, score
 * - Sort by: relevance, date, name
 */
export function SearchPanel({ onSelectNode, className }: SearchPanelProps) {
  const t = useTranslations("search");

  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [searchMode, setSearchMode] = React.useState<SearchMode>("hybrid");
  const [sortBy, setSortBy] = React.useState<SortBy>("relevance");
  const [showFilters, setShowFilters] = React.useState(false);

  // Filters
  const [nodeTypeFilter, setNodeTypeFilter] = React.useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [projectFilter, _setProjectFilter] = React.useState<string | undefined>(
    undefined,
  );

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Build search input
  const searchEnabled = debouncedQuery.length > 0;
  const searchFilters = {
    ...(projectFilter ? { projectId: projectFilter } : {}),
    ...(nodeTypeFilter.length > 0 ? { nodeTypes: nodeTypeFilter } : {}),
  };

  // Choose the right query based on search mode
  const hybridQuery = trpc.search.hybridSearch.useQuery(
    { query: debouncedQuery, filters: searchFilters },
    {
      enabled: searchEnabled && searchMode === "hybrid",
      refetchOnWindowFocus: false,
    },
  );
  const vectorQuery = trpc.search.vectorSearch.useQuery(
    { query: debouncedQuery, filters: searchFilters },
    {
      enabled: searchEnabled && searchMode === "vector",
      refetchOnWindowFocus: false,
    },
  );
  const keywordQuery = trpc.search.keywordSearch.useQuery(
    { query: debouncedQuery, filters: searchFilters },
    {
      enabled: searchEnabled && searchMode === "keyword",
      refetchOnWindowFocus: false,
    },
  );

  const activeQuery =
    searchMode === "hybrid"
      ? hybridQuery
      : searchMode === "vector"
        ? vectorQuery
        : keywordQuery;

  const isLoading = activeQuery.isLoading && searchEnabled;
  const rawResults: SearchResultItem[] = (activeQuery.data ?? []).map(
    (r: Record<string, Record<string, unknown>>) => ({
      nodeId: r.node.id,
      name: r.node.name,
      nodeType: r.node.type,
      score: r.score,
      matchType: r.matchType,
      content: typeof r.node.content === "string" ? r.node.content : "",
      updatedAt: r.node.updatedAt,
    }),
  );

  // Sort results
  const results = React.useMemo(() => {
    const sorted = [...rawResults];
    if (sortBy === "date") {
      sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    } else if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    // "relevance" is default order from the backend
    return sorted;
  }, [rawResults, sortBy]);

  const nodeTypes = [
    "project",
    "folder",
    "note",
    "link",
    "ai_suggestion",
    "audio_note",
  ];

  return (
    <div
      className={cn("flex flex-col h-full", className)}
      data-testid="search-panel"
    >
      {/* Search bar */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            className="w-full pl-10 pr-10 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="search-input"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("clear")}
              data-testid="search-clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Mode + Sort + Filter toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search mode selector */}
          <div
            className="flex border rounded-lg overflow-hidden text-xs"
            data-testid="search-mode"
          >
            {(["hybrid", "vector", "keyword"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSearchMode(mode)}
                className={cn(
                  "px-3 py-1 transition-colors",
                  searchMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent",
                )}
                data-testid={`search-mode-${mode}`}
              >
                {t(`mode.${mode}`)}
              </button>
            ))}
          </div>

          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="border rounded-lg px-2 py-1 text-xs bg-background"
            data-testid="search-sort"
          >
            <option value="relevance">{t("sort.relevance")}</option>
            <option value="date">{t("sort.date")}</option>
            <option value="name">{t("sort.name")}</option>
          </select>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs border rounded-lg transition-colors",
              showFilters
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent",
            )}
            data-testid="search-filter-toggle"
          >
            <SlidersHorizontal className="h-3 w-3" />
            {t("filters")}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div
            className="p-3 border rounded-lg bg-muted/30 space-y-2"
            data-testid="search-filters"
          >
            {/* Node type filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t("filterNodeType")}
              </label>
              <div className="flex flex-wrap gap-1 mt-1">
                {nodeTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setNodeTypeFilter((prev) =>
                        prev.includes(type)
                          ? prev.filter((t) => t !== type)
                          : [...prev, type],
                      );
                    }}
                    className={cn(
                      "px-2 py-0.5 text-xs rounded-full border transition-colors",
                      nodeTypeFilter.includes(type)
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-accent",
                    )}
                    data-testid={`filter-type-${type}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-2"
        data-testid="search-results"
      >
        {isLoading && (
          <div
            className="text-center text-muted-foreground py-8"
            data-testid="search-loading"
          >
            {t("searching")}
          </div>
        )}

        {!isLoading && searchEnabled && results.length === 0 && (
          <div
            className="text-center text-muted-foreground py-8"
            data-testid="search-empty"
          >
            {t("noResults")}
          </div>
        )}

        {!isLoading && !searchEnabled && (
          <div
            className="text-center text-muted-foreground py-8"
            data-testid="search-prompt"
          >
            {t("prompt")}
          </div>
        )}

        {results.map((result) => (
          <SearchResultCard
            key={result.nodeId}
            result={result}
            onClick={() => onSelectNode?.(result.nodeId)}
          />
        ))}

        {!isLoading && searchEnabled && results.length > 0 && (
          <div
            className="text-center text-xs text-muted-foreground py-2"
            data-testid="search-count"
          >
            {t("resultCount", { count: results.length })}
          </div>
        )}
      </div>
    </div>
  );
}
