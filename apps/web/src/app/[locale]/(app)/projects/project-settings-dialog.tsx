"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  Plus,
  Trash2,
  ImageIcon,
  X,
  AlertTriangle,
  UploadCloud,
} from "lucide-react";
import { Dialog } from "@/components/dialog";
import { MediaPickerGrid, InlineSvg } from "@/components/media-picker-grid";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getMediaAttachmentUrl } from "@/lib/media-url";
import { arrayBufferToBase64 } from "@/lib/base64";
import { useToast } from "@/contexts/toast-context";

// ── Style preset types ────────────────────────────────────────────────────────

export interface StylePreset {
  id: string;
  name: string;
  artStyle: string;
  colorPalette: string;
  moodKeywords: string;
}

export function parseStylePresets(sp: Record<string, unknown> | undefined): {
  presets: StylePreset[];
  activePresetId: string | undefined;
} {
  if (!sp) return { presets: [], activePresetId: undefined };
  if (Array.isArray((sp as { presets?: unknown }).presets)) {
    return {
      presets: (sp as { presets: StylePreset[] }).presets,
      activePresetId: (sp as { activePresetId?: string }).activePresetId,
    };
  }
  // Migrate v1 flat format
  if (sp.artStyle || sp.colorPalette || sp.moodKeywords) {
    return {
      presets: [
        {
          id: "default",
          name: "Default",
          artStyle: (sp.artStyle as string) ?? "",
          colorPalette: (sp.colorPalette as string) ?? "",
          moodKeywords: (sp.moodKeywords as string) ?? "",
        },
      ],
      activePresetId: "default",
    };
  }
  return { presets: [], activePresetId: undefined };
}

function cloneSettingsMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return { ...metadata };
}

function getInitialStyleEditorState(metadata: Record<string, unknown>) {
  const { presets, activePresetId } = parseStylePresets(
    metadata.styleProfile as Record<string, unknown> | undefined,
  );
  const editingPreset = presets.find(
    (preset) => preset.id === (activePresetId ?? presets[0]?.id),
  );

  return {
    presets,
    activePresetId,
    editingPresetId: activePresetId ?? presets[0]?.id,
    editName: editingPreset?.name ?? "",
    editArtStyle: editingPreset?.artStyle ?? "",
    editColorPalette: editingPreset?.colorPalette ?? "",
    editMoodKeywords: editingPreset?.moodKeywords ?? "",
  };
}

// ── Focal Point Picker ────────────────────────────────────────────────────────

function FocalPointPicker({
  imageUrl,
  focalX,
  focalY,
  onChange,
  onClear,
  clearLabel,
  hint,
}: {
  imageUrl: string;
  focalX: number;
  focalY: number;
  onChange: (x: number, y: number) => void;
  onClear: () => void;
  clearLabel: string;
  hint: string;
}) {
  const imgRef = React.useRef<HTMLDivElement>(null);

  const handlePointer = (e: React.MouseEvent) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(
      Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
    );
    const y = Math.round(
      Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    );
    onChange(x, y);
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    handlePointer(e);
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div
        ref={imgRef}
        className="relative w-full h-48 rounded-md border overflow-hidden cursor-crosshair select-none"
        onClick={handlePointer}
        onMouseMove={handleDrag}
      >
        <img
          src={imageUrl}
          alt="Hero"
          className="w-full h-full object-cover"
          style={{ objectPosition: `${focalX}% ${focalY}%` }}
          draggable={false}
        />
        {/* Focal point crosshair */}
        <div
          className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${focalX}%`, top: `${focalY}%` }}
        >
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-[0_0_4px_rgba(0,0,0,0.6)]" />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {focalX}% / {focalY}%
        </span>
        <button
          onClick={onClear}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" /> {clearLabel}
        </button>
      </div>
    </div>
  );
}

// ── Danger Zone ───────────────────────────────────────────────────────────────

function DangerZone({
  projectName,
  onDelete,
  t,
}: {
  projectName: string;
  onDelete: () => void;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [confirmInput, setConfirmInput] = React.useState("");

  return (
    <div className="mt-8 rounded-md border border-destructive/60 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/60 px-4 py-2.5">
        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
        <span className="text-sm font-semibold text-destructive">
          {t("dangerZone")}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{t("deleteProject")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("deleteProjectWarning")}
          </p>
        </div>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("deleteProject")}
          </button>
        ) : (
          <button
            onClick={() => setConfirming(false)}
            className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("cancel")}
          </button>
        )}
      </div>

      {/* Confirmation step */}
      {confirming && (
        <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {t("deleteConfirmPrompt", { name: projectName })}
          </p>
          <input
            autoFocus
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={projectName}
            className="px-3 py-1.5 text-sm rounded-md border border-destructive/40 bg-background outline-none focus:ring-2 focus:ring-destructive/40"
          />
          <button
            onClick={onDelete}
            disabled={confirmInput !== projectName}
            className="self-start flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t("deleteConfirmButton")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = "general" | "appearance" | "style";

// ── Component ─────────────────────────────────────────────────────────────────

export interface ProjectSettingsNode {
  id: string;
  name: string;
  type: string;
  projectId: string;
  summary?: string | null;
  metadata: Record<string, unknown>;
}

interface ProjectSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  node: ProjectSettingsNode;
  /** When provided, renders a "Delete project" danger zone in the General tab */
  onDelete?: () => void;
}

export function ProjectSettingsDialog({
  open,
  onClose,
  node,
  onDelete,
}: ProjectSettingsDialogProps) {
  const t = useTranslations("editor.projectSettings");
  const tSp = useTranslations("editor.styleProfile");
  const utils = trpc.useUtils();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = React.useState<Tab>("general");
  const [workingMetadata, setWorkingMetadata] = React.useState<
    Record<string, unknown>
  >(() => cloneSettingsMetadata(node.metadata));
  const workingMetadataRef = React.useRef(workingMetadata);

  React.useEffect(() => {
    workingMetadataRef.current = workingMetadata;
  }, [workingMetadata]);

  const invalidateSettingsQueries = React.useCallback(() => {
    void utils.nodes.getAllProjects.invalidate();
    void utils.nodes.getById.invalidate();
    void utils.nodes.getChildren.invalidate();
    void utils.nodes.getDescendants.invalidate();
  }, [utils]);

  // ── General tab state ───────────────────────────────────────────────────────
  const [name, setName] = React.useState(node.name);
  const [description, setDescription] = React.useState(node.summary ?? "");
  const [generalSaved, setGeneralSaved] = React.useState(false);
  const [epubAuthor, setEpubAuthor] = React.useState(
    (node.metadata.epubAuthor as string | undefined) ?? "",
  );
  const [epubDescription, setEpubDescription] = React.useState(
    (node.metadata.epubDescription as string | undefined) ?? "",
  );
  const [epubLanguage, setEpubLanguage] = React.useState(
    (node.metadata.epubLanguage as string | undefined) ?? "",
  );

  const updateGeneralMutation = trpc.nodes.update.useMutation({
    onSuccess: () => {
      invalidateSettingsQueries();
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 2000);
    },
    onError: (error) => {
      addToast(error.message || t("saveError"), "error");
    },
  });

  const handleSaveGeneral = () => {
    const nextMetadata = {
      ...workingMetadataRef.current,
      epubAuthor: epubAuthor.trim() || undefined,
      epubDescription: epubDescription.trim() || undefined,
      epubLanguage: epubLanguage.trim() || undefined,
    };
    setWorkingMetadata(nextMetadata);
    updateGeneralMutation.mutate({
      id: node.id,
      data: {
        name: name.trim(),
        summary: description || null,
        metadata: nextMetadata,
      },
    });
  };

  // ── Appearance tab state ────────────────────────────────────────────────────
  const currentHeroId =
    (workingMetadata.heroAttachmentId as string | null) ?? null;
  const [heroId, setHeroId] = React.useState<string | null>(currentHeroId);
  const [focalX, setFocalX] = React.useState<number>(
    (workingMetadata.heroFocalX as number | null) ?? 50,
  );
  const [focalY, setFocalY] = React.useState<number>(
    (workingMetadata.heroFocalY as number | null) ?? 50,
  );

  const mediaQuery = trpc.media.getByProject.useQuery(
    { projectId: node.projectId },
    { enabled: open && activeTab === "appearance", staleTime: 30_000 },
  );

  const setHeroMutation = trpc.nodes.setHeroImage.useMutation({
    onSuccess: () => {
      invalidateSettingsQueries();
    },
    onError: (error) => {
      // Roll back optimistic local state on failure
      setHeroId(currentHeroId);
      setWorkingMetadata((prev) => ({
        ...prev,
        heroAttachmentId: currentHeroId,
      }));
      addToast(error.message || t("saveError"), "error");
    },
  });

  const updateFocalMutation = trpc.nodes.update.useMutation({
    onSuccess: () => {
      invalidateSettingsQueries();
    },
    onError: (error) => {
      addToast(error.message || t("saveError"), "error");
    },
  });

  // ── Image upload ────────────────────────────────────────────────────────────
  const [isUploading, setIsUploading] = React.useState(false);
  const [isUploadingSvg, setIsUploadingSvg] = React.useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const chapterIconUploadInputRef = React.useRef<HTMLInputElement>(null);
  const dinkusUploadInputRef = React.useRef<HTMLInputElement>(null);
  const uploadMutation = trpc.media.upload.useMutation();

  const handleUploadFile = React.useCallback(
    async (file: File) => {
      const ACCEPTED_TYPES = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];
      const MAX_SIZE = 10 * 1024 * 1024;

      if (!ACCEPTED_TYPES.includes(file.type)) {
        return;
      }
      if (file.size > MAX_SIZE) {
        return;
      }

      setIsUploading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        const attachment = await uploadMutation.mutateAsync({
          nodeId: node.id,
          projectId: node.projectId,
          filename: file.name,
          mimeType: file.type,
          data: base64,
        });
        // Refetch media list so the new image appears in the grid
        await utils.media.getByProject.invalidate({
          projectId: node.projectId,
        });
        // Auto-select the newly uploaded image as hero
        handleSetHero(attachment.id);
      } finally {
        setIsUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node.id, node.projectId, uploadMutation, utils],
  );

  const handleUploadInputChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Reset so the same file can be re-selected
      e.target.value = "";
      await handleUploadFile(file);
    },
    [handleUploadFile],
  );

  /** Upload an SVG file and call onSuccess with the new attachment id (does NOT set as hero). */
  const handleUploadSvg = React.useCallback(
    async (file: File, onSuccess: (attachmentId: string) => void) => {
      if (file.type !== "image/svg+xml") return;
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) return;

      setIsUploadingSvg(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        const attachment = await uploadMutation.mutateAsync({
          nodeId: node.id,
          projectId: node.projectId,
          filename: file.name,
          mimeType: file.type,
          data: base64,
        });
        await utils.media.getByProject.invalidate({
          projectId: node.projectId,
        });
        onSuccess(attachment.id);
      } finally {
        setIsUploadingSvg(false);
      }
    },
    [node.id, node.projectId, uploadMutation, utils],
  );

  const handleSetHero = (attachmentId: string | null) => {
    setHeroId(attachmentId);
    setWorkingMetadata((previousMetadata) => ({
      ...previousMetadata,
      heroAttachmentId: attachmentId,
    }));
    setHeroMutation.mutate({ nodeId: node.id, attachmentId });
  };

  const handleFocalChange = (x: number, y: number) => {
    setFocalX(x);
    setFocalY(y);
    const nextMetadata = {
      ...workingMetadataRef.current,
      heroFocalX: x,
      heroFocalY: y,
    };
    setWorkingMetadata(nextMetadata);
    updateFocalMutation.mutate({
      id: node.id,
      data: {
        metadata: nextMetadata,
      },
    });
  };

  // ── EPUB SVG assets (chapter icon + dinkus) ─────────────────────────────────
  const [chapterIconId, setChapterIconId] = React.useState<string | null>(
    (workingMetadata.chapterIconAttachmentId as string | null) ?? null,
  );
  const [dinkusId, setDinkusId] = React.useState<string | null>(
    (workingMetadata.dinkusAttachmentId as string | null) ?? null,
  );

  const updateSvgMetaMutation = trpc.nodes.update.useMutation({
    onSuccess: () => {
      invalidateSettingsQueries();
    },
    onError: (error) => {
      addToast(error.message || t("saveError"), "error");
    },
  });

  const handleSetChapterIcon = (attachmentId: string | null) => {
    setChapterIconId(attachmentId);
    const nextMetadata = {
      ...workingMetadataRef.current,
      chapterIconAttachmentId: attachmentId ?? undefined,
    };
    setWorkingMetadata(nextMetadata);
    updateSvgMetaMutation.mutate({
      id: node.id,
      data: { metadata: nextMetadata },
    });
  };

  const handleSetDinkus = (attachmentId: string | null) => {
    setDinkusId(attachmentId);
    const nextMetadata = {
      ...workingMetadataRef.current,
      dinkusAttachmentId: attachmentId ?? undefined,
    };
    setWorkingMetadata(nextMetadata);
    updateSvgMetaMutation.mutate({
      id: node.id,
      data: { metadata: nextMetadata },
    });
  };

  // ── Style presets tab state ─────────────────────────────────────────────────
  const initialStyleEditorState = React.useMemo(
    () => getInitialStyleEditorState(workingMetadata),
    [workingMetadata],
  );

  const [stylePresets, setStylePresets] = React.useState<StylePreset[]>(
    initialStyleEditorState.presets,
  );
  const [spActiveId, setSpActiveId] = React.useState<string | undefined>(
    initialStyleEditorState.activePresetId,
  );
  const [spEditingId, setSpEditingId] = React.useState<string | undefined>(
    initialStyleEditorState.editingPresetId,
  );
  const [spEditName, setSpEditName] = React.useState(
    initialStyleEditorState.editName,
  );
  const [spEditArtStyle, setSpEditArtStyle] = React.useState(
    initialStyleEditorState.editArtStyle,
  );
  const [spEditColorPalette, setSpEditColorPalette] = React.useState(
    initialStyleEditorState.editColorPalette,
  );
  const [spEditMoodKeywords, setSpEditMoodKeywords] = React.useState(
    initialStyleEditorState.editMoodKeywords,
  );
  const [presetSaved, setPresetSaved] = React.useState(false);

  React.useEffect(() => {
    const nextMetadata = cloneSettingsMetadata(node.metadata);
    const nextStyleEditorState = getInitialStyleEditorState(nextMetadata);

    setActiveTab("general");
    setName(node.name);
    setDescription(node.summary ?? "");
    setGeneralSaved(false);
    setEpubAuthor((nextMetadata.epubAuthor as string | undefined) ?? "");
    setEpubDescription(
      (nextMetadata.epubDescription as string | undefined) ?? "",
    );
    setEpubLanguage((nextMetadata.epubLanguage as string | undefined) ?? "");
    setWorkingMetadata(nextMetadata);
    setHeroId((nextMetadata.heroAttachmentId as string | null) ?? null);
    setFocalX((nextMetadata.heroFocalX as number | null) ?? 50);
    setFocalY((nextMetadata.heroFocalY as number | null) ?? 50);
    setChapterIconId(
      (nextMetadata.chapterIconAttachmentId as string | null) ?? null,
    );
    setDinkusId((nextMetadata.dinkusAttachmentId as string | null) ?? null);
    setStylePresets(nextStyleEditorState.presets);
    setSpActiveId(nextStyleEditorState.activePresetId);
    setSpEditingId(nextStyleEditorState.editingPresetId);
    setSpEditName(nextStyleEditorState.editName);
    setSpEditArtStyle(nextStyleEditorState.editArtStyle);
    setSpEditColorPalette(nextStyleEditorState.editColorPalette);
    setSpEditMoodKeywords(nextStyleEditorState.editMoodKeywords);
    setPresetSaved(false);
  }, [open, node.id, node.name, node.summary, node.metadata]);

  const updateStyleMutation = trpc.nodes.update.useMutation({
    onSuccess: () => {
      invalidateSettingsQueries();
      setPresetSaved(true);
      setTimeout(() => setPresetSaved(false), 2000);
    },
    onError: (error) => {
      addToast(error.message || t("saveError"), "error");
    },
  });

  const handleSelectPreset = (preset: StylePreset) => {
    setSpEditingId(preset.id);
    setSpEditName(preset.name);
    setSpEditArtStyle(preset.artStyle);
    setSpEditColorPalette(preset.colorPalette);
    setSpEditMoodKeywords(preset.moodKeywords);
  };

  const handleAddPreset = () => {
    const newId = `preset-${Date.now()}`;
    const newPreset: StylePreset = {
      id: newId,
      name: "New Preset",
      artStyle: "",
      colorPalette: "",
      moodKeywords: "",
    };
    setStylePresets((prev) => [...prev, newPreset]);
    setSpEditingId(newId);
    setSpEditName(newPreset.name);
    setSpEditArtStyle("");
    setSpEditColorPalette("");
    setSpEditMoodKeywords("");
  };

  const handleSavePreset = () => {
    if (!spEditingId) return;
    const updated: StylePreset = {
      id: spEditingId,
      name: spEditName,
      artStyle: spEditArtStyle,
      colorPalette: spEditColorPalette,
      moodKeywords: spEditMoodKeywords,
    };
    const exists = stylePresets.some((p) => p.id === spEditingId);
    const finalPresets = exists
      ? stylePresets.map((p) => (p.id === spEditingId ? updated : p))
      : [...stylePresets, updated];
    const nextMetadata = {
      ...workingMetadataRef.current,
      styleProfile: { presets: finalPresets, activePresetId: spEditingId },
    };
    setStylePresets(finalPresets);
    setSpActiveId(spEditingId);
    setWorkingMetadata(nextMetadata);
    updateStyleMutation.mutate({
      id: node.id,
      data: {
        metadata: nextMetadata,
      },
    });
  };

  const handleDeletePreset = () => {
    if (!spEditingId) return;
    const filtered = stylePresets.filter((p) => p.id !== spEditingId);
    setStylePresets(filtered);
    const newActiveId =
      spEditingId === spActiveId ? filtered[0]?.id : spActiveId;
    const newEditingId = filtered[0]?.id;
    const nextMetadata = {
      ...workingMetadataRef.current,
      styleProfile: { presets: filtered, activePresetId: newActiveId },
    };
    setSpActiveId(newActiveId);
    setSpEditingId(newEditingId);
    const ep = filtered.find((p) => p.id === newEditingId);
    setSpEditName(ep?.name ?? "");
    setSpEditArtStyle(ep?.artStyle ?? "");
    setSpEditColorPalette(ep?.colorPalette ?? "");
    setSpEditMoodKeywords(ep?.moodKeywords ?? "");
    setWorkingMetadata(nextMetadata);
    updateStyleMutation.mutate({
      id: node.id,
      data: {
        metadata: nextMetadata,
      },
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: t("tabGeneral") },
    { id: "appearance", label: t("tabAppearance") },
    ...(node.type === "project"
      ? ([{ id: "style", label: t("tabStyle") }] as const)
      : []),
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("title", { name: node.name })}
      maxWidth="2xl"
      showFullscreenToggle={false}
    >
      <div className="flex h-full min-h-[480px]">
        {/* Tab sidebar */}
        <nav className="w-44 border-r flex-shrink-0 py-4 flex flex-col gap-0.5 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                activeTab === tab.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tab body */}
        <div className="flex-1 p-6 overflow-auto">
          {/* ── General ──────────────────────────────────────────────── */}
          {activeTab === "general" && (
            <div className="flex flex-col gap-5 max-w-lg">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t("name")}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="px-3 py-2 text-sm rounded-md border bg-background outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  {t("description")}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  rows={4}
                  className="px-3 py-2 text-sm rounded-md border bg-background outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {t("descriptionHint")}
                </p>
              </div>
              {/* ── EPUB Metadata ────────────────────────────────────── */}
              {node.type === "project" && (
                <div className="flex flex-col gap-3 border-t pt-4">
                  <div>
                    <h3 className="text-sm font-medium">{t("epubSection")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("epubSectionHint")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                      {t("epubAuthor")}
                    </label>
                    <input
                      value={epubAuthor}
                      onChange={(e) => setEpubAuthor(e.target.value)}
                      placeholder={t("epubAuthorPlaceholder")}
                      className="px-3 py-2 text-sm rounded-md border bg-background outline-none focus:ring-2 focus:ring-ring"
                      data-testid="project-settings-epub-author"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                      {t("epubDescription")}
                    </label>
                    <textarea
                      value={epubDescription}
                      onChange={(e) => setEpubDescription(e.target.value)}
                      placeholder={t("epubDescriptionPlaceholder")}
                      rows={3}
                      className="px-3 py-2 text-sm rounded-md border bg-background outline-none focus:ring-2 focus:ring-ring resize-none"
                      data-testid="project-settings-epub-description"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                      {t("epubLanguage")}
                    </label>
                    <input
                      value={epubLanguage}
                      onChange={(e) => setEpubLanguage(e.target.value)}
                      placeholder={t("epubLanguagePlaceholder")}
                      className="px-3 py-2 text-sm rounded-md border bg-background outline-none focus:ring-2 focus:ring-ring"
                      data-testid="project-settings-epub-language"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleSaveGeneral}
                disabled={updateGeneralMutation.isPending || !name.trim()}
                className="self-start flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {generalSaved ? t("saved") : t("save")}
              </button>

              {onDelete && (
                <DangerZone
                  projectName={node.name}
                  onDelete={() => {
                    onClose();
                    onDelete();
                  }}
                  t={t}
                />
              )}
            </div>
          )}

          {/* ── Appearance ───────────────────────────────────────────── */}
          {activeTab === "appearance" && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-sm font-medium mb-1">{t("heroImage")}</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("heroImageHint")}
                </p>

                {/* Current hero + focal point picker */}
                {heroId && (
                  <div className="mb-4">
                    <FocalPointPicker
                      imageUrl={getMediaAttachmentUrl(heroId)}
                      focalX={focalX}
                      focalY={focalY}
                      onChange={handleFocalChange}
                      onClear={() => handleSetHero(null)}
                      clearLabel={t("clearHero")}
                      hint={t("focalPointHint")}
                    />
                  </div>
                )}

                {/* Hidden file input for uploads */}
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleUploadInputChange}
                  data-testid="hero-upload-input"
                />

                {/* Image grid */}
                <MediaPickerGrid
                  items={(mediaQuery.data ?? []).filter((m) =>
                    m.mimeType?.startsWith("image/"),
                  )}
                  selectedId={heroId}
                  onSelect={handleSetHero}
                  onUploadClick={() => uploadInputRef.current?.click()}
                  isLoading={mediaQuery.isLoading}
                  isUploading={isUploading}
                  toggleable={false}
                  columns={4}
                  aspect="square"
                  objectFit="cover"
                  filterPlaceholder={t("filterImages")}
                  uploadLabel={t("uploadImage")}
                  emptyUploadLabel={t("uploadImage")}
                  loadingLabel={t("loadingImages")}
                  testIdPrefix="hero"
                />
              </div>

              {/* ── Chapter Icon (folder sections only) ────────────────── */}
              {node.type === "folder" && (
                <div>
                  <h3 className="text-sm font-medium mb-1">
                    {t("chapterIcon")}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("chapterIconHint")}
                  </p>

                  {chapterIconId && (
                    <div className="mb-2 flex items-center gap-3">
                      <InlineSvg
                        url={getMediaAttachmentUrl(chapterIconId)}
                        className="w-10 h-10 border rounded bg-muted/30"
                      />
                      <button
                        onClick={() => handleSetChapterIcon(null)}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        data-testid="clear-chapter-icon-button"
                      >
                        {t("clearChapterIcon")}
                      </button>
                    </div>
                  )}

                  <input
                    ref={chapterIconUploadInputRef}
                    type="file"
                    accept="image/svg+xml"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file)
                        await handleUploadSvg(file, handleSetChapterIcon);
                    }}
                  />
                  <MediaPickerGrid
                    items={(mediaQuery.data ?? []).filter(
                      (m) => m.mimeType === "image/svg+xml",
                    )}
                    selectedId={chapterIconId}
                    onSelect={handleSetChapterIcon}
                    onUploadClick={() =>
                      chapterIconUploadInputRef.current?.click()
                    }
                    isLoading={mediaQuery.isLoading}
                    isUploading={isUploadingSvg}
                    toggleable
                    columns={4}
                    aspect="square"
                    objectFit="contain"
                    invertOnDark
                    showLabels
                    filterPlaceholder={t("filterSvg")}
                    uploadLabel={t("uploadSvg")}
                    emptyUploadLabel={t("uploadSvg")}
                    loadingLabel={t("loadingImages")}
                    testIdPrefix="chapter-icon"
                  />
                </div>
              )}

              {/* ── Dinkus (folder + project as fallback) ──────────────── */}
              {(node.type === "folder" || node.type === "project") && (
                <div>
                  <h3 className="text-sm font-medium mb-1">{t("dinkus")}</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("dinkusHint")}
                  </p>

                  {dinkusId && (
                    <div className="mb-2 flex items-center gap-3">
                      <InlineSvg
                        url={getMediaAttachmentUrl(dinkusId)}
                        className="w-24 h-8 border rounded bg-muted/30"
                      />
                      <button
                        onClick={() => handleSetDinkus(null)}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        data-testid="clear-dinkus-button"
                      >
                        {t("clearDinkus")}
                      </button>
                    </div>
                  )}

                  <input
                    ref={dinkusUploadInputRef}
                    type="file"
                    accept="image/svg+xml"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) await handleUploadSvg(file, handleSetDinkus);
                    }}
                  />
                  <MediaPickerGrid
                    items={(mediaQuery.data ?? []).filter(
                      (m) => m.mimeType === "image/svg+xml",
                    )}
                    selectedId={dinkusId}
                    onSelect={handleSetDinkus}
                    onUploadClick={() => dinkusUploadInputRef.current?.click()}
                    isLoading={mediaQuery.isLoading}
                    isUploading={isUploadingSvg}
                    toggleable
                    columns={3}
                    aspect="wide"
                    objectFit="contain"
                    invertOnDark
                    showLabels
                    filterPlaceholder={t("filterSvg")}
                    uploadLabel={t("uploadSvg")}
                    emptyUploadLabel={t("uploadSvg")}
                    loadingLabel={t("loadingImages")}
                    testIdPrefix="dinkus"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Style Presets ─────────────────────────────────────────── */}
          {activeTab === "style" && node.type === "project" && (
            <div className="flex flex-col gap-4 max-w-lg">
              <div>
                <h3 className="text-sm font-medium mb-1">{tSp("title")}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("styleHint")}
                </p>
              </div>

              {/* Preset chips */}
              <div className="flex flex-wrap gap-2">
                {stylePresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border transition-colors",
                      spEditingId === preset.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary/60 text-foreground",
                    )}
                  >
                    {preset.id === spActiveId && <Check className="w-3 h-3" />}
                    {preset.name}
                  </button>
                ))}
                <button
                  onClick={handleAddPreset}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-sm border border-dashed border-border hover:border-primary/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {tSp("addPreset")}
                </button>
              </div>

              {/* Edit form */}
              {spEditingId ? (
                <div className="flex flex-col gap-4 pt-2 border-t">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                      {tSp("presetName")}
                    </label>
                    <input
                      value={spEditName}
                      onChange={(e) => setSpEditName(e.target.value)}
                      placeholder={tSp("presetNamePlaceholder")}
                      className="px-3 py-2 text-sm rounded-md border bg-background outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                      {tSp("artStyle")}
                    </label>
                    <input
                      value={spEditArtStyle}
                      onChange={(e) => setSpEditArtStyle(e.target.value)}
                      placeholder={tSp("artStylePlaceholder")}
                      className="px-3 py-2 text-sm rounded-md border bg-background outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                      {tSp("colorPalette")}
                    </label>
                    <input
                      value={spEditColorPalette}
                      onChange={(e) => setSpEditColorPalette(e.target.value)}
                      placeholder={tSp("colorPalettePlaceholder")}
                      className="px-3 py-2 text-sm rounded-md border bg-background outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">
                      {tSp("moodKeywords")}
                    </label>
                    <input
                      value={spEditMoodKeywords}
                      onChange={(e) => setSpEditMoodKeywords(e.target.value)}
                      placeholder={tSp("moodKeywordsPlaceholder")}
                      className="px-3 py-2 text-sm rounded-md border bg-background outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSavePreset}
                      disabled={updateStyleMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                      {presetSaved ? tSp("saved") : tSp("saveAndActivate")}
                    </button>
                    <button
                      onClick={handleDeletePreset}
                      disabled={updateStyleMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t("delete")}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tSp("emptyDescription")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
