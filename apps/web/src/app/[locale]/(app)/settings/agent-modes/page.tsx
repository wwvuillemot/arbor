"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AgentModeManager } from "@/components/agent-mode-manager";

export default function AgentModesPage() {
  const t = useTranslations("settings");

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-2">{t("nav.agentModes")}</h1>
      <p className="text-muted-foreground mb-8">
        {t("agentModes.description")}
      </p>

      <AgentModeManager />
    </div>
  );
}
