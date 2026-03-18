import path from "node:path";
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

// ---------------------------------------------------------------------------
// SVG sanitization for EPUB export
// ---------------------------------------------------------------------------

/**
 * Remove explicit `width` and `height` attributes from the root `<svg>` element
 * so that the enclosing container can control sizing via CSS.
 * Other attributes and child elements are untouched.
 */
function normalizeSvgRootDimensions(svgText: string): string {
  return svgText.replace(
    /(<svg\b)([^>]*)(>)/,
    (_m, open: string, attrs: string, close: string) => {
      const cleaned = attrs
        .replace(/\s+width="[^"]*"/g, "")
        .replace(/\s+height="[^"]*"/g, "");
      return `${open}${cleaned}${close}`;
    },
  );
}

/**
 * Strip unsafe content from raw SVG text and replace all hardcoded fill/stroke
 * colors with `currentColor` so the SVG inherits the EPUB reader's theme color.
 * `fill="none"` and `stroke="none"` are preserved for hollow/open shapes.
 */
function sanitizeAndAdaptSvgForEpub(svgText: string): string {
  // Security: remove script elements
  let result = svgText.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  // Security: remove event-handler attributes (onclick, onload, etc.)
  result = result.replace(
    /\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/g,
    "",
  );
  // Color adaptation: replace explicit fill values that are not "none"
  result = result.replace(/\bfill="(?!none\b)([^"]*)"/g, 'fill="currentColor"');
  // Color adaptation: replace explicit stroke values that are not "none"
  result = result.replace(
    /\bstroke="(?!none\b)([^"]*)"/g,
    'stroke="currentColor"',
  );
  // Color adaptation: replace fill inside inline style attributes
  result = result.replace(/\bfill:\s*(?!none\b)[^;}"']+/g, "fill:currentColor");
  // Color adaptation: replace stroke inside inline style attributes
  result = result.replace(
    /\bstroke:\s*(?!none\b)[^;}"']+/g,
    "stroke:currentColor",
  );
  return result;
}

/**
 * Decode a base64 SVG, sanitize it for EPUB (currentColor, no scripts), strip
 * explicit root dimensions, and return the cleaned SVG string.
 * Throws if decoding or processing fails.
 */
function processSvgDataUrl(b64Data: string): string {
  const svgText = Buffer.from(b64Data.replace(/\s/g, ""), "base64").toString(
    "utf-8",
  );
  const sanitized = sanitizeAndAdaptSvgForEpub(svgText);
  return normalizeSvgRootDimensions(sanitized);
}

/**
 * Post-process EPUB markdown: find Pandoc fenced-div blocks that contain an
 * SVG data-URL and replace them with raw HTML <div><svg>…</svg></div> so that
 * `currentColor` is inherited from the EPUB reader's theme.
 *
 * Handles two block types emitted by export-service.ts:
 *
 * Dinkus (between notes, 33% wide):
 *   ::: {style="text-align:center; margin: 2em 0"}
 *   ![](data:image/svg+xml;base64,…){width=33%}
 *   :::
 *
 * Chapter icon (below note title, 15% wide):
 *   ::: {style="text-align:center; margin: 0.5em 0 1.5em 0"}
 *   ![](data:image/svg+xml;base64,…){width=15%}
 *   :::
 */
function inlineSvgFencedBlocks(markdown: string): string {
  // Matches any fenced div whose image src is an SVG data-URL.
  // Capture groups: (1) full style string, (2) base64 data, (3) image attributes.
  const pattern =
    /:::\s*\{style="([^"]*)"\}\n!\[[^\]]*\]\(data:image\/svg\+xml;base64,([A-Za-z0-9+/=\r\n]+)\)\{([^}]*)\}\n:::/g;

  return markdown.replace(
    pattern,
    (_match, style: string, b64Data: string, imgAttrs: string) => {
      try {
        const svg = processSvgDataUrl(b64Data);
        // Extract the width percentage from the image attribute (e.g. "width=33%").
        const widthMatch = imgAttrs.match(/width=([0-9]+%)/);
        const maxWidth = widthMatch ? widthMatch[1] : "33%";
        // Re-use the style from the fenced div for vertical margins; override
        // horizontal margin to `auto` so the div is centered on the page.
        const divStyle = `${style}; max-width:${maxWidth}; margin-left:auto; margin-right:auto;`;
        return `\n<div style="${divStyle}">${svg}</div>\n`;
      } catch {
        // Leave the original block so Pandoc still renders the image.
        return _match;
      }
    },
  );
}
import { NodeService } from "../../services/node-service";
import { NodeDirectoryImportService } from "../../services/node-directory-import-service";
import { ExportService } from "../../services/export-service";
import {
  DEFAULT_PDF_TEMPLATE_ID,
  PDF_TEMPLATE_IDS,
  PandocExportService,
  type ResolvedImage,
} from "../../services/pandoc-export-service";
import { MediaAttachmentService } from "../../services/media-attachment-service";

const nodeService = new NodeService();
const nodeDirectoryImportService = new NodeDirectoryImportService(nodeService);
const exportService = new ExportService();
const mediaAttachmentService = new MediaAttachmentService();

// UUID pattern used to extract attachment IDs from media URLs
// (e.g. http://api.arbor.local/media/<uuid>).
const MEDIA_URL_ATTACHMENT_ID_RE =
  /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Resolve a media URL to its raw bytes by reading directly from MinIO,
 * bypassing the HTTP layer entirely.  This avoids ECONNREFUSED errors that
 * occur when the API server tries to fetch its own public-facing media URL.
 *
 * Returns null when the URL does not match the local media pattern so the
 * caller can fall back to a plain HTTP fetch.
 */
async function resolveLocalMediaUrl(
  url: string,
): Promise<ResolvedImage | null> {
  const urlMatch = MEDIA_URL_ATTACHMENT_ID_RE.exec(url);
  if (!urlMatch) return null;

  const attachmentId = urlMatch[1];
  try {
    const { attachment, stream } =
      await mediaAttachmentService.getAttachmentContent(attachmentId);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return { buffer: Buffer.concat(chunks), mimeType: attachment.mimeType };
  } catch {
    return null;
  }
}

const pandocExportService = new PandocExportService({
  resolveImageUrl: resolveLocalMediaUrl,
});
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME_TYPE = "application/pdf";
const EPUB_MIME_TYPE = "application/epub+zip";

// Zod schemas for validation
const nodeTypeSchema = z.enum([
  "project",
  "folder",
  "note",
  "link",
  "ai_suggestion",
  "audio_note",
]);
const authorTypeSchema = z.enum(["human", "ai", "mixed"]); // DEPRECATED

// Provenance format: "user:{id}" or "llm:{model}"
// Examples: "user:alice", "llm:gpt-4o", "llm:claude-3.5-sonnet"
const provenanceSchema = z
  .string()
  .regex(/^(user|llm):.+$/, "Must be in format 'user:{id}' or 'llm:{model}'");

const createNodeSchema = z.object({
  type: nodeTypeSchema,
  name: z.string().min(1),
  parentId: z.string().uuid().optional().nullable(),
  slug: z.string().optional(),
  content: z.any().optional(), // JSONB content (can be object, string, or null)
  metadata: z.record(z.any()).optional(),
  summary: z.string().nullable().optional(),
  authorType: authorTypeSchema.optional(), // DEPRECATED: Use createdBy/updatedBy instead
  position: z.number().int().optional(), // Position for ordering siblings
  createdBy: provenanceSchema.optional(), // Defaults to "user:system"
  updatedBy: provenanceSchema.optional(), // Defaults to "user:system"
});

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  content: z.any().optional(), // JSONB content (can be object, string, or null)
  metadata: z.record(z.any()).optional(),
  summary: z.string().nullable().optional(),
  authorType: authorTypeSchema.optional(), // DEPRECATED: Use updatedBy instead
  position: z.number().int().optional(), // Position for ordering siblings
  updatedBy: provenanceSchema.optional(), // Who last updated this node
});

const exportNodeInputSchema = z.object({
  id: z.string().uuid(),
  includeDescendants: z.boolean().default(false),
  includeFolderNames: z.boolean().default(true),
  includeNoteNames: z.boolean().default(true),
  sortMode: z.enum(["alphabetical", "manual"]).default("alphabetical"),
});

const exportPdfInputSchema = exportNodeInputSchema.extend({
  templateId: z.enum(PDF_TEMPLATE_IDS).default(DEFAULT_PDF_TEMPLATE_ID),
});

export const nodesRouter = router({
  // Get all projects
  getAllProjects: publicProcedure.query(async () => {
    return await nodeService.getAllProjects();
  }),

  // Get node by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const node = await nodeService.getNodeById(input.id);
      if (!node) {
        throw new Error("Node not found");
      }
      return node;
    }),

  // Get children of a node
  getChildren: publicProcedure
    .input(z.object({ parentId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await nodeService.getNodesByParentId(input.parentId);
    }),

  // Get all descendants of a node (recursive)
  getDescendants: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        maxDepth: z.number().int().positive().optional(),
      }),
    )
    .query(async ({ input }) => {
      return await nodeService.getDescendants(input.nodeId, input.maxDepth);
    }),

  // Create a new node
  create: publicProcedure
    .input(createNodeSchema)
    .mutation(async ({ input }) => {
      return await nodeService.createNode({
        type: input.type,
        name: input.name,
        parentId: input.parentId,
        slug: input.slug,
        content: input.content,
        metadata: input.metadata,
        summary: input.summary,
        authorType: input.authorType, // DEPRECATED
        position: input.position,
        createdBy: input.createdBy,
        updatedBy: input.updatedBy,
      });
    }),

  // Update a node
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateNodeSchema,
      }),
    )
    .mutation(async ({ input }) => {
      return await nodeService.updateNode(input.id, input.data);
    }),

  // Delete a node
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await nodeService.deleteNode(input.id);
      return { success: true };
    }),

  // Move a node to a new parent
  move: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        newParentId: z.string().uuid(),
        position: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return await nodeService.moveNode(
        input.id,
        input.newParentId,
        input.position,
      );
    }),

  // Copy a node (deep copy with children)
  copy: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        targetParentId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      return await nodeService.copyNode(input.id, input.targetParentId);
    }),

  // Reorder children of a parent
  reorder: publicProcedure
    .input(
      z.object({
        parentId: z.string().uuid(),
        childIds: z.array(z.string().uuid()),
      }),
    )
    .mutation(async ({ input }) => {
      await nodeService.reorderChildren(input.parentId, input.childIds);
      return { success: true };
    }),

  // Export a node or project as Markdown
  exportMarkdown: publicProcedure
    .input(exportNodeInputSchema)
    .query(async ({ input }) => {
      const exportOptions = {
        includeFolderNames: input.includeFolderNames,
        includeNoteNames: input.includeNoteNames,
        sortMode: input.sortMode,
      };

      if (input.includeDescendants) {
        return {
          content: await exportService.exportProjectAsMarkdown(
            input.id,
            exportOptions,
          ),
        };
      }
      return {
        content: await exportService.exportNodeAsMarkdown(
          input.id,
          exportOptions,
        ),
      };
    }),

  // Export a node or project as HTML (for PDF printing)
  exportHtml: publicProcedure
    .input(exportNodeInputSchema)
    .query(async ({ input }) => {
      const exportOptions = {
        includeFolderNames: input.includeFolderNames,
        includeNoteNames: input.includeNoteNames,
        sortMode: input.sortMode,
      };

      if (input.includeDescendants) {
        return {
          content: await exportService.exportProjectAsHtml(
            input.id,
            exportOptions,
          ),
        };
      }
      return {
        content: await exportService.exportNodeAsHtml(input.id, exportOptions),
      };
    }),

  // Get the available PDF templates supported by the local Pandoc exporter
  getPdfTemplates: publicProcedure.query(() => {
    return pandocExportService.getPdfTemplates();
  }),

  // Export a node or project as PDF via Pandoc
  exportPdf: publicProcedure
    .input(exportPdfInputSchema)
    .query(async ({ input }) => {
      const exportOptions = {
        includeFolderNames: input.includeFolderNames,
        includeNoteNames: input.includeNoteNames,
        sortMode: input.sortMode,
        outputFormat: "pdf" as const,
      };
      const node = await nodeService.getNodeById(input.id);

      if (!node) {
        throw new Error("Node not found");
      }

      const markdownContent = input.includeDescendants
        ? await exportService.exportProjectAsMarkdown(input.id, exportOptions)
        : await exportService.exportNodeAsMarkdown(input.id, exportOptions);
      const pdfContent = await pandocExportService.exportMarkdownAsPdf(
        markdownContent,
        input.templateId,
      );

      return {
        contentBase64: pdfContent.toString("base64"),
        fileName: `${node.name}.pdf`,
        mimeType: PDF_MIME_TYPE,
      };
    }),

  // Export a node or project as DOCX via Pandoc
  exportDocx: publicProcedure
    .input(exportNodeInputSchema)
    .query(async ({ input }) => {
      const exportOptions = {
        includeFolderNames: input.includeFolderNames,
        includeNoteNames: input.includeNoteNames,
        sortMode: input.sortMode,
        outputFormat: "docx" as const,
      };
      const node = await nodeService.getNodeById(input.id);

      if (!node) {
        throw new Error("Node not found");
      }

      const markdownContent = input.includeDescendants
        ? await exportService.exportProjectAsMarkdown(input.id, exportOptions)
        : await exportService.exportNodeAsMarkdown(input.id, exportOptions);
      const docxContent =
        await pandocExportService.exportMarkdownAsDocx(markdownContent);

      return {
        contentBase64: docxContent.toString("base64"),
        fileName: `${node.name}.docx`,
        mimeType: DOCX_MIME_TYPE,
      };
    }),

  // Export a project tree as a ZIP archive (notes as .md, attachments as-is)
  exportZip: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        sortMode: z.enum(["alphabetical", "manual"]).default("alphabetical"),
      }),
    )
    .query(async ({ input }) => {
      const node = await nodeService.getNodeById(input.id);
      if (!node) throw new Error("Node not found");

      const zipBuffer = await exportService.exportProjectAsZip(input.id, {
        sortMode: input.sortMode,
      });

      return {
        contentBase64: zipBuffer.toString("base64"),
        fileName: `${node.name}.zip`,
        mimeType: "application/zip",
      };
    }),

  // Export a node or project as EPUB 3.0 via Pandoc
  exportEpub: publicProcedure
    .input(
      exportNodeInputSchema.extend({
        coverAttachmentId: z.string().uuid().optional(),
        epubAuthor: z.string().max(256).optional(),
        epubDescription: z.string().max(2000).optional(),
        epubLanguage: z.string().max(35).optional(),
      }),
    )
    .query(async ({ input }) => {
      const exportOptions = {
        includeFolderNames: input.includeFolderNames,
        includeNoteNames: input.includeNoteNames,
        sortMode: input.sortMode,
        outputFormat: "epub" as const,
      };

      const node = await nodeService.getNodeById(input.id);
      if (!node) throw new Error("Node not found");

      const markdownContent = input.includeDescendants
        ? await exportService.exportProjectAsMarkdown(input.id, exportOptions)
        : await exportService.exportNodeAsMarkdown(input.id, exportOptions);

      // Rewrite MinIO-backed /media/{uuid} image URLs to base64 data-URLs so
      // Pandoc can embed them in the EPUB without reaching a live HTTP server.
      // Images already stored as data:image/…;base64,… (pasted inline images)
      // are already in the correct format and require no transformation.
      const mediaUrlPattern =
        /!\[[^\]]*\]\((https?:\/\/[^)]+\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))\)/g;
      const urlToAttachmentId = new Map<string, string>();
      for (const match of markdownContent.matchAll(mediaUrlPattern)) {
        const fullUrl = match[1];
        const attachmentId = match[2];
        if (!urlToAttachmentId.has(fullUrl)) {
          urlToAttachmentId.set(fullUrl, attachmentId);
        }
      }

      let rewrittenMarkdown = markdownContent;

      for (const [fullUrl, attachmentId] of urlToAttachmentId) {
        try {
          const { attachment, stream } =
            await mediaAttachmentService.getAttachmentContent(attachmentId);
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const imageBuffer = Buffer.concat(chunks);
          const mimeType = attachment.mimeType || "image/jpeg";
          const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
          rewrittenMarkdown = rewrittenMarkdown.split(fullUrl).join(dataUrl);
        } catch (err) {
          console.error(
            `[exportEpub] Failed to fetch media attachment ${attachmentId}:`,
            err,
          );
          // Leave the original URL; Pandoc will produce a broken-image placeholder
          // rather than crashing the whole export.
        }
      }

      // Second pass: inline all SVG fenced-div blocks (dinkuses and chapter
      // icons) so currentColor is inherited from the EPUB reader's theme.
      // This replaces Pandoc fenced divs containing SVG data-URLs with raw
      // HTML <div><svg>…</svg></div> that inherit CSS color.
      rewrittenMarkdown = inlineSvgFencedBlocks(rewrittenMarkdown);

      let coverImageBuffer: Buffer | undefined;
      let coverImageExtension: string | undefined;

      if (input.coverAttachmentId) {
        const { attachment, stream } =
          await mediaAttachmentService.getAttachmentContent(
            input.coverAttachmentId,
          );
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        coverImageBuffer = Buffer.concat(chunks);
        coverImageExtension =
          path.extname(attachment.filename).slice(1) || "jpg";
      }

      const epubContent = await pandocExportService.exportMarkdownAsEpub(
        rewrittenMarkdown,
        node.name ?? undefined,
        coverImageBuffer,
        coverImageExtension,
        {
          author: input.epubAuthor,
          description: input.epubDescription,
          language: input.epubLanguage,
        },
      );

      return {
        contentBase64: epubContent.toString("base64"),
        fileName: `${node.name}.epub`,
        mimeType: EPUB_MIME_TYPE,
      };
    }),

  // Set or clear the hero image for a node (stores attachmentId in metadata)
  setHeroImage: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        attachmentId: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      return await nodeService.setHeroImage(input.nodeId, input.attachmentId);
    }),

  // Toggle isFavorite on a node's metadata
  toggleFavorite: publicProcedure
    .input(z.object({ nodeId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return await nodeService.toggleFavorite(input.nodeId);
    }),

  // Toggle isLocked on a node's metadata
  toggleLock: publicProcedure
    .input(z.object({ nodeId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return await nodeService.toggleLock(input.nodeId);
    }),

  // Get all favorited nodes for a project
  getFavorites: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await nodeService.getFavoriteNodes(input.projectId);
    }),

  // Get all favorited nodes across all projects (for dashboard)
  getAllFavorites: publicProcedure.query(async () => {
    return await nodeService.getAllFavoriteNodes();
  }),

  /**
   * Import a directory of markdown/text files as a node hierarchy.
   * If parentNodeId is provided, imports into that existing node (folder/project) instead
   * of creating a new project. Otherwise always creates a new project node.
   * Returns both the actual project root ID and the specific node that served as the
   * import target so clients can distinguish folder imports from new-project imports.
   * Client reads files via webkitdirectory input and sends relative paths + text content.
   * Subdirectories are created as folder nodes; files become note nodes.
   */
  importDirectory: publicProcedure
    .input(
      z.object({
        projectName: z.string().min(1),
        parentNodeId: z.string().uuid().optional(), // Import into existing node instead of creating new project
        files: z.array(
          z.object({
            path: z.string(), // e.g. "rootDir/subfolder/note.md"
            content: z.unknown(), // TipTap JSON object or raw string
          }),
        ),
      }),
    )
    .mutation(async ({ input }) =>
      nodeDirectoryImportService.importDirectory(input),
    ),
});
