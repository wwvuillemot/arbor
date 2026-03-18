"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  FolderTree,
  History,
  Lock,
  Pencil,
  Trash2,
  X,
  Check,
  Download,
  FolderOpen,
  Loader2,
  GripHorizontal,
  Settings,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useAppPreferences } from "@/hooks/use-app-preferences";
import { useCurrentProject } from "@/hooks/use-current-project";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useToast } from "@/contexts/toast-context";
import {
  FileTree,
  type FileTreeHandle,
  type AttributionFilter,
  type FileTreeSortMode,
  CreateNodeDialog,
  RenameDialog,
  NodeContextMenu,
  BulkTagBar,
  type TreeNode,
  type ContextMenuAction,
  type DropPosition,
} from "@/components/file-tree";
import { FilterPanel } from "@/components/navigation";
import {
  TiptapEditor,
  ImageUpload,
  LinkPickerDialog,
} from "@/components/editor";
import { TagManager, TagPicker } from "@/components/tags";
import { NodeAttribution, VersionHistory } from "@/components/provenance";
import { ChatSidebar } from "@/components/chat";
import { Dialog } from "@/components/dialog";
import { getMediaAttachmentUrl } from "@/lib/media-url";
import { MediaPickerGrid } from "@/components/media-picker-grid";
import { downloadBinaryFile, downloadTextFile } from "@/lib/browser-export";
import { HeroGradient } from "@/components/hero-gradient";
import { NoteCard } from "@/components/note-card";
import {
  buildFlatLinkPickerTreeNodes,
  deriveEditorLinkNavigationTarget,
  deriveFilteredNodeIds,
  deriveImportTargetNodeId,
  deriveNodeMoveMutationInput,
  normalizeTiptapContent,
  resolveArborEditorLinkTargetNodeId,
  type LinkPickerSourceNode,
} from "./projects-page-helpers";
import {
  type PdfTemplateId,
  runProjectDocxExport,
  runProjectEpubExport,
  runProjectMarkdownExport,
  runProjectPdfExport,
  runProjectZipExport,
} from "./projects-export-workflow";
import { CreateProjectDialog } from "./projects-create-dialog";
import {
  applyPreparedImportDirectoryOutcome,
  prepareImportDirectoryWorkflow,
  type PendingImportDirectoryRequest,
} from "./projects-import-directory";
import {
  healImportedProjectInternalLinks,
  patchImportedNodeInternalLinks,
  uploadImportedImagesAndPatchNodes,
} from "./projects-import-side-effects";
import { runProjectImportWorkflow } from "./projects-import-workflow";
import {
  ProjectSettingsDialog,
  type ProjectSettingsNode,
} from "@/app/[locale]/(app)/projects/project-settings-dialog";
import type { Editor } from "@tiptap/react";

type ChatContextNode = {
  id: string;
  name: string;
  type: string;
};

type ExportNameOptions = {
  includeFolderNames: boolean;
  includeNoteNames: boolean;
};

function normalizeSettingsMetadata(metadata: unknown): Record<string, unknown> {
  return (metadata as Record<string, unknown> | null) ?? {};
}

function createProjectSettingsNode(project: {
  id: string;
  name: string;
  summary?: string | null;
  metadata?: unknown;
}): ProjectSettingsNode {
  return {
    id: project.id,
    name: project.name,
    type: "project",
    projectId: project.id,
    summary: project.summary ?? null,
    metadata: normalizeSettingsMetadata(project.metadata),
  };
}

function createFolderSettingsNode(
  folder: {
    id: string;
    name: string;
    metadata?: unknown;
  },
  projectId: string,
): ProjectSettingsNode {
  return {
    id: folder.id,
    name: folder.name,
    type: "folder",
    projectId,
    summary: null,
    metadata: normalizeSettingsMetadata(folder.metadata),
  };
}

function createAnyNodeSettingsNode(
  node: { id: string; name: string; metadata?: unknown },
  nodeType: string,
  projectId: string,
): ProjectSettingsNode {
  return {
    id: node.id,
    name: node.name,
    type: nodeType,
    projectId,
    summary: null,
    metadata: normalizeSettingsMetadata(node.metadata),
  };
}

function getFolderSettingsProjectId(
  currentProjectId: string | null | undefined,
  folderParentId: string | null | undefined,
): string | null {
  return currentProjectId ?? folderParentId ?? null;
}

const PROJECTS_SORT_MODE_PREFERENCE_KEY = "projects:sortMode";
const PROJECTS_EXPORT_NAME_OPTIONS_PREFERENCE_KEY =
  "projects:exportNameOptions";
const PROJECTS_PDF_TEMPLATE_PREFERENCE_KEY = "projects:pdfTemplateId";
const DEFAULT_PROJECTS_SORT_MODE: FileTreeSortMode = "alphabetical";
const DEFAULT_EXPORT_NAME_OPTIONS: ExportNameOptions = {
  includeFolderNames: true,
  includeNoteNames: true,
};
const DEFAULT_PROJECTS_PDF_TEMPLATE_ID: PdfTemplateId = "standard";

type PdfTemplateOption = {
  id: PdfTemplateId;
  label: string;
  description: string;
  isDefault: boolean;
};

type ExportFormat = "markdown" | "docx" | "pdf" | "zip" | "epub";

type ExportDialogState = {
  open: boolean;
  node: TreeNode | null;
};

const CHAT_CONTEXT_STORAGE_PREFIX = "arbor:chatContextNodes:";
const CHAT_CONTEXT_DRAFT_STORAGE_KEY = `${CHAT_CONTEXT_STORAGE_PREFIX}draft`;

function getChatContextStorageKey(threadId: string | null) {
  return threadId
    ? `${CHAT_CONTEXT_STORAGE_PREFIX}${threadId}`
    : CHAT_CONTEXT_DRAFT_STORAGE_KEY;
}

function isChatContextNode(value: unknown): value is ChatContextNode {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.type === "string"
  );
}

function isFileTreeSortMode(value: unknown): value is FileTreeSortMode {
  return value === "alphabetical" || value === "manual";
}

function resolveFileTreeSortModePreference(
  preferenceValue: unknown,
): FileTreeSortMode {
  return isFileTreeSortMode(preferenceValue)
    ? preferenceValue
    : DEFAULT_PROJECTS_SORT_MODE;
}

function isExportNameOptions(value: unknown): value is ExportNameOptions {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.includeFolderNames === "boolean" &&
    typeof candidate.includeNoteNames === "boolean"
  );
}

function resolveExportNameOptionsPreference(
  preferenceValue: unknown,
): ExportNameOptions {
  return isExportNameOptions(preferenceValue)
    ? preferenceValue
    : DEFAULT_EXPORT_NAME_OPTIONS;
}

function resolvePdfTemplatePreference(
  preferenceValue: unknown,
  pdfTemplateOptions: readonly PdfTemplateOption[],
): PdfTemplateId {
  const defaultTemplateId =
    pdfTemplateOptions.find((templateOption) => templateOption.isDefault)?.id ??
    DEFAULT_PROJECTS_PDF_TEMPLATE_ID;

  if (typeof preferenceValue !== "string") {
    return defaultTemplateId;
  }

  const hasMatchingTemplate = pdfTemplateOptions.some(
    (templateOption) => templateOption.id === preferenceValue,
  );

  return hasMatchingTemplate
    ? (preferenceValue as PdfTemplateId)
    : defaultTemplateId;
}

function shouldExportDescendants(nodeType: string | null | undefined): boolean {
  return nodeType === "folder" || nodeType === "project";
}

function readStoredChatContext(threadId: string | null): ChatContextNode[] {
  if (typeof window === "undefined") {
    return [];
  }

  const storedValue = localStorage.getItem(getChatContextStorageKey(threadId));
  if (!storedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isChatContextNode);
  } catch {
    return [];
  }
}

function writeStoredChatContext(
  threadId: string | null,
  contextNodes: ChatContextNode[],
) {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = getChatContextStorageKey(threadId);
  if (contextNodes.length === 0) {
    localStorage.removeItem(storageKey);
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(contextNodes));
}

function FolderCardView({
  nodes,
  onOpenNode,
  onToggleFavorite,
  onSettings,
}: {
  nodes: {
    id: string;
    name: string;
    type: string;
    content: unknown;
    metadata: unknown;
  }[];
  onOpenNode: (nodeId: string) => void;
  onToggleFavorite?: (nodeId: string) => void;
  onSettings?: (nodeId: string) => void;
}) {
  const nodeIds = React.useMemo(() => nodes.map((n) => n.id), [nodes]);
  const firstMediaQuery = trpc.media.getFirstImageByNodes.useQuery(
    { nodeIds },
    { enabled: nodeIds.length > 0, staleTime: 30_000 },
  );
  const firstMediaMap = firstMediaQuery.data ?? {};

  if (nodes.length === 0) {
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
        {nodes.map((node) => {
          const nodeMetadata = normalizeSettingsMetadata(node.metadata);

          return (
            <NoteCard
              key={node.id}
              node={{
                ...node,
                firstMediaId:
                  (nodeMetadata.heroAttachmentId as
                    | string
                    | null
                    | undefined) ??
                  firstMediaMap[node.id] ??
                  null,
                heroFocalX: nodeMetadata.heroFocalX as
                  | number
                  | null
                  | undefined,
                heroFocalY: nodeMetadata.heroFocalY as
                  | number
                  | null
                  | undefined,
              }}
              onClick={() => onOpenNode(node.id)}
              onToggleFavorite={onToggleFavorite}
              onSettings={onSettings ? () => onSettings(node.id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── End folder card view ──────────────────────────────────────────────────────

const NOTE_AUTO_SAVE_DEBOUNCE_MS = 5000;

export default function ProjectsPage() {
  const utils = trpc.useUtils();
  const t = useTranslations("projects");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tFileTree = useTranslations("fileTree");
  const tCommon = useTranslations("common");
  const { addToast } = useToast();
  const {
    getPreference,
    setPreference,
    isLoading: areAppPreferencesLoading,
  } = useAppPreferences();
  const persistedSortModePreference = resolveFileTreeSortModePreference(
    getPreference(
      PROJECTS_SORT_MODE_PREFERENCE_KEY,
      DEFAULT_PROJECTS_SORT_MODE,
    ),
  );
  const persistedExportNameOptions = resolveExportNameOptionsPreference(
    getPreference(
      PROJECTS_EXPORT_NAME_OPTIONS_PREFERENCE_KEY,
      DEFAULT_EXPORT_NAME_OPTIONS,
    ),
  );
  const pdfTemplatesQuery = trpc.nodes.getPdfTemplates.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const pdfTemplateOptions = React.useMemo(
    () => pdfTemplatesQuery.data ?? [],
    [pdfTemplatesQuery.data],
  );
  const persistedPdfTemplatePreference = resolvePdfTemplatePreference(
    getPreference(
      PROJECTS_PDF_TEMPLATE_PREFERENCE_KEY,
      DEFAULT_PROJECTS_PDF_TEMPLATE_ID,
    ),
    pdfTemplateOptions,
  );

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [projectName, setProjectName] = React.useState("");
  const [settingsNode, setSettingsNode] =
    React.useState<ProjectSettingsNode | null>(null);

  const router = useRouter();
  const searchParamsString =
    typeof searchParams?.toString === "function" ? searchParams.toString() : "";

  // Current project selection
  const { currentProjectId, setCurrentProject } = useCurrentProject();

  // File tree state
  const fileTreeRef = React.useRef<FileTreeHandle>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(
    () => searchParams?.get("node") ?? null,
  );

  // Note view/edit mode — starts read-only; user must click Edit to write.
  const [isNoteEditing, setIsNoteEditing] = React.useState(false);

  // Sync selectedNodeId when the URL ?node= param changes — e.g. the user clicks
  // a node link in the chat sidebar while already on the projects page.
  const nodeParam = searchParams?.get("node") ?? null;
  const pathnameRef = React.useRef(pathname);
  const nodeParamRef = React.useRef(nodeParam);
  const searchParamsStringRef = React.useRef(searchParamsString);
  const replaceRouteRef = React.useRef(router.replace);
  const selectedNodeIdRef = React.useRef(selectedNodeId);
  const refreshSelectedNodeRef = React.useRef(
    async (_nodeId: string): Promise<void> => undefined,
  );

  React.useEffect(() => {
    pathnameRef.current = pathname;
    nodeParamRef.current = nodeParam;
    searchParamsStringRef.current = searchParamsString;
    replaceRouteRef.current = router.replace;
  }, [nodeParam, pathname, router.replace, searchParamsString]);

  React.useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  React.useEffect(() => {
    if (nodeParam !== selectedNodeId) {
      setSelectedNodeId(nodeParam);
      setIsNoteEditing(false); // reset to read-only when navigating to a new node
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeParam]);

  // Update the URL when a node is selected so the page is deep-linkable and
  // reloading restores the open node. Also update state directly so callers
  // don't depend on the URL round-trip (which doesn't work in tests).
  const navigateToNode = React.useCallback((nodeId: string | null) => {
    setIsNoteEditing(false);
    setSelectedNodeId(nodeId);
    if (selectedNodeIdRef.current === nodeId) {
      if (nodeId) {
        void refreshSelectedNodeRef.current(nodeId);
      }
      return;
    }

    const params = new URLSearchParams(searchParamsStringRef.current);
    if (nodeId) {
      params.set("node", nodeId);
    } else {
      params.delete("node");
    }
    const nextQueryString = params.toString();
    const nextHref = nextQueryString
      ? `${pathnameRef.current}?${nextQueryString}`
      : pathnameRef.current;
    replaceRouteRef.current(nextHref);
  }, []);

  // Chat context nodes — files/folders the user has pinned to add to LLM context
  const [selectedChatThreadId, setSelectedChatThreadId] = React.useState<
    string | null
  >(null);
  const [chatContextNodes, setChatContextNodes] = React.useState<
    ChatContextNode[]
  >(() => readStoredChatContext(null));
  const chatContextNodeIds = React.useMemo(
    () => new Set(chatContextNodes.map((n) => n.id)),
    [chatContextNodes],
  );
  const latestChatContextNodesRef = React.useRef(chatContextNodes);
  const previousSelectedChatThreadIdRef = React.useRef<string | null>(null);
  const skipNextChatContextPersistenceRef = React.useRef(false);

  React.useEffect(() => {
    latestChatContextNodesRef.current = chatContextNodes;
  }, [chatContextNodes]);

  React.useEffect(() => {
    const previousSelectedChatThreadId =
      previousSelectedChatThreadIdRef.current;
    previousSelectedChatThreadIdRef.current = selectedChatThreadId;

    const storedChatContextNodes = readStoredChatContext(selectedChatThreadId);
    const shouldKeepDraftContextForNewThread =
      selectedChatThreadId !== null &&
      previousSelectedChatThreadId === null &&
      storedChatContextNodes.length === 0 &&
      latestChatContextNodesRef.current.length > 0;

    if (shouldKeepDraftContextForNewThread) {
      return;
    }

    skipNextChatContextPersistenceRef.current = true;
    setChatContextNodes(storedChatContextNodes);
  }, [selectedChatThreadId]);

  React.useEffect(() => {
    if (skipNextChatContextPersistenceRef.current) {
      skipNextChatContextPersistenceRef.current = false;
      return;
    }

    writeStoredChatContext(selectedChatThreadId, chatContextNodes);
  }, [selectedChatThreadId, chatContextNodes]);

  const handleAddToContext = React.useCallback((node: ChatContextNode) => {
    setChatContextNodes((prev) => {
      if (prev.some((n) => n.id === node.id)) {
        // Toggle off if already in context
        return prev.filter((n) => n.id !== node.id);
      }
      return [...prev, { id: node.id, name: node.name, type: node.type }];
    });
  }, []);
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
  const editorContentNodeIdRef = React.useRef<string | null>(null);
  const tEditor = useTranslations("editor");
  const tProvenance = useTranslations("provenance");
  const editorInstanceRef = React.useRef<Editor | null>(null);
  // Saved selection range — captured before the link picker dialog steals focus
  const savedSelectionRef = React.useRef<{ from: number; to: number } | null>(
    null,
  );
  const [showImageUpload, setShowImageUpload] = React.useState(false);
  const [imagePickerTab, setImagePickerTab] = React.useState<
    "upload" | "existing" | "generate"
  >("upload");
  const [aiImagePrompt, setAiImagePrompt] = React.useState("");
  const [showLinkPicker, setShowLinkPicker] = React.useState(false);
  const [linkPickerSearch, setLinkPickerSearch] = React.useState("");
  const [exportDialogState, setExportDialogState] =
    React.useState<ExportDialogState>({
      open: false,
      node: null,
    });
  const [selectedExportFormat, setSelectedExportFormat] =
    React.useState<ExportFormat>("markdown");
  const [isExporting, setIsExporting] = React.useState(false);
  const [fileTreeSortMode, setFileTreeSortMode] =
    React.useState<FileTreeSortMode>(persistedSortModePreference);
  const [exportNameOptions, setExportNameOptions] =
    React.useState<ExportNameOptions>(persistedExportNameOptions);
  const [selectedPdfTemplateId, setSelectedPdfTemplateId] =
    React.useState<PdfTemplateId>(persistedPdfTemplatePreference);
  const [selectedCoverAttachmentId, setSelectedCoverAttachmentId] =
    React.useState<string | null>(null);
  const [epubAuthor, setEpubAuthor] = React.useState("");
  const [epubDescription, setEpubDescription] = React.useState("");
  const [epubLanguage, setEpubLanguage] = React.useState("");

  // Fetch image attachments for the EPUB cover picker using the full project scope
  // so all images across every note/folder in the project are available as cover options.
  const epubAttachmentsQuery = trpc.media.getByProject.useQuery(
    { projectId: currentProjectId! },
    {
      enabled: selectedExportFormat === "epub" && !!currentProjectId,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );
  const epubImageAttachments = React.useMemo(
    () =>
      (epubAttachmentsQuery.data ?? []).filter((a) =>
        a.mimeType.startsWith("image/"),
      ),
    [epubAttachmentsQuery.data],
  );

  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);
  const [historyCompareVersions, setHistoryCompareVersions] = React.useState<{
    versionA: number;
    versionB: number;
  } | null>(null);

  React.useEffect(() => {
    if (areAppPreferencesLoading) {
      return;
    }

    setFileTreeSortMode(persistedSortModePreference);
  }, [areAppPreferencesLoading, persistedSortModePreference]);

  React.useEffect(() => {
    if (areAppPreferencesLoading) {
      return;
    }

    setExportNameOptions(persistedExportNameOptions);
  }, [areAppPreferencesLoading, persistedExportNameOptions]);

  React.useEffect(() => {
    if (areAppPreferencesLoading || pdfTemplatesQuery.isLoading) {
      return;
    }

    setSelectedPdfTemplateId(persistedPdfTemplatePreference);
  }, [
    areAppPreferencesLoading,
    pdfTemplatesQuery.isLoading,
    persistedPdfTemplatePreference,
  ]);

  const handleSortModeChange = React.useCallback(
    (nextSortMode: FileTreeSortMode) => {
      setFileTreeSortMode((currentSortMode) => {
        if (currentSortMode === nextSortMode) {
          return currentSortMode;
        }

        void setPreference(
          PROJECTS_SORT_MODE_PREFERENCE_KEY,
          nextSortMode,
        ).catch(() => {
          setFileTreeSortMode(currentSortMode);
        });

        return nextSortMode;
      });
    },
    [setPreference],
  );

  const handleExportNameOptionsChange = React.useCallback(
    (updater: (currentOptions: ExportNameOptions) => ExportNameOptions) => {
      setExportNameOptions((currentOptions) => {
        const nextOptions = updater(currentOptions);

        if (
          currentOptions.includeFolderNames ===
            nextOptions.includeFolderNames &&
          currentOptions.includeNoteNames === nextOptions.includeNoteNames
        ) {
          return currentOptions;
        }

        void setPreference(
          PROJECTS_EXPORT_NAME_OPTIONS_PREFERENCE_KEY,
          nextOptions,
        ).catch(() => {
          setExportNameOptions(currentOptions);
        });

        return nextOptions;
      });
    },
    [setPreference],
  );

  const handlePdfTemplateChange = React.useCallback(
    (nextTemplateId: PdfTemplateId) => {
      setSelectedPdfTemplateId((currentTemplateId) => {
        if (
          currentTemplateId === nextTemplateId ||
          !pdfTemplateOptions.some(
            (templateOption) => templateOption.id === nextTemplateId,
          )
        ) {
          return currentTemplateId;
        }

        void setPreference(
          PROJECTS_PDF_TEMPLATE_PREFERENCE_KEY,
          nextTemplateId,
        ).catch(() => {
          setSelectedPdfTemplateId(currentTemplateId);
        });

        return nextTemplateId;
      });
    },
    [pdfTemplateOptions, setPreference],
  );

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
  const normalizedSelectedNoteContent = React.useMemo(() => {
    if (selectedNodeQuery.data?.type !== "note") {
      return null;
    }

    return normalizeTiptapContent(selectedNodeQuery.data.content);
  }, [selectedNodeQuery.data?.content, selectedNodeQuery.data?.type]);
  const isSelectedNodeLocked =
    (selectedNodeQuery.data?.metadata as Record<string, unknown> | null)
      ?.isLocked === true;

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
    const allNodes = (projectDescendantsQuery.data ??
      []) as LinkPickerSourceNode[];
    return buildFlatLinkPickerTreeNodes(currentProjectId, allNodes);
  }, [projectDescendantsQuery.data, currentProjectId]);

  const filterNodeIds = React.useMemo(() => {
    return deriveFilteredNodeIds(
      selectedTagIds,
      filteredNodesQuery.data?.map((node) => node.id),
      searchQuery,
      searchResultsQuery.data?.map((result) => result.node.id),
    );
  }, [
    selectedTagIds,
    searchQuery,
    filteredNodesQuery.data,
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

  const handleCreate = React.useCallback(() => {
    if (!projectName.trim()) return;
    createMutation.mutate({
      type: "project",
      name: projectName.trim(),
      parentId: null,
    });
  }, [createMutation, projectName]);

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
      navigateToNode(data.id);
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
        navigateToNode(null);
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
  const nodeMoveMutation = trpc.nodes.move.useMutation();

  const handleMoveNode = React.useCallback(
    async (
      draggedNodeId: string,
      targetNodeId: string,
      position: DropPosition,
    ) => {
      try {
        const targetNode = (await utils.nodes.getById.fetch({
          id: targetNodeId,
        })) as {
          id: string;
          parentId: string | null;
          position?: number | null;
        } | null;
        const moveInput = deriveNodeMoveMutationInput(
          draggedNodeId,
          targetNodeId,
          position,
          targetNode ?? undefined,
        );

        if (!moveInput) {
          return;
        }

        await nodeMoveMutation.mutateAsync(moveInput);
        await Promise.all([
          utils.nodes.getChildren.invalidate(),
          utils.nodes.getById.invalidate({ id: draggedNodeId }),
        ]);
        addToast(tFileTree("moveSuccess"), "success");
      } catch (error) {
        console.error("Error moving node:", error);
        addToast(tFileTree("moveError"), "error");
      }
    },
    [
      nodeMoveMutation,
      utils.nodes.getById,
      utils.nodes.getChildren,
      addToast,
      tFileTree,
    ],
  );

  // Bulk node selection & tag modal
  const [selectedBulkNodeIds, setSelectedBulkNodeIds] = React.useState<
    Set<string>
  >(new Set());
  const [showBulkTagModal, setShowBulkTagModal] = React.useState(false);
  const toggleFavoriteMutation = trpc.nodes.toggleFavorite.useMutation({
    onSuccess: (updatedNode) => {
      const nowFavorite =
        (updatedNode.metadata as Record<string, unknown> | null)?.isFavorite ===
        true;
      addToast(
        nowFavorite
          ? tFileTree("favorites.added")
          : tFileTree("favorites.removed"),
        "success",
      );
      utils.nodes.getFavorites.invalidate();
      utils.nodes.getChildren.invalidate();
    },
    onError: (err) => {
      addToast(err.message || tCommon("error"), "error");
    },
  });
  const toggleLockMutation = trpc.nodes.toggleLock.useMutation({
    onSuccess: () => {
      utils.nodes.getAllProjects.invalidate();
      utils.nodes.getById.invalidate();
      utils.nodes.getChildren.invalidate();
      utils.nodes.getFavorites.invalidate();
    },
    onError: (err) => {
      addToast(err.message || tCommon("error"), "error");
    },
  });
  const handleToggleFavorite = React.useCallback(
    (nodeId: string) => {
      toggleFavoriteMutation.mutate({ nodeId });
    },
    [toggleFavoriteMutation],
  );

  const handleToggleBulkNode = React.useCallback((nodeId: string) => {
    setSelectedBulkNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const projectMeta =
    (currentProject?.metadata as Record<string, unknown> | null) ?? {};
  const isCurrentProjectLocked = projectMeta.isLocked === true;
  const currentProjectSettingsNode = React.useMemo(() => {
    if (!currentProject) {
      return null;
    }

    return createProjectSettingsNode({
      id: currentProject.id,
      name: currentProject.name,
      summary: (currentProject as { summary?: string | null }).summary ?? null,
      metadata: projectMeta,
    });
  }, [currentProject, projectMeta]);
  const selectedWorkspaceSettingsNode = React.useMemo(() => {
    const selectedNode = selectedNodeQuery.data as
      | {
          id: string;
          name: string;
          type?: string;
          parentId?: string | null;
          metadata?: unknown;
        }
      | undefined;

    if (selectedNode?.type === "folder") {
      const folderProjectId = getFolderSettingsProjectId(
        currentProjectId,
        selectedNode.parentId,
      );
      if (folderProjectId) {
        return createFolderSettingsNode(selectedNode, folderProjectId);
      }
    }

    if (selectedNode?.type === "note" && currentProjectId) {
      return createAnyNodeSettingsNode(selectedNode, "note", currentProjectId);
    }

    return currentProjectSettingsNode;
  }, [currentProjectId, currentProjectSettingsNode, selectedNodeQuery.data]);

  // Media upload mutation
  const mediaUploadMutation = trpc.media.upload.useMutation();

  const masterKeyQuery = trpc.preferences.getMasterKey.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const generateImageMutation = trpc.media.generateImage.useMutation({
    onSuccess: (attachment) => {
      editorInstanceRef.current
        ?.chain()
        .focus()
        .setImage({ src: getMediaAttachmentUrl(attachment.id) })
        .run();
      setShowImageUpload(false);
      setAiImagePrompt("");
    },
    onError: (err) => {
      addToast(err.message ?? tEditor("imageUpload.generateError"), "error");
    },
  });

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
  const [pendingImportRequest, setPendingImportRequest] =
    React.useState<PendingImportDirectoryRequest<File> | null>(null);
  const [importProjectName, setImportProjectName] = React.useState("");
  const [queuedImportProjectName, setQueuedImportProjectName] =
    React.useState("");

  const closeCreateDialog = React.useCallback(() => {
    setCreateDialogOpen(false);
    setProjectName("");
  }, []);

  const openCreateDialog = React.useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreateProjectNameChange = React.useCallback(
    (nextProjectName: string) => {
      setProjectName(nextProjectName);
    },
    [],
  );

  const handleCreateDialogImportFromFolder = React.useCallback(() => {
    setQueuedImportProjectName(projectName.trim());
    closeCreateDialog();
    importInputRef.current?.click();
  }, [closeCreateDialog, projectName]);

  const closeImportNameDialog = React.useCallback(() => {
    setPendingImportRequest(null);
    setImportProjectName("");
    setQueuedImportProjectName("");
  }, []);

  const showImportNameDialog = React.useCallback(
    (nextPendingImportRequest: PendingImportDirectoryRequest<File>) => {
      setPendingImportRequest(nextPendingImportRequest);
      setImportProjectName(nextPendingImportRequest.initialProjectName);
    },
    [],
  );

  const navigateToProjects = React.useCallback(() => {
    router.push(pathname);
  }, [pathname, router]);

  const updateImportedNodeContent = React.useCallback(
    async ({ id, content }: { id: string; content: Record<string, unknown> }) =>
      updateNodeMutation.mutateAsync({
        id,
        data: { content },
      }),
    [updateNodeMutation],
  );

  // After nodes are created, upload images and patch node content
  const uploadImagesAndPatch = React.useCallback(
    async (
      nodeMap: Record<string, string>,
      projectId: string,
      imageFilesByNotePath: Map<string, Map<string, File>>,
    ) =>
      uploadImportedImagesAndPatchNodes({
        nodeMap,
        projectId,
        imageFilesByNotePath,
        uploadImportedMedia: mediaUploadForImport.mutateAsync,
        fetchNodeById: utils.nodes.getById.fetch,
        updateNodeContent: updateImportedNodeContent,
      }),
    [mediaUploadForImport, updateImportedNodeContent, utils.nodes.getById],
  );

  // Patch relative imported note links to resolve to internal node IDs
  const patchInternalLinks = React.useCallback(
    async (
      nodeMap: Record<string, string>,
      entries: { path: string; content: unknown }[],
    ) =>
      patchImportedNodeInternalLinks({
        nodeMap,
        entries,
        fetchNodeById: utils.nodes.getById.fetch,
        updateNodeContent: updateImportedNodeContent,
      }),
    [updateImportedNodeContent, utils.nodes.getById],
  );

  const healImportedInternalLinks = React.useCallback(
    async (projectId: string, importedNodeMap: Record<string, string>) =>
      healImportedProjectInternalLinks({
        projectId,
        importedNodeMap,
        fetchDescendants: utils.nodes.getDescendants.fetch,
        updateNodeContent: updateImportedNodeContent,
      }),
    [updateImportedNodeContent, utils.nodes.getDescendants],
  );

  const getImportTargetNodeId = React.useCallback(
    (createNewProject = false) => {
      return deriveImportTargetNodeId(
        createNewProject,
        currentProject?.id,
        forceList,
        selectedNodeQuery.data as
          | { id: string; type: string; parentId: string | null }
          | undefined,
      );
    },
    [currentProject?.id, forceList, selectedNodeQuery.data],
  );

  const runImport = React.useCallback(
    async (
      projectName: string,
      entries: { path: string; content: unknown }[],
      imageFilesByNotePath: Map<string, Map<string, File>>,
      options?: { createNewProject?: boolean },
    ) =>
      runProjectImportWorkflow({
        projectName,
        entries,
        imageFilesByNotePath,
        createNewProject: options?.createNewProject,
        getImportTargetNodeId,
        importDirectory: importDirectoryMutation.mutateAsync,
        uploadImagesAndPatch,
        patchInternalLinks,
        healImportedInternalLinks,
        setCurrentProject,
        invalidateAllProjects: () => utils.nodes.getAllProjects.invalidate(),
        invalidateChildren: () => utils.nodes.getChildren.invalidate(),
        invalidateNodeById: () => utils.nodes.getById.invalidate(),
        invalidateDescendants: () => utils.nodes.getDescendants.invalidate(),
        navigateToProjects,
      }),
    [
      getImportTargetNodeId,
      healImportedInternalLinks,
      importDirectoryMutation,
      navigateToProjects,
      uploadImagesAndPatch,
      patchInternalLinks,
      setCurrentProject,
      utils.nodes.getAllProjects,
      utils.nodes.getChildren,
      utils.nodes.getById,
      utils.nodes.getDescendants,
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

      const importDirectoryOutcome = await prepareImportDirectoryWorkflow({
        allFiles,
        preferredProjectName,
        createNewProject,
      });

      await applyPreparedImportDirectoryOutcome({
        outcome: importDirectoryOutcome,
        runImport,
        showUnsupportedImportMessage: (message) => addToast(message, "error"),
        setPendingImportRequest: showImportNameDialog,
      });
    },
    [addToast, queuedImportProjectName, runImport, showImportNameDialog],
  );

  const handleImportWithName = React.useCallback(() => {
    if (!pendingImportRequest || !importProjectName.trim()) return;
    void runImport(
      importProjectName.trim(),
      pendingImportRequest.entries,
      pendingImportRequest.imageFilesByNotePath,
      { createNewProject: pendingImportRequest.createNewProject },
    );
    closeImportNameDialog();
  }, [
    closeImportNameDialog,
    runImport,
    importProjectName,
    pendingImportRequest,
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

  const handleImageUploadComplete = React.useCallback(
    (attachmentId: string) => {
      const editor = editorInstanceRef.current;
      if (editor) {
        editor
          .chain()
          .focus()
          .setImage({ src: getMediaAttachmentUrl(attachmentId) })
          .run();
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
      const navigationTarget = deriveEditorLinkNavigationTarget(
        href,
        window.location.href,
        window.location.origin,
      );

      if (navigationTarget.kind === "push") {
        router.push(navigationTarget.href);
        return;
      }

      if (navigationTarget.kind === "resolve-arbor-url") {
        const matchedNodeId = await resolveArborEditorLinkTargetNodeId(
          navigationTarget.pathSegments,
          async (query) =>
            utils.search.keywordSearch.fetch({
              query,
              filters: {},
              options: { limit: 5 },
            }),
        );

        if (matchedNodeId) {
          router.push(`/projects?node=${matchedNodeId}`);
        }
        return;
      }

      window.location.href = navigationTarget.href;
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

  const closeExportDialog = React.useCallback(() => {
    setExportDialogState({ open: false, node: null });
  }, []);

  const requestCloseExportDialog = React.useCallback(() => {
    if (isExporting) {
      return;
    }

    closeExportDialog();
  }, [closeExportDialog, isExporting]);

  const openExportDialog = React.useCallback(
    (node: TreeNode, initialFormat: ExportFormat = "markdown") => {
      setSelectedExportFormat(initialFormat);
      setExportDialogState({ open: true, node });

      // EPUB cover: use the project hero if the node doesn't have its own hero.
      // epubAuthor/epubDescription/epubLanguage are always stored on the project root,
      // so we read them from currentProject regardless of which node triggered the export.
      const nodeMeta = node.metadata as Record<string, unknown> | null;
      const projectMeta = currentProject?.metadata as Record<
        string,
        unknown
      > | null;

      const heroAttachmentId =
        nodeMeta?.heroAttachmentId ?? projectMeta?.heroAttachmentId ?? null;
      setSelectedCoverAttachmentId(
        typeof heroAttachmentId === "string" ? heroAttachmentId : null,
      );

      // Pre-fill EPUB metadata fields from the project's stored settings
      setEpubAuthor(
        typeof projectMeta?.epubAuthor === "string"
          ? projectMeta.epubAuthor
          : "",
      );
      setEpubDescription(
        typeof projectMeta?.epubDescription === "string"
          ? projectMeta.epubDescription
          : "",
      );
      setEpubLanguage(
        typeof projectMeta?.epubLanguage === "string"
          ? projectMeta.epubLanguage
          : "",
      );
    },
    [currentProject],
  );

  const handleExportConfirm = React.useCallback(async () => {
    const exportNode = exportDialogState.node;

    if (!exportNode) {
      return;
    }

    const includeDescendants = shouldExportDescendants(exportNode.type);

    setIsExporting(true);

    try {
      if (selectedExportFormat === "markdown") {
        await runProjectMarkdownExport({
          nodeId: exportNode.id,
          nodeName: exportNode.name,
          includeDescendants,
          includeFolderNames: exportNameOptions.includeFolderNames,
          includeNoteNames: exportNameOptions.includeNoteNames,
          sortMode: fileTreeSortMode,
          fetchMarkdown: utils.nodes.exportMarkdown.fetch,
          downloadTextFile,
          addSuccessToast: () =>
            addToast(tFileTree("exportSuccess"), "success"),
          addErrorToast: () => addToast(tFileTree("exportError"), "error"),
          closeExportMenu: closeExportDialog,
        });
        return;
      }

      if (selectedExportFormat === "docx") {
        await runProjectDocxExport({
          nodeId: exportNode.id,
          includeDescendants,
          includeFolderNames: exportNameOptions.includeFolderNames,
          includeNoteNames: exportNameOptions.includeNoteNames,
          sortMode: fileTreeSortMode,
          fetchDocx: utils.nodes.exportDocx.fetch,
          downloadBinaryFile,
          addSuccessToast: () =>
            addToast(tFileTree("exportSuccess"), "success"),
          addErrorToast: () => addToast(tFileTree("exportError"), "error"),
          closeExportMenu: closeExportDialog,
        });
        return;
      }

      if (selectedExportFormat === "zip") {
        await runProjectZipExport({
          nodeId: exportNode.id,
          sortMode: fileTreeSortMode,
          fetchZip: utils.nodes.exportZip.fetch,
          downloadBinaryFile,
          addSuccessToast: () =>
            addToast(tFileTree("exportSuccess"), "success"),
          addErrorToast: () => addToast(tFileTree("exportError"), "error"),
          closeExportMenu: closeExportDialog,
        });
        return;
      }

      if (selectedExportFormat === "epub") {
        await runProjectEpubExport({
          nodeId: exportNode.id,
          includeDescendants,
          includeFolderNames: exportNameOptions.includeFolderNames,
          includeNoteNames: exportNameOptions.includeNoteNames,
          sortMode: fileTreeSortMode,
          coverAttachmentId: selectedCoverAttachmentId ?? undefined,
          epubAuthor: epubAuthor || undefined,
          epubDescription: epubDescription || undefined,
          epubLanguage: epubLanguage || undefined,
          fetchEpub: utils.nodes.exportEpub.fetch,
          downloadBinaryFile,
          addSuccessToast: () =>
            addToast(tFileTree("exportSuccess"), "success"),
          addErrorToast: () => addToast(tFileTree("exportError"), "error"),
          closeExportMenu: closeExportDialog,
        });
        return;
      }

      await runProjectPdfExport({
        nodeId: exportNode.id,
        includeDescendants,
        includeFolderNames: exportNameOptions.includeFolderNames,
        includeNoteNames: exportNameOptions.includeNoteNames,
        sortMode: fileTreeSortMode,
        templateId: selectedPdfTemplateId,
        fetchPdf: utils.nodes.exportPdf.fetch,
        downloadBinaryFile,
        addSuccessToast: () => addToast(tFileTree("exportSuccess"), "success"),
        addErrorToast: () => addToast(tFileTree("exportError"), "error"),
        closeExportMenu: closeExportDialog,
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    addToast,
    addToast,
    closeExportDialog,
    epubAuthor,
    epubDescription,
    epubLanguage,
    exportDialogState.node,
    exportNameOptions.includeFolderNames,
    exportNameOptions.includeNoteNames,
    fileTreeSortMode,
    selectedCoverAttachmentId,
    selectedExportFormat,
    selectedPdfTemplateId,
    tFileTree,
    utils,
  ]);

  // Auto-save for editor content
  const handleAutoSave = React.useCallback(
    async (nodeId: string, content: Record<string, unknown>) => {
      await autoSaveMutation.mutateAsync({
        id: nodeId,
        data: { content },
      });

      utils.nodes.getById.setData({ id: nodeId }, (currentNode) => {
        if (!currentNode || currentNode.type !== "note") {
          return currentNode;
        }

        return {
          ...currentNode,
          content,
        };
      });
    },
    [autoSaveMutation, utils.nodes.getById],
  );

  const autoSaveContent =
    isNoteEditing &&
    selectedNodeId !== null &&
    editorContentNodeIdRef.current === selectedNodeId
      ? editorContent
      : null;

  const {
    status: autoSaveStatus,
    markSaved,
    flush: flushAutoSave,
  } = useAutoSave({
    nodeId: selectedNodeId,
    content: autoSaveContent,
    onSave: handleAutoSave,
    debounceMs: NOTE_AUTO_SAVE_DEBOUNCE_MS,
  });

  const handleManualNoteSave = React.useCallback(async () => {
    if (
      selectedNodeId === null ||
      !isNoteEditing ||
      isSelectedNodeLocked ||
      selectedNodeQuery.data?.type !== "note"
    ) {
      return;
    }

    await flushAutoSave();
  }, [
    flushAutoSave,
    isNoteEditing,
    isSelectedNodeLocked,
    selectedNodeId,
    selectedNodeQuery.data?.type,
  ]);

  const handleNoteEditToggle = React.useCallback(() => {
    if (isSelectedNodeLocked) {
      return;
    }

    if (!isNoteEditing) {
      setIsNoteEditing(true);
      return;
    }

    void (async () => {
      try {
        await flushAutoSave();
        setIsNoteEditing(false);
      } catch {
        // Keep edit mode active when the final flush fails so the user does not
        // silently lose changes.
      }
    })();
  }, [flushAutoSave, isNoteEditing, isSelectedNodeLocked]);

  React.useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "s";

      if (!isSaveShortcut || !isNoteEditing || isSelectedNodeLocked) {
        return;
      }

      event.preventDefault();

      if (event.repeat) {
        return;
      }

      void handleManualNoteSave();
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [handleManualNoteSave, isNoteEditing, isSelectedNodeLocked]);

  React.useEffect(() => {
    refreshSelectedNodeRef.current = async (nodeId: string) => {
      const refreshedNode = await utils.nodes.getById.fetch({ id: nodeId });
      if (!refreshedNode || selectedNodeIdRef.current !== nodeId) {
        return;
      }

      if (refreshedNode.type !== "note") {
        setEditorContent(null);
        editorContentNodeIdRef.current = nodeId;
        markSaved(null);
        void utils.nodes.getChildren.invalidate({ parentId: nodeId });
        return;
      }

      const normalizedRefreshedContent = normalizeTiptapContent(
        refreshedNode.content,
      );
      setEditorContent(normalizedRefreshedContent);
      editorContentNodeIdRef.current = nodeId;
      markSaved(normalizedRefreshedContent);
    };
  }, [markSaved, utils.nodes.getById, utils.nodes.getChildren]);

  const handleAgentResponseSuccess = React.useCallback(() => {
    if (!selectedNodeId) {
      return;
    }

    void (async () => {
      const refreshedNode = await utils.nodes.getById.fetch({
        id: selectedNodeId,
      });
      if (!refreshedNode || isNoteEditing) {
        return;
      }

      if (refreshedNode.type !== "note") {
        setEditorContent(null);
        editorContentNodeIdRef.current = selectedNodeId;
        markSaved(null);
        return;
      }

      const normalizedRefreshedContent = normalizeTiptapContent(
        refreshedNode.content,
      );
      setEditorContent(normalizedRefreshedContent);
      editorContentNodeIdRef.current = selectedNodeId;
      markSaved(normalizedRefreshedContent);
    })();
  }, [isNoteEditing, markSaved, selectedNodeId, utils.nodes.getById]);

  const closeHistoryDialog = React.useCallback(() => {
    setIsHistoryDialogOpen(false);
    setHistoryCompareVersions(null);
  }, []);

  const handleHistoryCompare = React.useCallback(
    (versionA: number, versionB: number) => {
      setHistoryCompareVersions({ versionA, versionB });
    },
    [],
  );

  const historyCompareCurrentContent =
    selectedNodeId !== null && editorContentNodeIdRef.current === selectedNodeId
      ? editorContent
      : normalizedSelectedNoteContent;

  const clearHistoryCompare = React.useCallback(() => {
    setHistoryCompareVersions(null);
  }, []);

  const handleHistoryRestoreSuccess = React.useCallback(
    (restoredContent: unknown, _restoredVersion: number) => {
      if (!selectedNodeId) {
        return;
      }

      const normalizedRestoredContent = normalizeTiptapContent(restoredContent);

      setEditorContent(normalizedRestoredContent);
      editorContentNodeIdRef.current = selectedNodeId;

      utils.nodes.getById.setData({ id: selectedNodeId }, (currentNode) => {
        if (!currentNode || currentNode.type !== "note") {
          return currentNode;
        }

        return {
          ...currentNode,
          content: normalizedRestoredContent,
        };
      });

      markSaved(normalizedRestoredContent);
      void utils.nodes.getById.invalidate({ id: selectedNodeId });
      closeHistoryDialog();
    },
    [closeHistoryDialog, markSaved, selectedNodeId, utils.nodes.getById],
  );

  // Sync editor content when the selected note changes or when a note first
  // loads. Do not overwrite local editor state just because edit mode toggled
  // off, otherwise stale query data can clobber a freshly autosaved note.
  React.useEffect(() => {
    if (!selectedNodeId) {
      setEditorContent(null);
      editorContentNodeIdRef.current = null;
      markSaved(null);
      return;
    }

    if (selectedNodeQuery.data?.type !== "note") {
      if (selectedNodeQuery.data) {
        setEditorContent(null);
        editorContentNodeIdRef.current = selectedNodeId;
        markSaved(null);
      }
      return;
    }

    const isNewlySelectedNote =
      editorContentNodeIdRef.current !== selectedNodeId;
    if (isNewlySelectedNote || editorContent === null) {
      setEditorContent(normalizedSelectedNoteContent);
      editorContentNodeIdRef.current = selectedNodeId;
      markSaved(normalizedSelectedNoteContent);
    }
  }, [
    markSaved,
    selectedNodeId,
    selectedNodeQuery.data,
    normalizedSelectedNoteContent,
    editorContent,
  ]);

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

  React.useEffect(() => {
    if (!isSelectedNodeLocked) return;

    setIsTitleEditing(false);
    setIsNoteEditing(false);
  }, [isSelectedNodeLocked]);

  const handleTitleSave = React.useCallback(() => {
    const trimmed = titleEditValue.trim();
    if (
      !isSelectedNodeLocked &&
      trimmed &&
      trimmed !== selectedNodeQuery.data?.name &&
      selectedNodeId
    ) {
      nodeUpdateMutation.mutate({
        id: selectedNodeId,
        data: { name: trimmed },
      });
    }
    setIsTitleEditing(false);
  }, [
    titleEditValue,
    isSelectedNodeLocked,
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
    const renameTargetIsLocked =
      (nodeId === selectedNodeId && isSelectedNodeLocked) ||
      (nodeId === currentProject?.id && isCurrentProjectLocked);

    if (renameTargetIsLocked) {
      setRenameDialog({ open: false, nodeId: "", currentName: "" });
      addToast("Node is locked", "error");
      return;
    }

    nodeUpdateMutation.mutate({ id: nodeId, data: { name: newName } });
  };

  const handleNodeDelete = () => {
    if (!nodeDeleteConfirm.node) return;

    const isDeleteTargetLocked =
      (nodeDeleteConfirm.node.metadata as Record<string, unknown> | null)
        ?.isLocked === true;
    if (isDeleteTargetLocked) {
      setNodeDeleteConfirm({ open: false, node: null });
      return;
    }

    nodeDeleteMutation.mutate({ id: nodeDeleteConfirm.node.id });
  };

  const handleContextMenuAction = (action: ContextMenuAction) => {
    const isActionNodeLocked =
      (action.node.metadata as Record<string, unknown> | null)?.isLocked ===
      true;

    switch (action.type) {
      case "newFolder":
        if (isActionNodeLocked) break;
        setNodeCreateDialog({
          open: true,
          type: "folder",
          parentId: action.node.id,
        });
        break;
      case "newNote":
        if (isActionNodeLocked) break;
        setNodeCreateDialog({
          open: true,
          type: "note",
          parentId: action.node.id,
        });
        break;
      case "settings": {
        if (action.node.type === "project") {
          setSettingsNode(
            currentProjectSettingsNode ??
              createProjectSettingsNode({
                id: action.node.id,
                name: action.node.name,
                metadata: action.node.metadata,
              }),
          );
          break;
        }

        if (action.node.type === "folder") {
          const folderProjectId = getFolderSettingsProjectId(
            currentProjectId,
            action.node.parentId,
          );
          if (folderProjectId) {
            setSettingsNode(
              createFolderSettingsNode(action.node, folderProjectId),
            );
          }
          break;
        }

        // Notes and any other node type within a project
        if (currentProjectId) {
          setSettingsNode(
            createAnyNodeSettingsNode(
              action.node,
              action.node.type,
              currentProjectId,
            ),
          );
        }
        break;
      }
      case "rename":
        if (isActionNodeLocked) break;
        setRenameDialog({
          open: true,
          nodeId: action.node.id,
          currentName: action.node.name,
        });
        break;
      case "export":
        openExportDialog(action.node);
        break;
      case "toggleLock":
        toggleLockMutation.mutate({ nodeId: action.node.id });
        break;
      case "delete":
        if (isActionNodeLocked) break;
        setNodeDeleteConfirm({ open: true, node: action.node });
        break;
      case "tagSelection":
        // If nothing is shift-selected, tag just the right-clicked node
        if (selectedBulkNodeIds.size === 0) {
          setSelectedBulkNodeIds(new Set([action.node.id]));
        }
        setShowBulkTagModal(true);
        break;
    }
  };

  // === WORKSPACE VIEW (project selected) ===
  if (currentProjectId && currentProject && !forceList) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selNode = selectedNodeQuery.data as any;
    const activePdfTemplateId =
      pdfTemplateOptions.find(
        (templateOption) => templateOption.id === selectedPdfTemplateId,
      )?.id ?? DEFAULT_PROJECTS_PDF_TEMPLATE_ID;
    const exportDialogNode = exportDialogState.node;
    const exportDialogScopeDescription = exportDialogNode
      ? shouldExportDescendants(exportDialogNode.type)
        ? tFileTree("exportDialog.scopeWithChildren", {
            name: exportDialogNode.name,
          })
        : tFileTree("exportDialog.scopeSingleNode", {
            name: exportDialogNode.name,
          })
      : "";
    const isEditorEditable =
      selNode?.type === "note" && !isSelectedNodeLocked ? isNoteEditing : false;
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
                onClick={() => {
                  if (selectedWorkspaceSettingsNode) {
                    setSettingsNode(selectedWorkspaceSettingsNode);
                  }
                }}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                title={tCommon("settings")}
                aria-label={tCommon("settings")}
                disabled={!selectedWorkspaceSettingsNode}
                data-testid="workspace-settings-button"
              >
                <Settings className="w-3 h-3" />
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
              onSelectNode={navigateToNode}
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
              onToggleFavorite={handleToggleFavorite}
              selectedNodeIds={selectedBulkNodeIds}
              onToggleNodeSelected={handleToggleBulkNode}
              sortMode={fileTreeSortMode}
              onSortModeChange={handleSortModeChange}
              className="flex-1 min-h-0"
            />
            {currentProjectId && (
              <BulkTagBar
                open={showBulkTagModal}
                onClose={() => setShowBulkTagModal(false)}
                selectedNodeIds={selectedBulkNodeIds}
                projectId={currentProjectId}
                onClearSelection={() => setSelectedBulkNodeIds(new Set())}
              />
            )}
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
                        className={cn(
                          "text-2xl font-bold",
                          isSelectedNodeLocked
                            ? "cursor-default"
                            : "cursor-pointer",
                        )}
                        onDoubleClick={() => {
                          if (isSelectedNodeLocked) return;
                          setTitleEditValue(selNode?.name || "");
                          setIsTitleEditing(true);
                        }}
                        data-testid="content-title"
                      >
                        {selNode?.name}
                      </h1>
                    )}
                    <div className="flex items-center gap-2">
                      {isSelectedNodeLocked && (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
                          title={tFileTree("locked")}
                          aria-label={tFileTree("locked")}
                          data-testid="selected-node-lock-indicator"
                        >
                          <Lock className="h-3 w-3" />
                          {tFileTree("locked")}
                        </span>
                      )}
                      {selNode?.type === "note" && isNoteEditing && (
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
                      {selNode?.type === "note" && (
                        <button
                          onClick={() => {
                            setHistoryCompareVersions(null);
                            setIsHistoryDialogOpen(true);
                          }}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                          data-testid="note-history-button"
                        >
                          <History className="w-3 h-3" />
                          {tProvenance("versionHistory.title")}
                        </button>
                      )}
                      {selNode?.type === "note" && (
                        <button
                          onClick={handleNoteEditToggle}
                          className={cn(
                            "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                            isEditorEditable
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          )}
                          disabled={isSelectedNodeLocked}
                          data-testid="note-edit-toggle"
                        >
                          {isEditorEditable ? (
                            <>
                              <Check className="w-3 h-3" />
                              {tEditor("doneEditing")}
                            </>
                          ) : (
                            <>
                              <Pencil className="w-3 h-3" />
                              {tEditor("edit")}
                            </>
                          )}
                        </button>
                      )}
                      <span className="text-xs text-muted-foreground px-2 py-1 rounded bg-muted">
                        {tFileTree(`nodeTypes.${selNode?.type}`)}
                      </span>
                      {selNode && (
                        <button
                          type="button"
                          onClick={() =>
                            handleContextMenuAction({
                              type: "settings",
                              node: selNode as TreeNode,
                            })
                          }
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
                          title={tCommon("settings")}
                          aria-label={tCommon("settings")}
                          data-testid="content-settings-button"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openExportDialog(selNode as TreeNode)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
                        title={tFileTree("export")}
                        aria-label={tFileTree("export")}
                        data-testid="content-export-button"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (isSelectedNodeLocked) return;

                          setNodeDeleteConfirm({
                            open: true,
                            node: selNode as TreeNode,
                          });
                        }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        title={tCommon("delete")}
                        aria-label={tCommon("delete")}
                        disabled={isSelectedNodeLocked}
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
                      onNavigateToNode={navigateToNode}
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
                    const parsed = normalizedSelectedNoteContent;
                    const renderedEditorContent = editorContent ?? parsed;
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
                      <div
                        className="flex-1 min-h-0"
                        onDoubleClick={() => {
                          if (!isSelectedNodeLocked && !isNoteEditing) {
                            setIsNoteEditing(true);
                          }
                        }}
                      >
                        <TiptapEditor
                          content={renderedEditorContent}
                          nodeId={selectedNodeId ?? undefined}
                          editable={isEditorEditable}
                          onChange={
                            isEditorEditable ? setEditorContent : undefined
                          }
                          editorRef={editorInstanceRef}
                          onInsertImage={
                            isEditorEditable
                              ? () => setShowImageUpload((prev) => !prev)
                              : undefined
                          }
                          onInsertLink={
                            isEditorEditable ? handleOpenLinkPicker : undefined
                          }
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
                                {(
                                  ["upload", "existing", "generate"] as const
                                ).map((tab) => (
                                  <button
                                    key={tab}
                                    onClick={() => setImagePickerTab(tab)}
                                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${imagePickerTab === tab ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                  >
                                    {tEditor(
                                      `imageUpload.tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`,
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className="flex-1 overflow-y-auto p-4">
                                {imagePickerTab === "upload" ? (
                                  <ImageUpload
                                    nodeId={selectedNodeId!}
                                    projectId={currentProjectId}
                                    onUpload={handleImageUpload}
                                    onUploadComplete={handleImageUploadComplete}
                                    onUploadError={handleImageUploadError}
                                    isUploading={mediaUploadMutation.isPending}
                                  />
                                ) : imagePickerTab === "existing" ? (
                                  <div>
                                    {projectImagesQuery.isLoading ? (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        Loading images...
                                      </p>
                                    ) : (projectImagesQuery.data ?? []).filter(
                                        (a) => a.mimeType.startsWith("image/"),
                                      ).length === 0 ? (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        {tEditor("imageUpload.noImagesYet")}
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
                                              type="button"
                                              onClick={() => {
                                                editorInstanceRef.current
                                                  ?.chain()
                                                  .focus()
                                                  .setImage({
                                                    src: getMediaAttachmentUrl(
                                                      attachment.id,
                                                    ),
                                                  })
                                                  .run();
                                                setShowImageUpload(false);
                                              }}
                                              className="group aspect-square rounded border hover:border-primary overflow-hidden bg-muted/30 transition-colors"
                                              title={attachment.filename}
                                            >
                                              <div className="relative h-full w-full">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                  src={getMediaAttachmentUrl(
                                                    attachment.id,
                                                  )}
                                                  alt={attachment.filename}
                                                  loading="lazy"
                                                  className="h-full w-full object-cover"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                                                  <span className="block truncate text-xs text-white">
                                                    {attachment.filename}
                                                  </span>
                                                </div>
                                              </div>
                                            </button>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-3">
                                    {!masterKeyQuery.data?.masterKey ? (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        {tEditor("imageUpload.noApiKey")}
                                      </p>
                                    ) : (
                                      <>
                                        <label className="text-sm font-medium">
                                          {tEditor(
                                            "imageUpload.generatePromptLabel",
                                          )}
                                        </label>
                                        <textarea
                                          value={aiImagePrompt}
                                          onChange={(e) =>
                                            setAiImagePrompt(e.target.value)
                                          }
                                          rows={3}
                                          className="w-full rounded border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                                          placeholder="A serene forest at dawn with soft golden light..."
                                          disabled={
                                            generateImageMutation.isPending
                                          }
                                        />
                                        <button
                                          onClick={() => {
                                            if (
                                              !aiImagePrompt.trim() ||
                                              !currentProjectId
                                            )
                                              return;
                                            generateImageMutation.mutate({
                                              prompt: aiImagePrompt.trim(),
                                              projectId: currentProjectId,
                                              masterKey:
                                                masterKeyQuery.data!.masterKey!,
                                            });
                                          }}
                                          disabled={
                                            !aiImagePrompt.trim() ||
                                            generateImageMutation.isPending
                                          }
                                          className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                                        >
                                          {generateImageMutation.isPending ? (
                                            <>
                                              <Loader2 className="w-4 h-4 animate-spin" />
                                              {tEditor(
                                                "imageUpload.generating",
                                              )}
                                            </>
                                          ) : (
                                            tEditor(
                                              "imageUpload.generateButton",
                                            )
                                          )}
                                        </button>
                                      </>
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
                        metadata: unknown;
                      }[]) ?? []
                    }
                    onOpenNode={navigateToNode}
                    onToggleFavorite={handleToggleFavorite}
                    onSettings={(childNodeId) => {
                      const childNode = (
                        folderChildrenQuery.data as
                          | {
                              id: string;
                              name: string;
                              type: string;
                              metadata?: unknown;
                            }[]
                          | undefined
                      )?.find((n) => n.id === childNodeId);
                      if (childNode && currentProjectId) {
                        setSettingsNode(
                          createAnyNodeSettingsNode(
                            childNode,
                            childNode.type,
                            currentProjectId,
                          ),
                        );
                      }
                    }}
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

          {selectedNodeId && selNode?.type === "note" && (
            <Dialog
              open={isHistoryDialogOpen}
              onClose={closeHistoryDialog}
              title={tProvenance("versionHistory.title")}
              maxWidth="4xl"
              fillHeight
            >
              <VersionHistory
                nodeId={selectedNodeId}
                onCompare={handleHistoryCompare}
                onClearCompare={clearHistoryCompare}
                compareVersions={historyCompareVersions}
                currentContent={historyCompareCurrentContent}
                currentVersionLabel={tProvenance("diffViewer.current")}
                onRestoreSuccess={handleHistoryRestoreSuccess}
                className="flex-1"
              />
            </Dialog>
          )}

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
            selectedCount={selectedBulkNodeIds.size}
            onClose={() =>
              setContextMenu({
                open: false,
                position: { x: 0, y: 0 },
                node: null,
              })
            }
            onAction={handleContextMenuAction}
          />
          <Dialog
            open={exportDialogState.open}
            onClose={requestCloseExportDialog}
            title={tFileTree("exportDialog.title")}
            showFullscreenToggle={false}
            maxWidth="md"
            footer={
              <div className="flex items-center justify-end gap-2 px-6 py-4">
                <button
                  type="button"
                  onClick={requestCloseExportDialog}
                  className="rounded-md border px-4 py-2 text-sm transition-colors hover:bg-accent"
                  disabled={isExporting}
                  data-testid="export-cancel-button"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportConfirm()}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!exportDialogState.node || isExporting}
                  data-testid="export-confirm-button"
                >
                  {isExporting
                    ? tFileTree("exportDialog.exporting")
                    : tFileTree("exportDialog.confirm")}
                </button>
              </div>
            }
          >
            <div
              className="flex-1 overflow-y-auto px-6 pb-6"
              data-testid="export-dialog"
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    {tFileTree("exportDialog.description")}
                  </p>
                  {exportDialogNode && (
                    <p
                      className="text-sm font-medium text-foreground"
                      data-testid="export-scope-description"
                    >
                      {exportDialogScopeDescription}
                    </p>
                  )}
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">
                    {tFileTree("exportDialog.formatLabel")}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {(
                      [
                        "markdown",
                        "docx",
                        "pdf",
                        "zip",
                        "epub",
                      ] as const satisfies readonly ExportFormat[]
                    ).map((format) => {
                      const isSelectedFormat = selectedExportFormat === format;

                      return (
                        <button
                          key={format}
                          type="button"
                          onClick={() => setSelectedExportFormat(format)}
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                            isSelectedFormat
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-border hover:bg-accent/50",
                          )}
                          aria-pressed={isSelectedFormat}
                          data-testid={`export-format-${format}`}
                        >
                          {tFileTree(`exportDialog.formats.${format}`)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={exportNameOptions.includeFolderNames}
                      onChange={(event) =>
                        handleExportNameOptionsChange((previousOptions) => ({
                          ...previousOptions,
                          includeFolderNames: event.target.checked,
                        }))
                      }
                      data-testid="export-include-folder-names"
                    />
                    <span>{tFileTree("includeFolderNames")}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={exportNameOptions.includeNoteNames}
                      onChange={(event) =>
                        handleExportNameOptionsChange((previousOptions) => ({
                          ...previousOptions,
                          includeNoteNames: event.target.checked,
                        }))
                      }
                      data-testid="export-include-note-names"
                    />
                    <span>{tFileTree("includeNoteNames")}</span>
                  </label>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {tFileTree("sort.label")}
                  </p>
                  <div
                    className="flex items-center rounded-md border bg-background p-0.5"
                    data-testid="export-sort-controls"
                  >
                    <button
                      type="button"
                      onClick={() => handleSortModeChange("alphabetical")}
                      className={cn(
                        "rounded px-2 py-1 text-xs transition-colors",
                        fileTreeSortMode === "alphabetical"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-pressed={fileTreeSortMode === "alphabetical"}
                      data-testid="export-sort-alphabetical"
                    >
                      {tFileTree("sort.alphabetical")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSortModeChange("manual")}
                      className={cn(
                        "rounded px-2 py-1 text-xs transition-colors",
                        fileTreeSortMode === "manual"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-pressed={fileTreeSortMode === "manual"}
                      data-testid="export-sort-manual"
                    >
                      {tFileTree("sort.manual")}
                    </button>
                  </div>
                </div>

                {selectedExportFormat === "pdf" &&
                  pdfTemplateOptions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {tFileTree("pdfTemplate")}
                      </p>
                      <div className="mt-1 space-y-1">
                        {pdfTemplateOptions.map((templateOption) => {
                          const isActiveTemplate =
                            activePdfTemplateId === templateOption.id;

                          return (
                            <button
                              key={templateOption.id}
                              type="button"
                              onClick={() =>
                                handlePdfTemplateChange(templateOption.id)
                              }
                              className={cn(
                                "w-full rounded border px-2 py-1.5 text-left transition-colors",
                                isActiveTemplate
                                  ? "border-accent bg-accent/60 text-accent-foreground"
                                  : "border-border hover:bg-accent/50",
                              )}
                              aria-pressed={isActiveTemplate}
                              data-testid={`export-pdf-template-${templateOption.id}`}
                            >
                              <span className="block text-xs font-medium">
                                {templateOption.label}
                              </span>
                              <span className="block text-[11px] text-muted-foreground">
                                {templateOption.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {selectedExportFormat === "epub" && (
                  <div data-testid="epub-cover-picker">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {tFileTree("exportDialog.epubCoverLabel")}
                    </p>
                    {/* "None" option */}
                    <button
                      type="button"
                      onClick={() => setSelectedCoverAttachmentId(null)}
                      className={cn(
                        "mb-2 flex h-8 items-center justify-center rounded border px-3 text-xs transition-colors",
                        selectedCoverAttachmentId === null
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-accent/50",
                      )}
                      aria-pressed={selectedCoverAttachmentId === null}
                      data-testid="epub-cover-none"
                    >
                      {tFileTree("exportDialog.epubCoverNone")}
                    </button>
                    <MediaPickerGrid
                      items={epubImageAttachments}
                      selectedId={selectedCoverAttachmentId}
                      onSelect={(id) => setSelectedCoverAttachmentId(id)}
                      isLoading={epubAttachmentsQuery.isLoading}
                      columns={4}
                      aspect="square"
                      objectFit="cover"
                      showLabels
                      filterPlaceholder={tFileTree(
                        "exportDialog.epubCoverFilter",
                      )}
                      loadingLabel={tFileTree("exportDialog.epubCoverLoading")}
                      testIdPrefix="epub-cover"
                    />
                  </div>
                )}

                {selectedExportFormat === "epub" && (
                  <div
                    className="mt-4 space-y-3"
                    data-testid="epub-metadata-section"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {tFileTree("exportDialog.epubMetaHeading")}
                    </p>

                    <div className="space-y-1">
                      <label
                        htmlFor="epub-author"
                        className="text-xs text-muted-foreground"
                      >
                        {tFileTree("exportDialog.epubAuthorLabel")}
                      </label>
                      <input
                        id="epub-author"
                        type="text"
                        value={epubAuthor}
                        onChange={(e) => setEpubAuthor(e.target.value)}
                        placeholder={tFileTree(
                          "exportDialog.epubAuthorPlaceholder",
                        )}
                        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="epub-author-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="epub-description"
                        className="text-xs text-muted-foreground"
                      >
                        {tFileTree("exportDialog.epubDescriptionLabel")}
                      </label>
                      <textarea
                        id="epub-description"
                        value={epubDescription}
                        onChange={(e) => setEpubDescription(e.target.value)}
                        placeholder={tFileTree(
                          "exportDialog.epubDescriptionPlaceholder",
                        )}
                        rows={2}
                        className="w-full resize-none rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="epub-description-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="epub-language"
                        className="text-xs text-muted-foreground"
                      >
                        {tFileTree("exportDialog.epubLanguageLabel")}
                      </label>
                      <input
                        id="epub-language"
                        type="text"
                        value={epubLanguage}
                        onChange={(e) => setEpubLanguage(e.target.value)}
                        placeholder={tFileTree(
                          "exportDialog.epubLanguagePlaceholder",
                        )}
                        className="w-full rounded-md border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="epub-language-input"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Dialog>

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
            onSelectedThreadIdChange={setSelectedChatThreadId}
            onRemoveContext={(id) =>
              setChatContextNodes((prev) => prev.filter((n) => n.id !== id))
            }
            onAgentResponseSuccess={handleAgentResponseSuccess}
          />
        </div>

        {settingsNode && (
          <ProjectSettingsDialog
            open
            onClose={() => setSettingsNode(null)}
            node={settingsNode}
            onDelete={
              settingsNode.type === "project"
                ? () => {
                    const projectToDelete = settingsNode;
                    setSettingsNode(null);
                    openDeleteDialog({
                      id: projectToDelete.id,
                      name: projectToDelete.name,
                    });
                  }
                : undefined
            }
          />
        )}

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
      <div className="p-8 max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
            <p className="text-muted-foreground">{t("description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateDialog}
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
              const meta =
                (project.metadata as Record<string, unknown> | null) ?? {};
              return (
                <NoteCard
                  key={project.id}
                  node={{
                    id: project.id,
                    name: project.name,
                    firstMediaId: meta.heroAttachmentId as
                      | string
                      | null
                      | undefined,
                    heroFocalX: meta.heroFocalX as number | null | undefined,
                    heroFocalY: meta.heroFocalY as number | null | undefined,
                  }}
                  variant="compact"
                  description={
                    (project as { summary?: string | null }).summary ??
                    undefined
                  }
                  isSelected={isSelected}
                  onClick={async () => {
                    await setCurrentProject(project.id);
                    navigateToProjects();
                  }}
                  onSettings={() =>
                    setSettingsNode(
                      createProjectSettingsNode({
                        id: project.id,
                        name: project.name,
                        summary:
                          (project as { summary?: string | null }).summary ??
                          null,
                        metadata: meta,
                      }),
                    )
                  }
                />
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
              onClick={openCreateDialog}
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
          open={!!pendingImportRequest}
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

        <CreateProjectDialog
          open={createDialogOpen}
          projectName={projectName}
          isCreating={createMutation.isPending}
          isImporting={importDirectoryMutation.isPending}
          onClose={closeCreateDialog}
          onProjectNameChange={handleCreateProjectNameChange}
          onCreateBlank={handleCreate}
          onImportFromFolder={handleCreateDialogImportFromFolder}
        />

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

        {settingsNode && (
          <ProjectSettingsDialog
            open
            onClose={() => setSettingsNode(null)}
            node={settingsNode}
            onDelete={
              settingsNode.type === "project"
                ? () => {
                    const projectToDelete = settingsNode;
                    setSettingsNode(null);
                    openDeleteDialog({
                      id: projectToDelete.id,
                      name: projectToDelete.name,
                    });
                  }
                : undefined
            }
          />
        )}
      </div>
    </>
  );
}
