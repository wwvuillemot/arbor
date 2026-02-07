"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { commandRegistry } from "@/lib/command-registry";

/**
 * Hook to register command groups with localized labels
 * This should be called once in the app layout
 */
export function useCommandGroups() {
  const t = useTranslations("commandPalette.groups");

  React.useEffect(() => {
    // Clear existing groups (but keep commands)
    commandRegistry.clearGroups();

    // Register groups with translated labels
    commandRegistry.registerGroup({
      id: "navigation",
      label: t("navigation"),
      priority: 100,
    });
    commandRegistry.registerGroup({
      id: "actions",
      label: t("actions"),
      priority: 90,
    });
    commandRegistry.registerGroup({
      id: "settings",
      label: t("settings"),
      priority: 80,
    });
    commandRegistry.registerGroup({
      id: "help",
      label: t("help"),
      priority: 70,
    });
  }, [t]);
}
