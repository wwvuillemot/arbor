"use client";

import * as React from "react";
import { Github, Code2, Database } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Dialog } from "./dialog";

export interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const t = useTranslations("about");

  // Get system info including database version
  const { data: systemInfo } = trpc.system.getInfo.useQuery(undefined, {
    enabled: open,
  });

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "i" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={
        <div className="flex items-center gap-3">
          <span className="text-3xl">🌳</span>
          <span>{t("title")}</span>
        </div>
      }
      maxWidth="md"
      showFullscreenToggle={false}
    >
      {/* Content */}
      <div className="p-6 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("version")}</span>
            <span className="font-mono">{systemInfo?.version || "0.1.0"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" />
              Database
            </span>
            <span className="font-mono text-xs">
              {systemInfo?.database?.version || "Loading..."}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("license")}</span>
            <span>MIT</span>
          </div>
        </div>

        <div className="pt-4 border-t space-y-2">
          <a
            href="https://github.com/wwvuillemot/arbor"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
              "hover:bg-accent transition-colors",
            )}
          >
            <Github className="h-4 w-4" />
            <span>{t("github")}</span>
          </a>
        </div>

        <div className="pt-4 border-t">
          <h3 className="text-sm font-medium mb-2">{t("techStack")}</h3>
          <div className="flex flex-wrap gap-2">
            {[
              "Next.js 15",
              "React 19",
              "TypeScript",
              "PostgreSQL",
              "Redis",
              "MinIO",
              "tRPC",
              "GraphQL",
              "Drizzle ORM",
              "Fastify",
            ].map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
              >
                <Code2 className="h-3 w-3" />
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-3 bg-muted/50">
        <p className="text-xs text-center text-muted-foreground">
          {t("footer")}
        </p>
      </div>
    </Dialog>
  );
}
