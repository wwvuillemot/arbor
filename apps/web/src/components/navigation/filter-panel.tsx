"use client";

import * as React from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import type { AttributionFilter } from "@/components/file-tree";
import { cn } from "@/lib/utils";

export interface FilterPanelProps {
  onSearchChange: (query: string) => void;
  onTagsChange: (tagIds: string[], operator: "AND" | "OR") => void;
  onAttributionChange: (filter: AttributionFilter) => void;
  className?: string;
}

/**
 * FilterPanel - Unified filtering UI for Projects page
 *
 * Consolidates search, tag filtering, and attribution filtering
 * into a single cohesive component above the file tree.
 */
export function FilterPanel({
  onSearchChange,
  onTagsChange,
  onAttributionChange,
  className = "",
}: FilterPanelProps) {
  const tFilter = useTranslations("filterPanel");
  const tAttribution = useTranslations("attributionFilter");

  // Local state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [tagOperator, setTagOperator] = React.useState<"AND" | "OR">("OR");
  const [attributionFilter, setAttributionFilter] =
    React.useState<AttributionFilter>("all");
  const [tagPopoverOpen, setTagPopoverOpen] = React.useState(false);

  // Fetch all tags
  const tagsQuery = trpc.tags.getAllTags.useQuery();
  const allTags = tagsQuery.data || [];

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, onSearchChange]);

  // Notify parent of tag changes
  React.useEffect(() => {
    onTagsChange(selectedTagIds, tagOperator);
  }, [selectedTagIds, tagOperator, onTagsChange]);

  // Notify parent of attribution changes
  React.useEffect(() => {
    onAttributionChange(attributionFilter);
  }, [attributionFilter, onAttributionChange]);

  // Check if any filters are active
  const hasActiveFilters =
    searchQuery.length > 0 ||
    selectedTagIds.length > 0 ||
    attributionFilter !== "all";

  // Clear all filters
  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedTagIds([]);
    setTagOperator("OR");
    setAttributionFilter("all");
  };

  // Toggle tag selection
  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  // Toggle operator
  const handleOperatorToggle = () => {
    setTagOperator((prev) => (prev === "OR" ? "AND" : "OR"));
  };

  return (
    <div className={cn("space-y-2 rounded-lg border bg-card p-3", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={tFilter("search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border bg-background pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tag Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {tFilter("tags")}:
        </span>
        <div className="relative">
          <button
            onClick={() => setTagPopoverOpen(!tagPopoverOpen)}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            data-testid="filter-panel-tag-selector"
          >
            {selectedTagIds.length === 0
              ? tFilter("selectTags")
              : `${selectedTagIds.length} selected`}
            <ChevronDown className="h-3 w-3" />
          </button>
          {tagPopoverOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 rounded-md border bg-popover p-2 shadow-md z-10">
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {allTags.map((tag) => (
                  <div
                    key={tag.id}
                    data-testid={`tag-option-${tag.id}`}
                    onClick={() => handleTagToggle(tag.id)}
                    className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={() => {}}
                      className="h-4 w-4"
                    />
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color || "#6b7280" }}
                    >
                      {tag.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Operator Toggle (only show if multiple tags selected) */}
        {selectedTagIds.length > 1 && (
          <button
            onClick={handleOperatorToggle}
            data-testid="filter-panel-operator-toggle"
            className="rounded-md px-2 py-1 text-xs font-medium hover:bg-accent transition-colors"
          >
            {tagOperator}
          </button>
        )}

        {/* Selected Tags */}
        {selectedTagIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedTagIds.map((tagId) => {
              const tag = allTags.find((t) => t.id === tagId);
              if (!tag) return null;
              return (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: tag.color || "#6b7280" }}
                  onClick={() => handleTagToggle(tagId)}
                >
                  {tag.name}
                  <X className="h-3 w-3" />
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Attribution Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {tFilter("attribution")}:
        </span>
        <div className="flex gap-1">
          {(["all", "human", "ai-generated", "ai-assisted"] as const).map(
            (filter) => {
              // Map filter value to translation key
              const translationKey =
                filter === "ai-generated"
                  ? "aiGenerated"
                  : filter === "ai-assisted"
                    ? "aiAssisted"
                    : filter;

              return (
                <button
                  key={filter}
                  onClick={() => setAttributionFilter(filter)}
                  data-testid={`attribution-filter-${filter}`}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    attributionFilter === filter
                      ? "bg-primary text-primary-foreground"
                      : "border bg-background hover:bg-accent",
                  )}
                >
                  {tAttribution(translationKey)}
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Clear All Button */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <button
            onClick={handleClearAll}
            data-testid="filter-panel-clear-all"
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
            {tFilter("clearAll")}
          </button>
        </div>
      )}
    </div>
  );
}
