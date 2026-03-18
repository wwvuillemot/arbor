"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Link,
  Sparkles,
  Mic,
  MessageSquarePlus,
  Image,
  Lock,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TreeNode {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  position: number | null;
  content: unknown;
  metadata: unknown;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Determine actor type from a provenance string like "user:alice" or "llm:gpt-4o"
 */
function getActorType(provenance?: string): "user" | "llm" | "system" | null {
  if (!provenance) return null;
  if (provenance.startsWith("llm:")) return "llm";
  if (provenance.startsWith("user:")) return "user";
  if (provenance.startsWith("system:")) return "system";
  return null;
}

/** Extract model/actor display name from provenance string */
function getActorDisplayName(provenance?: string): string | null {
  if (!provenance || !provenance.includes(":")) return null;
  return provenance.split(":").slice(1).join(":");
}

export type DropPosition = "before" | "inside" | "after";

export interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  children?: TreeNode[];
  isLoading?: boolean;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onRename?: (nodeId: string, newName: string) => void;
  onAddToContext?: (node: TreeNode) => void;
  isInContext?: boolean;
  onToggleFavorite?: (nodeId: string) => void;
  onDrop?: (
    draggedNodeId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => void;
  renderChildren?: (parentId: string, depth: number) => React.ReactNode;
  isChecked?: boolean;
  onToggleChecked?: (nodeId: string) => void;
}

const nodeTypeIcons: Record<
  string,
  { collapsed: React.ElementType; expanded: React.ElementType }
> = {
  folder: { collapsed: Folder, expanded: FolderOpen },
  project: { collapsed: Folder, expanded: FolderOpen },
  note: { collapsed: FileText, expanded: FileText },
  link: { collapsed: Link, expanded: Link },
  ai_suggestion: { collapsed: Sparkles, expanded: Sparkles },
  audio_note: { collapsed: Mic, expanded: Mic },
};

function isImageOnlyContent(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  const doc = content as { type?: string; content?: unknown[] };
  if (doc.type !== "doc" || !doc.content || doc.content.length !== 1)
    return false;
  const first = doc.content[0] as { type?: string };
  return first.type === "image";
}

function getNodeIcon(type: string, isExpanded: boolean, content?: unknown) {
  if (type === "note" && isImageOnlyContent(content)) return Image;
  const icons = nodeTypeIcons[type] || nodeTypeIcons.note;
  return isExpanded ? icons.expanded : icons.collapsed;
}

const expandableTypes = new Set(["folder", "project"]);

export function FileTreeNode({
  node,
  depth,
  isExpanded,
  isSelected,
  isLoading,
  onToggle,
  onSelect,
  onContextMenu,
  onRename,
  onAddToContext,
  isInContext,
  onToggleFavorite,
  onDrop,
  renderChildren,
  isChecked,
  onToggleChecked,
}: FileTreeNodeProps) {
  const t = useTranslations("fileTree");
  const isFavorite =
    (node.metadata as Record<string, unknown> | null)?.isFavorite === true;
  const isLocked =
    (node.metadata as Record<string, unknown> | null)?.isLocked === true;
  const isExpandable = expandableTypes.has(node.type);
  const Icon = getNodeIcon(node.type, isExpanded, node.content);

  // Inline editing state
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(node.name);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Drag-and-drop state
  const [dropIndicator, setDropIndicator] = React.useState<DropPosition | null>(
    null,
  );
  const rowRef = React.useRef<HTMLDivElement>(null);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (!isLocked && trimmed && trimmed !== node.name && onRename) {
      onRename(node.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(node.name);
      setIsEditing(false);
    }
    // Stop propagation so tree navigation keys don't fire
    e.stopPropagation();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRename && !isLocked) {
      setEditValue(node.name);
      setIsEditing(true);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return; // Don't toggle/select while editing
    if (e.shiftKey && onToggleChecked) {
      onToggleChecked(node.id);
      return;
    }
    onSelect(node.id);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing || !isExpandable || isLoading) {
      return;
    }
    onToggle(node.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    // Don't drag while editing or while locked
    if (isEditing || isLocked) {
      e.preventDefault();
      return;
    }
    // Don't allow dragging projects
    if (node.type === "project") {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/arbor-node-id", node.id);
    e.dataTransfer.effectAllowed = "move";
    // Add a class to the dragged element for styling
    (e.target as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
  };

  const getDropPosition = (e: React.DragEvent): DropPosition => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return "inside";
    const relativeY = e.clientY - rect.top;
    const height = rect.height;
    // Top 25% → before, bottom 25% → after, middle 50% → inside (for folders)
    if (relativeY < height * 0.25) return "before";
    if (relativeY > height * 0.75) return "after";
    return isExpandable
      ? "inside"
      : relativeY < height * 0.5
        ? "before"
        : "after";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    e.preventDefault();
    const draggedId = e.dataTransfer.types.includes(
      "application/arbor-node-id",
    );
    if (!draggedId) return;
    e.dataTransfer.dropEffect = "move";
    setDropIndicator(getDropPosition(e));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    // Only clear if we're leaving the actual node element
    const relatedTarget = e.relatedTarget as Node | null;
    if (rowRef.current && !rowRef.current.contains(relatedTarget)) {
      setDropIndicator(null);
    }
  };

  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropIndicator(null);
    if (isLocked) return;
    const draggedNodeId = e.dataTransfer.getData("application/arbor-node-id");
    if (!draggedNodeId || draggedNodeId === node.id || !onDrop) return;
    const position = getDropPosition(e);
    onDrop(draggedNodeId, node.id, position);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e as unknown as React.MouseEvent);
    }
    if (e.key === "ArrowRight" && isExpandable && !isExpanded) {
      e.preventDefault();
      onToggle(node.id);
    }
    if (e.key === "ArrowLeft" && isExpandable && isExpanded) {
      e.preventDefault();
      onToggle(node.id);
    }
  };

  const canDrag = node.type !== "project" && !isLocked;

  return (
    <div data-testid={`tree-node-${node.id}`}>
      {/* Drop indicator: before */}
      {dropIndicator === "before" && (
        <div
          className="h-0.5 bg-primary rounded-full mx-2"
          style={{ marginLeft: `${depth * 16 + 8}px` }}
          data-testid={`drop-indicator-before-${node.id}`}
        />
      )}
      <div
        ref={rowRef}
        role="treeitem"
        tabIndex={0}
        aria-expanded={isExpandable ? isExpanded : undefined}
        aria-selected={isSelected}
        draggable={canDrag}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDropEvent}
        className={cn(
          "group/node flex items-center gap-1 px-2 py-1 cursor-pointer rounded-sm text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "transition-colors",
          isSelected && "text-accent-foreground font-medium",
          isChecked && "bg-primary/10 ring-1 ring-inset ring-primary/30",
          dropIndicator === "inside" && "bg-primary/10 ring-1 ring-primary/40",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        {/* Expand/collapse chevron */}
        {isExpandable ? (
          <button
            type="button"
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
            onClick={handleToggleClick}
            aria-label={isExpanded ? "Collapse node" : "Expand node"}
            data-testid={`tree-node-toggle-${node.id}`}
          >
            {isLoading ? (
              <span className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Node type icon */}
        <Icon
          className={cn(
            "w-4 h-4 flex-shrink-0",
            isExpandable ? "text-amber-500" : "text-blue-500",
          )}
        />

        {isLocked && (
          <span
            className="flex-shrink-0 text-muted-foreground"
            title={t("locked")}
            aria-label={t("locked")}
            data-testid={`tree-node-lock-${node.id}`}
          >
            <Lock className="w-3.5 h-3.5" />
          </span>
        )}

        {/* Node name */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleEditKeyDown}
            className="truncate flex-1 bg-transparent outline-none border-b border-accent text-sm"
            data-testid={`tree-node-edit-${node.id}`}
          />
        ) : (
          <span className="truncate flex-1" onDoubleClick={handleDoubleClick}>
            {node.name}
          </span>
        )}

        {/* Add to chat context button — shown on hover when handler is provided */}
        {onAddToContext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToContext(node);
            }}
            className={cn(
              "flex-shrink-0 p-0.5 rounded transition-colors",
              isInContext
                ? "text-primary opacity-100"
                : "opacity-0 group-hover/node:opacity-100 text-muted-foreground hover:text-primary",
            )}
            title={
              isInContext ? "Remove from chat context" : "Add to chat context"
            }
          >
            <MessageSquarePlus className="w-3 h-3" />
          </button>
        )}

        {/* Favorite star */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(node.id);
            }}
            className={cn(
              "flex-shrink-0 p-0.5 rounded transition-colors",
              isFavorite
                ? "text-amber-400 opacity-100"
                : "opacity-0 group-hover/node:opacity-100 text-muted-foreground hover:text-amber-400",
            )}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-label={
              isFavorite ? "Remove from favorites" : "Add to favorites"
            }
          >
            <Star
              className="w-3 h-3"
              fill={isFavorite ? "currentColor" : "none"}
            />
          </button>
        )}

        {/* LLM Attribution badge */}
        {(() => {
          const actorType = getActorType(node.updatedBy);
          if (actorType !== "llm") return null;
          const modelName = getActorDisplayName(node.updatedBy);
          const formattedTime = node.updatedAt
            ? new Date(node.updatedAt).toLocaleString()
            : null;
          return (
            <span
              className="flex-shrink-0 text-xs leading-none cursor-default relative group"
              data-testid={`tree-node-attribution-${node.id}`}
              title={modelName ? `AI: ${modelName}` : "AI-assisted"}
              aria-label={
                modelName ? `AI-assisted by ${modelName}` : "AI-assisted"
              }
            >
              ✨{/* Tooltip with model + timestamp */}
              <span
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs rounded bg-popover text-popover-foreground border shadow-md whitespace-nowrap z-50 hidden group-hover:block"
                data-testid={`tree-node-attribution-tooltip-${node.id}`}
              >
                <span className="font-medium">{modelName || "AI"}</span>
                {formattedTime && (
                  <span
                    className="block text-muted-foreground text-[10px]"
                    data-testid={`tree-node-attribution-time-${node.id}`}
                  >
                    {formattedTime}
                  </span>
                )}
              </span>
            </span>
          );
        })()}
      </div>
      {/* Drop indicator: after */}
      {dropIndicator === "after" && (
        <div
          className="h-0.5 bg-primary rounded-full mx-2"
          style={{ marginLeft: `${depth * 16 + 8}px` }}
          data-testid={`drop-indicator-after-${node.id}`}
        />
      )}

      {/* Children */}
      {isExpandable && isExpanded && renderChildren && (
        <div role="group">{renderChildren(node.id, depth + 1)}</div>
      )}
    </div>
  );
}
