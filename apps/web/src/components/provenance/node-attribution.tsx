"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { AttributionBadge, type ActorType } from "./attribution-badge";

export interface NodeAttributionProps {
  /** Provenance string e.g. "user:alice" or "llm:gpt-4o" */
  updatedBy?: string;
  /** ISO timestamp of last update */
  updatedAt?: string;
  /** Provenance string for creation */
  createdBy?: string;
  className?: string;
}

/**
 * Determine actor type from a provenance string.
 */
function parseActorType(provenance?: string): ActorType | null {
  if (!provenance) return null;
  if (provenance.startsWith("llm:")) return "llm";
  if (provenance.startsWith("user:")) return "user";
  if (provenance.startsWith("system:")) return "system";
  return null;
}

/**
 * Determine if the node is AI-generated (both created and last updated by LLM)
 * vs AI-assisted (last updated by LLM but originally created by a user).
 */
function getAttributionLevel(
  createdBy?: string,
  updatedBy?: string,
): "ai-generated" | "ai-assisted" | "human" | null {
  const updatedActor = parseActorType(updatedBy);
  if (!updatedActor) return null;

  if (updatedActor === "llm") {
    const createdActor = parseActorType(createdBy);
    return createdActor === "llm" ? "ai-generated" : "ai-assisted";
  }

  return "human";
}

/**
 * NodeAttribution - Shows attribution status above the editor.
 *
 * Displays who last edited the node: human, AI-assisted, or AI-generated.
 * Includes a timestamp and the attribution badge.
 */
export function NodeAttribution({
  updatedBy,
  updatedAt,
  createdBy,
  className,
}: NodeAttributionProps) {
  const t = useTranslations("provenance.nodeAttribution");

  const actorType = parseActorType(updatedBy);
  const attributionLevel = getAttributionLevel(createdBy, updatedBy);

  // Don't render if no attribution data
  if (!actorType || !attributionLevel) return null;

  const formattedTime = updatedAt ? new Date(updatedAt).toLocaleString() : null;

  const levelLabel =
    attributionLevel === "ai-generated"
      ? t("aiGenerated")
      : attributionLevel === "ai-assisted"
        ? t("aiAssisted")
        : t("humanEdited");

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border mb-2",
        attributionLevel === "ai-generated" &&
          "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
        attributionLevel === "ai-assisted" &&
          "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
        attributionLevel === "human" &&
          "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
        className,
      )}
      data-testid="node-attribution"
    >
      <AttributionBadge actorType={actorType} actorId={updatedBy} size="sm" />
      <span
        className="text-muted-foreground"
        data-testid="node-attribution-level"
      >
        {levelLabel}
      </span>
      {formattedTime && (
        <span
          className="text-muted-foreground ml-auto"
          data-testid="node-attribution-time"
        >
          {formattedTime}
        </span>
      )}
    </div>
  );
}
