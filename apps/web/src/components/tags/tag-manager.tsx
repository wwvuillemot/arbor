"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Globe, FolderTree } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import { TagBadge, type TagBadgeTag } from "./tag-badge";

const TAG_TYPES = [
  "general",
  "character",
  "location",
  "event",
  "concept",
] as const;
type TagType = (typeof TAG_TYPES)[number];

const DEFAULT_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

export interface TagManagerProps {
  /** Current project context. When set, shows global + project tags and allows scoping. */
  projectId?: string;
  className?: string;
}

/**
 * TagManager - Full tag management panel
 *
 * Displays all tags with create/edit/delete functionality.
 * When `projectId` is provided, shows global tags + project-scoped tags,
 * and allows creating new tags as either global or project-scoped.
 */
export function TagManager({ projectId, className }: TagManagerProps) {
  const t = useTranslations("tags");
  const tCommon = useTranslations("common");
  const { addToast } = useToast();

  const [filterType, setFilterType] = React.useState<string>("");
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingTag, setEditingTag] = React.useState<TagBadgeTag | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState<TagBadgeTag | null>(
    null,
  );

  // Form state
  const [formName, setFormName] = React.useState("");
  const [formColor, setFormColor] = React.useState(DEFAULT_COLORS[0]);
  const [formType, setFormType] = React.useState<string>("general");
  // Scope: "project" = scoped to current project, "global" = visible everywhere
  const [formScope, setFormScope] = React.useState<"project" | "global">(
    projectId ? "project" : "global",
  );

  const utils = trpc.useUtils();

  // Fetch tags: global + project-scoped (if projectId provided)
  const tagsQuery = trpc.tags.getAll.useQuery(
    filterType
      ? { type: filterType as TagType, ...(projectId ? { projectId } : {}) }
      : projectId
        ? { projectId }
        : {},
  );

  const createMutation = trpc.tags.create.useMutation({
    onSuccess: () => {
      utils.tags.getAll.invalidate();
      setShowCreateForm(false);
      resetForm();
      addToast(t("createSuccess"), "success");
    },
    onError: () => {
      addToast(t("createError"), "error");
    },
  });

  const updateMutation = trpc.tags.update.useMutation({
    onSuccess: () => {
      utils.tags.getAll.invalidate();
      setEditingTag(null);
      resetForm();
      addToast(t("updateSuccess"), "success");
    },
    onError: () => {
      addToast(t("updateError"), "error");
    },
  });

  const deleteMutation = trpc.tags.delete.useMutation({
    onSuccess: () => {
      utils.tags.getAll.invalidate();
      setDeleteConfirm(null);
      addToast(t("deleteSuccess"), "success");
    },
    onError: () => {
      addToast(t("deleteError"), "error");
    },
  });

  function resetForm() {
    setFormName("");
    setFormColor(DEFAULT_COLORS[0]);
    setFormType("general");
    setFormScope(projectId ? "project" : "global");
  }

  function openEditForm(tag: TagBadgeTag & { projectId?: string | null }) {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color || DEFAULT_COLORS[0]);
    setFormType(tag.type);
    setFormScope(tag.projectId ? "project" : "global");
    setShowCreateForm(false);
  }

  function handleCreate() {
    if (!formName.trim()) return;
    createMutation.mutate({
      name: formName.trim(),
      color: formColor,
      type: formType as TagType,
      projectId: formScope === "project" && projectId ? projectId : null,
    });
  }

  function handleUpdate() {
    if (!editingTag || !formName.trim()) return;
    updateMutation.mutate({
      id: editingTag.id,
      name: formName.trim(),
      color: formColor,
      type: formType as TagType,
      projectId: formScope === "project" && projectId ? projectId : null,
    });
  }

  function handleDelete() {
    if (!deleteConfirm) return;
    deleteMutation.mutate({ id: deleteConfirm.id });
  }

  const allTags = (tagsQuery.data ?? []) as (TagBadgeTag & {
    projectId?: string | null;
  })[];

  // Split into project-scoped and global
  const projectTags = projectId
    ? allTags.filter((tag) => tag.projectId === projectId)
    : [];
  const globalTags = allTags.filter((tag) => !tag.projectId);

  const isFormOpen = showCreateForm || editingTag !== null;

  function renderTagGroup(
    groupTags: (TagBadgeTag & { projectId?: string | null })[],
    label: string,
    icon: React.ReactNode,
  ) {
    if (groupTags.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-1 mb-1.5">
          {icon}
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {groupTags.map((tag) => (
            <div key={tag.id} className="group relative">
              <TagBadge tag={tag} onClick={() => openEditForm(tag)} />
              <button
                onClick={() => setDeleteConfirm(tag)}
                className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs leading-none"
                data-testid={`tag-delete-${tag.id}`}
                aria-label={`${t("delete")} ${tag.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      data-testid="tag-manager"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setEditingTag(null);
            resetForm();
          }}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
          title={t("create")}
          data-testid="tag-create-button"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Type filter */}
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="text-xs rounded border bg-background px-2 py-1"
        data-testid="tag-type-filter"
      >
        <option value="">{t("allTypes")}</option>
        {TAG_TYPES.map((tagType) => (
          <option key={tagType} value={tagType}>
            {t(`types.${tagType}`)}
          </option>
        ))}
      </select>

      {/* Create/Edit form */}
      {isFormOpen && (
        <div
          className="flex flex-col gap-2 p-2 border rounded bg-card"
          data-testid="tag-form"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              {editingTag ? t("edit") : t("create")}
            </span>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setEditingTag(null);
                resetForm();
              }}
              className="p-0.5 rounded hover:bg-accent"
              data-testid="tag-form-cancel"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="text-sm rounded border bg-background px-2 py-1"
            data-testid="tag-form-name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (editingTag) handleUpdate();
                else handleCreate();
              }
            }}
          />

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">
              {t("color")}:
            </label>
            <div className="flex gap-1 flex-wrap">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormColor(color)}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 transition-transform",
                    formColor === color
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: color }}
                  data-testid={`tag-color-${color}`}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            className="text-xs rounded border bg-background px-2 py-1"
            data-testid="tag-form-type"
          >
            {TAG_TYPES.map((tagType) => (
              <option key={tagType} value={tagType}>
                {t(`types.${tagType}`)}
              </option>
            ))}
          </select>

          {/* Scope toggle — shown when in a project context (create or edit) */}
          {projectId && (
            <div className="flex rounded border overflow-hidden text-xs">
              <button
                onClick={() => setFormScope("project")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-1 transition-colors",
                  formScope === "project"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent",
                )}
              >
                <FolderTree className="w-3 h-3" />
                {t("scopeProject")}
              </button>
              <button
                onClick={() => setFormScope("global")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-1 transition-colors",
                  formScope === "global"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent",
                )}
              >
                <Globe className="w-3 h-3" />
                {t("scopeGlobal")}
              </button>
            </div>
          )}

          <button
            onClick={editingTag ? handleUpdate : handleCreate}
            disabled={
              !formName.trim() ||
              createMutation.isPending ||
              updateMutation.isPending
            }
            className="text-xs rounded bg-primary text-primary-foreground px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors"
            data-testid="tag-form-submit"
          >
            {createMutation.isPending || updateMutation.isPending
              ? editingTag
                ? t("saving")
                : t("creating")
              : editingTag
                ? tCommon("save")
                : t("create")}
          </button>
        </div>
      )}

      {/* Tag list — grouped when in project context */}
      {allTags.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="tag-empty">
          {t("noTags")}
        </p>
      ) : projectId ? (
        <div className="flex flex-col gap-3" data-testid="tag-list">
          {renderTagGroup(
            projectTags,
            t("scopeProject"),
            <FolderTree className="w-3 h-3 text-muted-foreground" />,
          )}
          {renderTagGroup(
            globalTags,
            t("scopeGlobal"),
            <Globe className="w-3 h-3 text-muted-foreground" />,
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5" data-testid="tag-list">
          {allTags.map((tag) => (
            <div key={tag.id} className="group relative">
              <TagBadge tag={tag} onClick={() => openEditForm(tag)} />
              <button
                onClick={() => setDeleteConfirm(tag)}
                className="absolute -top-1 -right-1 hidden group-hover:flex w-4 h-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs leading-none"
                data-testid={`tag-delete-${tag.id}`}
                aria-label={`${t("delete")} ${tag.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="flex flex-col gap-2 p-2 border border-destructive/50 rounded bg-card"
          data-testid="tag-delete-confirm"
        >
          <p className="text-xs">
            {t("confirmDelete", { name: deleteConfirm.name })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="text-xs rounded bg-destructive text-destructive-foreground px-3 py-1 hover:bg-destructive/90 disabled:opacity-50"
              data-testid="tag-delete-confirm-yes"
            >
              {deleteMutation.isPending ? t("deleting") : tCommon("delete")}
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="text-xs rounded border px-3 py-1 hover:bg-accent"
              data-testid="tag-delete-confirm-no"
            >
              {tCommon("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
