"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Pencil, Star, FolderTree, Settings, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeroGradient } from "@/components/hero-gradient";
import { extractHeroImage, tiptapToMarkdown } from "@/lib/tiptap-utils";
import { getMediaAttachmentUrl } from "@/lib/media-url";

export interface NoteCardTag {
  id: string;
  name: string;
  color?: string | null;
}

export interface NoteCardNode {
  id: string;
  name: string;
  content?: unknown;
  metadata?: unknown;
  /** ID of the first image attachment — used as hero if provided */
  firstMediaId?: string | null;
}

export interface NoteCardProps {
  node: NoteCardNode;
  onClick: () => void;
  /**
   * "full"    — hero + pencil + title + content preview + star + project badge + tags  (default)
   * "compact" — hero + title + project badge + tags (no pencil, no preview)
   */
  variant?: "full" | "compact";
  /** Project name shown as a badge below the title */
  projectName?: string;
  /** Tag pills shown below the project badge */
  tags?: NoteCardTag[];
  /** When provided, renders a star toggle button over the hero */
  onToggleFavorite?: (nodeId: string) => void;
  /** When provided, renders a settings cog button over the hero (top-left) */
  onSettings?: () => void;
  /** When true, renders a selected ring + green check badge */
  isSelected?: boolean;
  /** Plain-text description shown as content preview (used for projects) */
  description?: string;
}

export function NoteCard({
  node,
  onClick,
  variant = "full",
  projectName,
  tags,
  onToggleFavorite,
  onSettings,
  isSelected,
  description,
}: NoteCardProps) {
  const heroImage = React.useMemo(
    () =>
      node.firstMediaId
        ? getMediaAttachmentUrl(node.firstMediaId)
        : extractHeroImage(node.content),
    [node.firstMediaId, node.content],
  );

  const preview = React.useMemo(
    () =>
      variant === "full" && !description
        ? tiptapToMarkdown(node.content)
        : null,
    [variant, description, node.content],
  );

  const isFavorite =
    (node.metadata as Record<string, unknown> | null)?.isFavorite === true;

  const heroHeight = variant === "compact" ? "h-32" : "h-40";

  return (
    <div
      className={cn(
        "group rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow",
        isSelected && "ring-2 ring-green-500 border-green-500",
      )}
      onClick={onClick}
    >
      {/* Hero */}
      <div className={cn("w-full relative", heroHeight)}>
        <HeroGradient
          seed={node.name}
          imageUrl={heroImage}
          imageAlt={node.name}
          className="w-full h-full"
        />

        {/* Settings cog — top-right, always shown on hover */}
        {onSettings && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSettings();
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 hover:bg-black/50 transition-all"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Favorite star — top-right when no settings, top-left when settings present */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(node.id);
            }}
            className={cn(
              "absolute top-2 p-1.5 rounded-full transition-all",
              onSettings ? "right-10" : "right-2",
              "bg-black/20 backdrop-blur-sm",
              isFavorite
                ? "text-amber-400 opacity-100"
                : "text-white/70 opacity-0 hover:opacity-100",
              "[.group:hover_&]:opacity-100",
              isFavorite && "shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]",
              "hover:shadow-[0_0_10px_3px_rgba(251,191,36,0.7)] hover:text-amber-400",
            )}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-label={
              isFavorite ? "Remove from favorites" : "Add to favorites"
            }
          >
            <Star
              className="w-4 h-4"
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>
        )}

        {/* Selected check — bottom-right */}
        {isSelected && (
          <div className="absolute bottom-2 right-2 rounded-full bg-green-500 p-0.5 shadow">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {/* Title row */}
        <div className="flex items-center gap-2">
          {variant === "full" && !onSettings && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="p-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors shrink-0"
              title="Edit"
            >
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
          <span className="font-medium text-sm truncate">{node.name}</span>
        </div>

        {/* Project badge */}
        {projectName && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <FolderTree className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{projectName}</span>
          </div>
        )}

        {/* Tag pills */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
                style={
                  tag.color
                    ? {
                        borderColor: tag.color,
                        color: tag.color,
                        backgroundColor: `${tag.color}18`,
                      }
                    : undefined
                }
              >
                {tag.name}
              </span>
            ))}
            {tags.length > 4 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] text-muted-foreground border">
                +{tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Description — plain text (for projects) */}
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-3">
            {description}
          </p>
        )}

        {/* Content preview — full variant only, when no description */}
        {variant === "full" && preview && (
          <div className="relative max-h-[200px] overflow-hidden">
            <div className="text-xs text-muted-foreground prose prose-xs dark:prose-invert max-w-none [&_*]:text-xs [&_h1,&_h2,&_h3,&_h4]:font-semibold [&_h1,&_h2,&_h3,&_h4]:mt-1 [&_p]:mt-0 [&_ul]:mt-0 [&_ol]:mt-0 [&_li]:my-0">
              <ReactMarkdown>{preview}</ReactMarkdown>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  );
}
