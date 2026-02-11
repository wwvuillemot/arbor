"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { AgentModeConfig } from "./agent-mode-manager";
import { ToolSelector } from "./tool-selector";
import { MarkdownEditor } from "./markdown-editor";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

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

  if (!open) return null;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">
            {isEditing ? t("editMode") : t("createMode")}
          </h2>
          <button
            onClick={handleCancel}
            className="rounded-md p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-hidden flex flex-col"
        >
          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4 border-b border-border">
              <TabsList className="w-full justify-start">
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
                      max="1"
                      step="0.01"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12 text-right">
                      {temperature.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p>{t("form.temperatureHint")}</p>
                    <p className="text-amber-600 dark:text-amber-500">
                      ⚠️ Note: Reasoning models (o1, o3, o3-mini, DeepSeek R1) do not support temperature control and will ignore this setting.
                    </p>
                  </div>
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

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
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
            onClick={handleSubmit}
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
      </div>
    </div>
  );
}
