"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { SearchPanel } from "./search-panel";

export interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
}

export function SearchModal({ open, onClose, onSelectNode }: SearchModalProps) {
  const t = useTranslations("search");
  // Keyboard: Escape to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const handleSelectNode = (nodeId: string) => {
    onSelectNode?.(nodeId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className="relative z-10 mt-[5vh] w-full max-w-3xl mx-4 rounded-2xl border bg-background shadow-2xl flex flex-col"
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-0 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("title")}
          </span>
          <div className="flex items-center gap-3">
            <kbd className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 border rounded bg-muted text-muted-foreground font-mono">
              Esc
            </kbd>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search panel fills the rest */}
        <SearchPanel
          onSelectNode={handleSelectNode}
          className="flex-1 min-h-0"
        />
      </div>
    </div>
  );
}
