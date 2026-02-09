"use client";

import * as React from "react";
import { FileText, Folder, FolderTree, Link2, Bot, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchResultItem {
  nodeId: string;
  name: string;
  nodeType: string;
  score: number;
  matchType: string;
  content: string;
  updatedAt: string | Date;
}

export interface SearchResultCardProps {
  result: SearchResultItem;
  onClick?: () => void;
  className?: string;
}

const NODE_TYPE_ICONS: Record<string, React.ElementType> = {
  project: FolderTree,
  folder: Folder,
  note: FileText,
  link: Link2,
  ai_suggestion: Bot,
  audio_note: Mic,
};

/**
 * SearchResultCard - Display a single search result.
 *
 * Shows:
 * - Node type icon
 * - Title
 * - Snippet from content
 * - Relevance score bar
 * - Match type badge
 * - Updated date
 */
export function SearchResultCard({
  result,
  onClick,
  className,
}: SearchResultCardProps) {
  const Icon = NODE_TYPE_ICONS[result.nodeType] || FileText;
  const scorePercent = Math.round(result.score * 100);
  const snippet = result.content
    ? result.content.slice(0, 150) + (result.content.length > 150 ? "…" : "")
    : "";

  const formattedDate = React.useMemo(() => {
    const date = new Date(result.updatedAt);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [result.updatedAt]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 border rounded-lg hover:bg-accent/50 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
      data-testid="search-result-card"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-0.5 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <span className="font-medium truncate" data-testid="result-name">
              {result.name}
            </span>
            <span
              className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
              data-testid="result-match-type"
            >
              {result.matchType}
            </span>
          </div>

          {/* Snippet */}
          {snippet && (
            <p
              className="text-sm text-muted-foreground mt-1 line-clamp-2"
              data-testid="result-snippet"
            >
              {snippet}
            </p>
          )}

          {/* Bottom row: score + date */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {/* Score bar */}
            <div
              className="flex items-center gap-1.5"
              data-testid="result-score"
            >
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${scorePercent}%` }}
                />
              </div>
              <span>{scorePercent}%</span>
            </div>

            {/* Type */}
            <span data-testid="result-type">{result.nodeType}</span>

            {/* Date */}
            <span data-testid="result-date">{formattedDate}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
