"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { FolderPlus, FilePlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  FileTreeNode,
  type TreeNode,
  type DropPosition,
} from "./file-tree-node";
import { cn } from "@/lib/utils";

export interface FileTreeProps {
  projectId: string;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onCreateFolder: (parentId: string) => void;
  onCreateNote: (parentId: string) => void;
  onRenameNode?: (nodeId: string, newName: string) => void;
  onMoveNode?: (
    draggedNodeId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => void;
  className?: string;
}

export interface FileTreeHandle {
  expandNode: (nodeId: string) => void;
}

const containerTypes = new Set(["folder", "project"]);

export const FileTree = React.forwardRef<FileTreeHandle, FileTreeProps>(
  function FileTree(
    {
      projectId,
      selectedNodeId,
      onSelectNode,
      onContextMenu,
      onCreateFolder,
      onCreateNote,
      onRenameNode,
      onMoveNode,
      className,
    },
    ref,
  ) {
    const t = useTranslations("fileTree");
    const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(
      () => new Set([projectId]),
    );

    // Expose imperative methods to parent
    React.useImperativeHandle(ref, () => ({
      expandNode: (nodeId: string) => {
        setExpandedNodes((prev) => {
          if (prev.has(nodeId)) return prev;
          const next = new Set(prev);
          next.add(nodeId);
          return next;
        });
      },
    }));

    // Look up the selected node to determine the best parent for new nodes
    const selectedNodeQuery = trpc.nodes.getById.useQuery(
      { id: selectedNodeId! },
      { enabled: !!selectedNodeId, refetchOnWindowFocus: false },
    );

    const getCreateParentId = React.useCallback(() => {
      if (!selectedNodeId || !selectedNodeQuery.data) return projectId;
      // If the selected node is a folder/project, create inside it
      if (containerTypes.has(selectedNodeQuery.data.type))
        return selectedNodeId;
      // Otherwise create as a sibling (use the selected node's parent)
      return selectedNodeQuery.data.parentId ?? projectId;
    }, [selectedNodeId, selectedNodeQuery.data, projectId]);

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
            onClick={() => onCreateFolder(getCreateParentId())}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
            title={t("newFolder")}
            aria-label={t("newFolder")}
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => onCreateNote(getCreateParentId())}
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
            onRename={onRenameNode}
            onDrop={onMoveNode}
            emptyMessage={t("emptyProject")}
          />
        </div>
      </div>
    );
  },
);

/** Renders children of a given parent, fetching via tRPC */
function ChildrenList({
  parentId,
  depth,
  expandedNodes,
  selectedNodeId,
  onToggle,
  onSelect,
  onContextMenu,
  onRename,
  onDrop,
  emptyMessage,
}: {
  parentId: string;
  depth: number;
  expandedNodes: Set<string>;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onRename?: (nodeId: string, newName: string) => void;
  onDrop?: (
    draggedNodeId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => void;
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
          onRename={onRename}
          onDrop={onDrop}
          renderChildren={(childParentId, childDepth) => (
            <ChildrenList
              parentId={childParentId}
              depth={childDepth}
              expandedNodes={expandedNodes}
              selectedNodeId={selectedNodeId}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onRename={onRename}
              onDrop={onDrop}
            />
          )}
        />
      ))}
    </>
  );
}
