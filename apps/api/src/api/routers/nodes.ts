import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { NodeService } from "../../services/node-service";
import { NodeDirectoryImportService } from "../../services/node-directory-import-service";
import { ExportService } from "../../services/export-service";

const nodeService = new NodeService();
const nodeDirectoryImportService = new NodeDirectoryImportService(nodeService);
const exportService = new ExportService();

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
    .input(
      z.object({
        id: z.string().uuid(),
        includeDescendants: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      if (input.includeDescendants) {
        return {
          content: await exportService.exportProjectAsMarkdown(input.id),
        };
      }
      return { content: await exportService.exportNodeAsMarkdown(input.id) };
    }),

  // Export a node or project as HTML (for PDF printing)
  exportHtml: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        includeDescendants: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      if (input.includeDescendants) {
        return { content: await exportService.exportProjectAsHtml(input.id) };
      }
      return { content: await exportService.exportNodeAsHtml(input.id) };
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
