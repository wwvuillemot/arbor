"use client";

import * as React from "react";
import { Search, Link2, FileText, Folder, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LinkPickerTreeNode {
  id: string;
  name: string;
  type: string;
  depth: number;
}

interface LinkPickerDialogProps {
  open: boolean;
  isLoading: boolean;
  searchValue: string;
  nodes: LinkPickerTreeNode[];
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onInsertCustomUrl: (value: string) => void;
  onSelectNode: (nodeId: string) => void;
}

export function LinkPickerDialog({
  open,
  isLoading,
  searchValue,
  nodes,
  onClose,
  onSearchChange,
  onInsertCustomUrl,
  onSelectNode,
}: LinkPickerDialogProps) {
  const normalizedSearch = searchValue.trim().toLowerCase();
  const filteredNodes = React.useMemo(
    () =>
      nodes.filter(
        ({ type, name }) =>
          type === "note" && name.toLowerCase().includes(normalizedSearch),
      ),
    [nodes, normalizedSearch],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Insert link"
        className="relative flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
        data-testid="link-picker-dialog"
      >
        <div className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Insert link</h2>
              <p className="text-sm text-muted-foreground">
                Paste a URL or link directly to another note in this project.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Close link picker"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-b bg-muted/30 px-5 py-4">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const rawValue = formData.get("customUrl");
              const customUrl =
                typeof rawValue === "string" ? rawValue.trim() : "";
              if (!customUrl) return;
              onInsertCustomUrl(customUrl);
            }}
          >
            <label className="sr-only" htmlFor="link-picker-custom-url">
              Custom URL
            </label>
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                id="link-picker-custom-url"
                name="customUrl"
                type="text"
                placeholder="https://example.com or /projects?node=..."
                className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Insert link
            </button>
          </form>
        </div>

        <div className="border-b px-5 py-3">
          <label className="sr-only" htmlFor="link-picker-search">
            Search notes
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="link-picker-search"
              type="text"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search notes in this project"
              className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {isLoading ? (
            <p className="px-2 py-6 text-sm text-muted-foreground">
              Loading notes...
            </p>
          ) : normalizedSearch ? (
            filteredNodes.length > 0 ? (
              filteredNodes.map(({ id, name }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectNode(id)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  <span className="truncate">{name}</span>
                </button>
              ))
            ) : (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                No notes match “{searchValue.trim()}”.
              </p>
            )
          ) : nodes.length > 0 ? (
            nodes.map(({ id, name, type, depth }) => {
              const paddingLeft = `${depth * 16 + 12}px`;

              if (type === "folder") {
                return (
                  <div
                    key={id}
                    style={{ paddingLeft }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"
                  >
                    <Folder className="h-4 w-4 flex-shrink-0 text-amber-500" />
                    <span className="truncate">{name}</span>
                  </div>
                );
              }

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectNode(id)}
                  style={{ paddingLeft }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  <span className="truncate">{name}</span>
                </button>
              );
            })
          ) : (
            <p className="px-2 py-6 text-sm text-muted-foreground">
              No notes are available to link yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
