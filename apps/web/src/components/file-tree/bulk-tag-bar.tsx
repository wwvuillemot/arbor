"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { X, Tag, Plus, Minus, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";

interface BulkTagBarProps {
  open: boolean;
  onClose: () => void;
  selectedNodeIds: Set<string>;
  projectId: string;
  onClearSelection: () => void;
}

/**
 * BulkTagBar — centered modal for bulk-tagging shift-selected nodes.
 *
 * Triggered by right-click → "Tag N selected…". Shows all project tags
 * as pills; pre-selects tags that are already on every selected node
 * (or partially on some).
 */
export function BulkTagBar({
  open,
  onClose,
  selectedNodeIds,
  projectId,
  onClearSelection,
}: BulkTagBarProps) {
  const t = useTranslations("fileTree.bulkTagBar");
  const { addToast } = useToast();
  const utils = trpc.useUtils();

  const [selectedTagIds, setSelectedTagIds] = React.useState<Set<string>>(
    new Set(),
  );

  const allTagsQuery = trpc.tags.getAll.useQuery(
    { projectId },
    { staleTime: 30_000, enabled: open },
  );

  // Fetch existing tags for each selected node so we can pre-populate
  const nodeIds = React.useMemo(() => [...selectedNodeIds], [selectedNodeIds]);

  const nodeTagQueries = trpc.useQueries((t) =>
    nodeIds.map((nodeId) =>
      t.tags.getNodeTags({ nodeId }, { staleTime: 30_000, enabled: open }),
    ),
  );

  // Compute which tags are on ALL selected nodes vs SOME
  const { allNodeTagIds, someNodeTagIds } = React.useMemo(() => {
    if (!open || nodeTagQueries.some((q) => q.isLoading)) {
      return {
        allNodeTagIds: new Set<string>(),
        someNodeTagIds: new Set<string>(),
      };
    }
    const tagSets = nodeTagQueries.map(
      (q) => new Set((q.data ?? []).map((tag: { id: string }) => tag.id)),
    );
    if (tagSets.length === 0) {
      return {
        allNodeTagIds: new Set<string>(),
        someNodeTagIds: new Set<string>(),
      };
    }
    // allNodeTagIds: tags present in every node
    const allNodeTagIds = new Set(
      [...tagSets[0]].filter((id) => tagSets.every((s) => s.has(id))),
    );
    // someNodeTagIds: tags present in at least one node
    const someNodeTagIds = new Set(tagSets.flatMap((s) => [...s]));
    return { allNodeTagIds, someNodeTagIds };
  }, [open, nodeTagQueries]);

  // Pre-populate selectedTagIds when modal opens and node tag data is ready
  const initialized = React.useRef(false);
  const isLoadingNodeTags = nodeTagQueries.some((q) => q.isLoading);
  React.useEffect(() => {
    if (!open) {
      initialized.current = false;
      setSelectedTagIds(new Set());
      return;
    }
    if (initialized.current || isLoadingNodeTags) return;
    initialized.current = true;
    // Pre-select tags that are on ALL nodes — snapshot at initialization time
    setSelectedTagIds(new Set(allNodeTagIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isLoadingNodeTags]);

  const bulkAddMutation = trpc.tags.bulkAddToNodes.useMutation({
    onSuccess: () => {
      addToast(t("added", { count: selectedNodeIds.size }), "success");
      void utils.tags.getNodeTags.invalidate();
      onClearSelection();
      onClose();
    },
    onError: () => addToast(t("error"), "error"),
  });

  const bulkRemoveMutation = trpc.tags.bulkRemoveFromNodes.useMutation({
    onSuccess: () => {
      addToast(t("removed", { count: selectedNodeIds.size }), "success");
      void utils.tags.getNodeTags.invalidate();
      onClearSelection();
      onClose();
    },
    onError: () => addToast(t("error"), "error"),
  });

  const isPending = bulkAddMutation.isPending || bulkRemoveMutation.isPending;
  const tags = allTagsQuery.data ?? [];

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function handleApply() {
    if (selectedNodeIds.size === 0) return;

    const nodeIdsArr = [...selectedNodeIds];

    // Tags to add: selected now but not on all nodes
    const toAdd = [...selectedTagIds].filter((id) => !allNodeTagIds.has(id));
    // Tags to remove: was on some/all nodes but not selected now
    const toRemove = [...someNodeTagIds].filter(
      (id) => !selectedTagIds.has(id),
    );

    for (const tagId of toAdd) {
      bulkAddMutation.mutate({ nodeIds: nodeIdsArr, tagId });
    }
    for (const tagId of toRemove) {
      bulkRemoveMutation.mutate({ nodeIds: nodeIdsArr, tagId });
    }

    // If nothing changed, just close
    if (toAdd.length === 0 && toRemove.length === 0) {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-[420px] max-w-[90vw] rounded-lg border bg-popover shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Tag className="w-4 h-4 text-primary shrink-0" />
          <span className="flex-1 text-sm font-medium">
            {t("title", { count: selectedNodeIds.size })}
          </span>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 flex flex-col gap-3">
          {allTagsQuery.isLoading || isLoadingNodeTags ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : tags.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              {t("noTags")}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t("hint")}</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id);
                  const onAll = allNodeTagIds.has(tag.id);
                  const onSome = someNodeTagIds.has(tag.id) && !onAll;

                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      disabled={isPending}
                      title={
                        onAll
                          ? t("tagOnAll")
                          : onSome
                            ? t("tagOnSome")
                            : undefined
                      }
                      className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium border transition-all select-none",
                        isSelected
                          ? "ring-2 ring-offset-1 ring-primary opacity-100"
                          : onSome
                            ? "opacity-60 hover:opacity-100 border-dashed"
                            : "opacity-50 hover:opacity-100",
                      )}
                      style={
                        tag.color
                          ? {
                              borderColor: tag.color,
                              color: tag.color,
                              backgroundColor: isSelected
                                ? `${tag.color}30`
                                : `${tag.color}12`,
                            }
                          : undefined
                      }
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-3 py-1.5 rounded text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleApply}
            disabled={isPending || allTagsQuery.isLoading || isLoadingNodeTags}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            {t("apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
