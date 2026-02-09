"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, Tag } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import { TagBadge, type TagBadgeTag } from "./tag-badge";

export interface TagPickerProps {
  nodeId: string;
  className?: string;
}

/**
 * TagPicker - Assign/remove tags on a node
 *
 * Shows currently assigned tags as badges with remove buttons,
 * and a dropdown to add more tags from the full tag list.
 */
export function TagPicker({ nodeId, className }: TagPickerProps) {
  const t = useTranslations("tags");
  const { addToast } = useToast();

  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // Fetch all tags and tags assigned to this node
  const allTagsQuery = trpc.tags.getAll.useQuery({});
  const nodeTagsQuery = trpc.tags.getNodeTags.useQuery({ nodeId });

  const addMutation = trpc.tags.addToNode.useMutation({
    onSuccess: () => {
      utils.tags.getNodeTags.invalidate({ nodeId });
      addToast(t("tagAdded"), "success");
    },
    onError: () => {
      addToast(t("tagAddError"), "error");
    },
  });

  const removeMutation = trpc.tags.removeFromNode.useMutation({
    onSuccess: () => {
      utils.tags.getNodeTags.invalidate({ nodeId });
      addToast(t("tagRemoved"), "success");
    },
    onError: () => {
      addToast(t("tagRemoveError"), "error");
    },
  });

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const assignedTags = (nodeTagsQuery.data ?? []) as TagBadgeTag[];
  const allTags = (allTagsQuery.data ?? []) as TagBadgeTag[];
  const assignedTagIds = new Set(assignedTags.map((tag) => tag.id));

  // Filter available tags (not yet assigned, matching search)
  const availableTags = allTags.filter((tag) => {
    if (assignedTagIds.has(tag.id)) return false;
    if (search.trim()) {
      return tag.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  function handleAddTag(tag: TagBadgeTag) {
    addMutation.mutate({ nodeId, tagId: tag.id });
    setSearch("");
  }

  function handleRemoveTag(tag: TagBadgeTag) {
    removeMutation.mutate({ nodeId, tagId: tag.id });
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      data-testid="tag-picker"
    >
      {/* Assigned tags as badges */}
      {assignedTags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} size="sm" onRemove={handleRemoveTag} />
      ))}

      {/* Add tag button + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs",
            "text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors",
          )}
          data-testid="tag-picker-add-button"
          aria-label={t("addTag")}
        >
          <Plus className="w-3 h-3" />
          <Tag className="w-3 h-3" />
        </button>

        {isOpen && (
          <div
            className="absolute top-full left-0 mt-1 z-50 w-56 rounded-md border bg-popover shadow-md"
            data-testid="tag-picker-dropdown"
          >
            <div className="p-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchTags")}
                className="w-full text-sm rounded border bg-background px-2 py-1"
                data-testid="tag-picker-search"
                autoFocus
              />
            </div>
            <div className="max-h-40 overflow-y-auto px-1 pb-1">
              {availableTags.length === 0 ? (
                <p
                  className="text-xs text-muted-foreground px-2 py-2"
                  data-testid="tag-picker-empty"
                >
                  {t("noTags")}
                </p>
              ) : (
                availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors text-left"
                    data-testid={`tag-picker-option-${tag.id}`}
                  >
                    {tag.color && (
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    <span className="truncate">{tag.name}</span>
                    {tag.icon && <span className="text-xs">{tag.icon}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {assignedTags.length === 0 && !isOpen && (
        <span
          className="text-xs text-muted-foreground"
          data-testid="tag-picker-no-tags"
        >
          {t("noTagsAssigned")}
        </span>
      )}
    </div>
  );
}
