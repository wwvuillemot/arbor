import { router, publicProcedure } from "../trpc";
import { TagService } from "../../services/tag-service";
import {
  createEntityNodeInputSchema,
  createSuccessResponse,
  createTagInputSchema,
  getAllTagsInputSchema,
  getNodesByTagsInputSchema,
  getRelatedTagsInputSchema,
  getTagByIdOrThrow,
  linkEntityNodeInputSchema,
  nodeIdInputSchema,
  nodeTagRelationInputSchema,
  tagIdInputSchema,
  tagIdLookupInputSchema,
  updateTagInputSchema,
} from "./tags-router-helpers";

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
    .input(createTagInputSchema)
    .mutation(async ({ input }) => {
      return await tagService.createTag(input);
    }),

  /**
   * Update an existing tag
   */
  update: publicProcedure
    .input(updateTagInputSchema)
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      return await tagService.updateTag(id, updates);
    }),

  /**
   * Delete a tag
   */
  delete: publicProcedure
    .input(tagIdInputSchema)
    .mutation(async ({ input }) => {
      await tagService.deleteTag(input.id);
      return createSuccessResponse();
    }),

  /**
   * Get all tags, optionally filtered by type
   */
  getAll: publicProcedure
    .input(getAllTagsInputSchema)
    .query(async ({ input }) => {
      return await tagService.getAllTags(input?.type, input?.projectId);
    }),

  /**
   * Get a single tag by ID
   */
  getById: publicProcedure.input(tagIdInputSchema).query(async ({ input }) => {
    return getTagByIdOrThrow(tagService, input.id);
  }),

  /**
   * Add a tag to a node
   */
  addToNode: publicProcedure
    .input(nodeTagRelationInputSchema)
    .mutation(async ({ input }) => {
      await tagService.addTagToNode(input.nodeId, input.tagId);
      return createSuccessResponse();
    }),

  /**
   * Remove a tag from a node
   */
  removeFromNode: publicProcedure
    .input(nodeTagRelationInputSchema)
    .mutation(async ({ input }) => {
      await tagService.removeTagFromNode(input.nodeId, input.tagId);
      return createSuccessResponse();
    }),

  /**
   * Get all tags for a node
   */
  getNodeTags: publicProcedure
    .input(nodeIdInputSchema)
    .query(async ({ input }) => {
      return await tagService.getNodeTags(input.nodeId);
    }),

  /**
   * Get all nodes that have a specific tag
   */
  getNodesByTag: publicProcedure
    .input(tagIdLookupInputSchema)
    .query(async ({ input }) => {
      return await tagService.getNodesByTag(input.tagId);
    }),

  /**
   * Get nodes filtered by multiple tags with AND/OR logic
   */
  getNodesByTags: publicProcedure
    .input(getNodesByTagsInputSchema)
    .query(async ({ input }) => {
      return await tagService.getNodesByTags(input.tagIds, input.operator);
    }),

  /**
   * Get all tags with their node usage counts (for tag cloud)
   */
  getTagsWithCounts: publicProcedure.query(async () => {
    return await tagService.getTagsWithCounts();
  }),

  /**
   * Get tags that co-occur with a given tag (related tags suggestions)
   */
  getRelatedTags: publicProcedure
    .input(getRelatedTagsInputSchema)
    .query(async ({ input }) => {
      return await tagService.getRelatedTags(input.tagId, input.limit);
    }),

  /**
   * Link an entity-type tag to an existing node
   */
  linkEntityNode: publicProcedure
    .input(linkEntityNodeInputSchema)
    .mutation(async ({ input }) => {
      return await tagService.linkEntityNode(input.tagId, input.entityNodeId);
    }),

  /**
   * Unlink an entity-type tag from its entity node
   */
  unlinkEntityNode: publicProcedure
    .input(tagIdLookupInputSchema)
    .mutation(async ({ input }) => {
      return await tagService.unlinkEntityNode(input.tagId);
    }),

  /**
   * Create a new entity node for a tag and link it
   */
  createEntityNode: publicProcedure
    .input(createEntityNodeInputSchema)
    .mutation(async ({ input }) => {
      return await tagService.createEntityNode(input.tagId, input.parentId);
    }),
});
