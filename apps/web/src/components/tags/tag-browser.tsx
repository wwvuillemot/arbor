"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Search, ToggleLeft, ToggleRight, List, Cloud } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { TagBadge, type TagBadgeTag } from "./tag-badge";
import { TagCloud, type TagCloudTag } from "./tag-cloud";

export interface TagBrowserProps {
  onSelectNode?: (nodeId: string) => void;
  onFilterChange?: (tagIds: string[], operator: "AND" | "OR") => void;
  className?: string;
}

const TAG_TYPES = ["general", "character", "location", "event", "concept"];

/**
 * TagBrowser - Browse tags, filter nodes by tag selection
 *
 * Features:
 * - Search/filter tags by name
 * - Filter by tag type
 * - Toggle AND/OR logic
 * - Tag cloud or list view
 * - Shows filtered nodes
 */
export function TagBrowser({
  onSelectNode,
  onFilterChange,
  className,
}: TagBrowserProps) {
  const t = useTranslations("tags");

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [operator, setOperator] = React.useState<"AND" | "OR">("OR");
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [viewMode, setViewMode] = React.useState<"list" | "cloud">("cloud");

  // Fetch tags with counts
  const tagsWithCountsQuery = trpc.tags.getTagsWithCounts.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Notify parent of filter changes
  React.useEffect(() => {
    onFilterChange?.(selectedTagIds, operator);
  }, [selectedTagIds, operator, onFilterChange]);

  // Fetch related tags for suggestion
  const relatedTagsQuery = trpc.tags.getRelatedTags.useQuery(
    { tagId: selectedTagIds[0], limit: 5 },
    { enabled: selectedTagIds.length === 1, refetchOnWindowFocus: false },
  );

  const tagsWithCounts: TagCloudTag[] = React.useMemo(() => {
    const data = tagsWithCountsQuery.data ?? [];
    return data
      .filter((tag) => {
        const matchesSearch = tag.name
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesType = typeFilter === "all" || tag.type === typeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => b.nodeCount - a.nodeCount);
  }, [tagsWithCountsQuery.data, search, typeFilter]);

  const handleTagClick = React.useCallback((tag: TagBadgeTag) => {
    setSelectedTagIds((prev) =>
      prev.includes(tag.id)
        ? prev.filter((id) => id !== tag.id)
        : [...prev, tag.id],
    );
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedTagIds([]);
  }, []);

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-testid="tag-browser"
    >
      {/* Search + controls */}
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchTags")}
            className="w-full pl-7 pr-2 py-1 text-xs rounded border bg-background"
            data-testid="tag-browser-search"
          />
        </div>
        <button
          onClick={() => setViewMode(viewMode === "list" ? "cloud" : "list")}
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          title={
            viewMode === "list" ? t("browser.cloudView") : t("browser.listView")
          }
          data-testid="tag-browser-view-toggle"
        >
          {viewMode === "list" ? (
            <Cloud className="w-3.5 h-3.5" />
          ) : (
            <List className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Type filter */}
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="text-xs rounded border bg-background px-2 py-1"
        data-testid="tag-browser-type-filter"
      >
        <option value="all">{t("allTypes")}</option>
        {TAG_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`types.${type}`)}
          </option>
        ))}
      </select>

      {/* Tag display: cloud or list */}
      {viewMode === "cloud" ? (
        <TagCloud
          tags={tagsWithCounts}
          selectedTagIds={selectedTagIds}
          onTagClick={handleTagClick}
          className="py-2"
        />
      ) : (
        <div
          className="flex flex-col gap-1 max-h-40 overflow-y-auto"
          data-testid="tag-browser-list"
        >
          {tagsWithCounts.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleTagClick(tag)}
              className={cn(
                "flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-accent transition-colors text-left",
                selectedTagIds.includes(tag.id) && "bg-accent font-medium",
              )}
              data-testid={`tag-browser-list-item-${tag.id}`}
            >
              <TagBadge tag={tag} size="sm" />
              <span className="text-muted-foreground ml-2">
                {tag.nodeCount}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Selected tags + AND/OR toggle */}
      {selectedTagIds.length > 0 && (
        <div className="border-t pt-2" data-testid="tag-browser-selection">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">{t("browser.filtered")}</span>
            <div className="flex items-center gap-1">
              {selectedTagIds.length > 1 && (
                <button
                  onClick={() =>
                    setOperator((prev) => (prev === "AND" ? "OR" : "AND"))
                  }
                  className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded border hover:bg-accent transition-colors"
                  data-testid="tag-browser-operator-toggle"
                >
                  {operator === "AND" ? (
                    <ToggleRight className="w-3 h-3" />
                  ) : (
                    <ToggleLeft className="w-3 h-3" />
                  )}
                  {operator}
                </button>
              )}
              <button
                onClick={clearSelection}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="tag-browser-clear"
              >
                {t("browser.clear")}
              </button>
            </div>
          </div>

          {/* Selected tag badges */}
          <div className="flex flex-wrap gap-1">
            {selectedTagIds.map((tagId) => {
              const tag = tagsWithCountsQuery.data?.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  size="sm"
                  onRemove={() =>
                    setSelectedTagIds((prev) =>
                      prev.filter((id) => id !== tag.id),
                    )
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Related tags suggestion */}
      {selectedTagIds.length === 1 &&
        relatedTagsQuery.data &&
        relatedTagsQuery.data.length > 0 && (
          <div className="border-t pt-2" data-testid="tag-browser-related">
            <span className="text-xs text-muted-foreground">
              {t("browser.related")}
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {relatedTagsQuery.data.map((related) => (
                <TagBadge
                  key={related.id}
                  tag={related}
                  size="sm"
                  onClick={handleTagClick}
                />
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
