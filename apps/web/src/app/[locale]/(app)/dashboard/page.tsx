"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderTree, MessageSquare, ArrowRight, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCurrentProject } from "@/hooks/use-current-project";
import { cn } from "@/lib/utils";
import { HeroGradient } from "@/components/hero-gradient";

export default function DashboardPage() {
  const router = useRouter();
  const { setCurrentProject } = useCurrentProject();

  const projectsQuery = trpc.nodes.getAllProjects.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const threadsQuery = trpc.chat.listThreads.useQuery(undefined, {
    refetchOnWindowFocus: false,
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

  // Map projectId → project name for thread display
  const projectMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.name);
    return m;
  }, [projects]);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your projects and recent chats.
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
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleOpenProject(project.id)}
                className={cn(
                  "flex flex-col rounded-lg border bg-card text-left overflow-hidden p-0",
                  "hover:shadow-md hover:border-accent-foreground/20 transition-all duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-ring",
                )}
              >
                <HeroGradient seed={project.name} className="w-full h-20" />
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <FolderTree className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </button>
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
