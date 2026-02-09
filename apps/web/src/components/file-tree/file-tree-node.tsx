"use client";

import * as React from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Link,
  Sparkles,
  Mic,
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
  createdAt: string;
  updatedAt: string;
}

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
  renderChildren?: (parentId: string, depth: number) => React.ReactNode;
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

function getNodeIcon(type: string, isExpanded: boolean) {
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
  renderChildren,
}: FileTreeNodeProps) {
  const isExpandable = expandableTypes.has(node.type);
  const Icon = getNodeIcon(node.type, isExpanded);

  // Inline editing state
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(node.name);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== node.name && onRename) {
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
    if (onRename) {
      setEditValue(node.name);
      setIsEditing(true);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return; // Don't toggle/select while editing
    if (isExpandable) {
      onToggle(node.id);
    }
    onSelect(node.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
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

  return (
    <div data-testid={`tree-node-${node.id}`}>
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={isExpandable ? isExpanded : undefined}
        aria-selected={isSelected}
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer rounded-sm text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "transition-colors",
          isSelected && "text-accent-foreground font-medium",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        {/* Expand/collapse chevron */}
        {isExpandable ? (
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {isLoading ? (
              <span className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </span>
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
      </div>

      {/* Children */}
      {isExpandable && isExpanded && renderChildren && (
        <div role="group">{renderChildren(node.id, depth + 1)}</div>
      )}
    </div>
  );
}
