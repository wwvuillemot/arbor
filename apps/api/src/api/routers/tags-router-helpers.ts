import { z } from "zod";
import { tagTypeEnum } from "../../db/schema";
import { TagService } from "../../services/tag-service";

const tagNameSchema = z.string().min(1).max(255);

const tagColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional();

const tagIconSchema = z.string().max(50).nullable().optional();

const tagTypeSchema = z.enum(tagTypeEnum).optional();

const projectScopedTagIdSchema = z.string().uuid().nullable().optional();

export const createTagInputSchema = z.object({
  name: tagNameSchema,
  color: tagColorSchema,
  icon: tagIconSchema,
  type: tagTypeSchema,
  /** null/undefined = global tag; UUID = project-scoped tag */
  projectId: projectScopedTagIdSchema,
});

export const updateTagInputSchema = z.object({
  id: z.string().uuid(),
  name: tagNameSchema.optional(),
  color: tagColorSchema,
  icon: tagIconSchema,
  type: tagTypeSchema,
  /** null = make global; UUID = scope to project */
  projectId: projectScopedTagIdSchema,
});

export const tagIdInputSchema = z.object({
  id: z.string().uuid(),
});

export const getAllTagsInputSchema = z
  .object({
    type: z.enum(tagTypeEnum).optional(),
    /** Pass project UUID to include that project's tags + global tags */
    projectId: z.string().uuid().optional(),
  })
  .optional();

export const nodeIdInputSchema = z.object({
  nodeId: z.string().uuid(),
});

export const tagIdLookupInputSchema = z.object({
  tagId: z.string().uuid(),
});

export const nodeTagRelationInputSchema = z.object({
  nodeId: z.string().uuid(),
  tagId: z.string().uuid(),
});

export const getNodesByTagsInputSchema = z.object({
  tagIds: z.array(z.string().uuid()).min(1),
  operator: z.enum(["AND", "OR"]).optional().default("OR"),
});

export const getRelatedTagsInputSchema = z.object({
  tagId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export const linkEntityNodeInputSchema = z.object({
  tagId: z.string().uuid(),
  entityNodeId: z.string().uuid(),
});

export const createEntityNodeInputSchema = z.object({
  tagId: z.string().uuid(),
  parentId: z.string().uuid(),
});

export function createSuccessResponse() {
  return { success: true };
}

export async function getTagByIdOrThrow(tagService: TagService, tagId: string) {
  const tag = await tagService.getTagById(tagId);
  if (!tag) {
    throw new Error("Tag not found");
  }

  return tag;
}
