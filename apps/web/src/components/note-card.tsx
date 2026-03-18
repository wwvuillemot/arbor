"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Pencil, Star, FolderTree, Settings, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeroGradient } from "@/components/hero-gradient";
import { extractHeroImageData, tiptapToMarkdown } from "@/lib/tiptap-utils";
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
  /** Focal point for the hero image (0–100). Defaults to 50/50. */
  heroFocalX?: number | null;
  heroFocalY?: number | null;
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

const MAX_TILT = 4; // degrees

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
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
  const [sheenKey, setSheenKey] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setSheenKey((k) => k + 1); // restart animation each entry
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const { left, top, width, height } = card.getBoundingClientRect();
    const px = (e.clientX - left) / width; // 0–1
    const py = (e.clientY - top) / height; // 0–1
    setTilt({
      x: (py - 0.5) * -MAX_TILT * 2, // tilt up when cursor is near top
      y: (px - 0.5) * MAX_TILT * 2, // tilt right when cursor is near right
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const { heroImage, focalX, focalY } = React.useMemo(() => {
    if (node.firstMediaId) {
      return {
        heroImage: getMediaAttachmentUrl(node.firstMediaId),
        focalX: node.heroFocalX ?? 50,
        focalY: node.heroFocalY ?? 50,
      };
    }
    const data = extractHeroImageData(node.content);
    return {
      heroImage: data?.url ?? null,
      focalX: data?.focalX ?? 50,
      focalY: data?.focalY ?? 50,
    };
  }, [node.firstMediaId, node.heroFocalX, node.heroFocalY, node.content]);

  const preview = React.useMemo(
    () =>
      variant === "full" && !description
        ? tiptapToMarkdown(node.content)
        : null,
    [variant, description, node.content],
  );

  const metadata = node.metadata as Record<string, unknown> | null;
  const isFavorite = metadata?.isFavorite === true;
  const isLocked = metadata?.isLocked === true;

  const heroHeight = variant === "compact" ? "h-32" : "h-40";

  return (
    <div
      ref={cardRef}
      className={cn(
        "group rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden cursor-pointer",
        "transition-[transform,box-shadow] duration-200 ease-out",
        isSelected && "ring-2 ring-green-500 border-green-500",
      )}
      style={{
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x || tilt.y ? 1.01 : 1})`,
        boxShadow:
          tilt.x || tilt.y
            ? "0 8px 24px rgba(0,0,0,0.15)"
            : "0 1px 3px rgba(0,0,0,0.08)",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Hero */}
      <div className={cn("w-full relative overflow-hidden", heroHeight)}>
        <HeroGradient
          seed={node.name}
          imageUrl={heroImage}
          imageAlt={node.name}
          focalX={focalX}
          focalY={focalY}
          className="w-full h-full"
        />

        {/* Sheen sweep — one-shot diagonal highlight on hover entry.
            sheenKey change forces remount of the animated element so the
            keyframe restarts from scratch on each hover entry. */}
        {isHovered ? (
          <React.Fragment key={sheenKey}>
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              aria-hidden
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: "70%",
                  background:
                    "linear-gradient(105deg, transparent 5%, rgba(255,255,255,0.32) 35%, rgba(255,255,255,0.48) 50%, rgba(255,255,255,0.32) 65%, transparent 95%)",
                  animation: "card-sheen 0.55s ease-out forwards",
                }}
              />
            </div>
          </React.Fragment>
        ) : null}

        {/* Lock badge — top-left, visible when node is locked */}
        {isLocked && (
          <div
            className="absolute top-2 left-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white/90"
            title="Locked"
            aria-label="Locked"
            data-testid="card-locked-badge"
          >
            <Lock className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Favorite star — top-right */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(node.id);
            }}
            className={cn(
              "absolute top-2 right-2 p-1.5 rounded-full transition-all",
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
          {variant === "full" && (
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
          <span className="font-medium text-sm truncate flex-1">
            {node.name}
          </span>
          {onSettings && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSettings();
              }}
              className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-accent-foreground transition-all shrink-0"
              title="Settings"
              data-testid="card-settings-button"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
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
