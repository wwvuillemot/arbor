"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

export interface RenameDialogProps {
  open: boolean;
  currentName: string;
  nodeId: string;
  isSaving: boolean;
  onClose: () => void;
  onRename: (nodeId: string, newName: string) => void;
}

export function RenameDialog({
  open,
  currentName,
  nodeId,
  isSaving,
  onClose,
  onRename,
}: RenameDialogProps) {
  const t = useTranslations("fileTree.renameDialog");
  const tCommon = useTranslations("common");
  const [name, setName] = React.useState(currentName);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setName(currentName);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName === currentName) return;
    onRename(nodeId, trimmedName);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        className="relative z-10 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
      >
        <h2 id="rename-title" className="text-lg font-semibold">
          {t("title")}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="rename-input" className="text-sm font-medium">
              {t("name")}
            </label>
            <input
              ref={inputRef}
              id="rename-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isSaving}
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm border hover:bg-accent transition-colors"
              disabled={isSaving}
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim() || name.trim() === currentName}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
