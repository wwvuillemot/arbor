"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { TagBadgeTag } from "./tag-badge";

export interface TagCloudTag extends TagBadgeTag {
  nodeCount: number;
}

export interface TagCloudProps {
  tags: TagCloudTag[];
  selectedTagIds?: string[];
  onTagClick?: (tag: TagCloudTag) => void;
  className?: string;
}

/**
 * TagCloud - Visual tag cloud where size reflects usage count
 *
 * Tags with more nodes appear larger. Clicking a tag selects it for filtering.
 */
export function TagCloud({
  tags,
  selectedTagIds = [],
  onTagClick,
  className,
}: TagCloudProps) {
  if (tags.length === 0) return null;

  const maxCount = Math.max(...tags.map((t) => t.nodeCount), 1);

  /**
   * Compute font size class based on relative usage.
   * Range: text-xs (0) → text-2xl (max)
   */
  const sizeClass = (count: number): string => {
    const ratio = count / maxCount;
    if (ratio >= 0.8) return "text-2xl font-bold";
    if (ratio >= 0.6) return "text-xl font-semibold";
    if (ratio >= 0.4) return "text-lg font-medium";
    if (ratio >= 0.2) return "text-base";
    return "text-sm";
  };

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 items-center justify-center",
        className,
      )}
      data-testid="tag-cloud"
    >
      {tags.map((tag) => {
        const isSelected = selectedTagIds.includes(tag.id);
        const hasColor = tag.color && /^#[0-9a-fA-F]{6}$/.test(tag.color);

        return (
          <button
            key={tag.id}
            onClick={() => onTagClick?.(tag)}
            className={cn(
              "rounded-full px-2 py-0.5 transition-all cursor-pointer hover:opacity-80",
              sizeClass(tag.nodeCount),
              isSelected
                ? "ring-2 ring-primary ring-offset-1"
                : "opacity-70 hover:opacity-100",
              !hasColor && "text-foreground",
            )}
            style={
              hasColor
                ? { color: tag.color!, backgroundColor: `${tag.color}15` }
                : undefined
            }
            data-testid={`tag-cloud-item-${tag.id}`}
            title={`${tag.name} (${tag.nodeCount})`}
          >
            {tag.icon && <span className="mr-1">{tag.icon}</span>}
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
