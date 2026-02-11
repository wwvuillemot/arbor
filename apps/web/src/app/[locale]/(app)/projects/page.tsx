"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  FolderTree,
  Pencil,
  Trash2,
  X,
  Check,
  Download,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useAutoSave, type AutoSaveStatus } from "@/hooks/use-auto-save";
import { useToast } from "@/contexts/toast-context";
import { useAppPreferences } from "@/hooks/use-app-preferences";
import {
  FileTree,
  type FileTreeHandle,
  type AttributionFilter,
  CreateNodeDialog,
  RenameDialog,
  NodeContextMenu,
  type TreeNode,
  type ContextMenuAction,
  type DropPosition,
} from "@/components/file-tree";
import { FilterPanel } from "@/components/navigation";
import { TiptapEditor, ImageUpload } from "@/components/editor";
import { TagManager, TagPicker, TagBrowser } from "@/components/tags";
import { NodeAttribution } from "@/components/provenance";
import { ChatSidebar } from "@/components/chat";
import type { Editor } from "@tiptap/react";

export default function ProjectsPage() {
  const utils = trpc.useUtils();
  const t = useTranslations("projects");
  const searchParams = useSearchParams();
  const tFileTree = useTranslations("fileTree");
  const tCommon = useTranslations("common");
  const { addToast } = useToast();

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [projectName, setProjectName] = React.useState("");

  // Current project selection
  const { currentProjectId, setCurrentProject } = useCurrentProject();

  // File tree state
  const fileTreeRef = React.useRef<FileTreeHandle>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(
    null,
  );
  const [nodeCreateDialog, setNodeCreateDialog] = React.useState<{
    open: boolean;
    type: "folder" | "note";
    parentId: string | null;
  }>({ open: false, type: "folder", parentId: null });
  const [renameDialog, setRenameDialog] = React.useState<{
    open: boolean;
    nodeId: string;
    currentName: string;
  }>({ open: false, nodeId: "", currentName: "" });
  const [contextMenu, setContextMenu] = React.useState<{
    open: boolean;
    position: { x: number; y: number };
    node: TreeNode | null;
  }>({ open: false, position: { x: 0, y: 0 }, node: null });
  const [nodeDeleteConfirm, setNodeDeleteConfirm] = React.useState<{
    open: boolean;
    node: TreeNode | null;
  }>({ open: false, node: null });

  // Editor state
  const [editorContent, setEditorContent] = React.useState<Record<
    string,
    unknown
  > | null>(null);
  const tEditor = useTranslations("editor");
  const editorInstanceRef = React.useRef<Editor | null>(null);
  const [showImageUpload, setShowImageUpload] = React.useState(false);
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const exportMenuRef = React.useRef<HTMLDivElement>(null);

  // Sidebar tab state: "manage" = TagManager, "browse" = TagBrowser
  const [sidebarTagTab, setSidebarTagTab] = React.useState<"manage" | "browse">(
    "browse",
  );
  const tTags = useTranslations("tags");

  // Tag & attribution filter state
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [tagOperator, setTagOperator] = React.useState<"AND" | "OR">("OR");
  const [attributionFilter, setAttributionFilter] =
    React.useState<AttributionFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Chat sidebar state - persisted as app preference
  const { getPreference, setPreference } = useAppPreferences();
  const [chatSidebarOpen, setChatSidebarOpen] = React.useState(
    // Check query parameter first, then preference, default to false
    searchParams?.get("chat") === "open" || (getPreference("chatSidebarOpen", false) as boolean),
  );

  // Persist chat sidebar state when it changes
  React.useEffect(() => {
    setPreference("chatSidebarOpen", chatSidebarOpen);
  }, [chatSidebarOpen, setPreference]);

  const handleFilterChange = React.useCallback(
    (tagIds: string[], operator: "AND" | "OR") => {
      setSelectedTagIds(tagIds);
      setTagOperator(operator);
    },
    [],
  );

  // Inline title editing state
  const [isTitleEditing, setIsTitleEditing] = React.useState(false);
  const [titleEditValue, setTitleEditValue] = React.useState("");
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // Queries
  const projectsQuery = trpc.nodes.getAllProjects.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch selected node details (for workspace view)
  const selectedNodeQuery = trpc.nodes.getById.useQuery(
    { id: selectedNodeId! },
    { enabled: !!selectedNodeId, refetchOnWindowFocus: false },
  );

  // Fetch nodes filtered by selected tags (for file tree filtering)
  const filteredNodesQuery = trpc.tags.getNodesByTags.useQuery(
    { tagIds: selectedTagIds, operator: tagOperator },
    { enabled: selectedTagIds.length > 0, refetchOnWindowFocus: false },
  );

  // Fetch nodes matching search query
  const searchResultsQuery = trpc.search.keywordSearch.useQuery(
    {
      query: searchQuery,
      filters: { projectId: currentProjectId ?? undefined },
      options: { limit: 100 },
    },
    {
      enabled: searchQuery.length > 0 && !!currentProjectId,
      refetchOnWindowFocus: false,
    },
  );

  const filterNodeIds = React.useMemo(() => {
    const hasTagFilter = selectedTagIds.length > 0;
    const hasSearchFilter = searchQuery.length > 0;

    // No filters active
    if (!hasTagFilter && !hasSearchFilter) return null;

    // Combine tag and search results
    const tagNodeIds =
      hasTagFilter && filteredNodesQuery.data
        ? new Set(filteredNodesQuery.data.map((n) => n.id))
        : null;
    const searchNodeIds =
      hasSearchFilter && searchResultsQuery.data
        ? new Set(searchResultsQuery.data.map((r) => r.node.id))
        : null;

    // If both filters are active, intersect the results
    if (tagNodeIds && searchNodeIds) {
      const intersection = new Set<string>();
      for (const id of tagNodeIds) {
        if (searchNodeIds.has(id)) intersection.add(id);
      }
      return intersection;
    }

    // Return whichever filter is active
    return tagNodeIds || searchNodeIds || new Set<string>();
  }, [
    selectedTagIds.length,
    filteredNodesQuery.data,
    searchQuery.length,
    searchResultsQuery.data,
  ]);

  // Mutations
  const createMutation = trpc.nodes.create.useMutation({
    onSuccess: async () => {
      await utils.nodes.getAllProjects.refetch();
      addToast(t("createSuccess"), "success");
      setCreateDialogOpen(false);
      setProjectName("");
    },
    onError: (error) => {
      console.error("Error creating project:", error);
      addToast(t("createError"), "error");
    },
  });

  const updateMutation = trpc.nodes.update.useMutation({
    onSuccess: async () => {
      await utils.nodes.getAllProjects.refetch();
      addToast(t("updateSuccess"), "success");
      setEditDialogOpen(false);
      setSelectedProject(null);
      setProjectName("");
    },
    onError: (error) => {
      console.error("Error updating project:", error);
      addToast(t("updateError"), "error");
    },
  });

  const deleteMutation = trpc.nodes.delete.useMutation({
    onSuccess: async () => {
      try {
        // If we deleted the currently selected project, clear the selection
        if (selectedProject && selectedProject.id === currentProjectId) {
          await setCurrentProject(null);
        }
        // Force refetch to update the UI immediately
        await utils.nodes.getAllProjects.refetch();
        addToast(t("deleteSuccess"), "success");
      } catch (error) {
        console.error("Error in delete onSuccess:", error);
        addToast(t("deleteError"), "error");
      } finally {
        // Always close the dialog and clear selection
        setDeleteDialogOpen(false);
        setSelectedProject(null);
      }
    },
    onError: (error) => {
      console.error("Error deleting project:", error);
      addToast(t("deleteError"), "error");
      // Still close the dialog on error
      setDeleteDialogOpen(false);
      setSelectedProject(null);
    },
  });

  const handleCreate = () => {
    if (!projectName.trim()) return;
    createMutation.mutate({
      type: "project",
      name: projectName.trim(),
      parentId: null,
    });
  };

  const handleEdit = () => {
    if (!selectedProject || !projectName.trim()) return;
    updateMutation.mutate({
      id: selectedProject.id,
      data: { name: projectName.trim() },
    });
  };

  const handleDelete = () => {
    if (!selectedProject) return;
    deleteMutation.mutate({ id: selectedProject.id });
  };

  const openEditDialog = (project: { id: string; name: string }) => {
    setSelectedProject(project);
    setProjectName(project.name);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (project: { id: string; name: string }) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  // Node mutations (for file tree)
  const nodeCreateMutation = trpc.nodes.create.useMutation({
    onSuccess: (data) => {
      utils.nodes.getChildren.invalidate();
      // Auto-select the newly created node
      setSelectedNodeId(data.id);
      // Expand the parent folder so the new node is visible
      if (data.parentId) {
        fileTreeRef.current?.expandNode(data.parentId);
      }
      setNodeCreateDialog({ open: false, type: "folder", parentId: null });
    },
    onError: (error) => {
      console.error("Error creating node:", error);
      addToast(tCommon("error"), "error");
    },
  });

  const nodeUpdateMutation = trpc.nodes.update.useMutation({
    onSuccess: () => {
      utils.nodes.getChildren.invalidate();
      utils.nodes.getById.invalidate();
      setRenameDialog({ open: false, nodeId: "", currentName: "" });
    },
    onError: (error) => {
      console.error("Error updating node:", error);
      addToast(tCommon("error"), "error");
    },
  });

  const nodeDeleteMutation = trpc.nodes.delete.useMutation({
    onSuccess: (_, variables) => {
      utils.nodes.getChildren.invalidate();
      if (selectedNodeId === variables.id) {
        setSelectedNodeId(null);
      }
      setNodeDeleteConfirm({ open: false, node: null });
      addToast(tFileTree("deleteSuccess"), "success");
    },
    onError: (error) => {
      console.error("Error deleting node:", error);
      addToast(tCommon("error"), "error");
      setNodeDeleteConfirm({ open: false, node: null });
    },
  });

  // Node move mutation (for drag-and-drop in file tree)
  const nodeMoveMutation = trpc.nodes.move.useMutation({
    onSuccess: () => {
      utils.nodes.getChildren.invalidate();
      addToast(tFileTree("moveSuccess"), "success");
    },
    onError: (error) => {
      console.error("Error moving node:", error);
      addToast(tFileTree("moveError"), "error");
    },
  });

  const handleMoveNode = React.useCallback(
    (draggedNodeId: string, targetNodeId: string, position: DropPosition) => {
      if (position === "inside") {
        // Drop inside a folder: move the node to be a child of the target
        nodeMoveMutation.mutate({
          id: draggedNodeId,
          newParentId: targetNodeId,
        });
      } else {
        // Drop before/after: move to same parent as target, at specific position
        // We need to know the target's parentId - fetch it
        const targetNode = utils.nodes.getById.getData({ id: targetNodeId });
        if (targetNode && targetNode.parentId) {
          nodeMoveMutation.mutate({
            id: draggedNodeId,
            newParentId: targetNode.parentId,
          });
        }
      }
    },
    [nodeMoveMutation, utils.nodes.getById],
  );

  // Media upload mutation
  const mediaUploadMutation = trpc.media.upload.useMutation();
  const mediaGetDownloadUrlMutation = trpc.media.getDownloadUrl.useMutation();

  const handleImageUpload = React.useCallback(
    async (params: {
      nodeId: string;
      projectId: string;
      filename: string;
      mimeType: string;
      data: string;
    }) => {
      return await mediaUploadMutation.mutateAsync(params);
    },
    [mediaUploadMutation],
  );

  const handleGetDownloadUrl = React.useCallback(
    async (params: { id: string }) => {
      return await mediaGetDownloadUrlMutation.mutateAsync(params);
    },
    [mediaGetDownloadUrlMutation],
  );

  const handleImageUploadComplete = React.useCallback(
    (_attachmentId: string, downloadUrl: string) => {
      const editor = editorInstanceRef.current;
      if (editor) {
        editor.chain().focus().setImage({ src: downloadUrl }).run();
      }
      setShowImageUpload(false);
    },
    [],
  );

  const handleImageUploadError = React.useCallback(
    (error: string) => {
      addToast(error, "error");
    },
    [addToast],
  );

  // Close export menu on outside click
  React.useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  // Export handlers
  const handleExportMarkdown = React.useCallback(
    async (includeDescendants: boolean) => {
      if (!selectedNodeId) return;
      try {
        const result = await utils.nodes.exportMarkdown.fetch({
          id: selectedNodeId,
          includeDescendants,
        });
        const blob = new Blob([result.content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${selectedNodeQuery.data?.name || "export"}.md`;
        anchor.click();
        URL.revokeObjectURL(url);
        addToast(tFileTree("exportSuccess"), "success");
      } catch {
        addToast(tFileTree("exportError"), "error");
      }
      setShowExportMenu(false);
    },
    [selectedNodeId, selectedNodeQuery.data?.name, utils, addToast, tFileTree],
  );

  const handleExportPdf = React.useCallback(
    async (includeDescendants: boolean) => {
      if (!selectedNodeId) return;
      try {
        const result = await utils.nodes.exportHtml.fetch({
          id: selectedNodeId,
          includeDescendants,
        });
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(result.content);
          printWindow.document.close();
          printWindow.print();
        }
        addToast(tFileTree("exportSuccess"), "success");
      } catch {
        addToast(tFileTree("exportError"), "error");
      }
      setShowExportMenu(false);
    },
    [selectedNodeId, utils, addToast, tFileTree],
  );

  // Auto-save for editor content
  const handleAutoSave = React.useCallback(
    async (nodeId: string, content: Record<string, unknown>) => {
      await nodeUpdateMutation.mutateAsync({
        id: nodeId,
        data: { content },
      });
    },
    [nodeUpdateMutation],
  );

  const { status: autoSaveStatus } = useAutoSave({
    nodeId: selectedNodeId,
    content: editorContent,
    onSave: handleAutoSave,
  });

  // Sync editor content when selected node changes
  React.useEffect(() => {
    if (selectedNodeQuery.data?.type === "note") {
      setEditorContent(
        (selectedNodeQuery.data.content as Record<string, unknown>) ?? null,
      );
    } else {
      setEditorContent(null);
    }
  }, [selectedNodeQuery.data]);

  // Reset title editing when selected node changes
  React.useEffect(() => {
    setIsTitleEditing(false);
  }, [selectedNodeId]);

  // Focus title input when entering edit mode
  React.useEffect(() => {
    if (isTitleEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isTitleEditing]);

  const handleTitleSave = React.useCallback(() => {
    const trimmed = titleEditValue.trim();
    if (trimmed && trimmed !== selectedNodeQuery.data?.name && selectedNodeId) {
      nodeUpdateMutation.mutate({
        id: selectedNodeId,
        data: { name: trimmed },
      });
    }
    setIsTitleEditing(false);
  }, [
    titleEditValue,
    selectedNodeQuery.data?.name,
    selectedNodeId,
    nodeUpdateMutation,
  ]);

  // Node handlers
  const handleNodeCreate = (
    name: string,
    type: string,
    parentId: string | null,
  ) => {
    nodeCreateMutation.mutate({
      type: type as "folder" | "note",
      name,
      parentId,
    });
  };

  const handleNodeRename = (nodeId: string, newName: string) => {
    nodeUpdateMutation.mutate({ id: nodeId, data: { name: newName } });
  };

  const handleNodeDelete = () => {
    if (!nodeDeleteConfirm.node) return;
    nodeDeleteMutation.mutate({ id: nodeDeleteConfirm.node.id });
  };

  const handleContextMenuAction = (action: ContextMenuAction) => {
    switch (action.type) {
      case "newFolder":
        setNodeCreateDialog({
          open: true,
          type: "folder",
          parentId: action.node.id,
        });
        break;
      case "newNote":
        setNodeCreateDialog({
          open: true,
          type: "note",
          parentId: action.node.id,
        });
        break;
      case "rename":
        setRenameDialog({
          open: true,
          nodeId: action.node.id,
          currentName: action.node.name,
        });
        break;
      case "delete":
        setNodeDeleteConfirm({ open: true, node: action.node });
        break;
    }
  };

  // Current project data
  const currentProject = projectsQuery.data?.find(
    (p) => p.id === currentProjectId,
  );

  // === WORKSPACE VIEW (project selected) ===
  if (currentProjectId && currentProject) {
    return (
      <div className="flex h-full">
        {/* Left panel: File tree */}
        <div className="w-72 border-r flex flex-col bg-card">
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <button
              onClick={() => {
                setCurrentProject(null);
                setSelectedNodeId(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {t("title")}
            </button>
            <span className="text-sm font-medium truncate flex-1">
              {currentProject.name}
            </span>
            <button
              onClick={() =>
                openEditDialog({
                  id: currentProject.id,
                  name: currentProject.name,
                })
              }
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
              title={tCommon("edit")}
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
          {/* Unified filter panel */}
          <div className="border-b">
            <FilterPanel
              onSearchChange={setSearchQuery}
              onTagsChange={(tagIds, operator) => {
                setSelectedTagIds(tagIds);
                setTagOperator(operator);
              }}
              onAttributionChange={setAttributionFilter}
            />
          </div>
          <FileTree
            ref={fileTreeRef}
            projectId={currentProjectId}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onContextMenu={(e, node) =>
              setContextMenu({
                open: true,
                position: { x: e.clientX, y: e.clientY },
                node,
              })
            }
            onCreateFolder={(parentId) =>
              setNodeCreateDialog({ open: true, type: "folder", parentId })
            }
            onCreateNote={(parentId) =>
              setNodeCreateDialog({ open: true, type: "note", parentId })
            }
            onRenameNode={handleNodeRename}
            onMoveNode={handleMoveNode}
            filterNodeIds={filterNodeIds}
            attributionFilter={attributionFilter}
            className="flex-1 min-h-0"
          />
          <div className="border-t flex flex-col">
            <div className="flex border-b" data-testid="sidebar-tag-tabs">
              <button
                onClick={() => setSidebarTagTab("browse")}
                className={cn(
                  "flex-1 px-2 py-1.5 text-xs font-medium transition-colors",
                  sidebarTagTab === "browse"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="sidebar-tab-browse"
              >
                {tTags("browser.browse")}
              </button>
              <button
                onClick={() => setSidebarTagTab("manage")}
                className={cn(
                  "flex-1 px-2 py-1.5 text-xs font-medium transition-colors",
                  sidebarTagTab === "manage"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid="sidebar-tab-manage"
              >
                {tTags("title")}
              </button>
            </div>
            <div className="px-3 py-2 overflow-y-auto max-h-64">
              {sidebarTagTab === "browse" ? (
                <TagBrowser
                  onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
                />
              ) : (
                <TagManager />
              )}
            </div>
          </div>
        </div>

        {/* Right panel: Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedNodeQuery.data ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                {isTitleEditing ? (
                  <input
                    ref={titleInputRef}
                    value={titleEditValue}
                    onChange={(e) => setTitleEditValue(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleTitleSave();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setIsTitleEditing(false);
                      }
                    }}
                    className="text-2xl font-bold bg-transparent outline-none border-b-2 border-accent w-full"
                    data-testid="title-inline-edit"
                  />
                ) : (
                  <h1
                    className="text-2xl font-bold cursor-pointer"
                    onDoubleClick={() => {
                      setTitleEditValue(selectedNodeQuery.data?.name || "");
                      setIsTitleEditing(true);
                    }}
                    data-testid="content-title"
                  >
                    {selectedNodeQuery.data.name}
                  </h1>
                )}
                <div className="flex items-center gap-2">
                  {selectedNodeQuery.data.type === "note" && (
                    <span
                      className={cn(
                        "text-xs px-2 py-1 rounded",
                        autoSaveStatus === "saving" &&
                        "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30",
                        autoSaveStatus === "saved" &&
                        "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
                        autoSaveStatus === "error" &&
                        "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
                        autoSaveStatus === "idle" && "hidden",
                      )}
                      data-testid="auto-save-status"
                    >
                      {autoSaveStatus === "saving" && tEditor("saving")}
                      {autoSaveStatus === "saved" && tEditor("saved")}
                      {autoSaveStatus === "error" && tEditor("saveFailed")}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground px-2 py-1 rounded bg-muted">
                    {tFileTree(`nodeTypes.${selectedNodeQuery.data.type}`)}
                  </span>
                  <div className="relative" ref={exportMenuRef}>
                    <button
                      onClick={() => setShowExportMenu((prev) => !prev)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
                      title={tFileTree("export")}
                      aria-label={tFileTree("export")}
                      data-testid="content-export-button"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {showExportMenu && (
                      <div
                        className="absolute right-0 top-full mt-1 w-56 rounded-md border bg-popover text-popover-foreground shadow-md z-50"
                        data-testid="export-menu"
                      >
                        <button
                          onClick={() => handleExportMarkdown(false)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors rounded-t-md"
                          data-testid="export-markdown"
                        >
                          {tFileTree("exportMarkdown")}
                        </button>
                        <button
                          onClick={() => handleExportMarkdown(true)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          data-testid="export-project-markdown"
                        >
                          {tFileTree("exportProject")}
                        </button>
                        <hr className="border-border" />
                        <button
                          onClick={() => handleExportPdf(false)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                          data-testid="export-pdf"
                        >
                          {tFileTree("exportPdf")}
                        </button>
                        <button
                          onClick={() => handleExportPdf(true)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors rounded-b-md"
                          data-testid="export-project-pdf"
                        >
                          {tFileTree("exportProjectPdf")}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setNodeDeleteConfirm({
                        open: true,
                        node: selectedNodeQuery.data as TreeNode,
                      })
                    }
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title={tCommon("delete")}
                    aria-label={tCommon("delete")}
                    data-testid="content-delete-button"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mb-4" data-testid="node-tag-picker">
                <TagPicker
                  nodeId={selectedNodeQuery.data.id}
                  projectId={currentProjectId}
                  onNavigateToNode={(nodeId) => setSelectedNodeId(nodeId)}
                />
              </div>
              {selectedNodeQuery.data.type === "note" ? (
                <>
                  <NodeAttribution
                    updatedBy={
                      (selectedNodeQuery.data as { updatedBy?: string })
                        .updatedBy
                    }
                    updatedAt={selectedNodeQuery.data.updatedAt}
                    createdBy={
                      (selectedNodeQuery.data as { createdBy?: string })
                        .createdBy
                    }
                  />
                  <TiptapEditor
                    content={
                      (selectedNodeQuery.data.content as Record<
                        string,
                        unknown
                      >) ?? null
                    }
                    onChange={setEditorContent}
                    editorRef={editorInstanceRef}
                    onInsertImage={() => setShowImageUpload((prev) => !prev)}
                  />
                  {showImageUpload && currentProjectId && (
                    <div className="mt-4" data-testid="image-upload-section">
                      <ImageUpload
                        nodeId={selectedNodeQuery.data.id}
                        projectId={currentProjectId}
                        onUpload={handleImageUpload}
                        onGetDownloadUrl={handleGetDownloadUrl}
                        onUploadComplete={handleImageUploadComplete}
                        onUploadError={handleImageUploadError}
                        isUploading={mediaUploadMutation.isPending}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">
                  Select a note from the tree to view its content.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a node from the tree to view its details.
            </div>
          )}
        </div>

        {/* File tree dialogs */}
        <CreateNodeDialog
          open={nodeCreateDialog.open}
          nodeType={nodeCreateDialog.type}
          parentId={nodeCreateDialog.parentId}
          isCreating={nodeCreateMutation.isPending}
          onClose={() =>
            setNodeCreateDialog({ open: false, type: "folder", parentId: null })
          }
          onCreate={handleNodeCreate}
        />
        <RenameDialog
          open={renameDialog.open}
          currentName={renameDialog.currentName}
          nodeId={renameDialog.nodeId}
          isSaving={nodeUpdateMutation.isPending}
          onClose={() =>
            setRenameDialog({ open: false, nodeId: "", currentName: "" })
          }
          onRename={handleNodeRename}
        />
        <NodeContextMenu
          open={contextMenu.open}
          position={contextMenu.position}
          node={contextMenu.node}
          onClose={() =>
            setContextMenu({
              open: false,
              position: { x: 0, y: 0 },
              node: null,
            })
          }
          onAction={handleContextMenuAction}
        />

        {/* Node delete confirmation */}
        {nodeDeleteConfirm.open && nodeDeleteConfirm.node && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setNodeDeleteConfirm({ open: false, node: null })}
            />
            <div
              role="alertdialog"
              aria-modal="true"
              className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
            >
              <h2 className="text-lg font-semibold">{tFileTree("delete")}</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {tFileTree("confirmDelete", {
                  name: nodeDeleteConfirm.node.name,
                })}
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() =>
                    setNodeDeleteConfirm({ open: false, node: null })
                  }
                  className="rounded-md px-4 py-2 text-sm border hover:bg-accent transition-colors"
                  disabled={nodeDeleteMutation.isPending}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleNodeDelete}
                  disabled={nodeDeleteMutation.isPending}
                  className="rounded-md bg-destructive text-destructive-foreground px-4 py-2 text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {tFileTree("delete")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project edit dialog (reused in workspace view) */}
        {editDialogOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
              <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("editDialog.title")}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("editDialog.description")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditDialogOpen(false);
                      setSelectedProject(null);
                      setProjectName("");
                    }}
                    className="rounded-md p-1 hover:bg-accent transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="edit-project-name"
                      className="text-sm font-medium"
                    >
                      {t("editDialog.name")}
                    </label>
                    <input
                      id="edit-project-name"
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEdit();
                        if (e.key === "Escape") {
                          setEditDialogOpen(false);
                          setSelectedProject(null);
                          setProjectName("");
                        }
                      }}
                      className={cn(
                        "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "placeholder:text-muted-foreground",
                      )}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
                  <button
                    onClick={() => {
                      setEditDialogOpen(false);
                      setSelectedProject(null);
                      setProjectName("");
                    }}
                    className={cn(
                      "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                      "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "transition-colors",
                    )}
                  >
                    {tCommon("cancel")}
                  </button>
                  <button
                    onClick={handleEdit}
                    disabled={!projectName.trim() || updateMutation.isPending}
                    className={cn(
                      "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:pointer-events-none disabled:opacity-50",
                      "transition-colors",
                    )}
                  >
                    {updateMutation.isPending
                      ? t("editDialog.saving")
                      : t("editDialog.save")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat sidebar - slides in from right, pushes content left */}
        <ChatSidebar
          isOpen={chatSidebarOpen}
          onToggle={() => setChatSidebarOpen((prev) => !prev)}
        />
      </div>
    );
  }

  // === PROJECT LIST VIEW (no project selected) ===
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <button
          onClick={() => setCreateDialogOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "transition-colors",
          )}
        >
          <Plus className="h-4 w-4" />
          {t("createProject")}
        </button>
      </div>

      {/* Projects Grid */}
      {projectsQuery.isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          {tCommon("loading")}
        </div>
      ) : projectsQuery.error ? (
        <div className="text-center py-12 text-destructive">
          {tCommon("error")}: {projectsQuery.error.message}
        </div>
      ) : projectsQuery.data && projectsQuery.data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectsQuery.data.map((project) => {
            const isSelected = currentProjectId === project.id;
            return (
              <div
                key={project.id}
                onClick={() => setCurrentProject(project.id)}
                className={cn(
                  "group relative rounded-lg border bg-card p-6 hover:shadow-md transition-shadow cursor-pointer",
                  isSelected &&
                  "border-green-500 bg-green-50 dark:bg-green-950",
                )}
              >
                {/* Checkmark in upper-right corner */}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <div className="rounded-full bg-green-500 p-1">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FolderTree className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-lg truncate">
                        {project.name}
                      </h3>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog({ id: project.id, name: project.name });
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium",
                      "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "transition-colors",
                    )}
                  >
                    <Pencil className="h-3 w-3" />
                    {tCommon("edit")}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog({ id: project.id, name: project.name });
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium",
                      "border border-input bg-background hover:bg-destructive hover:text-destructive-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "transition-colors",
                    )}
                  >
                    <Trash2 className="h-3 w-3" />
                    {tCommon("delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <FolderTree className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t("noProjects")}</h3>
          <p className="text-muted-foreground mb-4">
            {t("noProjectsDescription")}
          </p>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "transition-colors",
            )}
          >
            <Plus className="h-4 w-4" />
            {t("createProject")}
          </button>
        </div>
      )}

      {/* Create Dialog */}
      {createDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
            <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {t("createDialog.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("createDialog.description")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCreateDialogOpen(false);
                    setProjectName("");
                  }}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="project-name" className="text-sm font-medium">
                    {t("createDialog.name")}
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    placeholder={t("createDialog.namePlaceholder")}
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") {
                        setCreateDialogOpen(false);
                        setProjectName("");
                      }
                    }}
                    className={cn(
                      "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "placeholder:text-muted-foreground",
                    )}
                    autoFocus
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
                <button
                  onClick={() => {
                    setCreateDialogOpen(false);
                    setProjectName("");
                  }}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "transition-colors",
                  )}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!projectName.trim() || createMutation.isPending}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "transition-colors",
                  )}
                >
                  {createMutation.isPending
                    ? t("createDialog.creating")
                    : t("createDialog.create")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
            <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {t("editDialog.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("editDialog.description")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditDialogOpen(false);
                    setSelectedProject(null);
                    setProjectName("");
                  }}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="edit-project-name"
                    className="text-sm font-medium"
                  >
                    {t("editDialog.name")}
                  </label>
                  <input
                    id="edit-project-name"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEdit();
                      if (e.key === "Escape") {
                        setEditDialogOpen(false);
                        setSelectedProject(null);
                        setProjectName("");
                      }
                    }}
                    className={cn(
                      "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "placeholder:text-muted-foreground",
                    )}
                    autoFocus
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
                <button
                  onClick={() => {
                    setEditDialogOpen(false);
                    setSelectedProject(null);
                    setProjectName("");
                  }}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "transition-colors",
                  )}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleEdit}
                  disabled={!projectName.trim() || updateMutation.isPending}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "transition-colors",
                  )}
                >
                  {updateMutation.isPending
                    ? t("editDialog.saving")
                    : t("editDialog.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
            <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {t("deleteDialog.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("deleteDialog.description")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setSelectedProject(null);
                  }}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
                <button
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setSelectedProject(null);
                  }}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "transition-colors",
                  )}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "transition-colors",
                  )}
                >
                  {deleteMutation.isPending
                    ? t("deleteDialog.deleting")
                    : t("deleteDialog.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
