"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Clock3, FolderPlus, FilePlus, Star } from "lucide-react";
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

export type FileTreeSortMode = "alphabetical" | "manual";

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
  /** When provided, show "add to chat context" button on each node */
  onAddToContext?: (node: TreeNode) => void;
  /** IDs of nodes currently in chat context (to show them as active) */
  contextNodeIds?: Set<string>;
  /** When provided, show star toggle on each node */
  onToggleFavorite?: (nodeId: string) => void;
  /** When provided, show checkboxes and track selection for bulk ops */
  selectedNodeIds?: Set<string>;
  onToggleNodeSelected?: (nodeId: string) => void;
  sortMode?: FileTreeSortMode;
  onSortModeChange?: (sortMode: FileTreeSortMode) => void;
  className?: string;
}

export interface FileTreeHandle {
  expandNode: (nodeId: string) => void;
}

const containerTypes = new Set(["folder", "project"]);
const MAX_RECENT_NODES = 5;
const DEFAULT_FILE_TREE_SORT_MODE: FileTreeSortMode = "alphabetical";

function getExpandedNodesStorageKey(projectId: string): string {
  return `arbor:fileTreeExpandedNodes:${projectId}`;
}

function ensureProjectExpanded(
  projectId: string,
  nodeIds: Iterable<string>,
): Set<string> {
  const nextExpandedNodes = new Set(nodeIds);
  nextExpandedNodes.add(projectId);
  return nextExpandedNodes;
}

function readStoredExpandedNodes(projectId: string): Set<string> {
  if (typeof window === "undefined") {
    return ensureProjectExpanded(projectId, []);
  }

  try {
    const storedValue = localStorage.getItem(
      getExpandedNodesStorageKey(projectId),
    );
    if (!storedValue) {
      return ensureProjectExpanded(projectId, []);
    }

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) {
      return ensureProjectExpanded(projectId, []);
    }

    const expandedNodeIds = parsedValue.filter(
      (value): value is string => typeof value === "string",
    );

    return ensureProjectExpanded(projectId, expandedNodeIds);
  } catch {
    return ensureProjectExpanded(projectId, []);
  }
}

function writeStoredExpandedNodes(
  projectId: string,
  expandedNodes: Set<string>,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      getExpandedNodesStorageKey(projectId),
      JSON.stringify(
        Array.from(ensureProjectExpanded(projectId, expandedNodes)),
      ),
    );
  } catch {
    // Ignore localStorage persistence failures.
  }
}

function shouldIncludeInRecents(node: TreeNode): boolean {
  return !containerTypes.has(node.type);
}

function updateRecentNodes(
  previousNodes: TreeNode[],
  nextNode: TreeNode,
): TreeNode[] {
  const deduplicatedNodes = previousNodes.filter(
    (node) => node.id !== nextNode.id,
  );
  return [nextNode, ...deduplicatedNodes].slice(0, MAX_RECENT_NODES);
}

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
      onAddToContext,
      contextNodeIds,
      onToggleFavorite,
      selectedNodeIds,
      onToggleNodeSelected,
      sortMode: controlledSortMode,
      onSortModeChange,
      className,
    },
    ref,
  ) {
    const t = useTranslations("fileTree");
    const [internalSortMode, setInternalSortMode] =
      React.useState<FileTreeSortMode>(DEFAULT_FILE_TREE_SORT_MODE);
    const sortMode = controlledSortMode ?? internalSortMode;
    const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(() =>
      readStoredExpandedNodes(projectId),
    );
    const [expandedNodesStorageProjectId, setExpandedNodesStorageProjectId] =
      React.useState(projectId);
    const [recentNodes, setRecentNodes] = React.useState<TreeNode[]>([]);
    const [recentsExpanded, setRecentsExpanded] = React.useState(true);
    const [favoritesExpanded, setFavoritesExpanded] = React.useState(true);
    const showPinnedSections = onToggleFavorite !== undefined;

    const favoritesQuery = trpc.nodes.getFavorites.useQuery(
      { projectId },
      {
        enabled: !!onToggleFavorite,
        refetchOnWindowFocus: false,
        staleTime: 15_000,
      },
    );

    // Expose imperative methods to parent
    React.useImperativeHandle(ref, () => ({
      expandNode: (nodeId: string) => {
        setExpandedNodes((prev) => {
          if (prev.has(nodeId)) return prev;
          return ensureProjectExpanded(projectId, [...prev, nodeId]);
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
    const _childrenQueries = new Map<
      string,
      ReturnType<typeof trpc.nodes.getChildren.useQuery>
    >();

    const toggleNode = React.useCallback(
      (nodeId: string) => {
        setExpandedNodes((prev) => {
          if (nodeId === projectId) {
            return prev;
          }

          const next = new Set(prev);
          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.add(nodeId);
          }
          return ensureProjectExpanded(projectId, next);
        });
      },
      [projectId],
    );

    const handleNodeSelect = React.useCallback(
      (node: TreeNode) => {
        if (shouldIncludeInRecents(node)) {
          setRecentNodes((previousNodes) =>
            updateRecentNodes(previousNodes, node),
          );
        }

        onSelectNode(node.id);
      },
      [onSelectNode],
    );

    const handleSortModeChange = React.useCallback(
      (nextSortMode: FileTreeSortMode) => {
        if (controlledSortMode === undefined) {
          setInternalSortMode(nextSortMode);
        }

        onSortModeChange?.(nextSortMode);
      },
      [controlledSortMode, onSortModeChange],
    );

    React.useEffect(() => {
      setExpandedNodesStorageProjectId(projectId);
      setExpandedNodes(readStoredExpandedNodes(projectId));
    }, [projectId]);

    React.useEffect(() => {
      if (expandedNodesStorageProjectId !== projectId) {
        return;
      }

      writeStoredExpandedNodes(projectId, expandedNodes);
    }, [expandedNodes, expandedNodesStorageProjectId, projectId]);

    React.useEffect(() => {
      setRecentNodes([]);
      setRecentsExpanded(true);
      setFavoritesExpanded(true);
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
          <div
            className="ml-auto flex items-center gap-1"
            data-testid="file-tree-sort-controls"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("sort.label")}
            </span>
            <div className="flex items-center rounded-md border bg-background p-0.5">
              <button
                type="button"
                onClick={() => handleSortModeChange("alphabetical")}
                className={cn(
                  "rounded px-2 py-1 text-xs transition-colors",
                  sortMode === "alphabetical"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={sortMode === "alphabetical"}
                data-testid="file-tree-sort-alphabetical"
              >
                {t("sort.alphabetical")}
              </button>
              <button
                type="button"
                onClick={() => handleSortModeChange("manual")}
                className={cn(
                  "rounded px-2 py-1 text-xs transition-colors",
                  sortMode === "manual"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={sortMode === "manual"}
                data-testid="file-tree-sort-manual"
              >
                {t("sort.manual")}
              </button>
            </div>
          </div>
        </div>

        {/* Tree */}
        <div
          className="flex-1 overflow-y-auto py-1"
          role="tree"
          aria-label="File tree"
        >
          {showPinnedSections && (
            <>
              <div className="mb-1">
                <button
                  type="button"
                  onClick={() => setRecentsExpanded((value) => !value)}
                  aria-expanded={recentsExpanded}
                  aria-controls="file-tree-recents-panel"
                  className="w-full flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Clock3 className="w-3 h-3" />
                  {t("recents.section")}
                </button>
                {recentsExpanded && (
                  <div
                    id="file-tree-recents-panel"
                    data-testid="file-tree-recents-panel"
                  >
                    <PinnedNodesList
                      nodes={recentNodes}
                      emptyMessage={t("recents.empty")}
                      expandedNodes={expandedNodes}
                      selectedNodeId={selectedNodeId}
                      onToggle={toggleNode}
                      onSelect={handleNodeSelect}
                      onContextMenu={onContextMenu}
                      onRename={onRenameNode}
                      onDrop={onMoveNode}
                      filterNodeIds={filterNodeIds}
                      attributionFilter={attributionFilter}
                      onAddToContext={onAddToContext}
                      contextNodeIds={contextNodeIds}
                      onToggleFavorite={onToggleFavorite}
                      selectedNodeIds={selectedNodeIds}
                      onToggleNodeSelected={onToggleNodeSelected}
                      sortMode={sortMode}
                    />
                  </div>
                )}
              </div>

              {/* Favorites pinned section */}
              <button
                type="button"
                onClick={() => setFavoritesExpanded((v) => !v)}
                aria-expanded={favoritesExpanded}
                aria-controls="file-tree-favorites-panel"
                className="w-full flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Star className="w-3 h-3" />
                {t("favorites.section")}
              </button>
              {favoritesExpanded && (
                <div
                  id="file-tree-favorites-panel"
                  data-testid="file-tree-favorites-panel"
                >
                  <PinnedNodesList
                    nodes={
                      (favoritesQuery.data as TreeNode[] | undefined) ?? []
                    }
                    emptyMessage={t("favorites.empty")}
                    expandedNodes={expandedNodes}
                    selectedNodeId={selectedNodeId}
                    onToggle={toggleNode}
                    onSelect={handleNodeSelect}
                    onContextMenu={onContextMenu}
                    onRename={onRenameNode}
                    onDrop={onMoveNode}
                    filterNodeIds={filterNodeIds}
                    attributionFilter={attributionFilter}
                    onAddToContext={onAddToContext}
                    contextNodeIds={contextNodeIds}
                    onToggleFavorite={onToggleFavorite}
                    selectedNodeIds={selectedNodeIds}
                    onToggleNodeSelected={onToggleNodeSelected}
                    sortMode={sortMode}
                  />
                </div>
              )}
              <div
                data-testid="file-tree-pinned-separator"
                className="h-px bg-border mx-2 mt-1 mb-1"
              />
            </>
          )}

          <ChildrenList
            parentId={projectId}
            depth={0}
            expandedNodes={expandedNodes}
            selectedNodeId={selectedNodeId}
            onToggle={toggleNode}
            onSelect={handleNodeSelect}
            onContextMenu={onContextMenu}
            onRename={onRenameNode}
            onDrop={onMoveNode}
            filterNodeIds={filterNodeIds}
            attributionFilter={attributionFilter}
            onAddToContext={onAddToContext}
            contextNodeIds={contextNodeIds}
            onToggleFavorite={onToggleFavorite}
            selectedNodeIds={selectedNodeIds}
            onToggleNodeSelected={onToggleNodeSelected}
            sortMode={sortMode}
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

function PinnedNodesList({
  nodes,
  emptyMessage,
  expandedNodes,
  selectedNodeId,
  onToggle,
  onSelect,
  onContextMenu,
  onRename,
  onDrop,
  filterNodeIds,
  attributionFilter,
  onAddToContext,
  contextNodeIds,
  onToggleFavorite,
  selectedNodeIds,
  onToggleNodeSelected,
  sortMode,
}: {
  nodes: TreeNode[];
  emptyMessage: string;
  expandedNodes: Set<string>;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (node: TreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onRename?: (nodeId: string, newName: string) => void;
  onDrop?: (
    draggedNodeId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => void;
  filterNodeIds?: Set<string> | null;
  attributionFilter?: AttributionFilter;
  onAddToContext?: (node: TreeNode) => void;
  contextNodeIds?: Set<string>;
  onToggleFavorite?: (nodeId: string) => void;
  selectedNodeIds?: Set<string>;
  onToggleNodeSelected?: (nodeId: string) => void;
  sortMode: FileTreeSortMode;
}) {
  if (nodes.length === 0) {
    return (
      <p className="px-4 py-1 text-xs text-muted-foreground/60 italic">
        {emptyMessage}
      </p>
    );
  }

  return nodes.map((node) => (
    <FileTreeNode
      key={node.id}
      node={node}
      depth={0}
      isExpanded={expandedNodes.has(node.id)}
      isSelected={selectedNodeId === node.id}
      isLoading={false}
      onToggle={onToggle}
      onSelect={() => onSelect(node)}
      onContextMenu={onContextMenu}
      onRename={onRename}
      onDrop={onDrop}
      onToggleFavorite={onToggleFavorite}
      onAddToContext={onAddToContext}
      isInContext={contextNodeIds?.has(node.id)}
      isChecked={selectedNodeIds?.has(node.id)}
      onToggleChecked={onToggleNodeSelected}
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
          onAddToContext={onAddToContext}
          contextNodeIds={contextNodeIds}
          onToggleFavorite={onToggleFavorite}
          selectedNodeIds={selectedNodeIds}
          onToggleNodeSelected={onToggleNodeSelected}
          sortMode={sortMode}
        />
      )}
    />
  ));
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
  onAddToContext,
  contextNodeIds,
  onToggleFavorite,
  selectedNodeIds,
  onToggleNodeSelected,
  sortMode,
  emptyMessage,
}: {
  parentId: string;
  depth: number;
  expandedNodes: Set<string>;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (node: TreeNode) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onRename?: (nodeId: string, newName: string) => void;
  onDrop?: (
    draggedNodeId: string,
    targetNodeId: string,
    position: DropPosition,
  ) => void;
  filterNodeIds?: Set<string> | null;
  attributionFilter?: AttributionFilter;
  onAddToContext?: (node: TreeNode) => void;
  contextNodeIds?: Set<string>;
  onToggleFavorite?: (nodeId: string) => void;
  selectedNodeIds?: Set<string>;
  onToggleNodeSelected?: (nodeId: string) => void;
  sortMode: FileTreeSortMode;
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
        filterNodeIds ?? null,
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

  // Sort: folders before files, then by the active sort mode.
  const sortedChildren = [...filteredChildren].sort((a, b) => {
    const aIsContainer = containerTypes.has(a.type);
    const bIsContainer = containerTypes.has(b.type);
    if (aIsContainer !== bIsContainer) return aIsContainer ? -1 : 1;

    const alphabeticalComparison = a.name.localeCompare(b.name, undefined, {
      sensitivity: "base",
    });
    const posA = (a as { position?: number | null }).position ?? 0;
    const posB = (b as { position?: number | null }).position ?? 0;

    if (sortMode === "alphabetical") {
      if (alphabeticalComparison !== 0) return alphabeticalComparison;
      return posA - posB;
    }

    if (posA !== posB) return posA - posB;
    return alphabeticalComparison;
  });

  return (
    <>
      {sortedChildren.map((child) => (
        <FileTreeNode
          key={child.id}
          node={child as TreeNode}
          depth={depth}
          isExpanded={expandedNodes.has(child.id)}
          isSelected={selectedNodeId === child.id}
          isLoading={false}
          onToggle={onToggle}
          onSelect={() => onSelect(child as TreeNode)}
          onContextMenu={onContextMenu}
          onRename={onRename}
          onDrop={onDrop}
          onAddToContext={onAddToContext}
          isInContext={contextNodeIds?.has(child.id)}
          onToggleFavorite={onToggleFavorite}
          isChecked={selectedNodeIds?.has(child.id)}
          onToggleChecked={onToggleNodeSelected}
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
              onAddToContext={onAddToContext}
              contextNodeIds={contextNodeIds}
              onToggleFavorite={onToggleFavorite}
              selectedNodeIds={selectedNodeIds}
              onToggleNodeSelected={onToggleNodeSelected}
              sortMode={sortMode}
            />
          )}
        />
      ))}
    </>
  );
}
