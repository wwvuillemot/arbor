const NOTE_FILE_EXTENSION_REGEX = /\.(md|txt|markdown|mdown|mkd|mdx)$/i;

export type ImportHealingNode = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  content?: unknown;
  metadata?: unknown;
};

export function normalizeImportSourcePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

export function joinImportSourcePath(
  parentPath: string,
  childPath: string,
): string {
  const normalizedParentPath = normalizeImportSourcePath(parentPath);
  const normalizedChildPath = normalizeImportSourcePath(childPath);

  if (!normalizedParentPath) {
    return normalizedChildPath;
  }

  if (!normalizedChildPath) {
    return normalizedParentPath;
  }

  return `${normalizedParentPath}/${normalizedChildPath}`;
}

export function stripTopLevelImportSegment(path: string): string | null {
  const normalizedPath = normalizeImportSourcePath(path);
  const pathSegments = normalizedPath.split("/");

  if (pathSegments.length <= 1) {
    return null;
  }

  const rootlessPath = pathSegments.slice(1).join("/");
  return rootlessPath || null;
}

export function getImportSourcePath(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const importSourcePath = (metadata as Record<string, unknown>)
    .importSourcePath;
  if (typeof importSourcePath !== "string" || !importSourcePath.trim()) {
    return null;
  }

  return normalizeImportSourcePath(importSourcePath);
}

export function getNoteFileNameCandidates(node: ImportHealingNode): string[] {
  const fileNameCandidates = new Set<string>();
  const importSourcePath = getImportSourcePath(node.metadata);
  const importSourceBasename = importSourcePath?.split("/").pop();

  if (importSourceBasename) {
    fileNameCandidates.add(importSourceBasename);
  }

  const trimmedNodeName = node.name.trim();
  if (trimmedNodeName) {
    fileNameCandidates.add(
      NOTE_FILE_EXTENSION_REGEX.test(trimmedNodeName)
        ? trimmedNodeName
        : `${trimmedNodeName}.md`,
    );
  }

  return [...fileNameCandidates];
}

export function normalizeTiptapContent(
  rawContent: unknown,
): Record<string, unknown> | null {
  if (!rawContent) return null;

  if (typeof rawContent === "string") {
    try {
      const parsedContent = JSON.parse(rawContent) as unknown;
      return parsedContent && typeof parsedContent === "object"
        ? (parsedContent as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof rawContent === "object"
    ? (rawContent as Record<string, unknown>)
    : null;
}

export function transformTiptapContent(
  rawContent: unknown,
  transformValue: (key: string, value: unknown) => unknown,
): Record<string, unknown> | null {
  const normalizedContent = normalizeTiptapContent(rawContent);
  if (!normalizedContent) return null;

  return JSON.parse(
    JSON.stringify(normalizedContent, transformValue),
  ) as Record<string, unknown>;
}
