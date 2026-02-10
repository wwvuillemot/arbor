"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export interface DiffViewerProps {
  nodeId: string;
  versionA: number;
  versionB: number;
  className?: string;
}

interface DiffPatch {
  diffs: Array<[number, string]>;
}

/**
 * Parse a diff-match-patch patch result into renderable segments.
 * Each segment is [operation, text] where operation is:
 * -1 = deletion, 0 = equal, 1 = insertion
 */
function parseDiffSegments(
  diff: unknown,
): Array<{ op: number; text: string }> {
  if (!diff) return [];

  // If diff is a string (patch text), parse it
  if (typeof diff === "string") {
    // Simple heuristic: show as a single unchanged block
    return [{ op: 0, text: diff }];
  }

  // If it's an array of patches from diff-match-patch
  if (Array.isArray(diff)) {
    // Check if it's already an array of [op, text] tuples
    if (diff.length > 0 && Array.isArray(diff[0]) && diff[0].length === 2) {
      return diff.map(([op, text]: [number, string]) => ({ op, text }));
    }

    // It might be an array of patch objects with diffs
    const segments: Array<{ op: number; text: string }> = [];
    for (const patch of diff) {
      if (patch && typeof patch === "object" && "diffs" in patch) {
        const patchObj = patch as DiffPatch;
        for (const [op, text] of patchObj.diffs) {
          segments.push({ op, text });
        }
      }
    }
    if (segments.length > 0) return segments;
  }

  return [];
}

/**
 * DiffViewer - Displays an inline diff between two versions
 *
 * Shows additions in green, deletions in red, and unchanged text in default color.
 * Includes a summary with counts.
 */
export function DiffViewer({
  nodeId,
  versionA,
  versionB,
  className,
}: DiffViewerProps) {
  const t = useTranslations("provenance.diffViewer");

  const compareQuery = trpc.provenance.compareVersions.useQuery({
    nodeId,
    versionA,
    versionB,
  });

  if (compareQuery.isLoading) {
    return (
      <div className={cn("p-4", className)} data-testid="diff-viewer-loading">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const data = compareQuery.data;
  if (!data) {
    return (
      <div className={cn("p-4", className)} data-testid="diff-viewer-empty">
        <p className="text-sm text-muted-foreground">{t("noDiff")}</p>
      </div>
    );
  }

  const segments = parseDiffSegments(data.diff);

  // Count additions/deletions/unchanged characters
  let additionChars = 0;
  let deletionChars = 0;
  let unchangedChars = 0;
  for (const seg of segments) {
    if (seg.op === 1) additionChars += seg.text.length;
    else if (seg.op === -1) deletionChars += seg.text.length;
    else unchangedChars += seg.text.length;
  }

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-testid="diff-viewer"
    >
      <h3 className="text-sm font-semibold">{t("title")}</h3>

      {/* Version labels */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span data-testid="diff-viewer-version-a">
          {t("versionA")}: v{versionA}
        </span>
        <span data-testid="diff-viewer-version-b">
          {t("versionB")}: v{versionB}
        </span>
      </div>

      {/* Summary */}
      <div
        className="flex gap-3 text-xs"
        data-testid="diff-viewer-summary"
      >
        <span className="text-green-600 dark:text-green-400">
          +{additionChars} {t("additions")}
        </span>
        <span className="text-red-600 dark:text-red-400">
          -{deletionChars} {t("deletions")}
        </span>
        <span className="text-muted-foreground">
          {unchangedChars} {t("unchanged")}
        </span>
      </div>

      {/* Diff content */}
      <div
        className="p-3 rounded border bg-muted/30 text-sm font-mono whitespace-pre-wrap overflow-auto max-h-96"
        data-testid="diff-viewer-content"
      >
        {segments.length === 0 ? (
          <span className="text-muted-foreground">{t("noDiff")}</span>
        ) : (
          segments.map((seg, index) => (
            <span
              key={index}
              className={cn(
                seg.op === 1 &&
                  "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200",
                seg.op === -1 &&
                  "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 line-through",
              )}
              data-testid={`diff-segment-${index}`}
            >
              {seg.text}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

