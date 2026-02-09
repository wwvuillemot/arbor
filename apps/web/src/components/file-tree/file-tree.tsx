"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { FolderPlus, FilePlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FileTreeNode, type TreeNode } from "./file-tree-node";
import { cn } from "@/lib/utils";

export interface FileTreeProps {
  projectId: string;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onCreateFolder: (parentId: string) => void;
  onCreateNote: (parentId: string) => void;
  className?: string;
}

export function FileTree({
  projectId,
  selectedNodeId,
  onSelectNode,
  onContextMenu,
  onCreateFolder,
  onCreateNote,
  className,
}: FileTreeProps) {
  const t = useTranslations("fileTree");
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(
    () => new Set([projectId]),
  );

  // Cache for loaded children per parent node
  const childrenQueries = new Map<
    string,
    ReturnType<typeof trpc.nodes.getChildren.useQuery>
  >();

  const toggleNode = React.useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Ensure project is always expanded
  React.useEffect(() => {
    setExpandedNodes((prev) => {
      if (prev.has(projectId)) return prev;
      const next = new Set(prev);
      next.add(projectId);
      return next;
    });
  }, [projectId]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b">
        <button
          onClick={() => onCreateFolder(projectId)}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
          title={t("newFolder")}
          aria-label={t("newFolder")}
        >
          <FolderPlus className="w-4 h-4" />
        </button>
        <button
          onClick={() => onCreateNote(projectId)}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
          title={t("newNote")}
          aria-label={t("newNote")}
        >
          <FilePlus className="w-4 h-4" />
        </button>
      </div>

      {/* Tree */}
      <div
        className="flex-1 overflow-y-auto py-1"
        role="tree"
        aria-label="File tree"
      >
        <ChildrenList
          parentId={projectId}
          depth={0}
          expandedNodes={expandedNodes}
          selectedNodeId={selectedNodeId}
          onToggle={toggleNode}
          onSelect={onSelectNode}
          onContextMenu={onContextMenu}
          emptyMessage={t("emptyProject")}
        />
      </div>
    </div>
  );
}

/** Renders children of a given parent, fetching via tRPC */
function ChildrenList({
  parentId,
  depth,
  expandedNodes,
  selectedNodeId,
  onToggle,
  onSelect,
  onContextMenu,
  emptyMessage,
}: {
  parentId: string;
  depth: number;
  expandedNodes: Set<string>;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  emptyMessage?: string;
}) {
  const childrenQuery = trpc.nodes.getChildren.useQuery(
    { parentId },
    { refetchOnWindowFocus: false, staleTime: 30_000 },
  );

  if (childrenQuery.isLoading) {
    return (
      <div
        className="px-4 py-2 text-xs text-muted-foreground"
        style={{ paddingLeft: `${depth * 16 + 24}px` }}
      >
        Loading...
      </div>
    );
  }

  if (!childrenQuery.data || childrenQuery.data.length === 0) {
    if (depth === 0 && emptyMessage) {
      return (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      );
    }
    return null;
  }

  return (
    <>
      {childrenQuery.data.map((child) => (
        <FileTreeNode
          key={child.id}
          node={child as TreeNode}
          depth={depth}
          isExpanded={expandedNodes.has(child.id)}
          isSelected={selectedNodeId === child.id}
          isLoading={false}
          onToggle={onToggle}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          renderChildren={(childParentId, childDepth) => (
            <ChildrenList
              parentId={childParentId}
              depth={childDepth}
              expandedNodes={expandedNodes}
              selectedNodeId={selectedNodeId}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          )}
        />
      ))}
    </>
  );
}
