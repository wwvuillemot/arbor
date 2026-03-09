"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, Plus, Trash2, ImageIcon, X, AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getMediaAttachmentUrl } from "@/lib/media-url";

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

interface ProjectSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  project: {
    id: string;
    name: string;
    summary?: string | null;
    metadata: Record<string, unknown>;
  };
  /** When provided, renders a "Delete project" danger zone in the General tab */
  onDelete?: () => void;
}

export function ProjectSettingsDialog({
  open,
  onClose,
  project,
  onDelete,
}: ProjectSettingsDialogProps) {
  const t = useTranslations("editor.projectSettings");
  const tSp = useTranslations("editor.styleProfile");
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = React.useState<Tab>("general");

  // ── General tab state ───────────────────────────────────────────────────────
  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.summary ?? "");
  const [generalSaved, setGeneralSaved] = React.useState(false);

  const updateGeneralMutation = trpc.nodes.update.useMutation({
    onSuccess: () => {
      utils.nodes.getAllProjects.invalidate();
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 2000);
    },
  });

  const handleSaveGeneral = () => {
    updateGeneralMutation.mutate({
      id: project.id,
      data: { name: name.trim(), summary: description || null },
    });
  };

  // ── Appearance tab state ────────────────────────────────────────────────────
  const currentHeroId =
    (project.metadata.heroAttachmentId as string | null) ?? null;
  const [heroId, setHeroId] = React.useState<string | null>(currentHeroId);

  const mediaQuery = trpc.media.getByNode.useQuery(
    { nodeId: project.id },
    { enabled: open && activeTab === "appearance", staleTime: 30_000 },
  );

  const setHeroMutation = trpc.nodes.setHeroImage.useMutation({
    onSuccess: () => {
      utils.nodes.getAllProjects.invalidate();
    },
  });

  const handleSetHero = (attachmentId: string | null) => {
    setHeroId(attachmentId);
    setHeroMutation.mutate({ nodeId: project.id, attachmentId });
  };

  // ── Style presets tab state ─────────────────────────────────────────────────
  const { presets: initPresets, activePresetId: initActiveId } =
    parseStylePresets(
      project.metadata.styleProfile as Record<string, unknown> | undefined,
    );
  const initEditPreset = initPresets.find(
    (p) => p.id === (initActiveId ?? initPresets[0]?.id),
  );

  const [stylePresets, setStylePresets] =
    React.useState<StylePreset[]>(initPresets);
  const [spActiveId, setSpActiveId] = React.useState<string | undefined>(
    initActiveId,
  );
  const [spEditingId, setSpEditingId] = React.useState<string | undefined>(
    initActiveId ?? initPresets[0]?.id,
  );
  const [spEditName, setSpEditName] = React.useState(
    initEditPreset?.name ?? "",
  );
  const [spEditArtStyle, setSpEditArtStyle] = React.useState(
    initEditPreset?.artStyle ?? "",
  );
  const [spEditColorPalette, setSpEditColorPalette] = React.useState(
    initEditPreset?.colorPalette ?? "",
  );
  const [spEditMoodKeywords, setSpEditMoodKeywords] = React.useState(
    initEditPreset?.moodKeywords ?? "",
  );
  const [presetSaved, setPresetSaved] = React.useState(false);

  const updateStyleMutation = trpc.nodes.update.useMutation({
    onSuccess: () => {
      utils.nodes.getAllProjects.invalidate();
      setPresetSaved(true);
      setTimeout(() => setPresetSaved(false), 2000);
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
    setStylePresets(finalPresets);
    setSpActiveId(spEditingId);
    updateStyleMutation.mutate({
      id: project.id,
      data: {
        metadata: {
          ...project.metadata,
          styleProfile: { presets: finalPresets, activePresetId: spEditingId },
        },
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
    setSpActiveId(newActiveId);
    setSpEditingId(newEditingId);
    const ep = filtered.find((p) => p.id === newEditingId);
    setSpEditName(ep?.name ?? "");
    setSpEditArtStyle(ep?.artStyle ?? "");
    setSpEditColorPalette(ep?.colorPalette ?? "");
    setSpEditMoodKeywords(ep?.moodKeywords ?? "");
    updateStyleMutation.mutate({
      id: project.id,
      data: {
        metadata: {
          ...project.metadata,
          styleProfile: { presets: filtered, activePresetId: newActiveId },
        },
      },
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: t("tabGeneral") },
    { id: "appearance", label: t("tabAppearance") },
    { id: "style", label: t("tabStyle") },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("title", { name: project.name })}
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
              <button
                onClick={handleSaveGeneral}
                disabled={updateGeneralMutation.isPending || !name.trim()}
                className="self-start flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {generalSaved ? t("saved") : t("save")}
              </button>

              {onDelete && (
                <DangerZone
                  projectName={project.name}
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

                {/* Current hero */}
                {heroId && (
                  <div className="relative inline-block mb-3">
                    <img
                      src={getMediaAttachmentUrl(heroId)}
                      alt="Hero"
                      className="h-32 w-64 object-cover rounded-md border"
                    />
                    <button
                      onClick={() => handleSetHero(null)}
                      className="absolute -top-2 -right-2 bg-background border rounded-full p-0.5 hover:bg-muted transition-colors"
                      title={t("clearHero")}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Image grid */}
                {mediaQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    {t("loadingImages")}
                  </p>
                ) : (mediaQuery.data ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 border border-dashed rounded-md text-muted-foreground">
                    <ImageIcon className="w-8 h-8" />
                    <p className="text-xs">{t("noImages")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {(mediaQuery.data ?? [])
                      .filter((m) => m.mimeType?.startsWith("image/"))
                      .map((media) => (
                        <button
                          key={media.id}
                          onClick={() => handleSetHero(media.id)}
                          className={cn(
                            "relative aspect-square rounded-md overflow-hidden border-2 transition-all",
                            heroId === media.id
                              ? "border-primary ring-2 ring-primary ring-offset-1"
                              : "border-transparent hover:border-primary/50",
                          )}
                        >
                          <img
                            src={getMediaAttachmentUrl(media.id)}
                            alt={media.filename ?? ""}
                            className="w-full h-full object-cover"
                          />
                          {heroId === media.id && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="w-5 h-5 text-primary drop-shadow" />
                            </div>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Style Presets ─────────────────────────────────────────── */}
          {activeTab === "style" && (
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
