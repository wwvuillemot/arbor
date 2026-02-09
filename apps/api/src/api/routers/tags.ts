import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { TagService } from "../../services/tag-service";
import { tagTypeEnum } from "../../db/schema";

const tagService = new TagService();

/**
 * Tags Router
 *
 * tRPC endpoints for tag CRUD operations and tag-node associations.
 */
export const tagsRouter = router({
  /**
   * Create a new tag
   */
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
        icon: z.string().max(50).nullable().optional(),
        type: z.enum(tagTypeEnum).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return await tagService.createTag(input);
    }),

  /**
   * Update an existing tag
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .nullable()
          .optional(),
        icon: z.string().max(50).nullable().optional(),
        type: z.enum(tagTypeEnum).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      return await tagService.updateTag(id, updates);
    }),

  /**
   * Delete a tag
   */
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await tagService.deleteTag(input.id);
      return { success: true };
    }),

  /**
   * Get all tags, optionally filtered by type
   */
  getAll: publicProcedure
    .input(
      z
        .object({
          type: z.enum(tagTypeEnum).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return await tagService.getAllTags(input?.type);
    }),

  /**
   * Get a single tag by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const tag = await tagService.getTagById(input.id);
      if (!tag) {
        throw new Error("Tag not found");
      }
      return tag;
    }),

  /**
   * Add a tag to a node
   */
  addToNode: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        tagId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      await tagService.addTagToNode(input.nodeId, input.tagId);
      return { success: true };
    }),

  /**
   * Remove a tag from a node
   */
  removeFromNode: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        tagId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      await tagService.removeTagFromNode(input.nodeId, input.tagId);
      return { success: true };
    }),

  /**
   * Get all tags for a node
   */
  getNodeTags: publicProcedure
    .input(z.object({ nodeId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await tagService.getNodeTags(input.nodeId);
    }),

  /**
   * Get all nodes that have a specific tag
   */
  getNodesByTag: publicProcedure
    .input(z.object({ tagId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await tagService.getNodesByTag(input.tagId);
    }),
});
