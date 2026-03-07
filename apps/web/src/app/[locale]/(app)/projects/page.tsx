"use client";

import * as React from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  FolderTree,
  Pencil,
  Trash2,
  X,
  Check,
  Download,
  FolderOpen,
  Loader2,
  GripHorizontal,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useToast } from "@/contexts/toast-context";
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
import {
  TiptapEditor,
  ImageUpload,
  LinkPickerDialog,
  type LinkPickerTreeNode,
} from "@/components/editor";
import { TagManager, TagPicker } from "@/components/tags";
import { NodeAttribution } from "@/components/provenance";
import { ChatSidebar } from "@/components/chat";
import { Dialog } from "@/components/dialog";
import { markdownToTipTap, extractImagePaths } from "@/lib/markdown-to-tiptap";
import { rewriteImportedInternalHref } from "@/lib/import-link-rewrite";
import { extractHeroImage, tiptapToMarkdown } from "@/lib/tiptap-utils";
import type { Editor } from "@tiptap/react";

const NOTE_FILE_EXTENSION_REGEX = /\.(md|txt|markdown|mdown|mkd|mdx)$/i;

type ImportHealingNode = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  content?: unknown;
  metadata?: unknown;
};

function normalizeImportSourcePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function joinImportSourcePath(parentPath: string, childPath: string): string {
  const normalizedParentPath = normalizeImportSourcePath(parentPath);
  const normalizedChildPath = normalizeImportSourcePath(childPath);

  if (!normalizedParentPath) {
    return normalizedChildPath;
  }

  if (!normalizedChildPath) {
    return normalizedParentPath;
  }

  return `${normalizedParentPath}/${normalizedChildPath}`;
}

function stripTopLevelImportSegment(path: string): string | null {
  const normalizedPath = normalizeImportSourcePath(path);
  const pathSegments = normalizedPath.split("/");

  if (pathSegments.length <= 1) {
    return null;
  }

  const rootlessPath = pathSegments.slice(1).join("/");
  return rootlessPath || null;
}

function getImportSourcePath(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const importSourcePath = (metadata as Record<string, unknown>)
    .importSourcePath;
  if (typeof importSourcePath !== "string" || !importSourcePath.trim()) {
    return null;
  }

  return normalizeImportSourcePath(importSourcePath);
}

function getNoteFileNameCandidates(node: ImportHealingNode): string[] {
  const fileNameCandidates = new Set<string>();
  const importSourcePath = getImportSourcePath(node.metadata);
  const importSourceBasename = importSourcePath?.split("/").pop();

  if (importSourceBasename) {
    fileNameCandidates.add(importSourceBasename);
  }

  const trimmedNodeName = node.name.trim();
  if (trimmedNodeName) {
    fileNameCandidates.add(
      NOTE_FILE_EXTENSION_REGEX.test(trimmedNodeName)
        ? trimmedNodeName
        : `${trimmedNodeName}.md`,
    );
  }

  return [...fileNameCandidates];
}

function normalizeTiptapContent(
  rawContent: unknown,
): Record<string, unknown> | null {
  if (!rawContent) return null;

  if (typeof rawContent === "string") {
    try {
      const parsedContent = JSON.parse(rawContent) as unknown;
      return parsedContent && typeof parsedContent === "object"
        ? (parsedContent as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof rawContent === "object"
    ? (rawContent as Record<string, unknown>)
    : null;
}

function transformTiptapContent(
  rawContent: unknown,
  transformValue: (key: string, value: unknown) => unknown,
): Record<string, unknown> | null {
  const normalizedContent = normalizeTiptapContent(rawContent);
  if (!normalizedContent) return null;

  return JSON.parse(
    JSON.stringify(normalizedContent, transformValue),
  ) as Record<string, unknown>;
}

function NoteCard({
  node,
  onClick,
}: {
  node: { name: string; content: unknown };
  onClick: () => void;
}) {
  const heroImage = React.useMemo(
    () => extractHeroImage(node.content),
    [node.content],
  );
  const preview = React.useMemo(
    () => tiptapToMarkdown(node.content),
    [node.content],
  );

  return (
    <div
      className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {heroImage && (
        <Image
          src={heroImage}
          alt={node.name}
          width={400}
          height={160}
          className="w-full h-40 object-cover"
          unoptimized
        />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
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
          <span className="font-medium text-sm truncate">{node.name}</span>
        </div>
        {preview && (
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

function FolderCardView({
  nodes,
  onOpenNode,
}: {
  nodes: { id: string; name: string; type: string; content: unknown }[];
  onOpenNode: (nodeId: string) => void;
}) {
  const children = nodes;

  if (children.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        This folder is empty.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div
        className="mx-auto grid w-full max-w-[calc(18rem*4+3rem)] gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]"
        data-testid="folder-card-grid"
      >
        {children.map((node) => (
          <NoteCard
            key={node.id}
            node={node}
            onClick={() => onOpenNode(node.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── End folder card view ──────────────────────────────────────────────────────

/** Chunk size for chunked btoa binary conversion (avoids call stack overflow) */
const BASE64_CHUNK_SIZE = 8192;
//** 7 days in seconds — MinIO max allowed presigned URL expiry */
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

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

  const router = useRouter();

  // Current project selection
  const { currentProjectId, setCurrentProject } = useCurrentProject();

  // File tree state
  const fileTreeRef = React.useRef<FileTreeHandle>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(
    () => searchParams?.get("node") ?? null,
  );

  // Sync selectedNodeId when the URL ?node= param changes — e.g. the user clicks
  // a node link in the chat sidebar while already on the projects page.
  const nodeParam = searchParams?.get("node") ?? null;
  React.useEffect(() => {
    if (nodeParam !== selectedNodeId) {
      setSelectedNodeId(nodeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeParam]);

  // Chat context nodes — files/folders the user has pinned to add to LLM context
  const [chatContextNodes, setChatContextNodes] = React.useState<
    { id: string; name: string; type: string }[]
  >([]);
  const chatContextNodeIds = React.useMemo(
    () => new Set(chatContextNodes.map((n) => n.id)),
    [chatContextNodes],
  );

  const handleAddToContext = React.useCallback(
    (node: { id: string; name: string; type: string }) => {
      setChatContextNodes((prev) => {
        if (prev.some((n) => n.id === node.id)) {
          // Toggle off if already in context
          return prev.filter((n) => n.id !== node.id);
        }
        return [...prev, { id: node.id, name: node.name, type: node.type }];
      });
    },
    [],
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
  // Saved selection range — captured before the link picker dialog steals focus
  const savedSelectionRef = React.useRef<{ from: number; to: number } | null>(
    null,
  );
  const [showImageUpload, setShowImageUpload] = React.useState(false);
  const [imagePickerTab, setImagePickerTab] = React.useState<
    "upload" | "existing"
  >("upload");
  const [showLinkPicker, setShowLinkPicker] = React.useState(false);
  const [linkPickerSearch, setLinkPickerSearch] = React.useState("");
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const exportMenuRef = React.useRef<HTMLDivElement>(null);

  // Tag panel resize/collapse state — persisted in localStorage
  const TAG_PANEL_HEIGHT_KEY = "arbor:tagPanelHeight";
  const TAG_PANEL_COLLAPSED_KEY = "arbor:tagPanelCollapsed";
  const TAG_PANEL_MIN = 80;
  const TAG_PANEL_MAX = 600;
  const TAG_PANEL_DEFAULT = 200;
  const [tagPanelCollapsed, setTagPanelCollapsed] = React.useState<boolean>(
    () => {
      try {
        return localStorage.getItem(TAG_PANEL_COLLAPSED_KEY) === "true";
      } catch {
        return false;
      }
    },
  );
  const [tagPanelHeight, setTagPanelHeight] = React.useState<number>(() => {
    try {
      return (
        parseInt(localStorage.getItem(TAG_PANEL_HEIGHT_KEY) ?? "", 10) ||
        TAG_PANEL_DEFAULT
      );
    } catch {
      return TAG_PANEL_DEFAULT;
    }
  });
  const tagDragRef = React.useRef<{ startY: number; startH: number } | null>(
    null,
  );

  const handleTagPanelDragStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      tagDragRef.current = { startY: e.clientY, startH: tagPanelHeight };
      const onMove = (ev: MouseEvent) => {
        if (!tagDragRef.current) return;
        const delta = tagDragRef.current.startY - ev.clientY; // drag up = taller
        const next = Math.min(
          TAG_PANEL_MAX,
          Math.max(TAG_PANEL_MIN, tagDragRef.current.startH + delta),
        );
        setTagPanelHeight(next);
      };
      const onUp = (ev: MouseEvent) => {
        if (!tagDragRef.current) return;
        const delta = tagDragRef.current.startY - ev.clientY;
        const next = Math.min(
          TAG_PANEL_MAX,
          Math.max(TAG_PANEL_MIN, tagDragRef.current.startH + delta),
        );
        try {
          localStorage.setItem(TAG_PANEL_HEIGHT_KEY, String(next));
        } catch {
          /* ignore */
        }
        tagDragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [tagPanelHeight],
  );

  const toggleTagPanel = React.useCallback(() => {
    setTagPanelCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(TAG_PANEL_COLLAPSED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const tTags = useTranslations("tags");

  // Tag & attribution filter state
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [tagOperator, setTagOperator] = React.useState<"AND" | "OR">("OR");
  const [attributionFilter, setAttributionFilter] =
    React.useState<AttributionFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Chat sidebar state - persisted in localStorage
  const [chatSidebarOpen, setChatSidebarOpen] = React.useState(() => {
    // Check query parameter first
    if (searchParams?.get("chat") === "open") {
      return true;
    }
    // Then check localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chatSidebarOpen");
      return saved === "true";
    }
    return false;
  });

  // Persist to localStorage when state changes
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chatSidebarOpen", String(chatSidebarOpen));
    }
  }, [chatSidebarOpen]);

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

  const forceList = searchParams?.get("list") === "1";
  const currentProject = projectsQuery.data?.find(
    (project) => project.id === currentProjectId,
  );

  // Fetch children of the selected node when it's a folder
  const selNodeType = (selectedNodeQuery.data as { type?: string } | undefined)
    ?.type;
  const folderChildrenQuery = trpc.nodes.getChildren.useQuery(
    { parentId: selectedNodeId! },
    {
      enabled: !!selectedNodeId && selNodeType === "folder",
      refetchOnWindowFocus: false,
    },
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

  // Fetch all nodes in the current project for the link picker
  const projectDescendantsQuery = trpc.nodes.getDescendants.useQuery(
    { nodeId: currentProjectId! },
    {
      enabled: showLinkPicker && !!currentProjectId,
      refetchOnWindowFocus: false,
    },
  );

  // Fetch existing project images for the image picker (existing tab)
  const projectImagesQuery = trpc.media.getByProject.useQuery(
    { projectId: currentProjectId! },
    {
      enabled:
        showImageUpload && imagePickerTab === "existing" && !!currentProjectId,
      refetchOnWindowFocus: false,
    },
  );

  // Flat list of project nodes sorted into tree order with depth, for the link picker.
  const flatTreeNodes = React.useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allNodes = (projectDescendantsQuery.data ?? []) as any[];
    const result: LinkPickerTreeNode[] = [];
    const addChildren = (parentId: string, depth: number) => {
      allNodes
        .filter((n) => n.parentId === parentId)
        .forEach((n) => {
          result.push({ id: n.id, name: n.name, type: n.type, depth });
          if (n.type === "folder") addChildren(n.id, depth + 1);
        });
    };
    if (currentProjectId) addChildren(currentProjectId, 0);
    return result;
  }, [projectDescendantsQuery.data, currentProjectId]);

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

  // Separate mutation for autosave — does NOT invalidate getById so the editor
  // content prop never changes mid-edit and the cursor never jumps.
  const autoSaveMutation = trpc.nodes.update.useMutation({
    onError: (error) => {
      console.error("Autosave error:", error);
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
        nodeMoveMutation.mutate({
          id: draggedNodeId,
          newParentId: targetNodeId,
        });
      } else {
        const targetNode = utils.nodes.getById.getData({ id: targetNodeId });
        if (targetNode && targetNode.parentId) {
          const siblings =
            utils.nodes.getChildren.getData({
              parentId: targetNode.parentId,
            }) ?? [];
          const targetIndex = siblings.findIndex((s) => s.id === targetNodeId);
          let insertPosition: number;
          if (targetIndex === -1) {
            insertPosition = position === "before" ? 0 : siblings.length;
          } else if (position === "before") {
            insertPosition = targetIndex;
          } else {
            insertPosition = targetIndex + 1;
          }
          nodeMoveMutation.mutate({
            id: draggedNodeId,
            newParentId: targetNode.parentId,
            position: insertPosition,
          });
        }
      }
    },
    [nodeMoveMutation, utils.nodes.getById, utils.nodes.getChildren],
  );

  // Media upload mutation
  const mediaUploadMutation = trpc.media.upload.useMutation();

  // ─── Import from directory ───────────────────────────────────────────
  const mediaUploadForImport = trpc.media.upload.useMutation();
  const updateNodeMutation = trpc.nodes.update.useMutation();

  const importDirectoryMutation = trpc.nodes.importDirectory.useMutation({
    onSuccess: (data) => {
      addToast(
        `Imported ${data.imported} note${data.imported !== 1 ? "s" : ""} and ${data.folders} folder${data.folders !== 1 ? "s" : ""}`,
        "success",
      );
      utils.nodes.getAllProjects.invalidate();
    },
    onError: (err) => {
      addToast(`Import failed: ${err.message}`, "error");
    },
  });
  const importInputRef = React.useRef<HTMLInputElement>(null);

  // webkitdirectory is not a valid React prop, so set it via a callback ref
  const importInputCallbackRef = React.useCallback(
    (el: HTMLInputElement | null) => {
      importInputRef.current = el;
      if (el) {
        el.setAttribute("webkitdirectory", "");
      }
    },
    [],
  );

  // For the "ask for project name" case (loose files without a single root dir)
  const [pendingImportEntries, setPendingImportEntries] = React.useState<
    { path: string; content: unknown }[] | null
  >(null);
  const [pendingImagesByNotePath, setPendingImagesByNotePath] =
    React.useState<Map<string, Map<string, File>> | null>(null);
  const [importProjectName, setImportProjectName] = React.useState("");
  const [pendingImportCreatesProject, setPendingImportCreatesProject] =
    React.useState(false);
  const [queuedImportProjectName, setQueuedImportProjectName] =
    React.useState("");

  const closeCreateDialog = React.useCallback(() => {
    setCreateDialogOpen(false);
    setProjectName("");
  }, []);

  const closeImportNameDialog = React.useCallback(() => {
    setPendingImportEntries(null);
    setPendingImagesByNotePath(null);
    setImportProjectName("");
    setPendingImportCreatesProject(false);
    setQueuedImportProjectName("");
  }, []);

  // After nodes are created, upload images and patch node content
  const uploadImagesAndPatch = React.useCallback(
    async (
      nodeMap: Record<string, string>,
      projectId: string,
      imageFilesByNotePath: Map<string, Map<string, File>>,
    ) => {
      for (const [notePath, imageFiles] of imageFilesByNotePath.entries()) {
        const nodeId = nodeMap[notePath];
        if (!nodeId) continue;
        const srcMap = new Map<string, string>();
        for (const [localPath, file] of imageFiles.entries()) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            // Chunked btoa to avoid call stack overflow for large images
            const bytes = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
              binary += String.fromCharCode(
                ...bytes.subarray(i, i + BASE64_CHUNK_SIZE),
              );
            }
            const base64 = btoa(binary);
            const attachment = await mediaUploadForImport.mutateAsync({
              nodeId,
              projectId,
              filename: file.name,
              mimeType: file.type || "application/octet-stream",
              data: base64,
              createdBy: "user:import",
            });
            // Get a pre-signed Minio URL for the uploaded image
            const { url } = await utils.media.getDownloadUrl.fetch({
              id: attachment.id,
              expirySeconds: SEVEN_DAYS_IN_SECONDS,
            });
            srcMap.set(localPath, url);
          } catch (err) {
            console.error("Image upload failed for", file.name, err);
          }
        }
        if (srcMap.size === 0) continue;
        // Fetch current node content and replace placeholder srcs
        // (the markdownToTipTap call already used the placeholder; patch in the real URLs)
        // We stored the tiptap JSON with local path srcs — need to patch them
        try {
          const node = await utils.nodes.getById.fetch({ id: nodeId });
          if (!node?.content) continue;

          let changed = false;
          const patchedContent = transformTiptapContent(
            node.content,
            (key, value) => {
              if (key === "src" && typeof value === "string") {
                const uploadedImageUrl = srcMap.get(value);
                if (uploadedImageUrl && uploadedImageUrl !== value) {
                  changed = true;
                  return uploadedImageUrl;
                }
              }
              return value;
            },
          );

          if (!changed || !patchedContent) continue;

          await updateNodeMutation.mutateAsync({
            id: nodeId,
            data: { content: patchedContent },
          });
        } catch {
          // Non-fatal
        }
      }
    },
    [
      mediaUploadForImport,
      utils.media.getDownloadUrl,
      updateNodeMutation,
      utils.nodes.getById,
    ],
  );

  // Patch relative imported note links to resolve to internal node IDs
  const patchInternalLinks = React.useCallback(
    async (
      nodeMap: Record<string, string>,
      entries: { path: string; content: unknown }[],
    ) => {
      for (const { path } of entries) {
        const nodeId = nodeMap[path];
        if (!nodeId) continue;
        try {
          const node = await utils.nodes.getById.fetch({ id: nodeId });
          if (!node?.content) continue;

          let changed = false;

          const patchedContent = transformTiptapContent(
            node.content,
            (key, value) => {
              if (key === "href" && typeof value === "string") {
                const rewrittenHref = rewriteImportedInternalHref(
                  value,
                  path,
                  nodeMap,
                );

                if (rewrittenHref !== null && rewrittenHref !== value) {
                  changed = true;
                  // Patch to internal node URL if target exists, otherwise use # to
                  // prevent broken navigation to a raw imported file path.
                  return rewrittenHref;
                }
              }
              return value;
            },
          );

          if (changed && patchedContent) {
            await updateNodeMutation.mutateAsync({
              id: nodeId,
              data: { content: patchedContent },
            });
          }
        } catch {
          // Non-fatal — skip this node
        }
      }
    },
    [utils.nodes.getById, updateNodeMutation],
  );

  const healImportedInternalLinks = React.useCallback(
    async (projectId: string, importedNodeMap: Record<string, string>) => {
      const descendants = (await utils.nodes.getDescendants.fetch({
        nodeId: projectId,
      })) as ImportHealingNode[];
      const nodesById = new Map(
        descendants.map((descendant) => [descendant.id, descendant]),
      );
      const folderAliasesById = new Map<string, string[]>();
      const aliasToNodeIds = new Map<string, Set<string>>();

      const addAlias = (alias: string | null, nodeId: string) => {
        if (!alias) {
          return;
        }

        const normalizedAlias = normalizeImportSourcePath(alias);
        if (!normalizedAlias) {
          return;
        }

        const matchingNodeIds =
          aliasToNodeIds.get(normalizedAlias) ?? new Set();
        matchingNodeIds.add(nodeId);
        aliasToNodeIds.set(normalizedAlias, matchingNodeIds);
      };

      const getFolderAliases = (folderId: string | null): string[] => {
        if (!folderId || folderId === projectId) {
          return [""];
        }

        const cachedAliases = folderAliasesById.get(folderId);
        if (cachedAliases) {
          return cachedAliases;
        }

        const folderNode = nodesById.get(folderId);
        if (!folderNode || folderNode.type !== "folder") {
          return [""];
        }

        const folderAliases = new Set<string>();
        const importSourcePath = getImportSourcePath(folderNode.metadata);

        if (importSourcePath) {
          folderAliases.add(importSourcePath);
          const rootlessFolderPath =
            stripTopLevelImportSegment(importSourcePath);
          if (rootlessFolderPath) {
            folderAliases.add(rootlessFolderPath);
          }
        }

        const trimmedFolderName = folderNode.name.trim();
        if (trimmedFolderName) {
          for (const parentAlias of getFolderAliases(folderNode.parentId)) {
            folderAliases.add(
              joinImportSourcePath(parentAlias, trimmedFolderName),
            );
          }
        }

        const resolvedFolderAliases = [...folderAliases].filter(Boolean);
        folderAliasesById.set(
          folderId,
          resolvedFolderAliases.length > 0 ? resolvedFolderAliases : [""],
        );

        return folderAliasesById.get(folderId) ?? [""];
      };

      const getNotePathCandidates = (node: ImportHealingNode): string[] => {
        const notePathCandidates = new Set<string>();
        const importSourcePath = getImportSourcePath(node.metadata);

        if (importSourcePath) {
          notePathCandidates.add(importSourcePath);
          const rootlessImportSourcePath =
            stripTopLevelImportSegment(importSourcePath);
          if (rootlessImportSourcePath) {
            notePathCandidates.add(rootlessImportSourcePath);
          }
        }

        const fileNameCandidates = getNoteFileNameCandidates(node);
        for (const parentAlias of getFolderAliases(node.parentId)) {
          for (const fileNameCandidate of fileNameCandidates) {
            notePathCandidates.add(
              joinImportSourcePath(parentAlias, fileNameCandidate),
            );
          }
        }

        return [...notePathCandidates].filter(Boolean);
      };

      for (const [nodePath, nodeId] of Object.entries(importedNodeMap)) {
        addAlias(nodePath, nodeId);
      }

      for (const descendant of descendants) {
        if (descendant.type !== "note") {
          continue;
        }

        for (const notePathCandidate of getNotePathCandidates(descendant)) {
          addAlias(notePathCandidate, descendant.id);
        }
      }

      const projectWideNodeMap = Object.fromEntries(
        [...aliasToNodeIds.entries()]
          .filter(([, matchingNodeIds]) => matchingNodeIds.size === 1)
          .map(([alias, matchingNodeIds]) => [
            alias,
            [...matchingNodeIds][0] as string,
          ]),
      );

      for (const descendant of descendants) {
        if (descendant.type !== "note" || !descendant.content) {
          continue;
        }

        const importingNotePathCandidates = getNotePathCandidates(descendant);
        if (importingNotePathCandidates.length === 0) {
          continue;
        }

        let changed = false;
        const patchedContent = transformTiptapContent(
          descendant.content,
          (key, value) => {
            if (key !== "href" || typeof value !== "string") {
              return value;
            }

            for (const importingNotePath of importingNotePathCandidates) {
              const rewrittenHref = rewriteImportedInternalHref(
                value,
                importingNotePath,
                projectWideNodeMap,
              );

              if (rewrittenHref !== null && rewrittenHref !== value) {
                changed = true;
                return rewrittenHref;
              }
            }

            return value;
          },
        );

        if (changed && patchedContent) {
          await updateNodeMutation.mutateAsync({
            id: descendant.id,
            data: { content: patchedContent },
          });
        }
      }
    },
    [updateNodeMutation, utils.nodes.getDescendants],
  );

  const getImportTargetNodeId = React.useCallback(
    (createNewProject = false) => {
      if (createNewProject || !currentProject || forceList) {
        return undefined;
      }

      const selectedNode = selectedNodeQuery.data as
        | { id: string; type: string; parentId: string | null }
        | undefined;

      if (!selectedNode) {
        return currentProject.id;
      }

      if (selectedNode.type === "folder") {
        return selectedNode.id;
      }

      if (selectedNode.type === "note") {
        return selectedNode.parentId ?? currentProject.id;
      }

      return currentProject.id;
    },
    [currentProject, forceList, selectedNodeQuery.data],
  );

  const runImport = React.useCallback(
    async (
      projectName: string,
      entries: { path: string; content: unknown }[],
      imageFilesByNotePath: Map<string, Map<string, File>>,
      options?: { createNewProject?: boolean },
    ) => {
      const importTargetNodeId = getImportTargetNodeId(
        options?.createNewProject ?? false,
      );

      const result = await importDirectoryMutation.mutateAsync({
        projectName,
        parentNodeId: importTargetNodeId,
        files: entries,
      });
      // Patch images first (updates node content with Minio URLs)
      if (imageFilesByNotePath.size > 0) {
        await uploadImagesAndPatch(
          result.nodeMap,
          result.projectId,
          imageFilesByNotePath,
        );
        // Flush the node cache so patchInternalLinks fetches fresh content
        // (otherwise it would overwrite the just-patched image URLs with stale data)
        await utils.nodes.getById.invalidate();
      }
      // Patch internal markdown links to resolve to node IDs
      await patchInternalLinks(result.nodeMap, entries);
      // Flush descendants cache so the healing pass does not rewrite notes from
      // stale content and accidentally clobber already-patched image URLs.
      await utils.nodes.getDescendants.invalidate();
      // Revisit older imported notes now that new targets may exist.
      await healImportedInternalLinks(result.projectId, result.nodeMap);
      // Navigate to the newly imported project so the user can see it
      await setCurrentProject(result.projectId);
      await Promise.all([
        utils.nodes.getAllProjects.invalidate(),
        utils.nodes.getChildren.invalidate(),
        utils.nodes.getById.invalidate(),
        utils.nodes.getDescendants.invalidate(),
      ]);
      router.push("/projects");
    },
    [
      getImportTargetNodeId,
      healImportedInternalLinks,
      importDirectoryMutation,
      uploadImagesAndPatch,
      patchInternalLinks,
      setCurrentProject,
      utils.nodes.getAllProjects,
      utils.nodes.getChildren,
      utils.nodes.getById,
      utils.nodes.getDescendants,
      router,
    ],
  );

  const handleImportDirectory = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const allFiles = Array.from(e.target.files ?? []);
      const createNewProject =
        e.currentTarget.dataset.importMode === "new-project";
      const preferredProjectName = queuedImportProjectName.trim();
      setQueuedImportProjectName("");
      e.target.value = "";
      if (allFiles.length === 0) return;

      const IMAGE_EXTS = /\.(png|jpg|jpeg|gif|webp|svg)$/i;
      const MARKDOWN_EXTS = /\.(md|txt|markdown|mdown|mkd|mdx)$/i;

      // Index all image files by full relative path and by filename (for references)
      const imageFilesByPath = new Map<string, File>(); // localPath/filename → File
      for (const file of allFiles) {
        const f = file as File & { webkitRelativePath: string };
        if (!f.name.startsWith(".") && IMAGE_EXTS.test(f.name)) {
          const path = f.webkitRelativePath || f.name;
          imageFilesByPath.set(path, file);
          imageFilesByPath.set(f.name, file); // alias for relative references
        }
      }

      // Parse markdown/text files → TipTap JSON, track referenced images
      const entries: { path: string; content: unknown }[] = [];
      const imageFilesByNotePath = new Map<string, Map<string, File>>(); // notePath → (imgLocalPath → File)
      const referencedImages = new Set<File>();

      for (const file of allFiles) {
        const f = file as File & { webkitRelativePath: string };
        if (!MARKDOWN_EXTS.test(f.name) || f.name.startsWith(".")) continue;
        const path = f.webkitRelativePath || f.name;
        const rawText = await file.text();
        const tiptapContent = markdownToTipTap(rawText);

        // Track which images this note references
        const imgPaths = extractImagePaths(rawText);
        if (imgPaths.length > 0) {
          const noteImgMap = new Map<string, File>();
          for (const imgPath of imgPaths) {
            const noteDir = path.split("/").slice(0, -1).join("/");
            const candidates = [
              imgPath,
              `${noteDir}/${imgPath}`,
              imgPath.split("/").pop() ?? imgPath,
            ];
            for (const candidate of candidates) {
              if (imageFilesByPath.has(candidate)) {
                const imgFile = imageFilesByPath.get(candidate)!;
                noteImgMap.set(imgPath, imgFile);
                referencedImages.add(imgFile);
                break;
              }
            }
          }
          if (noteImgMap.size > 0) imageFilesByNotePath.set(path, noteImgMap);
        }

        entries.push({ path, content: tiptapContent });
      }

      // Create standalone image notes for ALL images so the folder structure appears in the
      // project tree. Referenced images will also be patched inline into their parent notes.
      const processedImages = new Set<File>();
      for (const file of allFiles) {
        const f = file as File & { webkitRelativePath: string };
        if (!IMAGE_EXTS.test(f.name) || f.name.startsWith(".")) continue;
        if (processedImages.has(file)) continue;
        processedImages.add(file);

        const imgPath = f.webkitRelativePath || f.name;
        const imgName = f.name.replace(IMAGE_EXTS, "");
        // Use .md extension so the API router accepts the entry as a note
        const syntheticPath = imgPath.replace(IMAGE_EXTS, ".md");
        const content = {
          type: "doc",
          content: [
            {
              type: "image",
              attrs: { src: imgPath, alt: imgName, title: null },
            },
          ],
        };
        entries.push({ path: syntheticPath, content });
        imageFilesByNotePath.set(syntheticPath, new Map([[imgPath, file]]));
      }

      if (entries.length === 0) {
        const exts = [
          ...new Set(
            allFiles.map((f) =>
              f.name.includes(".")
                ? f.name.split(".").pop()!.toLowerCase()
                : "(no ext)",
            ),
          ),
        ]
          .slice(0, 10)
          .join(", ");
        addToast(
          allFiles.length === 0
            ? "No files were received from the browser. Try selecting the folder again."
            : `No supported files found among ${allFiles.length} files (extensions: ${exts || "none"}). Supported: .md, .txt, .png, .jpg, .jpeg, .gif, .webp, .svg`,
          "error",
        );
        return;
      }

      const roots = new Set(
        entries.map((f) => (f.path as string).split("/")[0]),
      );
      if (roots.size === 1) {
        const rootDirectoryName = [...roots][0];
        const projectName = preferredProjectName || rootDirectoryName;
        await runImport(projectName, entries, imageFilesByNotePath, {
          createNewProject,
        });
      } else {
        setPendingImportEntries(entries);
        setPendingImagesByNotePath(imageFilesByNotePath);
        setImportProjectName(preferredProjectName);
        setPendingImportCreatesProject(createNewProject);
      }
    },
    [addToast, queuedImportProjectName, runImport],
  );

  const handleImportWithName = React.useCallback(() => {
    if (!pendingImportEntries || !importProjectName.trim()) return;
    void runImport(
      importProjectName.trim(),
      pendingImportEntries,
      pendingImagesByNotePath ?? new Map(),
      { createNewProject: pendingImportCreatesProject },
    );
    closeImportNameDialog();
  }, [
    closeImportNameDialog,
    runImport,
    pendingImportEntries,
    pendingImportCreatesProject,
    importProjectName,
    pendingImagesByNotePath,
  ]);

  const handleImageUpload = React.useCallback(
    async (params: {
      nodeId: string;
      projectId: string;
      filename: string;
      mimeType: string;
      data: string;
    }): Promise<{ id: string }> => {
      const result = await mediaUploadMutation.mutateAsync(params);
      return { id: result.id ?? "" };
    },
    [mediaUploadMutation],
  );

  const handleGetDownloadUrl = React.useCallback(
    async (params: { id: string }) => {
      return await utils.media.getDownloadUrl.fetch(params);
    },
    [utils.media.getDownloadUrl],
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

  // Handle link clicks from TipTap editor — navigate in the current window, never new tab
  const handleEditorLinkClick = React.useCallback(
    async (href: string) => {
      // Handle full URLs that may point to this app (e.g. http://app.arbor.local/projects?node=uuid)
      try {
        const url = new URL(href, window.location.href);
        const nodeId = url.searchParams.get("node");
        if (nodeId) {
          router.push(`/projects?node=${nodeId}`);
          return;
        }
        if (url.origin === window.location.origin) {
          router.push(url.pathname + url.search);
          return;
        }

        // Handle LLM-generated arbor internal URLs like https://arbor/path/to/node-name.
        // Try to resolve each path segment from most-specific to least.
        if (url.hostname === "arbor" || url.hostname.endsWith(".arbor")) {
          const segments = url.pathname.split("/").filter(Boolean);
          for (let i = segments.length - 1; i >= 0; i--) {
            const rawSeg = segments[i];
            // Convert underscores/hyphens to spaces for name matching
            const nameCandidates = [
              rawSeg,
              rawSeg.replace(/_/g, " "),
              rawSeg.replace(/-/g, " "),
            ];
            for (const candidate of nameCandidates) {
              try {
                const results = await utils.search.keywordSearch.fetch({
                  query: candidate,
                  filters: {},
                  options: { limit: 5 },
                });
                const match = results.find(
                  (r: { node: { name: string } }) =>
                    r.node.name === candidate ||
                    r.node.name.replace(/\s/g, "_") === rawSeg,
                );
                if (match) {
                  router.push(`/projects?node=${match.node.id}`);
                  return;
                }
              } catch {
                /* ignore search errors */
              }
            }
          }
          return; // arbor URL but no match found — don't navigate externally
        }
      } catch {
        /* not a URL */
      }
      if (href.startsWith("?") || href.startsWith("/")) {
        router.push(href.startsWith("?") ? `/projects${href}` : href);
        return;
      }
      window.location.href = href;
    },
    [router, utils],
  );

  const closeLinkPicker = React.useCallback(() => {
    setShowLinkPicker(false);
    setLinkPickerSearch("");
  }, []);

  const insertLinkIntoEditor = React.useCallback(
    (href: string) => {
      const editor = editorInstanceRef.current;

      if (editor) {
        const savedSelection = savedSelectionRef.current;
        const linkChain = editor.chain().focus();
        if (savedSelection) {
          linkChain.setTextSelection(savedSelection);
        }
        linkChain.setLink({ href }).run();
      }

      savedSelectionRef.current = null;
      closeLinkPicker();
    },
    [closeLinkPicker],
  );

  const handleCustomLinkInsert = React.useCallback(
    (value: string) => {
      const normalizedHref = value.startsWith("http")
        ? value
        : `https://${value}`;
      insertLinkIntoEditor(normalizedHref);
    },
    [insertLinkIntoEditor],
  );

  const handleLinkPickerNodeSelect = React.useCallback(
    (nodeId: string) => {
      insertLinkIntoEditor(`?node=${nodeId}`);
    },
    [insertLinkIntoEditor],
  );

  const handleOpenLinkPicker = React.useCallback(() => {
    const editor = editorInstanceRef.current;
    if (editor) {
      const { from, to } = editor.state.selection;
      savedSelectionRef.current = { from, to };
    }
    setLinkPickerSearch("");
    setShowLinkPicker(true);
  }, []);

  const linkPickerDialog = (
    <LinkPickerDialog
      open={showLinkPicker}
      isLoading={projectDescendantsQuery.isLoading}
      searchValue={linkPickerSearch}
      nodes={flatTreeNodes}
      onClose={closeLinkPicker}
      onSearchChange={setLinkPickerSearch}
      onInsertCustomUrl={handleCustomLinkInsert}
      onSelectNode={handleLinkPickerNodeSelect}
    />
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
      await autoSaveMutation.mutateAsync({
        id: nodeId,
        data: { content },
      });
    },
    [autoSaveMutation],
  );

  const { status: autoSaveStatus } = useAutoSave({
    nodeId: selectedNodeId,
    content: editorContent,
    onSave: handleAutoSave,
  });

  // Sync editor content when selected node changes
  React.useEffect(() => {
    if (selectedNodeQuery.data?.type === "note") {
      setEditorContent(normalizeTiptapContent(selectedNodeQuery.data.content));
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

  // === WORKSPACE VIEW (project selected) ===
  if (currentProjectId && currentProject && !forceList) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selNode = selectedNodeQuery.data as any;
    return (
      <>
        {/* Hidden directory import input — rendered in ALL views so the import button always works */}
        <input
          ref={importInputCallbackRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleImportDirectory}
          data-testid="import-directory-input"
        />
        <div className="flex h-full">
          {/* Left panel: File tree */}
          <div className="w-72 border-r flex flex-col bg-card">
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <span className="text-sm font-medium truncate flex-1">
                {currentProject.name}
              </span>
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importDirectoryMutation.isPending}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors disabled:opacity-50"
                title="Import directory of markdown files"
              >
                {importDirectoryMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FolderOpen className="w-3 h-3" />
                )}
              </button>
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
              onAddToContext={chatSidebarOpen ? handleAddToContext : undefined}
              contextNodeIds={chatSidebarOpen ? chatContextNodeIds : undefined}
              className="flex-1 min-h-0"
            />
            <div className="border-t flex flex-col flex-shrink-0">
              {tagPanelCollapsed ? (
                /* Collapsed — slim bar with icon button to reopen, same pattern as ChatSidebar */
                <div className="flex items-center justify-center py-1.5">
                  <button
                    onClick={toggleTagPanel}
                    className="p-1 rounded hover:bg-muted transition-colors"
                    title={tTags("title")}
                  >
                    <FolderTree className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  {/* Drag-handle strip — full-width top edge, same pattern as ChatSidebar */}
                  <div
                    onMouseDown={handleTagPanelDragStart}
                    className="w-full h-5 cursor-ns-resize flex items-center justify-center group"
                  >
                    <GripHorizontal className="w-4 h-3 text-border group-hover:text-muted-foreground transition-colors" />
                  </div>

                  {/* Header — title left, X right, same pattern as ChatSidebar */}
                  <div className="flex items-center justify-between px-3 pb-1.5 border-b shrink-0">
                    <h2 className="text-xs font-semibold">{tTags("title")}</h2>
                    <button
                      onClick={toggleTagPanel}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title={tTags("title")}
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>

                  <div
                    className="overflow-y-auto px-3 py-2"
                    style={{ height: tagPanelHeight }}
                  >
                    <TagManager projectId={currentProjectId ?? undefined} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right panel: Content — flex column so header is pinned, editor scrolls internally */}
          <div className="flex-1 flex flex-col min-h-0">
            {selNode ? (
              <>
                {/* Pinned header: title, actions, tags, attribution */}
                <div className="flex-shrink-0 px-6 pt-5 pb-3 border-b">
                  <div className="flex items-center justify-between mb-3">
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
                          setTitleEditValue(selNode?.name || "");
                          setIsTitleEditing(true);
                        }}
                        data-testid="content-title"
                      >
                        {selNode?.name}
                      </h1>
                    )}
                    <div className="flex items-center gap-2">
                      {selNode?.type === "note" && (
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
                        {tFileTree(`nodeTypes.${selNode?.type}`)}
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
                            node: selNode as TreeNode,
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
                  <div className="mb-2" data-testid="node-tag-picker">
                    <TagPicker
                      nodeId={selNode?.id}
                      projectId={currentProjectId}
                      onNavigateToNode={(nodeId) => setSelectedNodeId(nodeId)}
                    />
                  </div>
                  {selNode?.type === "note" && (
                    <NodeAttribution
                      updatedBy={selNode?.updatedBy}
                      updatedAt={selNode?.updatedAt}
                      createdBy={selNode?.createdBy}
                    />
                  )}
                </div>
                {/* Content area — fills remaining space */}
                {selNode?.type === "note" ? (
                  (() => {
                    const nodeData = selectedNodeQuery.data as {
                      content?: unknown;
                      name?: string;
                    };
                    const parsed = normalizeTiptapContent(nodeData.content);
                    const doc = parsed as {
                      type?: string;
                      content?: {
                        type?: string;
                        attrs?: { src?: string; alt?: string };
                      }[];
                    } | null;
                    const isImageOnly =
                      doc?.type === "doc" &&
                      doc.content?.length === 1 &&
                      doc.content[0].type === "image";
                    if (isImageOnly) {
                      const imgSrc = doc!.content![0].attrs?.src ?? "";
                      const imgAlt =
                        doc!.content![0].attrs?.alt ?? nodeData.name;
                      return (
                        <div className="flex-1 overflow-y-auto p-6">
                          <div className="flex items-center justify-center p-4 bg-muted/20 rounded-md">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgSrc}
                              alt={imgAlt}
                              className="max-w-full max-h-[70vh] object-contain rounded"
                            />
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="flex-1 min-h-0">
                        <TiptapEditor
                          content={parsed}
                          onChange={setEditorContent}
                          editorRef={editorInstanceRef}
                          onInsertImage={() =>
                            setShowImageUpload((prev) => !prev)
                          }
                          onInsertLink={handleOpenLinkPicker}
                          onLinkClick={handleEditorLinkClick}
                        />
                        {/* Image upload/picker modal */}
                        {showImageUpload && currentProjectId && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                            <div
                              className="absolute inset-0"
                              onClick={() => setShowImageUpload(false)}
                            />
                            <div
                              className="relative bg-background rounded-lg shadow-lg w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
                              data-testid="image-upload-modal"
                            >
                              <div className="flex items-center justify-between p-4 border-b">
                                <h2 className="text-sm font-semibold">
                                  Insert image
                                </h2>
                                <button
                                  onClick={() => setShowImageUpload(false)}
                                  className="p-1 rounded hover:bg-accent"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="flex border-b">
                                <button
                                  onClick={() => setImagePickerTab("upload")}
                                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${imagePickerTab === "upload" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                  Upload new
                                </button>
                                <button
                                  onClick={() => setImagePickerTab("existing")}
                                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${imagePickerTab === "existing" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                  Select existing
                                </button>
                              </div>
                              <div className="flex-1 overflow-y-auto p-4">
                                {imagePickerTab === "upload" ? (
                                  <ImageUpload
                                    nodeId={selectedNodeId!}
                                    projectId={currentProjectId}
                                    onUpload={handleImageUpload}
                                    onGetDownloadUrl={handleGetDownloadUrl}
                                    onUploadComplete={handleImageUploadComplete}
                                    onUploadError={handleImageUploadError}
                                    isUploading={mediaUploadMutation.isPending}
                                  />
                                ) : (
                                  <div>
                                    {projectImagesQuery.isLoading ? (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        Loading images...
                                      </p>
                                    ) : (projectImagesQuery.data ?? []).filter(
                                        (a) => a.mimeType.startsWith("image/"),
                                      ).length === 0 ? (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        No images uploaded to this project yet.
                                      </p>
                                    ) : (
                                      <div className="grid grid-cols-3 gap-3">
                                        {(projectImagesQuery.data ?? [])
                                          .filter((a) =>
                                            a.mimeType.startsWith("image/"),
                                          )
                                          .map((attachment) => (
                                            <button
                                              key={attachment.id}
                                              onClick={async () => {
                                                try {
                                                  const { url } =
                                                    await handleGetDownloadUrl({
                                                      id: attachment.id,
                                                    });
                                                  editorInstanceRef.current
                                                    ?.chain()
                                                    .focus()
                                                    .setImage({ src: url })
                                                    .run();
                                                  setShowImageUpload(false);
                                                } catch {
                                                  addToast(
                                                    "Failed to load image",
                                                    "error",
                                                  );
                                                }
                                              }}
                                              className="aspect-square rounded border hover:border-primary overflow-hidden bg-muted/30 flex items-center justify-center transition-colors"
                                              title={attachment.filename}
                                            >
                                              <span className="text-xs text-muted-foreground truncate px-1">
                                                {attachment.filename}
                                              </span>
                                            </button>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : selNode?.type === "folder" ? (
                  <FolderCardView
                    nodes={
                      (folderChildrenQuery.data as {
                        id: string;
                        name: string;
                        type: string;
                        content: unknown;
                      }[]) ?? []
                    }
                    onOpenNode={(nodeId) => setSelectedNodeId(nodeId)}
                  />
                ) : (
                  <div className="flex-1 overflow-y-auto p-6">
                    <p className="text-muted-foreground">
                      Select a note from the tree to view its content.
                    </p>
                  </div>
                )}
              </>
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
              setNodeCreateDialog({
                open: false,
                type: "folder",
                parentId: null,
              })
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
                onClick={() =>
                  setNodeDeleteConfirm({ open: false, node: null })
                }
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
            projectId={currentProjectId}
            projectName={currentProject?.name ?? null}
            contextNodes={chatContextNodes}
            onRemoveContext={(id) =>
              setChatContextNodes((prev) => prev.filter((n) => n.id !== id))
            }
          />
        </div>

        {linkPickerDialog}
      </>
    );
  }

  // === PROJECT LIST VIEW (no project selected) ===
  return (
    <>
      {/* Hidden directory import input — rendered in ALL views so the import button always works */}
      <input
        ref={importInputCallbackRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleImportDirectory}
        data-import-mode="new-project"
        data-testid="import-directory-input"
      />
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
            <p className="text-muted-foreground">{t("description")}</p>
          </div>
          <div className="flex items-center gap-2">
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
                  onClick={async () => {
                    await setCurrentProject(project.id);
                    router.push("/projects");
                  }}
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
                        openDeleteDialog({
                          id: project.id,
                          name: project.name,
                        });
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

        {linkPickerDialog}

        {/* Import — name project dialog (shown when importing loose files without a single root dir) */}
        <Dialog
          open={!!pendingImportEntries}
          onClose={closeImportNameDialog}
          title="Name Your Project"
          maxWidth="sm"
          showFullscreenToggle={false}
          footer={
            <div className="flex justify-end gap-2 p-4">
              <button
                onClick={closeImportNameDialog}
                className="px-4 py-2 text-sm rounded border hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportWithName}
                disabled={
                  !importProjectName.trim() || importDirectoryMutation.isPending
                }
                className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {importDirectoryMutation.isPending ? "Importing…" : "Import"}
              </button>
            </div>
          }
        >
          <div className="px-6 pb-2">
            <p className="text-sm text-muted-foreground mb-4">
              Your files don&apos;t share a single root directory. Enter a name
              for the new project that will hold them.
            </p>
            <input
              autoFocus
              type="text"
              value={importProjectName}
              onChange={(e) => setImportProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleImportWithName();
              }}
              placeholder="Project name"
              className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </Dialog>

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
                    onClick={closeCreateDialog}
                    className="rounded-md p-1 hover:bg-accent transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="project-name"
                      className="text-sm font-medium"
                    >
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
                          closeCreateDialog();
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
                    onClick={closeCreateDialog}
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
                    onClick={() => {
                      setQueuedImportProjectName(projectName.trim());
                      closeCreateDialog();
                      importInputRef.current?.click();
                    }}
                    disabled={importDirectoryMutation.isPending}
                    className={cn(
                      "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                      "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:pointer-events-none disabled:opacity-50",
                      "transition-colors",
                    )}
                  >
                    {importDirectoryMutation.isPending
                      ? t("createDialog.importing")
                      : t("createDialog.importFromFolder")}
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
                      : t("createDialog.createBlank")}
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
    </>
  );
}
