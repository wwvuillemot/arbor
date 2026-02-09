"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

export interface CreateNodeDialogProps {
  open: boolean;
  nodeType: "folder" | "note" | "project";
  parentId: string | null;
  isCreating: boolean;
  onClose: () => void;
  onCreate: (name: string, type: string, parentId: string | null) => void;
}

export function CreateNodeDialog({
  open,
  nodeType,
  parentId,
  isCreating,
  onClose,
  onCreate,
}: CreateNodeDialogProps) {
  const t = useTranslations();
  const [name, setName] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Translation keys per type
  const translationMap = {
    project: {
      title: t("projects.createDialog.title"),
      description: t("projects.createDialog.description"),
      nameLabel: t("projects.createDialog.name"),
      placeholder: t("projects.createDialog.namePlaceholder"),
      creating: t("projects.createDialog.creating"),
      create: t("projects.createDialog.create"),
    },
    folder: {
      title: t("fileTree.createFolder.title"),
      description: t("fileTree.createFolder.description"),
      nameLabel: t("fileTree.createFolder.name"),
      placeholder: t("fileTree.createFolder.namePlaceholder"),
      creating: t("fileTree.createFolder.creating"),
      create: t("fileTree.createFolder.create"),
    },
    note: {
      title: t("fileTree.createNote.title"),
      description: t("fileTree.createNote.description"),
      nameLabel: t("fileTree.createNote.name"),
      placeholder: t("fileTree.createNote.namePlaceholder"),
      creating: t("fileTree.createNote.creating"),
      create: t("fileTree.createNote.create"),
    },
  };

  const labels = translationMap[nodeType];

  React.useEffect(() => {
    if (open) {
      setName("");
      // Focus after dialog animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onCreate(trimmedName, nodeType, parentId);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-node-title"
        className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
      >
        <h2 id="create-node-title" className="text-lg font-semibold">
          {labels.title}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {labels.description}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="node-name" className="text-sm font-medium">
              {labels.nameLabel}
            </label>
            <input
              ref={inputRef}
              id="node-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={labels.placeholder}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isCreating}
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm border hover:bg-accent transition-colors"
              disabled={isCreating}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isCreating ? labels.creating : labels.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
