"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type ActorType = "user" | "llm" | "system";

export interface AttributionBadgeProps {
  actorType: ActorType;
  actorId?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const ACTOR_ICONS: Record<ActorType, string> = {
  user: "👤",
  llm: "🤖",
  system: "⚙️",
};

const ACTOR_COLORS: Record<ActorType, string> = {
  user: "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700",
  llm: "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700",
  system: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
};

/**
 * AttributionBadge - Displays AI/human/system attribution indicator
 *
 * Shows a badge indicating whether content was created by a human,
 * AI model, or system process. Includes tooltip with actor details.
 */
export function AttributionBadge({
  actorType,
  actorId,
  size = "sm",
  className,
}: AttributionBadgeProps) {
  const t = useTranslations("provenance.attributionBadge");
  const [showTooltip, setShowTooltip] = React.useState(false);

  const icon = ACTOR_ICONS[actorType];
  const colorClasses = ACTOR_COLORS[actorType];

  const label =
    actorType === "llm"
      ? t("aiGenerated")
      : actorType === "user"
        ? t("humanCreated")
        : t("system");

  // Extract readable actor name from actorId (e.g., "llm:gpt-4o" → "gpt-4o")
  const actorDisplayName = actorId
    ? actorId.includes(":")
      ? actorId.split(":").slice(1).join(":")
      : actorId
    : undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium relative",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base",
        colorClasses,
        className,
      )}
      data-testid={`attribution-badge-${actorType}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      role="status"
      aria-label={`${label}${actorDisplayName ? ` - ${actorDisplayName}` : ""}`}
    >
      <span className="leading-none" data-testid="attribution-badge-icon">
        {icon}
      </span>
      <span data-testid="attribution-badge-label">{label}</span>

      {/* Tooltip */}
      {showTooltip && actorDisplayName && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs rounded bg-popover text-popover-foreground border shadow-md whitespace-nowrap z-50"
          data-testid="attribution-badge-tooltip"
        >
          {actorType === "llm" ? t("tooltip.model") : t("tooltip.actor")}:{" "}
          {actorDisplayName}
        </span>
      )}
    </span>
  );
}

