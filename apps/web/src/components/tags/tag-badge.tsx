"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TagBadgeTag {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  type: string;
}

export interface TagBadgeProps {
  tag: TagBadgeTag;
  size?: "sm" | "md";
  onClick?: (tag: TagBadgeTag) => void;
  onRemove?: (tag: TagBadgeTag) => void;
  className?: string;
}

/**
 * TagBadge - A small colored badge displaying a tag name
 *
 * Shows the tag name with its color as the background.
 * Supports optional onClick and onRemove handlers.
 */
export function TagBadge({
  tag,
  size = "sm",
  onClick,
  onRemove,
  className,
}: TagBadgeProps) {
  const hasColor = tag.color && /^#[0-9a-fA-F]{6}$/.test(tag.color);

  const badgeStyle: React.CSSProperties = hasColor
    ? {
        backgroundColor: `${tag.color}20`,
        borderColor: `${tag.color}60`,
        color: tag.color,
      }
    : {};

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        !hasColor && "bg-muted border-border text-foreground",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className,
      )}
      style={badgeStyle}
      onClick={onClick ? () => onClick(tag) : undefined}
      data-testid={`tag-badge-${tag.id}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(tag);
              }
            }
          : undefined
      }
    >
      {tag.icon && <span className="leading-none">{tag.icon}</span>}
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(tag);
          }}
          className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5 leading-none"
          data-testid={`tag-badge-remove-${tag.id}`}
          aria-label={`Remove ${tag.name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
