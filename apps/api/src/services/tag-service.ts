import { db } from "../db/index";
import { tags, nodeTags, nodes } from "../db/schema";
import type { Tag, TagType } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface CreateTagParams {
  name: string;
  color?: string | null;
  icon?: string | null;
  type?: TagType;
}

export interface UpdateTagParams {
  name?: string;
  color?: string | null;
  icon?: string | null;
  type?: TagType;
}

/**
 * TagService
 *
 * Manages tag CRUD operations and tag-node associations.
 * Tags can be of different types: general, character, location, event, concept.
 */
export class TagService {
  /**
   * Create a new tag
   */
  async createTag(params: CreateTagParams): Promise<Tag> {
    const [tag] = await db
      .insert(tags)
      .values({
        name: params.name,
        color: params.color ?? null,
        icon: params.icon ?? null,
        type: params.type || "general",
      })
      .returning();

    return tag;
  }

  /**
   * Get a tag by ID
   */
  async getTagById(id: string): Promise<Tag | null> {
    const [tag] = await db.select().from(tags).where(eq(tags.id, id));
    return tag || null;
  }

  /**
   * Get all tags, optionally filtered by type
   */
  async getAllTags(type?: TagType): Promise<Tag[]> {
    if (type) {
      return await db.select().from(tags).where(eq(tags.type, type));
    }
    return await db.select().from(tags);
  }

  /**
   * Update a tag
   */
  async updateTag(id: string, updates: UpdateTagParams): Promise<Tag> {
    const existing = await this.getTagById(id);
    if (!existing) {
      throw new Error(`Tag not found: ${id}`);
    }

    const [updated] = await db
      .update(tags)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(tags.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete a tag (cascade removes all node_tags associations)
   */
  async deleteTag(id: string): Promise<void> {
    const existing = await this.getTagById(id);
    if (!existing) {
      throw new Error(`Tag not found: ${id}`);
    }

    await db.delete(tags).where(eq(tags.id, id));
  }

  /**
   * Add a tag to a node
   */
  async addTagToNode(nodeId: string, tagId: string): Promise<void> {
    // Verify node exists
    const [node] = await db.select().from(nodes).where(eq(nodes.id, nodeId));
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    // Verify tag exists
    const tag = await this.getTagById(tagId);
    if (!tag) {
      throw new Error(`Tag not found: ${tagId}`);
    }

    // Check if already associated (upsert - ignore conflict)
    await db.insert(nodeTags).values({ nodeId, tagId }).onConflictDoNothing();
  }

  /**
   * Remove a tag from a node
   */
  async removeTagFromNode(nodeId: string, tagId: string): Promise<void> {
    await db
      .delete(nodeTags)
      .where(and(eq(nodeTags.nodeId, nodeId), eq(nodeTags.tagId, tagId)));
  }

  /**
   * Get all tags for a node
   */
  async getNodeTags(nodeId: string): Promise<Tag[]> {
    const results = await db
      .select({ tag: tags })
      .from(nodeTags)
      .innerJoin(tags, eq(nodeTags.tagId, tags.id))
      .where(eq(nodeTags.nodeId, nodeId));

    return results.map((r) => r.tag);
  }

  /**
   * Get all nodes with a specific tag
   */
  async getNodesByTag(tagId: string): Promise<(typeof nodes.$inferSelect)[]> {
    const results = await db
      .select({ node: nodes })
      .from(nodeTags)
      .innerJoin(nodes, eq(nodeTags.nodeId, nodes.id))
      .where(eq(nodeTags.tagId, tagId));

    return results.map((r) => r.node);
  }
}
