"use client";

import * as React from "react";
import diff_match_patch from "diff-match-patch";
import ReactMarkdown from "react-markdown";
import { useTranslations } from "next-intl";
import { tiptapToMarkdown } from "@/lib/tiptap-utils";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export interface DiffViewerProps {
  nodeId: string;
  versionA: number;
  versionB: number;
  compareData?: CompareVersionsResult | null;
  versionALabel?: string;
  versionBLabel?: string;
  className?: string;
}

interface DiffPatch {
  diffs: Array<[number, string]>;
}

interface StoredPatchDiff {
  type: "diff-match-patch";
  patches: string;
  summary?: {
    additions?: number;
    deletions?: number;
    unchanged?: number;
  };
}

interface VersionWithContent {
  version?: number;
  contentAfter?: unknown;
}

interface CompareVersionsResult {
  versionA?: VersionWithContent;
  versionB?: VersionWithContent;
  diff?: unknown;
}

const diffEngine = new diff_match_patch();

function isStoredPatchDiff(diff: unknown): diff is StoredPatchDiff {
  return (
    Boolean(diff) &&
    typeof diff === "object" &&
    (diff as { type?: unknown }).type === "diff-match-patch" &&
    typeof (diff as { patches?: unknown }).patches === "string"
  );
}

/**
 * Parse a diff-match-patch patch result into renderable segments.
 * Each segment is [operation, text] where operation is:
 * -1 = deletion, 0 = equal, 1 = insertion
 */
function parseDiffSegments(diff: unknown): Array<{ op: number; text: string }> {
  if (!diff) return [];

  if (isStoredPatchDiff(diff)) {
    try {
      const parsedPatches = diffEngine.patch_fromText(
        diff.patches,
      ) as unknown as DiffPatch[];
      return parsedPatches.flatMap((patch) =>
        patch.diffs.map(([op, text]) => ({ op, text })),
      );
    } catch {
      return [];
    }
  }

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

function getDiffSummary(
  diff: unknown,
  segments: Array<{ op: number; text: string }>,
): { additions: number; deletions: number; unchanged: number } {
  if (isStoredPatchDiff(diff) && diff.summary) {
    return {
      additions: diff.summary.additions ?? 0,
      deletions: diff.summary.deletions ?? 0,
      unchanged: diff.summary.unchanged ?? 0,
    };
  }

  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const segment of segments) {
    if (segment.op === 1) additions += segment.text.length;
    else if (segment.op === -1) deletions += segment.text.length;
    else unchanged += segment.text.length;
  }

  return { additions, deletions, unchanged };
}

function serializeDiffContent(content: unknown): string {
  if (content == null) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  return JSON.stringify(content, null, 2);
}

function createStoredPatchDiff(
  contentBefore: unknown,
  contentAfter: unknown,
): StoredPatchDiff {
  const beforeText = serializeDiffContent(contentBefore);
  const afterText = serializeDiffContent(contentAfter);
  const rawDiffs = diffEngine.diff_main(beforeText, afterText) as Array<
    [number, string]
  >;

  diffEngine.diff_cleanupSemantic(rawDiffs);

  const patches = diffEngine.patch_make(beforeText, rawDiffs);
  return {
    type: "diff-match-patch",
    patches: diffEngine.patch_toText(patches),
    summary: getDiffSummary(
      null,
      rawDiffs.map(([op, text]) => ({ op, text })),
    ),
  };
}

function getContentPreview(content: unknown): string {
  if (typeof content === "string") {
    return content.trim() || "—";
  }

  if (content && typeof content === "object") {
    const markdownPreview = tiptapToMarkdown(
      content,
      Number.MAX_SAFE_INTEGER,
    ).trim();
    if (markdownPreview) {
      return markdownPreview;
    }

    try {
      return JSON.stringify(content, null, 2) || "—";
    } catch {
      return "—";
    }
  }

  return "—";
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
  compareData,
  versionALabel,
  versionBLabel,
  className,
}: DiffViewerProps) {
  const t = useTranslations("provenance.diffViewer");

  const compareQuery = trpc.provenance.compareVersions.useQuery(
    {
      nodeId,
      versionA,
      versionB,
    },
    {
      enabled: compareData == null,
    },
  );

  if (compareData == null && compareQuery.isLoading) {
    return (
      <div className={cn("p-4", className)} data-testid="diff-viewer-loading">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const data =
    compareData ?? (compareQuery.data as CompareVersionsResult | null) ?? null;
  if (!data) {
    return (
      <div className={cn("p-4", className)} data-testid="diff-viewer-empty">
        <p className="text-sm text-muted-foreground">{t("noDiff")}</p>
      </div>
    );
  }

  const segments = parseDiffSegments(data.diff);
  const summary = getDiffSummary(data.diff, segments);
  const versionAPreview = getContentPreview(data.versionA?.contentAfter);
  const versionBPreview = getContentPreview(data.versionB?.contentAfter);
  const renderedVersionALabel =
    versionALabel ?? `v${data.versionA?.version ?? versionA}`;
  const renderedVersionBLabel =
    versionBLabel ?? `v${data.versionB?.version ?? versionB}`;

  return (
    <div
      className={cn("min-w-0 flex flex-col gap-3", className)}
      data-testid="diff-viewer"
    >
      <h3 className="text-sm font-semibold">{t("title")}</h3>

      {/* Version labels */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span data-testid="diff-viewer-version-a">
          {t("versionA")}: {renderedVersionALabel}
        </span>
        <span data-testid="diff-viewer-version-b">
          {t("versionB")}: {renderedVersionBLabel}
        </span>
      </div>

      <div className="grid gap-3" data-testid="diff-viewer-version-panels">
        <div className="rounded-md border bg-red-50/60 p-4 dark:bg-red-950/10">
          <div className="mb-2 text-xs font-medium text-red-700 dark:text-red-300">
            {t("versionA")}: {renderedVersionALabel}
          </div>
          <div
            className="prose prose-sm prose-neutral max-w-none whitespace-pre-wrap break-words dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            data-testid="diff-viewer-version-a-content"
          >
            <ReactMarkdown>{versionAPreview}</ReactMarkdown>
          </div>
        </div>

        <div className="rounded-md border bg-green-50/60 p-4 dark:bg-green-950/10">
          <div className="mb-2 text-xs font-medium text-green-700 dark:text-green-300">
            {t("versionB")}: {renderedVersionBLabel}
          </div>
          <div
            className="prose prose-sm prose-neutral max-w-none whitespace-pre-wrap break-words dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            data-testid="diff-viewer-version-b-content"
          >
            <ReactMarkdown>{versionBPreview}</ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-3 text-xs" data-testid="diff-viewer-summary">
        <span className="text-green-600 dark:text-green-400">
          +{summary.additions} {t("additions")}
        </span>
        <span className="text-red-600 dark:text-red-400">
          -{summary.deletions} {t("deletions")}
        </span>
        <span className="text-muted-foreground">
          {summary.unchanged} {t("unchanged")}
        </span>
      </div>

      {/* Diff content */}
      <div
        className="max-h-96 overflow-auto rounded border bg-muted/30 p-3 font-mono text-sm whitespace-pre-wrap"
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

export function buildCurrentComparisonData(
  historicalVersion: number,
  historicalContent: unknown,
  currentVersion: number,
  currentContent: unknown,
): CompareVersionsResult {
  return {
    versionA: {
      version: historicalVersion,
      contentAfter: historicalContent,
    },
    versionB: {
      version: currentVersion,
      contentAfter: currentContent,
    },
    diff: createStoredPatchDiff(historicalContent, currentContent),
  };
}
