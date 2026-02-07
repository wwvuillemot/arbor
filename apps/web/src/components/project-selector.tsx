"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { FolderTree, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useCurrentProject } from "@/hooks/use-current-project";

interface ProjectSelectorProps {
  isCollapsed: boolean;
}

export function ProjectSelector({ isCollapsed }: ProjectSelectorProps) {
  const t = useTranslations("projects");
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const { currentProjectId, setCurrentProject } = useCurrentProject();
  const projectsQuery = trpc.nodes.getAllProjects.useQuery(undefined, {
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Find the current project
  const currentProject = React.useMemo(() => {
    if (!currentProjectId || !projectsQuery.data) return null;
    return projectsQuery.data.find((p) => p.id === currentProjectId);
  }, [currentProjectId, projectsQuery.data]);

  // Clear currentProjectId if the project no longer exists
  React.useEffect(() => {
    if (
      currentProjectId &&
      projectsQuery.data &&
      !projectsQuery.data.find((p) => p.id === currentProjectId)
    ) {
      // Project was deleted, clear the selection
      setCurrentProject(null);
    }
  }, [currentProjectId, projectsQuery.data, setCurrentProject]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleSelectProject = async (projectId: string) => {
    await setCurrentProject(projectId);
    setIsOpen(false);
  };

  if (isCollapsed) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center justify-center w-full rounded-md px-2 py-2",
            "hover:bg-accent hover:text-accent-foreground",
            "transition-colors",
            currentProject && "text-green-600 dark:text-green-400",
          )}
          title={currentProject?.name || t("selectProject")}
        >
          <FolderTree className="h-5 w-5" />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute left-full ml-2 top-0 z-50 min-w-[200px] rounded-md border bg-popover p-1 shadow-md">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              {t("selectProject")}
            </div>
            {projectsQuery.data && projectsQuery.data.length > 0 ? (
              projectsQuery.data.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    "transition-colors",
                    currentProjectId === project.id && "bg-accent",
                  )}
                >
                  <FolderTree className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate text-left">
                    {project.name}
                  </span>
                  {currentProjectId === project.id && (
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {t("noProjects")}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 w-full rounded-md px-3 py-2",
          "hover:bg-accent hover:text-accent-foreground",
          "transition-colors",
        )}
      >
        <FolderTree className="h-5 w-5 flex-shrink-0" />
        <span className="flex-1 truncate text-left text-sm">
          {currentProject?.name || t("noProjectSelected")}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            isOpen && "transform rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 bottom-full mb-2 z-50 rounded-md border bg-popover p-1 shadow-md">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            {t("selectProject")}
          </div>
          {projectsQuery.data && projectsQuery.data.length > 0 ? (
            projectsQuery.data.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                className={cn(
                  "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-sm",
                  "hover:bg-accent hover:text-accent-foreground",
                  "transition-colors",
                  currentProjectId === project.id && "bg-accent",
                )}
              >
                <FolderTree className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate text-left">
                  {project.name}
                </span>
                {currentProjectId === project.id && (
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                )}
              </button>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              {t("noProjects")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
