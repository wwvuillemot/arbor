"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TagBadgeTag {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  type: string;
  entityNodeId?: string | null;
}

const ENTITY_TYPES = ["character", "location", "event", "concept"];

export interface TagBadgeProps {
  tag: TagBadgeTag;
  size?: "sm" | "md";
  onClick?: (tag: TagBadgeTag) => void;
  onRemove?: (tag: TagBadgeTag) => void;
  onEntityClick?: (tag: TagBadgeTag) => void;
  className?: string;
}

/**
 * TagBadge - A small colored badge displaying a tag name
 *
 * Shows the tag name with its color as the background.
 * Supports optional onClick and onRemove handlers.
 * Entity-type tags show a navigation indicator when they have a linked entity node.
 */
export function TagBadge({
  tag,
  size = "sm",
  onClick,
  onRemove,
  onEntityClick,
  className,
}: TagBadgeProps) {
  const validatedColor =
    typeof tag.color === "string" && /^#[0-9a-fA-F]{6}$/.test(tag.color)
      ? tag.color
      : undefined;
  const hasColor = validatedColor !== undefined;
  const isEntityType = ENTITY_TYPES.includes(tag.type);
  const hasEntityNode = isEntityType && !!tag.entityNodeId;

  const badgeStyle: React.CSSProperties = hasColor
    ? {
        backgroundColor: `${validatedColor}20`,
        borderColor: `${validatedColor}60`,
        color: validatedColor,
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
      {hasEntityNode && onEntityClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEntityClick(tag);
          }}
          className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5 leading-none"
          data-testid={`tag-badge-entity-${tag.id}`}
          aria-label={`Go to ${tag.name}`}
        >
          →
        </button>
      )}
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
