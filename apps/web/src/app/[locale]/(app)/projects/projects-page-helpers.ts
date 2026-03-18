import { extractImagePaths, markdownToTipTap } from "@/lib/markdown-to-tiptap";
import { rewriteImportedInternalHref } from "@/lib/import-link-rewrite";

const IMAGE_FILE_EXTENSION_REGEX = /\.(png|jpg|jpeg|gif|webp|svg)$/i;
const NOTE_FILE_EXTENSION_REGEX = /\.(md|txt|markdown|mdown|mkd|mdx)$/i;

export type ImportHealingNode = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  content?: unknown;
  metadata?: unknown;
};

export type ImportHealingContext = {
  projectWideNodeMap: Record<string, string>;
  getNotePathCandidates: (node: ImportHealingNode) => string[];
};

export type ImportHealingUpdate = {
  id: string;
  content: Record<string, unknown>;
};

export type ImportDirectoryFile = {
  name: string;
  webkitRelativePath?: string;
  text: () => Promise<string>;
};

export type ImportDirectoryEntry = {
  path: string;
  content: unknown;
};

export type PreparedImportDirectoryEntries<TFile extends ImportDirectoryFile> =
  {
    entries: ImportDirectoryEntry[];
    imageFilesByNotePath: Map<string, Map<string, TFile>>;
    rootDirectoryNames: string[];
  };

export type ImportDirectoryHandling =
  | {
      kind: "import-now";
      projectName: string;
      createNewProject: boolean;
    }
  | {
      kind: "prompt-for-project-name";
      initialProjectName: string;
      createNewProject: boolean;
    };

export type LinkPickerSourceNode = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
};

export type FlatLinkPickerTreeNode = {
  id: string;
  name: string;
  type: string;
  depth: number;
};

export type EditorLinkNavigationTarget =
  | {
      kind: "push";
      href: string;
    }
  | {
      kind: "resolve-arbor-url";
      pathSegments: string[];
    }
  | {
      kind: "external";
      href: string;
    };

export type EditorLinkSearchResult = {
  node: {
    id: string;
    name: string;
  };
};

function getImportDirectoryFilePath(file: ImportDirectoryFile): string {
  return file.webkitRelativePath || file.name;
}

function createSyntheticImageNoteContent(imagePath: string, imageName: string) {
  return {
    type: "doc",
    content: [
      {
        type: "image",
        attrs: { src: imagePath, alt: imageName, title: null },
      },
    ],
  };
}

export function summarizeImportFileExtensions(
  files: Pick<ImportDirectoryFile, "name">[],
): string {
  return [
    ...new Set(
      files.map((file) =>
        file.name.includes(".")
          ? (file.name.split(".").pop()?.toLowerCase() ?? "(no ext)")
          : "(no ext)",
      ),
    ),
  ]
    .slice(0, 10)
    .join(", ");
}

export function buildUnsupportedImportDirectoryMessage(
  fileCount: number,
  extensionSummary: string,
): string {
  if (fileCount === 0) {
    return "No files were received from the browser. Try selecting the folder again.";
  }

  return `No supported files found among ${fileCount} files (extensions: ${extensionSummary || "none"}). Supported: .md, .txt, .png, .jpg, .jpeg, .gif, .webp, .svg`;
}

export function deriveImportDirectoryHandling(
  preferredProjectName: string,
  rootDirectoryNames: string[],
  createNewProject: boolean,
): ImportDirectoryHandling {
  if (rootDirectoryNames.length === 1) {
    return {
      kind: "import-now",
      projectName: preferredProjectName || rootDirectoryNames[0]!,
      createNewProject,
    };
  }

  return {
    kind: "prompt-for-project-name",
    initialProjectName: preferredProjectName,
    createNewProject,
  };
}

export function deriveImportTargetNodeId(
  createNewProject: boolean,
  currentProjectId: string | null | undefined,
  forceList: boolean,
  selectedNode:
    | { id: string; type: string; parentId: string | null }
    | undefined,
): string | undefined {
  if (createNewProject || !currentProjectId || forceList) {
    return undefined;
  }

  if (!selectedNode) {
    return currentProjectId;
  }

  if (selectedNode.type === "folder") {
    return selectedNode.id;
  }

  if (selectedNode.type === "note") {
    return selectedNode.parentId ?? currentProjectId;
  }

  return currentProjectId;
}

export function deriveNodeMoveMutationInput(
  draggedNodeId: string,
  targetNodeId: string,
  position: "before" | "inside" | "after",
  targetNode:
    | { id: string; parentId: string | null; position?: number | null }
    | undefined,
): { id: string; newParentId: string; position?: number } | null {
  if (position === "inside") {
    return {
      id: draggedNodeId,
      newParentId: targetNodeId,
    };
  }

  if (!targetNode?.parentId || typeof targetNode.position !== "number") {
    return null;
  }

  return {
    id: draggedNodeId,
    newParentId: targetNode.parentId,
    position:
      position === "before" ? targetNode.position : targetNode.position + 1,
  };
}

export async function prepareImportDirectoryEntries<
  TFile extends ImportDirectoryFile,
>(allFiles: TFile[]): Promise<PreparedImportDirectoryEntries<TFile>> {
  const imageFilesByPath = new Map<string, TFile>();
  for (const file of allFiles) {
    if (
      !file.name.startsWith(".") &&
      IMAGE_FILE_EXTENSION_REGEX.test(file.name)
    ) {
      const filePath = getImportDirectoryFilePath(file);
      imageFilesByPath.set(filePath, file);
      imageFilesByPath.set(file.name, file);
    }
  }

  const entries: ImportDirectoryEntry[] = [];
  const imageFilesByNotePath = new Map<string, Map<string, TFile>>();

  for (const file of allFiles) {
    if (
      file.name.startsWith(".") ||
      !NOTE_FILE_EXTENSION_REGEX.test(file.name)
    ) {
      continue;
    }

    const filePath = getImportDirectoryFilePath(file);
    const rawText = await file.text();
    const tiptapContent = markdownToTipTap(rawText);
    const imagePaths = extractImagePaths(rawText);

    if (imagePaths.length > 0) {
      const noteImageMap = new Map<string, TFile>();
      for (const imagePath of imagePaths) {
        const noteDirectoryPath = filePath.split("/").slice(0, -1).join("/");
        const candidatePaths = [
          imagePath,
          `${noteDirectoryPath}/${imagePath}`,
          imagePath.split("/").pop() ?? imagePath,
        ];

        for (const candidatePath of candidatePaths) {
          const imageFile = imageFilesByPath.get(candidatePath);
          if (imageFile) {
            noteImageMap.set(imagePath, imageFile);
            break;
          }
        }
      }

      if (noteImageMap.size > 0) {
        imageFilesByNotePath.set(filePath, noteImageMap);
      }
    }

    entries.push({ path: filePath, content: tiptapContent });
  }

  const processedImages = new Set<TFile>();
  for (const file of allFiles) {
    if (
      file.name.startsWith(".") ||
      !IMAGE_FILE_EXTENSION_REGEX.test(file.name)
    ) {
      continue;
    }

    if (processedImages.has(file)) {
      continue;
    }

    processedImages.add(file);
    const imagePath = getImportDirectoryFilePath(file);
    const imageName = file.name.replace(IMAGE_FILE_EXTENSION_REGEX, "");
    const syntheticPath = imagePath.replace(IMAGE_FILE_EXTENSION_REGEX, ".md");

    entries.push({
      path: syntheticPath,
      content: createSyntheticImageNoteContent(imagePath, imageName),
    });
    imageFilesByNotePath.set(syntheticPath, new Map([[imagePath, file]]));
  }

  const rootDirectoryNames = [
    ...new Set(
      entries
        .map((entry) => entry.path.split("/")[0])
        .filter((rootDirectoryName): rootDirectoryName is string =>
          Boolean(rootDirectoryName),
        ),
    ),
  ];

  return {
    entries,
    imageFilesByNotePath,
    rootDirectoryNames,
  };
}

export function buildFlatLinkPickerTreeNodes(
  rootNodeId: string | null | undefined,
  allNodes: LinkPickerSourceNode[],
): FlatLinkPickerTreeNode[] {
  if (!rootNodeId) {
    return [];
  }

  const flatTreeNodes: FlatLinkPickerTreeNode[] = [];

  const addChildren = (parentId: string, depth: number) => {
    allNodes
      .filter((node) => node.parentId === parentId)
      .forEach((node) => {
        flatTreeNodes.push({
          id: node.id,
          name: node.name,
          type: node.type,
          depth,
        });

        if (node.type === "folder") {
          addChildren(node.id, depth + 1);
        }
      });
  };

  addChildren(rootNodeId, 0);
  return flatTreeNodes;
}

export function deriveFilteredNodeIds(
  selectedTagIds: string[],
  filteredTagNodeIds: string[] | undefined,
  searchQuery: string,
  filteredSearchNodeIds: string[] | undefined,
): Set<string> | null {
  const hasTagFilter = selectedTagIds.length > 0;
  const hasSearchFilter = searchQuery.length > 0;

  if (!hasTagFilter && !hasSearchFilter) {
    return null;
  }

  const tagNodeIds = hasTagFilter ? new Set(filteredTagNodeIds ?? []) : null;
  const searchNodeIds = hasSearchFilter
    ? new Set(filteredSearchNodeIds ?? [])
    : null;

  if (tagNodeIds && searchNodeIds) {
    const intersection = new Set<string>();
    for (const nodeId of tagNodeIds) {
      if (searchNodeIds.has(nodeId)) {
        intersection.add(nodeId);
      }
    }
    return intersection;
  }

  return tagNodeIds || searchNodeIds || new Set<string>();
}

function isArborHostname(hostname: string): boolean {
  return hostname === "arbor" || hostname.endsWith(".arbor");
}

export function deriveEditorLinkNavigationTarget(
  href: string,
  currentLocationHref: string,
  currentOrigin: string,
): EditorLinkNavigationTarget {
  try {
    const url = new URL(href, currentLocationHref);
    const nodeId = url.searchParams.get("node");
    if (nodeId) {
      return { kind: "push", href: `/projects?node=${nodeId}` };
    }

    if (url.origin === currentOrigin) {
      return { kind: "push", href: url.pathname + url.search };
    }

    if (isArborHostname(url.hostname)) {
      return {
        kind: "resolve-arbor-url",
        pathSegments: url.pathname.split("/").filter(Boolean),
      };
    }
  } catch {
    // fall back to raw href handling below
  }

  if (href.startsWith("?") || href.startsWith("/")) {
    return {
      kind: "push",
      href: href.startsWith("?") ? `/projects${href}` : href,
    };
  }

  return { kind: "external", href };
}

export function buildArborLinkNameCandidates(rawSegment: string): string[] {
  return [
    ...new Set([
      rawSegment,
      rawSegment.replace(/_/g, " "),
      rawSegment.replace(/-/g, " "),
    ]),
  ];
}

export function findMatchingArborSearchResult(
  rawSegment: string,
  candidate: string,
  results: EditorLinkSearchResult[],
): EditorLinkSearchResult | undefined {
  return results.find(
    (result) =>
      result.node.name === candidate ||
      result.node.name.replace(/\s/g, "_") === rawSegment,
  );
}

export async function resolveArborEditorLinkTargetNodeId(
  pathSegments: string[],
  searchKeywordResults: (query: string) => Promise<EditorLinkSearchResult[]>,
): Promise<string | null> {
  for (
    let segmentIndex = pathSegments.length - 1;
    segmentIndex >= 0;
    segmentIndex -= 1
  ) {
    const rawSegment = pathSegments[segmentIndex];
    if (!rawSegment) {
      continue;
    }

    const nameCandidates = buildArborLinkNameCandidates(rawSegment);
    for (const candidate of nameCandidates) {
      try {
        const results = await searchKeywordResults(candidate);
        const matchingResult = findMatchingArborSearchResult(
          rawSegment,
          candidate,
          results,
        );
        if (matchingResult) {
          return matchingResult.node.id;
        }
      } catch {
        // ignore search errors so we can keep trying broader matches
      }
    }
  }

  return null;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMarkdownTableCells(line: string): string[] | null {
  const trimmedLine = line.trim();
  if (!trimmedLine.includes("|")) return null;

  const rawCells = trimmedLine.split("|");
  if (trimmedLine.startsWith("|")) rawCells.shift();
  if (trimmedLine.endsWith("|")) rawCells.pop();

  if (rawCells.length < 2) return null;
  return rawCells.map((cellText) => cellText.trim());
}

function isMarkdownTableDelimiter(
  line: string,
  expectedColumnCount: number,
): boolean {
  const cells = parseMarkdownTableCells(line);
  if (!cells || cells.length !== expectedColumnCount) return false;

  return cells.every((cellText) => /^:?-{3,}:?$/.test(cellText));
}

function extractUnmarkedTextContent(node: unknown): string | null {
  if (!isRecord(node)) return null;

  if (node.type === "text") {
    if (typeof node.text !== "string") return null;
    if (Array.isArray(node.marks) && node.marks.length > 0) return null;
    return node.text;
  }

  if (node.type === "hardBreak") {
    return "\n";
  }

  if (!Array.isArray(node.content)) {
    return null;
  }

  let combinedText = "";
  for (const childNode of node.content) {
    const childText = extractUnmarkedTextContent(childNode);
    if (childText === null) return null;
    combinedText += childText;
  }

  return combinedText;
}

function getLegacyMarkdownTableLine(block: unknown): string | null {
  if (!isRecord(block) || block.type !== "paragraph") {
    return null;
  }

  return extractUnmarkedTextContent(block);
}

function parseSingleParagraphLegacyMarkdownTable(
  block: unknown,
): Record<string, unknown> | null {
  const paragraphText = getLegacyMarkdownTableLine(block);
  if (!paragraphText || !paragraphText.includes("\n")) {
    return null;
  }

  const tableLines = paragraphText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (tableLines.length < 3) {
    return null;
  }

  const headerCells = parseMarkdownTableCells(tableLines[0]);
  if (
    !headerCells ||
    !isMarkdownTableDelimiter(tableLines[1], headerCells.length)
  ) {
    return null;
  }

  const hasOnlyValidBodyRows = tableLines.slice(2).every((line) => {
    const bodyCells = parseMarkdownTableCells(line);
    return Boolean(bodyCells && bodyCells.length === headerCells.length);
  });
  if (!hasOnlyValidBodyRows) {
    return null;
  }

  const reparsedDocument = markdownToTipTap(tableLines.join("\n"));
  const reparsedBlock = reparsedDocument.content[0];

  if (
    reparsedDocument.content.length !== 1 ||
    !isRecord(reparsedBlock) ||
    reparsedBlock.type !== "table"
  ) {
    return null;
  }

  return reparsedBlock;
}

function normalizeLegacyMarkdownTableParagraphs(
  content: Record<string, unknown>,
): Record<string, unknown> {
  if (content.type !== "doc" || !Array.isArray(content.content)) {
    return content;
  }

  let changed = false;
  const normalizedBlocks: unknown[] = [];

  for (let index = 0; index < content.content.length; ) {
    const singleParagraphTable = parseSingleParagraphLegacyMarkdownTable(
      content.content[index],
    );
    if (singleParagraphTable) {
      changed = true;
      normalizedBlocks.push(singleParagraphTable);
      index += 1;
      continue;
    }

    const headerLine = getLegacyMarkdownTableLine(content.content[index]);
    const separatorLine = getLegacyMarkdownTableLine(
      content.content[index + 1],
    );
    const headerCells = headerLine ? parseMarkdownTableCells(headerLine) : null;

    if (
      !headerCells ||
      !separatorLine ||
      !isMarkdownTableDelimiter(separatorLine, headerCells.length)
    ) {
      normalizedBlocks.push(content.content[index]);
      index += 1;
      continue;
    }

    const tableLines = [headerLine, separatorLine];
    let nextIndex = index + 2;

    while (nextIndex < content.content.length) {
      const bodyLine = getLegacyMarkdownTableLine(content.content[nextIndex]);
      const bodyCells = bodyLine ? parseMarkdownTableCells(bodyLine) : null;
      if (!bodyCells || bodyCells.length !== headerCells.length) {
        break;
      }

      tableLines.push(bodyLine);
      nextIndex += 1;
    }

    if (tableLines.length < 3) {
      normalizedBlocks.push(content.content[index]);
      index += 1;
      continue;
    }

    const reparsedDocument = markdownToTipTap(tableLines.join("\n"));
    const reparsedBlock = reparsedDocument.content[0];
    if (
      reparsedDocument.content.length !== 1 ||
      !isRecord(reparsedBlock) ||
      reparsedBlock.type !== "table"
    ) {
      normalizedBlocks.push(content.content[index]);
      index += 1;
      continue;
    }

    changed = true;
    normalizedBlocks.push(reparsedBlock);
    index = nextIndex;
  }

  if (!changed) {
    return content;
  }

  return {
    ...content,
    content: normalizedBlocks,
  };
}

export function normalizeTiptapContent(
  rawContent: unknown,
): Record<string, unknown> | null {
  if (!rawContent) return null;

  if (typeof rawContent === "string") {
    try {
      const parsedContent = JSON.parse(rawContent) as unknown;
      return parsedContent && typeof parsedContent === "object"
        ? normalizeLegacyMarkdownTableParagraphs(
            parsedContent as Record<string, unknown>,
          )
        : null;
    } catch {
      return null;
    }
  }

  return typeof rawContent === "object"
    ? normalizeLegacyMarkdownTableParagraphs(
        rawContent as Record<string, unknown>,
      )
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

export function replaceImportedImageSourceUrls(
  rawContent: unknown,
  uploadedImageUrlsBySourcePath: Map<string, string>,
): { changed: boolean; content: Record<string, unknown> | null } {
  let changed = false;

  const content = transformTiptapContent(rawContent, (key, value) => {
    if (key !== "src" || typeof value !== "string") {
      return value;
    }

    const uploadedImageUrl = uploadedImageUrlsBySourcePath.get(value);
    if (uploadedImageUrl && uploadedImageUrl !== value) {
      changed = true;
      return uploadedImageUrl;
    }

    return value;
  });

  return { changed, content };
}

export function rewriteImportedNoteContent(
  rawContent: unknown,
  importingNotePaths: string[],
  nodeMap: Record<string, string>,
): { changed: boolean; content: Record<string, unknown> | null } {
  let changed = false;

  const content = transformTiptapContent(rawContent, (key, value) => {
    if (key !== "href" || typeof value !== "string") {
      return value;
    }

    for (const importingNotePath of importingNotePaths) {
      const rewrittenHref = rewriteImportedInternalHref(
        value,
        importingNotePath,
        nodeMap,
      );

      if (rewrittenHref !== null && rewrittenHref !== value) {
        changed = true;
        return rewrittenHref;
      }
    }

    return value;
  });

  return { changed, content };
}

export function createImportHealingContext(
  projectId: string,
  descendants: ImportHealingNode[],
  importedNodeMap: Record<string, string>,
): ImportHealingContext {
  const nodesById = new Map(
    descendants.map((descendant) => [descendant.id, descendant]),
  );
  const folderAliasesById = new Map<string, string[]>();
  const aliasToNodeIds = new Map<string, Set<string>>();

  const addAlias = (alias: string | null, nodeId: string) => {
    if (!alias) {
      return;
    }

    const normalizedAlias = normalizeImportSourcePath(alias);
    if (!normalizedAlias) {
      return;
    }

    const matchingNodeIds = aliasToNodeIds.get(normalizedAlias) ?? new Set();
    matchingNodeIds.add(nodeId);
    aliasToNodeIds.set(normalizedAlias, matchingNodeIds);
  };

  const getFolderAliases = (folderId: string | null): string[] => {
    if (!folderId || folderId === projectId) {
      return [""];
    }

    const cachedAliases = folderAliasesById.get(folderId);
    if (cachedAliases) {
      return cachedAliases;
    }

    const folderNode = nodesById.get(folderId);
    if (!folderNode || folderNode.type !== "folder") {
      return [""];
    }

    const folderAliases = new Set<string>();
    const importSourcePath = getImportSourcePath(folderNode.metadata);

    if (importSourcePath) {
      folderAliases.add(importSourcePath);
      const rootlessFolderPath = stripTopLevelImportSegment(importSourcePath);
      if (rootlessFolderPath) {
        folderAliases.add(rootlessFolderPath);
      }
    }

    const trimmedFolderName = folderNode.name.trim();
    if (trimmedFolderName) {
      for (const parentAlias of getFolderAliases(folderNode.parentId)) {
        folderAliases.add(joinImportSourcePath(parentAlias, trimmedFolderName));
      }
    }

    const resolvedFolderAliases = [...folderAliases].filter(Boolean);
    const normalizedFolderAliases =
      resolvedFolderAliases.length > 0 ? resolvedFolderAliases : [""];
    folderAliasesById.set(folderId, normalizedFolderAliases);

    return normalizedFolderAliases;
  };

  const getNotePathCandidates = (node: ImportHealingNode): string[] => {
    const notePathCandidates = new Set<string>();
    const importSourcePath = getImportSourcePath(node.metadata);

    if (importSourcePath) {
      notePathCandidates.add(importSourcePath);
      const rootlessImportSourcePath =
        stripTopLevelImportSegment(importSourcePath);
      if (rootlessImportSourcePath) {
        notePathCandidates.add(rootlessImportSourcePath);
      }
    }

    const fileNameCandidates = getNoteFileNameCandidates(node);
    for (const parentAlias of getFolderAliases(node.parentId)) {
      for (const fileNameCandidate of fileNameCandidates) {
        notePathCandidates.add(
          joinImportSourcePath(parentAlias, fileNameCandidate),
        );
      }
    }

    return [...notePathCandidates].filter(Boolean);
  };

  for (const [nodePath, nodeId] of Object.entries(importedNodeMap)) {
    addAlias(nodePath, nodeId);
  }

  for (const descendant of descendants) {
    if (descendant.type !== "note") {
      continue;
    }

    for (const notePathCandidate of getNotePathCandidates(descendant)) {
      addAlias(notePathCandidate, descendant.id);
    }
  }

  const projectWideNodeMap = Object.fromEntries(
    [...aliasToNodeIds.entries()]
      .filter(([, matchingNodeIds]) => matchingNodeIds.size === 1)
      .map(([alias, matchingNodeIds]) => [
        alias,
        [...matchingNodeIds][0] as string,
      ]),
  );

  return { projectWideNodeMap, getNotePathCandidates };
}

export function deriveImportHealingUpdates(
  descendants: ImportHealingNode[],
  importHealingContext: ImportHealingContext,
): ImportHealingUpdate[] {
  const importHealingUpdates: ImportHealingUpdate[] = [];

  for (const descendant of descendants) {
    if (descendant.type !== "note" || !descendant.content) {
      continue;
    }

    const importingNotePathCandidates =
      importHealingContext.getNotePathCandidates(descendant);
    if (importingNotePathCandidates.length === 0) {
      continue;
    }

    const { changed, content: patchedContent } = rewriteImportedNoteContent(
      descendant.content,
      importingNotePathCandidates,
      importHealingContext.projectWideNodeMap,
    );

    if (!changed || !patchedContent) {
      continue;
    }

    importHealingUpdates.push({
      id: descendant.id,
      content: patchedContent,
    });
  }

  return importHealingUpdates;
}
