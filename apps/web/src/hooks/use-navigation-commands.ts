"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useMessages } from "next-intl";
import {
  Search,
  LayoutDashboard,
  FolderTree,
  MessageSquare,
  Settings,
} from "lucide-react";
import { commandRegistry } from "@/lib/command-registry";

export function useNavigationCommands() {
  const router = useRouter();
  const t = useTranslations("commands.navigation");
  const messages = useMessages() as Record<string, unknown>;

  React.useEffect(() => {
    // Helper to safely get keywords array from messages
    const getKeywords = (path: string): string[] => {
      try {
        // Navigate through the messages object to get the keywords array
        const parts = `commands.navigation.${path}.keywords`.split(".");
        let current: unknown = messages;

        for (const part of parts) {
          if (current && typeof current === "object" && part in current) {
            current = (current as Record<string, unknown>)[part];
          } else {
            return [];
          }
        }

        // If we found an array, return it
        if (Array.isArray(current)) {
          return current;
        }

        return [];
      } catch {
        return [];
      }
    };

    const unregister = commandRegistry.registerMany([
      {
        id: "nav-dashboard",
        label: t("dashboard.label"),
        description: t("dashboard.description"),
        icon: LayoutDashboard,
        group: "navigation",
        keywords: getKeywords("dashboard"),
        shortcut: ["g", "d"],
        action: () => router.push("/dashboard"),
      },
      {
        id: "nav-search",
        label: t("search.label"),
        description: t("search.description"),
        icon: Search,
        group: "navigation",
        keywords: getKeywords("search"),
        shortcut: ["g", "s"],
        action: () => router.push("/search"),
      },
      {
        id: "nav-projects",
        label: t("projects.label"),
        description: t("projects.description"),
        icon: FolderTree,
        group: "navigation",
        keywords: getKeywords("projects"),
        shortcut: ["g", "p"],
        action: () => router.push("/projects"),
      },
      {
        id: "nav-chat",
        label: t("chat.label"),
        description: t("chat.description"),
        icon: MessageSquare,
        group: "navigation",
        keywords: getKeywords("chat"),
        shortcut: ["g", "c"],
        action: () => router.push("/chat"),
      },
      {
        id: "nav-settings",
        label: t("settings.label"),
        description: t("settings.description"),
        icon: Settings,
        group: "settings",
        keywords: getKeywords("settings"),
        shortcut: ["g", ","],
        action: () => router.push("/settings"),
      },
    ]);

    return unregister;
  }, [router, t, messages]);
}
