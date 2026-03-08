import type { CreateNodeParams } from "./node-service";
import type { ImportedDirectoryFile } from "./node-directory-import-service";

const IMPORT_ACTOR = "user:import";
const SUPPORTED_NOTE_FILE_PATTERN = /\.(md|txt|markdown|mdown|mkd|mdx)$/i;

type UnknownRecord = Record<string, unknown>;

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function toTitleCase(name: string): string {
  return name
    .replace(/[_-]/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function extractFirstHeading(documentContent: unknown): string | null {
  if (
    !isUnknownRecord(documentContent) ||
    !Array.isArray(documentContent.content)
  ) {
    return null;
  }

  const firstContentNode = documentContent.content[0];
  if (
    !isUnknownRecord(firstContentNode) ||
    firstContentNode.type !== "heading" ||
    !Array.isArray(firstContentNode.content)
  ) {
    return null;
  }

  const headingText = firstContentNode.content
    .filter((contentNode): contentNode is UnknownRecord =>
      isUnknownRecord(contentNode),
    )
    .filter((contentNode) => contentNode.type === "text")
    .map((contentNode) =>
      typeof contentNode.text === "string" ? contentNode.text : "",
    )
    .join("")
    .trim();

  return headingText || null;
}

function normalizeImportedContent(content: unknown): unknown {
  if (isUnknownRecord(content)) {
    return content;
  }

  if (typeof content === "string") {
    try {
      return JSON.parse(content) as unknown;
    } catch {
      return {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: content }],
          },
        ],
      };
    }
  }

  return { type: "doc", content: [] };
}

export function createImportPathToNodeIdMap(
  files: ImportedDirectoryFile[],
  importTargetNodeId: string,
): Map<string, string> {
  const pathToNodeId = new Map<string, string>();
  const rootPrefix = files[0]?.path.split("/")[0] ?? "";

  if (rootPrefix) {
    pathToNodeId.set(rootPrefix, importTargetNodeId);
  }

  return pathToNodeId;
}

export function collectSortedDirectoryPaths(
  files: ImportedDirectoryFile[],
): string[] {
  const directoryPaths = new Set<string>();

  for (const file of files) {
    const pathSegments = file.path.split("/");
    for (
      let segmentIndex = 2;
      segmentIndex < pathSegments.length;
      segmentIndex++
    ) {
      directoryPaths.add(pathSegments.slice(0, segmentIndex).join("/"));
    }
  }

  return [...directoryPaths].sort(
    (leftPath, rightPath) =>
      leftPath.split("/").length - rightPath.split("/").length,
  );
}

export function getImportedPathParent(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

export function buildImportedFolderNodeParams(
  directoryPath: string,
  parentId: string,
): CreateNodeParams {
  const pathSegments = directoryPath.split("/");
  const directoryName = pathSegments[pathSegments.length - 1];

  return {
    type: "folder",
    name: toTitleCase(directoryName),
    parentId,
    metadata: { importSourcePath: directoryPath },
    createdBy: IMPORT_ACTOR,
    updatedBy: IMPORT_ACTOR,
  };
}

export function getSortedImportableNoteFiles(
  files: ImportedDirectoryFile[],
): ImportedDirectoryFile[] {
  return [...files]
    .filter((file) => {
      const fileName = file.path.split("/").pop() ?? "";
      return (
        SUPPORTED_NOTE_FILE_PATTERN.test(fileName) && !fileName.startsWith(".")
      );
    })
    .sort((leftFile, rightFile) =>
      leftFile.path.localeCompare(rightFile.path, undefined, {
        sensitivity: "base",
      }),
    );
}

export function buildImportedNoteNodeParams(
  file: ImportedDirectoryFile,
  parentId: string,
  position: number,
): CreateNodeParams {
  const fileName = file.path.split("/").pop() ?? file.path;
  const normalizedContent = normalizeImportedContent(file.content);

  return {
    type: "note",
    name:
      extractFirstHeading(normalizedContent) ??
      toTitleCase(fileName.replace(SUPPORTED_NOTE_FILE_PATTERN, "")),
    parentId,
    content: normalizedContent,
    metadata: { importSourcePath: file.path },
    position,
    createdBy: IMPORT_ACTOR,
    updatedBy: IMPORT_ACTOR,
  };
}
