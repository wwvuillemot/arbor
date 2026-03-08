"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { SearchResultCard, type SearchResultItem } from "./search-result-card";

export type SearchMode = "hybrid" | "vector" | "keyword";
export type SortBy = "relevance" | "date" | "name";

const AVAILABLE_NODE_TYPES = [
  "project",
  "folder",
  "note",
  "link",
  "ai_suggestion",
  "audio_note",
] as const;

type SearchNodeType = (typeof AVAILABLE_NODE_TYPES)[number];

export interface SearchPanelProps {
  onSelectNode?: (nodeId: string) => void;
  className?: string;
}

// ── Session storage helpers ──────────────────────────────────────────────────

function sessionGet<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sessionSet(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

const SS = {
  query: "arbor:search:query",
  mode: "arbor:search:mode",
  sort: "arbor:search:sort",
  project: "arbor:search:project",
  tags: "arbor:search:tags",
  showFilters: "arbor:search:showFilters",
};

// ── Component ────────────────────────────────────────────────────────────────

export function SearchPanel({ onSelectNode, className }: SearchPanelProps) {
  const t = useTranslations("search");
  const tFileTree = useTranslations("fileTree");

  const [query, setQuery] = React.useState<string>(() =>
    sessionGet(SS.query, ""),
  );
  const [debouncedQuery, setDebouncedQuery] = React.useState<string>(() =>
    sessionGet(SS.query, ""),
  );
  const [searchMode, setSearchMode] = React.useState<SearchMode>(() =>
    sessionGet(SS.mode, "hybrid"),
  );
  const [sortBy, setSortBy] = React.useState<SortBy>(() =>
    sessionGet(SS.sort, "relevance"),
  );
  const [showFilters, setShowFilters] = React.useState<boolean>(() =>
    sessionGet(SS.showFilters, false),
  );

  // Filters
  const [projectFilter, setProjectFilter] = React.useState<string>(() =>
    sessionGet(SS.project, ""),
  );
  const [tagFilters, setTagFilters] = React.useState<string[]>(() =>
    sessionGet(SS.tags, []),
  );
  const [nodeTypeFilter, setNodeTypeFilter] = React.useState<SearchNodeType[]>(
    [],
  );

  // Persist state to sessionStorage on change
  React.useEffect(() => {
    sessionSet(SS.query, query);
  }, [query]);
  React.useEffect(() => {
    sessionSet(SS.mode, searchMode);
  }, [searchMode]);
  React.useEffect(() => {
    sessionSet(SS.sort, sortBy);
  }, [sortBy]);
  React.useEffect(() => {
    sessionSet(SS.project, projectFilter);
  }, [projectFilter]);
  React.useEffect(() => {
    sessionSet(SS.tags, tagFilters);
  }, [tagFilters]);
  React.useEffect(() => {
    sessionSet(SS.showFilters, showFilters);
  }, [showFilters]);

  // Data queries
  const projectsQuery = trpc.nodes.getAllProjects.useQuery();
  const tagsQuery = trpc.tags.getAll.useQuery(
    projectFilter ? { projectId: projectFilter } : {},
  );

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Build filters
  const searchEnabled = debouncedQuery.length > 0;
  const searchFilters = {
    ...(projectFilter ? { projectId: projectFilter } : {}),
    ...(nodeTypeFilter.length > 0 ? { nodeTypes: nodeTypeFilter } : {}),
    ...(tagFilters.length > 0 ? { tagIds: tagFilters } : {}),
  };

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

  // Map raw results to SearchResultItem
  const rawResults: SearchResultItem[] = React.useMemo(
    () =>
      (activeQuery.data ?? []).map((r: Record<string, unknown>) => {
        const node = r.node as Record<string, unknown>;
        return {
          nodeId: node.id as string,
          name: node.name as string,
          nodeType: node.type as string,
          score: r.score as number,
          matchType: r.matchType as string,
          contentJson: node.content ?? null,
          updatedAt: node.updatedAt as string,
          tags: (r.tags as SearchResultItem["tags"]) ?? [],
          projectId: (r.projectId as string) ?? null,
          projectName: (r.projectName as string) ?? null,
        };
      }),
    [activeQuery.data],
  );

  // Sort
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
    return sorted;
  }, [rawResults, sortBy]);

  // Group by project
  const grouped = React.useMemo(() => {
    const map = new Map<string, { label: string; items: SearchResultItem[] }>();
    for (const r of results) {
      const key = r.projectId ?? "__none__";
      const label = r.projectName ?? "Ungrouped";
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(r);
    }
    // Sort groups: pinned project first, then alphabetical
    return Array.from(map.entries()).sort(([, a], [, b]) =>
      a.label.localeCompare(b.label),
    );
  }, [results]);

  const allTags = tagsQuery.data ?? [];
  const allProjects = projectsQuery.data ?? [];

  const [showTagList, setShowTagList] = React.useState(false);

  return (
    <div
      className={cn("flex flex-col h-full", className)}
      data-testid="search-panel"
    >
      {/* Search bar */}
      <div className="p-4 border-b space-y-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            className="w-full pl-10 pr-10 py-2.5 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

        {/* Controls row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode */}
          <div
            className="flex border rounded-lg overflow-hidden text-xs"
            data-testid="search-mode"
          >
            {(["hybrid", "vector", "keyword"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSearchMode(mode)}
                data-testid={`search-mode-${mode}`}
                className={cn(
                  "px-2.5 py-1 transition-colors",
                  searchMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent",
                )}
              >
                {t(`mode.${mode}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            data-testid="search-sort"
            className="border rounded-lg px-2 py-1 text-xs bg-background"
          >
            <option value="relevance">{t("sort.relevance")}</option>
            <option value="date">{t("sort.date")}</option>
            <option value="name">{t("sort.name")}</option>
          </select>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            data-testid="search-filter-toggle"
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs border rounded-lg transition-colors",
              showFilters ||
                projectFilter ||
                tagFilters.length > 0 ||
                nodeTypeFilter.length > 0
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent",
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            {t("filters")}
            {tagFilters.length +
              nodeTypeFilter.length +
              (projectFilter ? 1 : 0) >
              0 && (
              <span className="ml-0.5 font-bold">
                (
                {tagFilters.length +
                  nodeTypeFilter.length +
                  (projectFilter ? 1 : 0)}
                )
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div
            className="p-3 border rounded-lg bg-muted/30 space-y-3"
            data-testid="search-filters"
          >
            {/* Project filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t("filterProject")}
              </label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full border rounded-lg px-2 py-1.5 text-xs bg-background"
              >
                <option value="">{t("allProjects")}</option>
                {allProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Node type filter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t("filterNodeType")}
              </label>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_NODE_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setNodeTypeFilter((prev) =>
                        prev.includes(type)
                          ? prev.filter((t) => t !== type)
                          : [...prev, type],
                      )
                    }
                    data-testid={`filter-type-${type}`}
                    className={cn(
                      "px-2 py-0.5 text-xs rounded-full border transition-colors",
                      nodeTypeFilter.includes(type)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent",
                    )}
                  >
                    {tFileTree(
                      `nodeTypes.${type}` as Parameters<typeof tFileTree>[0],
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tag filter */}
            {allTags.length > 0 && (
              <div>
                <button
                  onClick={() => setShowTagList(!showTagList)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1"
                >
                  {t("filterTags")}
                  {tagFilters.length > 0 && (
                    <span className="text-primary font-bold">
                      ({tagFilters.length})
                    </span>
                  )}
                  {showTagList ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
                {showTagList && (
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {allTags.map((tag) => {
                      const active = tagFilters.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() =>
                            setTagFilters((prev) =>
                              active
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id],
                            )
                          }
                          className="px-2 py-0.5 text-xs rounded-full border transition-colors"
                          style={
                            tag.color
                              ? {
                                  borderColor: active
                                    ? tag.color!
                                    : tag.color + "60",
                                  backgroundColor: active
                                    ? tag.color! + "30"
                                    : tag.color + "10",
                                  color: tag.color!,
                                }
                              : {}
                          }
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Clear filters */}
            {(projectFilter ||
              tagFilters.length > 0 ||
              nodeTypeFilter.length > 0) && (
              <button
                onClick={() => {
                  setProjectFilter("");
                  setTagFilters([]);
                  setNodeTypeFilter([]);
                }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                {t("clearFilters")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        data-testid="search-results"
      >
        {isLoading && (
          <div
            className="text-center text-muted-foreground py-12"
            data-testid="search-loading"
          >
            {t("searching")}
          </div>
        )}

        {!isLoading && searchEnabled && results.length === 0 && (
          <div
            className="text-center text-muted-foreground py-12"
            data-testid="search-empty"
          >
            {t("noResults")}
          </div>
        )}

        {!isLoading && !searchEnabled && (
          <div
            className="text-center text-muted-foreground py-12"
            data-testid="search-prompt"
          >
            {t("prompt")}
          </div>
        )}

        {/* Grouped results */}
        {!isLoading && results.length > 0 && (
          <>
            {grouped.map(([key, group]) => (
              <div key={key}>
                {/* Group header (only if multiple groups or ungrouped) */}
                {grouped.length > 1 && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </span>
                    <div className="flex-1 border-t" />
                    <span className="text-xs text-muted-foreground">
                      {group.items.length}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.items.map((result) => (
                    <SearchResultCard
                      key={result.nodeId}
                      result={result}
                      onClick={() => onSelectNode?.(result.nodeId)}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div
              className="text-center text-xs text-muted-foreground py-2"
              data-testid="search-count"
            >
              {t("resultCount", { count: results.length })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
