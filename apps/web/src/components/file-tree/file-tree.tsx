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

export type AttributionFilter =
  | "all"
  | "human"
  | "ai-generated"
  | "ai-assisted";

/**
 * Determine attribution level from provenance strings.
 * Returns "ai-generated" if both created and updated by LLM,
 * "ai-assisted" if updated by LLM but created by user,
 * "human" if last updated by user.
 */
function getAttributionLevel(
  createdBy?: string,
  updatedBy?: string,
): "ai-generated" | "ai-assisted" | "human" | null {
  if (!updatedBy) return null;
  const isUpdatedByLlm = updatedBy.startsWith("llm:");
  if (isUpdatedByLlm) {
    const isCreatedByLlm = createdBy?.startsWith("llm:") ?? false;
    return isCreatedByLlm ? "ai-generated" : "ai-assisted";
  }
  if (updatedBy.startsWith("user:")) return "human";
  return null;
}

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
  /** When provided, only show nodes whose IDs are in this set (plus containers) */
  filterNodeIds?: Set<string> | null;
  /** When set to a value other than "all", filter leaf nodes by attribution */
  attributionFilter?: AttributionFilter;
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
      filterNodeIds,
      attributionFilter,
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
            filterNodeIds={filterNodeIds}
            attributionFilter={attributionFilter}
            emptyMessage={t("emptyProject")}
          />
        </div>
      </div>
    );
  },
);

/**
 * Check if a node or any of its descendants match the current filters
 */
function hasMatchingDescendants(
  nodeId: string,
  allNodes: Map<string, TreeNode>,
  filterNodeIds: Set<string> | null,
  attributionFilter: AttributionFilter | undefined,
): boolean {
  const node = allNodes.get(nodeId);
  if (!node) return false;

  const isContainer = containerTypes.has(node.type);

  // Check if this node itself matches
  let nodeMatches = true;

  // Tag-based filter
  if (filterNodeIds != null && !isContainer) {
    nodeMatches = nodeMatches && filterNodeIds.has(node.id);
  }

  // Attribution filter
  if (attributionFilter && attributionFilter !== "all" && !isContainer) {
    const level = getAttributionLevel(node.createdBy, node.updatedBy);
    nodeMatches = nodeMatches && level === attributionFilter;
  }

  // If this is a leaf node, return whether it matches
  if (!isContainer) {
    return nodeMatches;
  }

  // For containers, check if any descendants match
  const children = Array.from(allNodes.values()).filter(
    (n) => n.parentId === nodeId,
  );

  return children.some((child) =>
    hasMatchingDescendants(
      child.id,
      allNodes,
      filterNodeIds,
      attributionFilter,
    ),
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
  onRename,
  onDrop,
  filterNodeIds,
  attributionFilter,
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
  filterNodeIds?: Set<string> | null;
  attributionFilter?: AttributionFilter;
  emptyMessage?: string;
}) {
  const childrenQuery = trpc.nodes.getChildren.useQuery(
    { parentId },
    { refetchOnWindowFocus: false, staleTime: 30_000 },
  );

  // Fetch all descendants when filtering is active (needed to check if folders have matching children)
  const descendantsQuery = trpc.nodes.getDescendants.useQuery(
    { nodeId: parentId },
    {
      enabled:
        filterNodeIds != null ||
        (attributionFilter != null && attributionFilter !== "all"),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );

  // Build a map of all descendants for efficient lookup
  // IMPORTANT: This must be called before any early returns to satisfy Rules of Hooks
  const allNodesMap = React.useMemo(() => {
    const map = new Map<string, TreeNode>();
    if (descendantsQuery.data) {
      descendantsQuery.data.forEach((node) => {
        map.set(node.id, node as TreeNode);
      });
    }
    // Also add direct children
    if (childrenQuery.data) {
      childrenQuery.data.forEach((node) => {
        map.set(node.id, node as TreeNode);
      });
    }
    return map;
  }, [descendantsQuery.data, childrenQuery.data]);

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

  // Apply filters to children
  const filteredChildren = childrenQuery.data.filter((child) => {
    const isContainer = containerTypes.has(child.type);

    // If filtering is active, check if container has any matching descendants
    if (
      isContainer &&
      (filterNodeIds != null ||
        (attributionFilter && attributionFilter !== "all"))
    ) {
      return hasMatchingDescendants(
        child.id,
        allNodesMap,
        filterNodeIds,
        attributionFilter,
      );
    }

    // Tag-based filter: for leaf nodes, only show if they're in the filter set
    if (filterNodeIds != null) {
      if (!isContainer && !filterNodeIds.has(child.id)) return false;
    }

    // Attribution filter: only applies to leaf nodes
    if (attributionFilter && attributionFilter !== "all") {
      if (!isContainer) {
        const typedChild = child as TreeNode;
        const level = getAttributionLevel(
          typedChild.createdBy,
          typedChild.updatedBy,
        );
        // If attribution can't be determined, hide under non-"all" filters
        if (level !== attributionFilter) return false;
      }
    }

    return true;
  });

  if (filteredChildren.length === 0) {
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
      {filteredChildren.map((child) => (
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
              filterNodeIds={filterNodeIds}
              attributionFilter={attributionFilter}
            />
          )}
        />
      ))}
    </>
  );
}
