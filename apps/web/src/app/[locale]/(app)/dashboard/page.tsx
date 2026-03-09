"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FolderTree,
  MessageSquare,
  ArrowRight,
  Plus,
  Star,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCurrentProject } from "@/hooks/use-current-project";
import { cn } from "@/lib/utils";
import { HeroGradient } from "@/components/hero-gradient";
import { getMediaAttachmentUrl } from "@/lib/media-url";
import { NoteCard } from "@/components/note-card";
import { ProjectSettingsDialog } from "../projects/project-settings-dialog";

export default function DashboardPage() {
  const router = useRouter();
  const { setCurrentProject } = useCurrentProject();

  const [settingsProject, setSettingsProject] = React.useState<{
    id: string;
    name: string;
    summary?: string | null;
    metadata: Record<string, unknown>;
  } | null>(null);
  const projectsQuery = trpc.nodes.getAllProjects.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const threadsQuery = trpc.chat.listThreads.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const favoritesQuery = trpc.nodes.getAllFavorites.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.nodes.delete.useMutation({
    onSuccess: () => utils.nodes.getAllProjects.invalidate(),
  });
  const toggleFavoriteMutation = trpc.nodes.toggleFavorite.useMutation({
    onSuccess: () => {
      utils.nodes.getAllFavorites.invalidate();
    },
  });

  const projects = React.useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data],
  );
  const recentThreads = (threadsQuery.data ?? []).slice(0, 8);

  const handleOpenProject = React.useCallback(
    async (projectId: string) => {
      await setCurrentProject(projectId);
      router.push("/projects");
    },
    [setCurrentProject, router],
  );

  const handleOpenChat = React.useCallback(
    async (thread: { id: string; projectId?: string | null }) => {
      if (thread.projectId) {
        await setCurrentProject(thread.projectId);
      }
      localStorage.setItem("arbor:selectedThreadId", thread.id);
      router.push("/projects?chat=open");
    },
    [setCurrentProject, router],
  );

  const handleOpenFavorite = React.useCallback(
    async (node: { id: string; projectId: string }) => {
      await setCurrentProject(node.projectId);
      router.push(`/projects?node=${node.id}`);
    },
    [setCurrentProject, router],
  );

  // Map projectId → project name for thread display
  const projectMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      {settingsProject && (
        <ProjectSettingsDialog
          open
          onClose={() => setSettingsProject(null)}
          project={settingsProject}
          onDelete={() => {
            deleteMutation.mutate({ id: settingsProject.id });
            setSettingsProject(null);
          }}
        />
      )}
      <div>
        <h1 className="text-3xl font-bold">Arbor Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your projects, favorites, and recent chats.
        </p>
      </div>

      {/* ── Projects ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Projects</h2>
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {projectsQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-lg border bg-muted/30 animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border rounded-lg border-dashed text-muted-foreground gap-2">
            <FolderTree className="w-8 h-8 opacity-40" />
            <p className="text-sm">No projects yet.</p>
            <button
              onClick={() => router.push("/projects")}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const meta =
                (project.metadata as Record<string, unknown> | null) ?? {};
              return (
                <NoteCard
                  key={project.id}
                  node={{
                    id: project.id,
                    name: project.name,
                    firstMediaId: meta.heroAttachmentId as
                      | string
                      | null
                      | undefined,
                  }}
                  variant="compact"
                  description={
                    (project as { summary?: string | null }).summary ??
                    undefined
                  }
                  onClick={() => handleOpenProject(project.id)}
                  onSettings={() =>
                    setSettingsProject({
                      id: project.id,
                      name: project.name,
                      summary:
                        (project as { summary?: string | null }).summary ??
                        null,
                      metadata: meta,
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── Favorites ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          <h2 className="text-xl font-semibold">Favorites</h2>
        </div>

        {favoritesQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-lg border bg-muted/30 animate-pulse"
              />
            ))}
          </div>
        ) : (favoritesQuery.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 border rounded-lg border-dashed text-muted-foreground gap-2">
            <Star className="w-7 h-7 opacity-30" />
            <p className="text-sm">
              No favorites yet. Star nodes in your projects to see them here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(favoritesQuery.data ?? []).map((node) => (
              <NoteCard
                key={node.id}
                node={node}
                variant="compact"
                projectName={node.projectName}
                tags={node.tags}
                onClick={() => handleOpenFavorite(node)}
                onToggleFavorite={(nodeId) =>
                  toggleFavoriteMutation.mutate({ nodeId })
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Recent Chats ───────────────────────────────────────────── */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Recent Chats</h2>

        {threadsQuery.isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg border bg-muted/30 animate-pulse"
              />
            ))}
          </div>
        ) : recentThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border rounded-lg border-dashed text-muted-foreground gap-2">
            <MessageSquare className="w-8 h-8 opacity-40" />
            <p className="text-sm">No chats yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentThreads.map((thread) => {
              const projectName = thread.projectId
                ? projectMap.get(thread.projectId)
                : null;
              return (
                <button
                  key={thread.id}
                  onClick={() => handleOpenChat(thread)}
                  className={cn(
                    "flex items-center gap-3 w-full p-3 rounded-lg border text-left",
                    "hover:bg-accent hover:border-accent-foreground/20 transition-colors",
                    "group",
                  )}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {thread.name}
                    </div>
                    {projectName && (
                      <div className="text-xs text-muted-foreground truncate">
                        {projectName}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(thread.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
