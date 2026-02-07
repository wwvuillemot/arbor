"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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

  React.useEffect(() => {
    const unregister = commandRegistry.registerMany([
      {
        id: "nav-dashboard",
        label: t("dashboard.label"),
        description: t("dashboard.description"),
        icon: LayoutDashboard,
        group: "navigation",
        keywords: [t("dashboard.keywords.0"), t("dashboard.keywords.1")],
        shortcut: ["g", "d"],
        action: () => router.push("/dashboard"),
      },
      {
        id: "nav-search",
        label: t("search.label"),
        description: t("search.description"),
        icon: Search,
        group: "navigation",
        keywords: [t("search.keywords.0"), t("search.keywords.1")],
        shortcut: ["g", "s"],
        action: () => router.push("/search"),
      },
      {
        id: "nav-projects",
        label: t("projects.label"),
        description: t("projects.description"),
        icon: FolderTree,
        group: "navigation",
        keywords: [
          t("projects.keywords.0"),
          t("projects.keywords.1"),
          t("projects.keywords.2"),
        ],
        shortcut: ["g", "p"],
        action: () => router.push("/projects"),
      },
      {
        id: "nav-chat",
        label: t("chat.label"),
        description: t("chat.description"),
        icon: MessageSquare,
        group: "navigation",
        keywords: [
          t("chat.keywords.0"),
          t("chat.keywords.1"),
          t("chat.keywords.2"),
        ],
        shortcut: ["g", "c"],
        action: () => router.push("/chat"),
      },
      {
        id: "nav-settings",
        label: t("settings.label"),
        description: t("settings.description"),
        icon: Settings,
        group: "settings",
        keywords: [
          t("settings.keywords.0"),
          t("settings.keywords.1"),
          t("settings.keywords.2"),
        ],
        shortcut: ["g", ","],
        action: () => router.push("/settings"),
      },
    ]);

    return unregister;
  }, [router, t]);
}
