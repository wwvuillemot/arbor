"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, Bot } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { AgentModeDialog } from "./agent-mode-dialog";

export interface AgentModeConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  allowedTools: string[];
  guidelines: string;
  temperature: number;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function AgentModeManager() {
  const t = useTranslations("settings.agentModes");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingMode, setEditingMode] = React.useState<AgentModeConfig | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(
    null,
  );

  const {
    data: modes,
    isLoading,
    refetch,
  } = trpc.chat.listAgentModes.useQuery();
  const deleteMutation = trpc.chat.deleteAgentMode.useMutation({
    onSuccess: () => {
      refetch();
      setDeleteConfirmId(null);
    },
  });

  const handleCreate = () => {
    setEditingMode(null);
    setDialogOpen(true);
  };

  const handleEdit = (mode: AgentModeConfig) => {
    setEditingMode(mode);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirmId === id) {
      await deleteMutation.mutateAsync({ id });
    } else {
      setDeleteConfirmId(id);
      // Reset confirmation after 3 seconds
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const handleDialogClose = (success: boolean) => {
    setDialogOpen(false);
    setEditingMode(null);
    if (success) {
      refetch();
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Create Button */}
      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          className={cn(
            "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
            "hover:bg-primary/90 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          <Plus className="h-4 w-4" />
          {t("createMode")}
        </button>
      </div>

      {/* Modes List */}
      <div className="space-y-4">
        {modes?.map((mode) => (
          <div
            key={mode.id}
            className={cn(
              "rounded-lg border border-border bg-card p-6",
              "hover:border-primary/50 transition-colors",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="rounded-md bg-primary/10 p-2">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold">
                      {mode.displayName}
                    </h3>
                    {mode.isBuiltIn && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {t("builtIn")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {mode.description}
                  </p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium">{t("temperature")}:</span>{" "}
                      {mode.temperature.toFixed(2)}
                    </div>
                    <div>
                      <span className="font-medium">{t("tools")}:</span>{" "}
                      {mode.allowedTools.length === 0
                        ? t("allTools")
                        : `${mode.allowedTools.length} ${t("toolsCount")}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Edit button - now available for ALL modes */}
                <button
                  onClick={() => handleEdit(mode)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium",
                    "border border-input bg-background hover:bg-muted hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("edit")}
                </button>

                {/* Delete button - only for custom modes */}
                {!mode.isBuiltIn && (
                  <button
                    onClick={() => handleDelete(mode.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium",
                      deleteConfirmId === mode.id
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        : "border border-input bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleteConfirmId === mode.id
                      ? t("confirmDelete")
                      : t("delete")}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <AgentModeDialog
        open={dialogOpen}
        mode={editingMode}
        onClose={handleDialogClose}
      />
    </div>
  );
}
