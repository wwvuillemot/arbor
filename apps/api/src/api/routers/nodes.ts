import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { NodeService } from "../../services/node-service";

const nodeService = new NodeService();

// Zod schemas for validation
const nodeTypeSchema = z.enum([
  "project",
  "folder",
  "note",
  "link",
  "ai_suggestion",
  "audio_note",
]);
const authorTypeSchema = z.enum(["human", "ai", "mixed"]);

const createNodeSchema = z.object({
  type: nodeTypeSchema,
  name: z.string().min(1),
  parentId: z.string().uuid().optional().nullable(),
  slug: z.string().optional(),
  content: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  authorType: authorTypeSchema.optional(),
});

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  content: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  authorType: authorTypeSchema.optional(),
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
        authorType: input.authorType,
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
});
