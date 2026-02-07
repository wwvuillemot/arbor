"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { commandRegistry } from "@/lib/command-registry";

export function useAboutCommand(openAbout: () => void) {
  const t = useTranslations("commands.help");

  React.useEffect(() => {
    const unregister = commandRegistry.register({
      id: "about-arbor",
      label: t("about.label"),
      description: t("about.description"),
      icon: Info,
      group: "help",
      keywords: [
        t("about.keywords.0"),
        t("about.keywords.1"),
        t("about.keywords.2"),
      ],
      shortcut: ["⌘", "⇧", "I"],
      action: openAbout,
    });

    return unregister;
  }, [openAbout, t]);
}
