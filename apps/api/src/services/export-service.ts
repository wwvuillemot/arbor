import { zipSync, type Zippable } from "fflate";
import type { Readable } from "node:stream";
import { NodeService } from "./node-service";
import { MediaAttachmentService } from "./media-attachment-service";
import { ConfigurationService } from "./configuration-service";
import type { Node } from "../db/schema";
import {
  parseProseMirrorContent,
  prosemirrorToMarkdown as renderProsemirrorToMarkdown,
  type PMNode,
} from "./export-markdown";
import { wrapMarkdownInHtmlDocument } from "./export-html";

const nodeService = new NodeService();
const mediaAttachmentService = new MediaAttachmentService();
const configurationService = new ConfigurationService();

const containerTypes = new Set(["folder", "project"]);

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "").replace(/\/api$/, "");
}

/**
 * Extract a string attachment ID from a node's JSONB metadata by key.
 * Returns null when the key is absent, not a string, or an empty string.
 */
function getMetadataAttachmentId(
  metadata: unknown,
  key: string,
): string | null {
  const value = (metadata as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export type ExportSortMode = "alphabetical" | "manual";

export type ExportOutputFormat = "standard" | "pdf" | "docx" | "epub";

export type ExportNameOptions = {
  includeFolderNames?: boolean;
  includeNoteNames?: boolean;
  sortMode?: ExportSortMode;
  outputFormat?: ExportOutputFormat;
};

type ResolvedExportNameOptions = {
  includeFolderNames: boolean;
  includeNoteNames: boolean;
  sortMode: ExportSortMode;
  outputFormat: ExportOutputFormat;
};

function resolveExportNameOptions(
  options?: ExportNameOptions,
): ResolvedExportNameOptions {
  return {
    includeFolderNames: options?.includeFolderNames ?? true,
    includeNoteNames: options?.includeNoteNames ?? true,
    sortMode: options?.sortMode ?? "alphabetical",
    outputFormat: options?.outputFormat ?? "standard",
  };
}

function compareNodesForExport(
  leftNode: Node,
  rightNode: Node,
  sortMode: ExportSortMode,
): number {
  const leftIsContainer = containerTypes.has(leftNode.type);
  const rightIsContainer = containerTypes.has(rightNode.type);

  if (leftIsContainer !== rightIsContainer) {
    return leftIsContainer ? -1 : 1;
  }

  const alphabeticalComparison = leftNode.name.localeCompare(
    rightNode.name,
    undefined,
    { sensitivity: "base" },
  );
  const leftPosition = leftNode.position ?? 0;
  const rightPosition = rightNode.position ?? 0;

  if (sortMode === "alphabetical") {
    if (alphabeticalComparison !== 0) {
      return alphabeticalComparison;
    }

    return leftPosition - rightPosition;
  }

  if (leftPosition !== rightPosition) {
    return leftPosition - rightPosition;
  }

  return alphabeticalComparison;
}

function shouldIncludeNodeName(
  nodeType: string,
  options: ResolvedExportNameOptions,
): boolean {
  if (nodeType === "folder" || nodeType === "project") {
    return options.includeFolderNames;
  }

  return options.includeNoteNames;
}

export class ExportService {
  /**
   * Export a single node's content as Markdown
   */
  async exportNodeAsMarkdown(
    nodeId: string,
    options?: ExportNameOptions,
  ): Promise<string> {
    const node = await nodeService.getNodeById(nodeId);
    if (!node) throw new Error("Node not found");

    const resolvedOptions = resolveExportNameOptions(options);
    const lines: string[] = [];
    const isContainer = containerTypes.has(node.type);
    const apiBaseUrl = isContainer ? await this.getApiBaseUrl() : null;

    if (resolvedOptions.outputFormat === "pdf" && isContainer) {
      const includeName = shouldIncludeNodeName(node.type, resolvedOptions);
      this.appendPdfContainerSection(lines, node, apiBaseUrl, 1, {
        includeName,
        includeNewPage: false,
      });
    } else {
      // standard and docx: hero image BEFORE heading
      if (apiBaseUrl) {
        this.appendContainerHeroImage(lines, node, apiBaseUrl);
      }
      if (shouldIncludeNodeName(node.type, resolvedOptions)) {
        lines.push(`# ${node.name}\n`);
      }
    }

    this.appendMarkdownContent(lines, node.content);

    return lines.join("\n").trim() + (lines.length > 0 ? "\n" : "");
  }

  /**
   * Export a project (or folder) and all descendants as Markdown
   */
  async exportProjectAsMarkdown(
    nodeId: string,
    options?: ExportNameOptions,
  ): Promise<string> {
    const node = await nodeService.getNodeById(nodeId);
    if (!node) throw new Error("Node not found");

    const resolvedOptions = resolveExportNameOptions(options);
    const lines: string[] = [];
    const apiBaseUrl = containerTypes.has(node.type)
      ? await this.getApiBaseUrl()
      : null;
    const isPdf = resolvedOptions.outputFormat === "pdf";
    const isDocx = resolvedOptions.outputFormat === "docx";
    const isEpub = resolvedOptions.outputFormat === "epub";

    // Root node
    // For EPUB the root is a collection wrapper — it is excluded from the TOC
    // entirely and its hero image is provided separately as the epub cover.
    if (isPdf) {
      const includeName = shouldIncludeNodeName(node.type, resolvedOptions);
      this.appendPdfContainerSection(lines, node, apiBaseUrl, 1, {
        includeName,
        includeNewPage: false,
      });
    } else if (!isEpub) {
      // standard and docx: hero image BEFORE heading
      if (apiBaseUrl) {
        this.appendContainerHeroImage(lines, node, apiBaseUrl);
      }
      if (shouldIncludeNodeName(node.type, resolvedOptions)) {
        lines.push(`# ${node.name}\n`);
      }
    }

    this.appendMarkdownContent(lines, node.content, true);

    const descendants = await this.getSortedDescendants(
      nodeId,
      resolvedOptions.sortMode,
    );

    // Build a depth map.  For EPUB the root is treated as depth 0 so that its
    // direct children (sections) become H1, their children become H2, etc.
    const nodeDepthMap = new Map<string, number>();
    const rootDepth = isEpub ? 0 : 1;
    nodeDepthMap.set(nodeId, rootDepth);

    for (const desc of descendants) {
      const parentDepth = nodeDepthMap.get(desc.parentId!) ?? rootDepth;
      nodeDepthMap.set(desc.id, parentDepth + 1);
    }

    // EPUB-only: track the type of the last rendered descendant and which
    // dinkus/chapter-icon attachments are active for the current section.
    // The dinkus is injected between consecutive notes — never before the first
    // note in a section (i.e. when a folder heading was the previous item).
    // The chapter icon is injected after the first heading of each note.
    //
    // Inheritance: each folder resolves its dinkus/icon from its own metadata,
    // then the nearest ancestor folder that has a value, then the root project.
    // This map stores the resolved value per folder so child/sibling folders
    // can inherit correctly without being limited to only the root fallback.
    let lastDescType: "folder" | "note" | null = null;
    const rootDinkusId = getMetadataAttachmentId(
      node.metadata,
      "dinkusAttachmentId",
    );
    const rootChapterIconId = getMetadataAttachmentId(
      node.metadata,
      "chapterIconAttachmentId",
    );
    // Maps folder node id → resolved dinkus/icon id (own value or inherited).
    const folderDinkusMap = new Map<string, string | null>();
    const folderIconMap = new Map<string, string | null>();
    let currentSectionDinkusId: string | null = rootDinkusId;
    let currentSectionChapterIconId: string | null = rootChapterIconId;

    for (const desc of descendants) {
      if (desc.type === "folder") {
        const depth = Math.min(Math.max(1, nodeDepthMap.get(desc.id) ?? 2), 6);

        if (isPdf) {
          this.appendPdfContainerSection(lines, desc, apiBaseUrl, depth, {
            includeName: resolvedOptions.includeFolderNames,
            includeNewPage: true,
          });
        } else if (isEpub) {
          // Resolve dinkus and chapter icon for notes within this folder.
          // Priority: folder's own metadata → nearest ancestor folder with a
          // value (tracked in folderDinkusMap/folderIconMap) → root project.
          const parentDinkus =
            folderDinkusMap.get(desc.parentId ?? "") ?? rootDinkusId;
          const parentIcon =
            folderIconMap.get(desc.parentId ?? "") ?? rootChapterIconId;
          currentSectionDinkusId =
            getMetadataAttachmentId(desc.metadata, "dinkusAttachmentId") ??
            parentDinkus;
          currentSectionChapterIconId =
            getMetadataAttachmentId(desc.metadata, "chapterIconAttachmentId") ??
            parentIcon;
          folderDinkusMap.set(desc.id, currentSectionDinkusId);
          folderIconMap.set(desc.id, currentSectionChapterIconId);

          // Folder title page: H1 heading (title only — no chapter icon here)
          // followed by the hero image on the same EPUB page.
          // The chapter icon belongs on each NOTE title within this folder, not
          // on the folder's own heading page.
          if (resolvedOptions.includeFolderNames) {
            lines.push(`${"#".repeat(depth)} ${desc.name}\n`);
          }
          if (apiBaseUrl) {
            // Empty alt text so Pandoc does not generate a <figcaption> that
            // would duplicate the folder name already shown in the H1 heading.
            this.appendContainerHeroImage(lines, desc, apiBaseUrl, "");
          }
          lastDescType = "folder";
        } else {
          // standard and docx: hero image BEFORE heading
          if (apiBaseUrl) {
            this.appendContainerHeroImage(lines, desc, apiBaseUrl);
          }
          if (resolvedOptions.includeFolderNames) {
            lines.push(`${"#".repeat(depth)} ${desc.name}\n`);
          }
        }
      } else if (desc.type === "note") {
        const depth = Math.min(Math.max(1, nodeDepthMap.get(desc.id) ?? 2), 6);

        if (isPdf) {
          lines.push("```{=latex}\n\\newpage\n```\n");
        } else if (isDocx) {
          lines.push(
            '```{=openxml}\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n```\n',
          );
        } else if (isEpub) {
          // Dinkus: inject between consecutive notes in the same section.
          // Skip when the previous item was a folder heading (first note in
          // section) so the dinkus doesn't lead the section.
          // The fenced div centers the image; SVG inlining in the router later
          // replaces the data-URL with inline SVG for currentColor support.
          if (lastDescType === "note" && apiBaseUrl && currentSectionDinkusId) {
            lines.push(`::: {style="text-align:center; margin: 2em 0"}`);
            lines.push(
              `![](${apiBaseUrl}/media/${currentSectionDinkusId}){width=33%}`,
            );
            lines.push(`:::`);
            lines.push("");
          }
        } else {
          // standard: horizontal rule as section separator
          lines.push("---\n");
        }

        if (resolvedOptions.includeNoteNames) {
          lines.push(`${"#".repeat(depth)} ${desc.name}\n`);
          // Chapter icon immediately after the system-generated note heading.
          if (isEpub && apiBaseUrl && currentSectionChapterIconId) {
            lines.push(
              `::: {style="text-align:center; margin: 0.5em 0 1.5em 0"}`,
            );
            lines.push(
              `![](${apiBaseUrl}/media/${currentSectionChapterIconId}){width=15%}`,
            );
            lines.push(`:::`);
            lines.push("");
          }
        }

        // Emit note body content, applying any EPUB-specific transforms.
        // When includeNoteNames is false the note body contains its own heading
        // (H1 typed by the user); in that case inject the chapter icon after
        // that first heading so it always appears below the chapter title.
        if (
          isEpub &&
          apiBaseUrl &&
          (currentSectionDinkusId ||
            (currentSectionChapterIconId && !resolvedOptions.includeNoteNames))
        ) {
          const rawNoteMarkdown = this.contentToMarkdownString(desc.content);
          if (rawNoteMarkdown) {
            let processedMarkdown = rawNoteMarkdown;
            if (currentSectionDinkusId) {
              processedMarkdown = this.replaceHorizontalRulesWithDinkus(
                processedMarkdown,
                `${apiBaseUrl}/media/${currentSectionDinkusId}`,
              );
            }
            if (
              currentSectionChapterIconId &&
              !resolvedOptions.includeNoteNames
            ) {
              processedMarkdown = this.injectChapterIconAfterFirstHeading(
                processedMarkdown,
                `${apiBaseUrl}/media/${currentSectionChapterIconId}`,
              );
            }
            lines.push(processedMarkdown);
            lines.push("");
          }
        } else {
          this.appendMarkdownContent(lines, desc.content, true);
        }

        if (isEpub) {
          lastDescType = "note";
        }
      }
    }

    return lines.join("\n").trim() + (lines.length > 0 ? "\n" : "");
  }

  /**
   * Export a single node's content as styled HTML
   */
  async exportNodeAsHtml(
    nodeId: string,
    options?: ExportNameOptions,
  ): Promise<string> {
    const markdown = await this.exportNodeAsMarkdown(nodeId, options);
    return wrapMarkdownInHtmlDocument(markdown, "");
  }

  /**
   * Export a project as styled HTML
   */
  async exportProjectAsHtml(
    nodeId: string,
    options?: ExportNameOptions,
  ): Promise<string> {
    const node = await nodeService.getNodeById(nodeId);
    if (!node) throw new Error("Node not found");

    const resolvedOptions = resolveExportNameOptions(options);
    const markdown = await this.exportProjectAsMarkdown(
      nodeId,
      resolvedOptions,
    );
    const documentTitle = shouldIncludeNodeName(node.type, resolvedOptions)
      ? node.name
      : "";

    return wrapMarkdownInHtmlDocument(markdown, documentTitle);
  }

  /**
   * Convert ProseMirror JSON to Markdown
   */
  prosemirrorToMarkdown(doc: PMNode): string {
    return renderProsemirrorToMarkdown(doc);
  }

  private appendMarkdownContent(
    lines: string[],
    content: unknown,
    appendTrailingSpacer = false,
  ): void {
    const contentObject = parseProseMirrorContent(content);
    if (!contentObject) {
      return;
    }

    lines.push(this.prosemirrorToMarkdown(contentObject));
    if (appendTrailingSpacer) {
      lines.push("");
    }
  }

  /**
   * Convert ProseMirror JSON content to a markdown string without appending
   * to any output array. Returns null when content is absent or unparseable.
   */
  private contentToMarkdownString(content: unknown): string | null {
    const contentObject = parseProseMirrorContent(content);
    if (!contentObject) {
      return null;
    }
    return this.prosemirrorToMarkdown(contentObject);
  }

  /**
   * Replace every standalone horizontal-rule line (`---`) in a markdown string
   * with a dinkus image reference sized to 33% width so it renders as a small
   * decorative divider rather than a full-width rule.
   */
  private replaceHorizontalRulesWithDinkus(
    markdown: string,
    dinkusUrl: string,
  ): string {
    // Wrap in a Pandoc fenced div so the image is centered; the router's
    // SVG inlining pass later replaces the data-URL with inline SVG for
    // currentColor support in the EPUB reader.
    const dinkusBlock = [
      `::: {style="text-align:center; margin: 2em 0"}`,
      `![](${dinkusUrl}){width=33%}`,
      `:::`,
    ].join("\n");
    return markdown.replace(/^---$/gm, dinkusBlock);
  }

  /**
   * Inject a centered chapter icon fenced div immediately after the first
   * heading found in a markdown string.  Used when the note body itself
   * contains the chapter title (i.e. includeNoteNames is false) so the icon
   * always appears below the user-authored heading rather than before it.
   * If no heading is found the markdown is returned unchanged.
   */
  private injectChapterIconAfterFirstHeading(
    markdown: string,
    iconUrl: string,
  ): string {
    const iconBlock = [
      `::: {style="text-align:center; margin: 0.5em 0 1.5em 0"}`,
      `![](${iconUrl}){width=15%}`,
      `:::`,
    ].join("\n");

    const lines = markdown.split("\n");
    const firstHeadingIndex = lines.findIndex((line) => /^#{1,6} /.test(line));
    if (firstHeadingIndex === -1) {
      return markdown;
    }

    lines.splice(firstHeadingIndex + 1, 0, "", iconBlock, "");
    return lines.join("\n");
  }

  private appendContainerHeroImage(
    lines: string[],
    node: Pick<Node, "name" | "metadata">,
    apiBaseUrl: string,
    altText?: string,
  ): void {
    const heroAttachmentId =
      (node.metadata as Record<string, unknown> | null)?.heroAttachmentId ??
      null;

    if (typeof heroAttachmentId !== "string" || heroAttachmentId.length === 0) {
      return;
    }

    const alt = altText !== undefined ? altText : node.name;
    lines.push(`![${alt}](${apiBaseUrl}/media/${heroAttachmentId})`);
    lines.push("");
  }

  /**
   * Appends a PDF-specific container section.
   *
   * When the node has a hero image the section is rendered as a raw LaTeX
   * full-page block: optional \newpage, centered image, optional title below.
   * When there is no hero image but a name is requested a plain Markdown
   * heading is emitted (preceded by \newpage when requested).
   * When neither image nor name is present nothing is emitted.
   */
  private appendPdfContainerSection(
    lines: string[],
    node: Pick<Node, "name" | "metadata">,
    apiBaseUrl: string | null,
    headingLevel: number,
    opts: { includeName: boolean; includeNewPage: boolean },
  ): void {
    const heroAttachmentId =
      (node.metadata as Record<string, unknown> | null)?.heroAttachmentId ??
      null;

    const hasHeroImage =
      apiBaseUrl &&
      typeof heroAttachmentId === "string" &&
      heroAttachmentId.length > 0;

    if (hasHeroImage) {
      const imageUrl = `${apiBaseUrl}/media/${heroAttachmentId}`;
      const latexLines: string[] = ["```{=latex}"];

      if (opts.includeNewPage) {
        latexLines.push("\\newpage");
      }

      latexLines.push(
        "\\vspace*{\\fill}",
        "\\begin{center}",
        `\\includegraphics[width=0.85\\textwidth,keepaspectratio]{${imageUrl}}`,
      );

      if (opts.includeName) {
        latexLines.push("", "\\bigskip", "", `{\\Large ${node.name}}`);
      }

      latexLines.push("\\end{center}", "\\vfill", "```");
      lines.push(latexLines.join("\n"));
      lines.push("");
      return;
    }

    if (opts.includeName) {
      if (opts.includeNewPage) {
        lines.push("```{=latex}\n\\newpage\n```\n");
      }
      const hashes = "#".repeat(Math.min(headingLevel, 6));
      lines.push(`${hashes} ${node.name}\n`);
    }
    // No image and no name → nothing to emit
  }

  private async getApiBaseUrl(): Promise<string> {
    const configuredApiUrl =
      await configurationService.getConfiguration("API_URL");
    return normalizeApiBaseUrl(configuredApiUrl);
  }

  private async getSortedDescendants(
    parentId: string,
    sortMode: ExportSortMode,
  ): Promise<Node[]> {
    const childNodes = await nodeService.getNodesByParentId(parentId);
    const sortedChildNodes = [...childNodes].sort((leftNode, rightNode) =>
      compareNodesForExport(leftNode, rightNode, sortMode),
    );
    const descendantNodes: Node[] = [];

    for (const childNode of sortedChildNodes) {
      descendantNodes.push(childNode);
      descendantNodes.push(
        ...(await this.getSortedDescendants(childNode.id, sortMode)),
      );
    }

    return descendantNodes;
  }

  /**
   * Export a project tree as a ZIP archive.
   *
   * - Folders → directories in the ZIP
   * - Notes → individual `.md` files
   * - Media attachments for every node → included in native format
   *   in the same directory as their parent node
   */
  async exportProjectAsZip(
    nodeId: string,
    options?: Pick<ExportNameOptions, "sortMode">,
  ): Promise<Buffer> {
    const sortMode = options?.sortMode ?? "alphabetical";

    const rootNode = await nodeService.getNodeById(nodeId);
    if (!rootNode) throw new Error("Node not found");

    // Build a map from nodeId → ZIP directory path (with trailing slash)
    const nodeDirMap = new Map<string, string>();
    const sanitizeName = (name: string) =>
      // eslint-disable-next-line no-control-regex
      name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "untitled";

    const rootDirName = sanitizeName(rootNode.name) + "/";
    nodeDirMap.set(rootNode.id, rootDirName);

    // Collect all descendants in order so we can build paths
    const allDescendants = await this.getSortedDescendants(nodeId, sortMode);

    for (const descendant of allDescendants) {
      const parentDir =
        nodeDirMap.get(descendant.parentId ?? "") ?? rootDirName;
      if (containerTypes.has(descendant.type)) {
        nodeDirMap.set(
          descendant.id,
          parentDir + sanitizeName(descendant.name) + "/",
        );
      } else {
        nodeDirMap.set(descendant.id, parentDir);
      }
    }

    // Accumulate zip entries
    const zipEntries: Zippable = {};

    const addEntry = (path: string, data: Uint8Array) => {
      zipEntries[path] = [data, { level: 6 }];
    };

    // Ensure root directory placeholder so it appears in the ZIP
    addEntry(rootDirName, new Uint8Array(0));

    // Helper to convert a Readable to a Buffer
    const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    };

    // Process each node
    const nodesToProcess = [rootNode, ...allDescendants];
    for (const node of nodesToProcess) {
      const nodeDir = nodeDirMap.get(node.id) ?? rootDirName;

      // Export notes as markdown files
      if (node.type === "note") {
        const noteMarkdown = await this.exportNodeAsMarkdown(node.id, {
          includeFolderNames: false,
          includeNoteNames: true,
          sortMode,
        });
        const fileName = sanitizeName(node.name) + ".md";
        addEntry(nodeDir + fileName, Buffer.from(noteMarkdown, "utf-8"));
      }

      // Attach binary media files alongside their parent node
      const attachments = await mediaAttachmentService.getAttachmentsByNodeId(
        node.id,
      );
      for (const attachment of attachments) {
        try {
          const { stream } = await mediaAttachmentService.getAttachmentContent(
            attachment.id,
          );
          const fileBuffer = await streamToBuffer(stream);
          const attachmentFileName = sanitizeName(attachment.filename);
          addEntry(nodeDir + attachmentFileName, fileBuffer);
        } catch (_err) {
          // Skip unavailable attachments rather than failing the whole export
        }
      }
    }

    const zipped = zipSync(zipEntries);
    return Buffer.from(zipped);
  }
}
