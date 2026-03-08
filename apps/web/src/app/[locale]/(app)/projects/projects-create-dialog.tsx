"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type CreateProjectDialogProps = {
  open: boolean;
  projectName: string;
  isCreating: boolean;
  isImporting: boolean;
  onClose: () => void;
  onProjectNameChange: (nextProjectName: string) => void;
  onCreateBlank: () => void;
  onImportFromFolder: () => void;
};

export function CreateProjectDialog({
  open,
  projectName,
  isCreating,
  isImporting,
  onClose,
  onProjectNameChange,
  onCreateBlank,
  onImportFromFolder,
}: CreateProjectDialogProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
        <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold">
                {t("createDialog.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("createDialog.description")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 hover:bg-accent transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-4">
            <div className="space-y-2">
              <label htmlFor="project-name" className="text-sm font-medium">
                {t("createDialog.name")}
              </label>
              <input
                id="project-name"
                type="text"
                placeholder={t("createDialog.namePlaceholder")}
                value={projectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onCreateBlank();
                  }

                  if (event.key === "Escape") {
                    onClose();
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
              onClick={onClose}
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
              onClick={onImportFromFolder}
              disabled={isImporting}
              className={cn(
                "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
                "transition-colors",
              )}
            >
              {isImporting
                ? t("createDialog.importing")
                : t("createDialog.importFromFolder")}
            </button>
            <button
              onClick={onCreateBlank}
              disabled={!projectName.trim() || isCreating}
              className={cn(
                "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
                "transition-colors",
              )}
            >
              {isCreating
                ? t("createDialog.creating")
                : t("createDialog.createBlank")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
