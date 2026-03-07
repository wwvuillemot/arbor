const SUPPORTED_NOTE_EXTENSIONS = [
  ".md",
  ".txt",
  ".markdown",
  ".mdown",
  ".mkd",
  ".mdx",
] as const;

const NOTE_EXTENSIONS = /\.(md|txt|markdown|mdown|mkd|mdx)$/i;
const NOTE_LINK_WITH_EXT_REGEX = /\.(md|txt|markdown|mdown|mkd|mdx)(#.*)?$/i;
// Non-note file extensions we should NOT attempt to rewrite
const BINARY_EXT_REGEX =
  /\.(png|jpg|jpeg|gif|webp|svg|pdf|zip|mp3|mp4|mov|avi|doc|docx|xls|xlsx|ppt|pptx)(#.*)?$/i;

function decodePathSegment(pathSegment: string): string {
  try {
    return decodeURIComponent(pathSegment);
  } catch {
    return pathSegment;
  }
}

function normalizePath(path: string): string {
  const normalizedParts: string[] = [];

  for (const rawPart of path.replace(/\\/g, "/").split("/")) {
    const pathPart = decodePathSegment(rawPart).trim();

    if (!pathPart || pathPart === ".") {
      continue;
    }

    if (pathPart === "..") {
      normalizedParts.pop();
      continue;
    }

    normalizedParts.push(pathPart);
  }

  return normalizedParts.join("/");
}

function resolveImportPath(importingNotePath: string, href: string): string {
  const importingDirectoryPath = normalizePath(importingNotePath)
    .split("/")
    .slice(0, -1)
    .join("/");
  const resolvedParts = importingDirectoryPath
    ? importingDirectoryPath.split("/")
    : [];

  for (const rawPart of href.replace(/\\/g, "/").split("/")) {
    const hrefPart = decodePathSegment(rawPart).trim();

    if (!hrefPart || hrefPart === ".") {
      continue;
    }

    if (hrefPart === "..") {
      resolvedParts.pop();
      continue;
    }

    resolvedParts.push(hrefPart);
  }

  return resolvedParts.join("/");
}

function normalizeComparableBasename(pathOrBasename: string): string {
  return (
    decodePathSegment(pathOrBasename)
      .split("/")
      .pop()
      ?.replace(NOTE_EXTENSIONS, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, " ")
      .trim() ?? ""
  );
}

function addToPathIndex(
  pathIndex: Map<string, Set<string>>,
  path: string,
  nodeId: string,
): void {
  if (!path) {
    return;
  }

  const existingNodeIds = pathIndex.get(path) ?? new Set<string>();
  existingNodeIds.add(nodeId);
  pathIndex.set(path, existingNodeIds);
}

function getUniqueNodeId(
  pathIndex: Map<string, Set<string>>,
  path: string,
): string | null {
  const matchingNodeIds = pathIndex.get(path);

  if (!matchingNodeIds || matchingNodeIds.size !== 1) {
    return null;
  }

  return Array.from(matchingNodeIds)[0] ?? null;
}

/**
 * Attempt to rewrite a relative internal href to an internal node URL.
 *
 * Handles:
 *  - Standard relative links with note extensions:  ./other.md, ../sibling/note.md
 *  - Extensionless relative links:                  ./other, ../sibling/note
 *  - Obsidian-style bare name hrefs:                Page Name, Page Name.md
 *
 * Returns `?node=<id>` when resolved, `null` when the link should be left
 * unchanged (unresolved or not a note link at all).
 *
 * IMPORTANT: Never returns "#" — leaving the original href preserves the
 * ability to resolve it in a future import pass.
 */
export function rewriteImportedInternalHref(
  href: string,
  importingNotePath: string,
  nodeMap: Record<string, string>,
): string | null {
  // Skip external links and already-resolved internal links
  if (
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) ||
    href.startsWith("//") ||
    href.startsWith("?node=") ||
    href === "#"
  ) {
    return null;
  }

  const hrefWithoutAnchor = href.replace(/#.*$/, "");
  if (!hrefWithoutAnchor) {
    return null;
  }

  // Skip binary/media files we don't import as notes
  if (BINARY_EXT_REGEX.test(hrefWithoutAnchor)) {
    return null;
  }

  // Only handle note-extension links or extensionless links (could be a note name)
  const hasNoteExtension = NOTE_LINK_WITH_EXT_REGEX.test(hrefWithoutAnchor);
  const hasAnyExtension = /\.[a-zA-Z0-9]+$/.test(
    decodePathSegment(hrefWithoutAnchor).replace(/\/$/, ""),
  );
  if (!hasNoteExtension && hasAnyExtension) {
    // Has an extension but it's not a note extension — skip (e.g. .png inline refs)
    return null;
  }

  const normalizedPathIndex = new Map<string, Set<string>>();
  const normalizedBasenameIndex = new Map<string, Set<string>>();

  for (const [nodePath, nodeId] of Object.entries(nodeMap)) {
    const normalizedNodePath = normalizePath(nodePath);
    addToPathIndex(normalizedPathIndex, normalizedNodePath, nodeId);
    addToPathIndex(
      normalizedBasenameIndex,
      normalizeComparableBasename(normalizedNodePath),
      nodeId,
    );
  }

  const resolvedPath = resolveImportPath(importingNotePath, hrefWithoutAnchor);
  const exactCandidatePaths = hasNoteExtension
    ? [resolvedPath]
    : SUPPORTED_NOTE_EXTENSIONS.map(
        (noteExtension) => `${resolvedPath}${noteExtension}`,
      );

  for (const exactCandidatePath of exactCandidatePaths) {
    const matchingNodeId = getUniqueNodeId(
      normalizedPathIndex,
      normalizePath(exactCandidatePath),
    );

    if (matchingNodeId) {
      return `?node=${matchingNodeId}`;
    }
  }

  // 3. Basename fallback: only resolve when there is a unique project-wide match.
  const matchingNodeId = getUniqueNodeId(
    normalizedBasenameIndex,
    normalizeComparableBasename(resolvedPath),
  );

  if (matchingNodeId) {
    return `?node=${matchingNodeId}`;
  }

  // Unresolved — return null so the original href is preserved intact.
  // Do NOT return "#" as that would permanently destroy the link.
  return null;
}
