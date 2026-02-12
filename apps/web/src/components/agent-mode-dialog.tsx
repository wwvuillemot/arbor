"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { AgentModeConfig } from "./agent-mode-manager";
import { ToolSelector } from "./tool-selector";
import { MarkdownEditor } from "./markdown-editor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { Dialog } from "./dialog";

export interface AgentModeDialogProps {
  open: boolean;
  mode: AgentModeConfig | null;
  onClose: (success: boolean) => void;
}

export function AgentModeDialog({ open, mode, onClose }: AgentModeDialogProps) {
  const t = useTranslations("settings.agentModes");
  const isEditing = mode !== null;

  const [name, setName] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [guidelines, setGuidelines] = React.useState("");
  const [temperature, setTemperature] = React.useState(0.7);
  const [allowedTools, setAllowedTools] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const createMutation = trpc.chat.createAgentMode.useMutation();
  const updateMutation = trpc.chat.updateAgentMode.useMutation();

  // Reset form when dialog opens/closes or mode changes
  React.useEffect(() => {
    if (open) {
      if (mode) {
        setName(mode.name);
        setDisplayName(mode.displayName);
        setDescription(mode.description);
        setGuidelines(mode.guidelines);
        setTemperature(mode.temperature);
        setAllowedTools(mode.allowedTools);
      } else {
        setName("");
        setDisplayName("");
        setDescription("");
        setGuidelines("");
        setTemperature(0.7);
        setAllowedTools([]);
      }
      setError(null);
    }
  }, [open, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: mode.id,
          displayName,
          description,
          guidelines,
          temperature,
          allowedTools,
        });
      } else {
        await createMutation.mutateAsync({
          name,
          displayName,
          description,
          guidelines,
          temperature,
          allowedTools,
        });
      }
      onClose(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorSaving"));
    }
  };

  const handleCancel = () => {
    onClose(false);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Footer with action buttons
  const footer = (
    <div className="flex items-center justify-end gap-3 p-6">
      <button
        type="button"
        onClick={handleCancel}
        disabled={isSaving}
        className={cn(
          "rounded-md px-4 py-2 text-sm font-medium",
          "border border-input bg-background hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {t("form.cancel")}
      </button>
      <button
        type="submit"
        form="agent-mode-form"
        disabled={isSaving}
        className={cn(
          "rounded-md px-4 py-2 text-sm font-medium",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {isSaving ? t("form.saving") : t("form.save")}
      </button>
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      title={isEditing ? t("editMode") : t("createMode")}
      maxWidth="2xl"
      footer={footer}
    >
      <form
        id="agent-mode-form"
        onSubmit={handleSubmit}
        className="flex-1 overflow-hidden flex flex-col"
      >
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 flex justify-center">
            <TabsList className="justify-center">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
              <TabsTrigger value="tools">Tools</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-0">
              {/* Name (only for create) */}
              {!isEditing && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    {t("form.name")} <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("form.namePlaceholder")}
                    required
                    pattern="[a-z0-9_-]+"
                    className={cn(
                      "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "placeholder:text-muted-foreground",
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("form.nameHint")}
                  </p>
                </div>
              )}

              {/* Display Name */}
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium mb-2"
                >
                  {t("form.displayName")}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("form.displayNamePlaceholder")}
                  required
                  maxLength={100}
                  className={cn(
                    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "placeholder:text-muted-foreground",
                  )}
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium mb-2"
                >
                  {t("form.description")}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("form.descriptionPlaceholder")}
                  required
                  rows={2}
                  className={cn(
                    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "placeholder:text-muted-foreground resize-none",
                  )}
                />
              </div>

              {/* Temperature */}
              <div>
                <label
                  htmlFor="temperature"
                  className="block text-sm font-medium mb-2"
                >
                  {t("form.temperature")}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <div className="flex items-center gap-4">
                  <input
                    id="temperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-mono w-16 text-right">
                    {temperature.toFixed(1)}
                  </span>
                </div>

                {/* Visual markers - aligned with slider track */}
                <div className="relative mt-2 mb-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 flex justify-between text-xs px-2">
                      <span className="text-muted-foreground">0.0</span>
                      <span className="text-muted-foreground">0.5</span>
                      <span className="text-muted-foreground">1.0</span>
                      <span className="text-muted-foreground">1.5</span>
                      <span className="text-muted-foreground">2.0</span>
                    </div>
                    <div className="w-16"></div>
                  </div>
                </div>

                {/* Temperature guide */}
                <div className="space-y-2 text-xs">
                  <div className={cn(
                    "p-2 rounded-md border",
                    temperature >= 0 && temperature <= 0.2
                      ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                      : "bg-muted/50 border-border"
                  )}>
                    <div className="font-medium">0.0 - 0.2 (Very Low)</div>
                    <div className="text-muted-foreground">Deterministic, exact, and highly factual. Ideal for technical documentation, code, and data extraction.</div>
                  </div>
                  <div className={cn(
                    "p-2 rounded-md border",
                    temperature > 0.2 && temperature <= 0.6
                      ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                      : "bg-muted/50 border-border"
                  )}>
                    <div className="font-medium">0.3 - 0.6 (Medium)</div>
                    <div className="text-muted-foreground">Balanced, professional, and coherent. Good for general-purpose chat, summarization, or structured creative tasks.</div>
                  </div>
                  <div className={cn(
                    "p-2 rounded-md border",
                    temperature > 0.6 && temperature <= 1.0
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                      : "bg-muted/50 border-border"
                  )}>
                    <div className="font-medium">0.7 - 1.0 (Moderate to High)</div>
                    <div className="text-muted-foreground">Creative, varied, and conversational. Suitable for brainstorming, storytelling, and marketing copy.</div>
                  </div>
                  <div className={cn(
                    "p-2 rounded-md border",
                    temperature > 1.0
                      ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                      : "bg-muted/50 border-border"
                  )}>
                    <div className="font-medium">&gt; 1.0 (High)</div>
                    <div className="text-muted-foreground">Very random, creative, and risky. Potential for high creativity but also for lower coherence or hallucinations.</div>
                  </div>
                </div>

                <p className="text-xs text-amber-600 dark:text-amber-500 mt-3">
                  ⚠️ Note: Reasoning models (o1, o3, o3-mini, DeepSeek R1) do not support temperature control and will ignore this setting.
                </p>
              </div>
            </TabsContent>

            {/* Guidelines Tab */}
            <TabsContent value="guidelines" className="space-y-4 mt-0">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("form.guidelines")} <span className="text-destructive">*</span>
                </label>
                <MarkdownEditor
                  value={guidelines}
                  onChange={setGuidelines}
                  placeholder={t("form.guidelinesPlaceholder")}
                  required
                  minHeight="400px"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("form.guidelinesHint")}
                </p>
              </div>
            </TabsContent>

            {/* Tools Tab */}
            <TabsContent value="tools" className="space-y-4 mt-0">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("form.allowedTools")}
                </label>
                <ToolSelector value={allowedTools} onChange={setAllowedTools} />
                <p className="text-xs text-muted-foreground mt-2">
                  {t("form.allowedToolsHint")}
                </p>
              </div>
            </TabsContent>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/50 p-3 text-sm text-destructive mt-4">
                {error}
              </div>
            )}
          </div>
        </Tabs>

      </form>
    </Dialog>
  );
}
