"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, FolderTree, Pencil, Trash2, X, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCurrentProject } from "@/hooks/use-current-project";

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [projectName, setProjectName] = React.useState("");

  // Current project selection
  const { currentProjectId, setCurrentProject } = useCurrentProject();

  // Queries
  const projectsQuery = trpc.nodes.getAllProjects.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutations
  const createMutation = trpc.nodes.create.useMutation({
    onSuccess: () => {
      projectsQuery.refetch();
      setCreateDialogOpen(false);
      setProjectName("");
    },
  });

  const updateMutation = trpc.nodes.update.useMutation({
    onSuccess: () => {
      projectsQuery.refetch();
      setEditDialogOpen(false);
      setSelectedProject(null);
      setProjectName("");
    },
  });

  const deleteMutation = trpc.nodes.delete.useMutation({
    onSuccess: async () => {
      // If we deleted the currently selected project, clear the selection
      if (selectedProject && selectedProject.id === currentProjectId) {
        await setCurrentProject(null);
      }
      projectsQuery.refetch();
      setDeleteDialogOpen(false);
      setSelectedProject(null);
    },
  });

  const handleCreate = () => {
    if (!projectName.trim()) return;
    createMutation.mutate({
      type: "project",
      name: projectName.trim(),
      parentId: null,
    });
  };

  const handleEdit = () => {
    if (!selectedProject || !projectName.trim()) return;
    updateMutation.mutate({
      id: selectedProject.id,
      data: { name: projectName.trim() },
    });
  };

  const handleDelete = () => {
    if (!selectedProject) return;
    deleteMutation.mutate({ id: selectedProject.id });
  };

  const openEditDialog = (project: { id: string; name: string }) => {
    setSelectedProject(project);
    setProjectName(project.name);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (project: { id: string; name: string }) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <button
          onClick={() => setCreateDialogOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "transition-colors",
          )}
        >
          <Plus className="h-4 w-4" />
          {t("createProject")}
        </button>
      </div>

      {/* Projects Grid */}
      {projectsQuery.isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          {tCommon("loading")}
        </div>
      ) : projectsQuery.error ? (
        <div className="text-center py-12 text-destructive">
          {tCommon("error")}: {projectsQuery.error.message}
        </div>
      ) : projectsQuery.data && projectsQuery.data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectsQuery.data.map((project) => {
            const isSelected = currentProjectId === project.id;
            return (
              <div
                key={project.id}
                onClick={() => setCurrentProject(project.id)}
                className={cn(
                  "group relative rounded-lg border bg-card p-6 hover:shadow-md transition-shadow cursor-pointer",
                  isSelected &&
                  "border-green-500 bg-green-50 dark:bg-green-950",
                )}
              >
                {/* Checkmark in upper-right corner */}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <div className="rounded-full bg-green-500 p-1">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FolderTree className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-lg truncate">
                        {project.name}
                      </h3>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog({ id: project.id, name: project.name });
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium",
                      "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "transition-colors",
                    )}
                  >
                    <Pencil className="h-3 w-3" />
                    {tCommon("edit")}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog({ id: project.id, name: project.name });
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium",
                      "border border-input bg-background hover:bg-destructive hover:text-destructive-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "transition-colors",
                    )}
                  >
                    <Trash2 className="h-3 w-3" />
                    {tCommon("delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <FolderTree className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t("noProjects")}</h3>
          <p className="text-muted-foreground mb-4">
            {t("noProjectsDescription")}
          </p>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "transition-colors",
            )}
          >
            <Plus className="h-4 w-4" />
            {t("createProject")}
          </button>
        </div>
      )}

      {/* Create Dialog */}
      {createDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
            <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {t("createDialog.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("createDialog.description")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCreateDialogOpen(false);
                    setProjectName("");
                  }}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="project-name" className="text-sm font-medium">
                    {t("createDialog.name")}
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    placeholder={t("createDialog.namePlaceholder")}
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") {
                        setCreateDialogOpen(false);
                        setProjectName("");
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

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
                <button
                  onClick={() => {
                    setCreateDialogOpen(false);
                    setProjectName("");
                  }}
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
                  onClick={handleCreate}
                  disabled={!projectName.trim() || createMutation.isPending}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "transition-colors",
                  )}
                >
                  {createMutation.isPending
                    ? t("createDialog.creating")
                    : t("createDialog.create")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
            <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {t("editDialog.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("editDialog.description")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditDialogOpen(false);
                    setSelectedProject(null);
                    setProjectName("");
                  }}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="edit-project-name"
                    className="text-sm font-medium"
                  >
                    {t("editDialog.name")}
                  </label>
                  <input
                    id="edit-project-name"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEdit();
                      if (e.key === "Escape") {
                        setEditDialogOpen(false);
                        setSelectedProject(null);
                        setProjectName("");
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

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
                <button
                  onClick={() => {
                    setEditDialogOpen(false);
                    setSelectedProject(null);
                    setProjectName("");
                  }}
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
                  onClick={handleEdit}
                  disabled={!projectName.trim() || updateMutation.isPending}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "transition-colors",
                  )}
                >
                  {updateMutation.isPending
                    ? t("editDialog.saving")
                    : t("editDialog.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
            <div className="overflow-hidden rounded-lg border bg-card shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {t("deleteDialog.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("deleteDialog.description")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setSelectedProject(null);
                  }}
                  className="rounded-md p-1 hover:bg-accent transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
                <button
                  onClick={() => {
                    setDeleteDialogOpen(false);
                    setSelectedProject(null);
                  }}
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
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                    "transition-colors",
                  )}
                >
                  {deleteMutation.isPending
                    ? t("deleteDialog.deleting")
                    : t("deleteDialog.delete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
