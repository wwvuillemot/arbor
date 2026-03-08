import diff_match_patch from "diff-match-patch";

const diffEngine = new diff_match_patch();

interface StoredPatchDiff {
  type: "diff-match-patch";
  patches: string;
}

function summarizeDiffs(diffs: Array<[number, string]>): {
  additions: number;
  deletions: number;
  unchanged: number;
} {
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const [operation, text] of diffs) {
    const characterCount = text.length;
    if (operation === 1) {
      additions += characterCount;
    } else if (operation === -1) {
      deletions += characterCount;
    } else {
      unchanged += characterCount;
    }
  }

  return { additions, deletions, unchanged };
}

function isStoredPatchDiff(diffData: unknown): diffData is StoredPatchDiff {
  if (typeof diffData !== "object" || diffData === null) {
    return false;
  }

  const diffRecord = diffData as Record<string, unknown>;
  return (
    diffRecord.type === "diff-match-patch" &&
    typeof diffRecord.patches === "string"
  );
}

export function contentToText(content: unknown): string {
  if (content == null) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  return JSON.stringify(content, null, 2);
}

export function computeDiff(
  contentBefore: unknown,
  contentAfter: unknown,
): unknown {
  if (contentBefore == null && contentAfter == null) {
    return null;
  }

  const beforeText = contentToText(contentBefore);
  const afterText = contentToText(contentAfter);
  const rawDiffs = diffEngine.diff_main(beforeText, afterText) as Array<
    [number, string]
  >;

  diffEngine.diff_cleanupSemantic(rawDiffs);

  const patches = diffEngine.patch_make(beforeText, rawDiffs);
  return {
    type: "diff-match-patch",
    patches: diffEngine.patch_toText(patches),
    summary: summarizeDiffs(rawDiffs),
  };
}

export function applyDiff(content: unknown, diffData: unknown): string {
  if (!isStoredPatchDiff(diffData)) {
    return contentToText(content);
  }

  const patches = diffEngine.patch_fromText(diffData.patches);
  const [result] = diffEngine.patch_apply(patches, contentToText(content));
  return result;
}
