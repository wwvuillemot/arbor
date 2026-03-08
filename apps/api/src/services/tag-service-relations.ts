import { db } from "../db/index";
import { nodes, nodeTags, tags, type Node, type Tag } from "../db/schema";
import { and, count, eq, inArray, sql } from "drizzle-orm";

async function ensureNodeExists(nodeId: string): Promise<void> {
  const [node] = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(eq(nodes.id, nodeId));

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
}

async function ensureTagExists(tagId: string): Promise<void> {
  const [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.id, tagId));

  if (!tag) {
    throw new Error(`Tag not found: ${tagId}`);
  }
}

export async function addTagToNode(
  nodeId: string,
  tagId: string,
): Promise<void> {
  await ensureNodeExists(nodeId);
  await ensureTagExists(tagId);

  await db.insert(nodeTags).values({ nodeId, tagId }).onConflictDoNothing();
}

export async function removeTagFromNode(
  nodeId: string,
  tagId: string,
): Promise<void> {
  await db
    .delete(nodeTags)
    .where(and(eq(nodeTags.nodeId, nodeId), eq(nodeTags.tagId, tagId)));
}

export async function getNodeTags(nodeId: string): Promise<Tag[]> {
  const results = await db
    .select({ tag: tags })
    .from(nodeTags)
    .innerJoin(tags, eq(nodeTags.tagId, tags.id))
    .where(eq(nodeTags.nodeId, nodeId));

  return results.map((result) => result.tag);
}

export async function getNodesByTag(tagId: string): Promise<Node[]> {
  const results = await db
    .select({ node: nodes })
    .from(nodeTags)
    .innerJoin(nodes, eq(nodeTags.nodeId, nodes.id))
    .where(eq(nodeTags.tagId, tagId));

  return results.map((result) => result.node);
}

export async function getNodesByTags(
  tagIds: string[],
  operator: "AND" | "OR" = "OR",
): Promise<Node[]> {
  if (tagIds.length === 0) {
    return [];
  }

  if (operator === "OR") {
    const nodeIdRows = await db
      .selectDistinct({ nodeId: nodeTags.nodeId })
      .from(nodeTags)
      .where(inArray(nodeTags.tagId, tagIds));

    if (nodeIdRows.length === 0) {
      return [];
    }

    const nodeIds = nodeIdRows.map((row) => row.nodeId);
    return db.select().from(nodes).where(inArray(nodes.id, nodeIds));
  }

  const matchingNodeRows = await db
    .select({ nodeId: nodeTags.nodeId })
    .from(nodeTags)
    .where(inArray(nodeTags.tagId, tagIds))
    .groupBy(nodeTags.nodeId)
    .having(sql`count(distinct ${nodeTags.tagId}) = ${tagIds.length}`);

  if (matchingNodeRows.length === 0) {
    return [];
  }

  const matchingNodeIds = matchingNodeRows.map((row) => row.nodeId);
  return db.select().from(nodes).where(inArray(nodes.id, matchingNodeIds));
}

export async function getTagsWithCounts(): Promise<
  (Tag & { nodeCount: number })[]
> {
  const results = await db
    .select({
      tag: tags,
      nodeCount: count(nodeTags.nodeId),
    })
    .from(tags)
    .leftJoin(nodeTags, eq(tags.id, nodeTags.tagId))
    .groupBy(
      tags.id,
      tags.name,
      tags.color,
      tags.icon,
      tags.type,
      tags.entityNodeId,
      tags.projectId,
      tags.createdAt,
      tags.updatedAt,
    );

  return results.map((result) => ({
    ...result.tag,
    nodeCount: Number(result.nodeCount),
  }));
}

export async function getRelatedTags(
  tagId: string,
  limit = 10,
): Promise<(Tag & { sharedCount: number })[]> {
  const taggedNodeIds = db
    .select({ nodeId: nodeTags.nodeId })
    .from(nodeTags)
    .where(eq(nodeTags.tagId, tagId));

  const results = await db
    .select({
      tag: tags,
      sharedCount: count(nodeTags.nodeId),
    })
    .from(nodeTags)
    .innerJoin(tags, eq(nodeTags.tagId, tags.id))
    .where(
      and(
        inArray(nodeTags.nodeId, taggedNodeIds),
        sql`${nodeTags.tagId} != ${tagId}`,
      ),
    )
    .groupBy(
      tags.id,
      tags.name,
      tags.color,
      tags.icon,
      tags.type,
      tags.entityNodeId,
      tags.projectId,
      tags.createdAt,
      tags.updatedAt,
    )
    .orderBy(sql`count(${nodeTags.nodeId}) desc`)
    .limit(limit);

  return results.map((result) => ({
    ...result.tag,
    sharedCount: Number(result.sharedCount),
  }));
}
