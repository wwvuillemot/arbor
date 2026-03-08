import { db } from "../db/index";
import { nodes, tags, type Node, type Tag, type TagType } from "../db/schema";
import { eq } from "drizzle-orm";

export const ENTITY_TAG_TYPES: readonly TagType[] = [
  "character",
  "location",
  "event",
  "concept",
];

async function getTagByIdOrThrow(tagId: string): Promise<Tag> {
  const [tag] = await db.select().from(tags).where(eq(tags.id, tagId));

  if (!tag) {
    throw new Error(`Tag not found: ${tagId}`);
  }

  return tag;
}

async function ensureNodeExists(
  nodeId: string,
  missingLabel = "Node",
): Promise<void> {
  const [node] = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(eq(nodes.id, nodeId));

  if (!node) {
    throw new Error(`${missingLabel} not found: ${nodeId}`);
  }
}

function ensureEntityTagType(tag: Tag, actionDescription: string): void {
  if (!ENTITY_TAG_TYPES.includes(tag.type)) {
    throw new Error(
      `Only entity-type tags (character, location, event, concept) can ${actionDescription}`,
    );
  }
}

function buildEntityNodeSlug(tagName: string): string {
  return tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export async function linkEntityNode(
  tagId: string,
  entityNodeId: string,
): Promise<Tag> {
  const tag = await getTagByIdOrThrow(tagId);
  ensureEntityTagType(tag, "be linked to nodes");
  await ensureNodeExists(entityNodeId);

  const [updatedTag] = await db
    .update(tags)
    .set({ entityNodeId, updatedAt: new Date() })
    .where(eq(tags.id, tagId))
    .returning();

  return updatedTag;
}

export async function unlinkEntityNode(tagId: string): Promise<Tag> {
  await getTagByIdOrThrow(tagId);

  const [updatedTag] = await db
    .update(tags)
    .set({ entityNodeId: null, updatedAt: new Date() })
    .where(eq(tags.id, tagId))
    .returning();

  return updatedTag;
}

export async function createEntityNode(
  tagId: string,
  parentId: string,
): Promise<{ tag: Tag; node: Node }> {
  const tag = await getTagByIdOrThrow(tagId);
  ensureEntityTagType(tag, "have entity nodes");

  if (tag.entityNodeId) {
    throw new Error(`Tag "${tag.name}" already has an entity node`);
  }

  await ensureNodeExists(parentId, "Parent node");

  const [entityNode] = await db
    .insert(nodes)
    .values({
      type: "note",
      name: tag.name,
      parentId,
      slug: buildEntityNodeSlug(tag.name),
      content: {},
      metadata: { entityTagId: tagId, entityType: tag.type },
      authorType: "human",
      position: 0,
      createdBy: "user:system",
      updatedBy: "user:system",
    })
    .returning();

  const [updatedTag] = await db
    .update(tags)
    .set({ entityNodeId: entityNode.id, updatedAt: new Date() })
    .where(eq(tags.id, tagId))
    .returning();

  return { tag: updatedTag, node: entityNode };
}
