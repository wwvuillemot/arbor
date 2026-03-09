import { db } from "../db/index";
import { tags } from "../db/schema";
import type { Node, Tag, TagType } from "../db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import {
  addTagToNode as addTagToNodeRelation,
  getNodeTags as getNodeTagsRelation,
  getNodesByTag as getNodesByTagRelation,
  getNodesByTags as getNodesByTagsRelation,
  getRelatedTags as getRelatedTagsRelation,
  getTagsWithCounts as getTagsWithCountsRelation,
  removeTagFromNode as removeTagFromNodeRelation,
} from "./tag-service-relations";
import {
  createEntityNode as createEntityNodeForTag,
  linkEntityNode as linkEntityNodeForTag,
  unlinkEntityNode as unlinkEntityNodeForTag,
} from "./tag-service-entity-nodes";

export interface CreateTagParams {
  name: string;
  color?: string | null;
  icon?: string | null;
  type?: TagType;
  /** If set, tag is scoped to this project. If null/undefined, tag is global. */
  projectId?: string | null;
}

export interface UpdateTagParams {
  name?: string;
  color?: string | null;
  icon?: string | null;
  type?: TagType;
  entityNodeId?: string | null;
  /** null = make global; UUID = scope to project */
  projectId?: string | null;
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
        projectId: params.projectId ?? null,
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
   * Get tags visible for a given context:
   * - If projectId provided: returns global tags + tags scoped to that project.
   * - If no projectId: returns only global tags.
   * - Optionally filter by type.
   */
  async getAllTags(type?: TagType, projectId?: string): Promise<Tag[]> {
    const scopeCondition = projectId
      ? or(isNull(tags.projectId), eq(tags.projectId, projectId))!
      : isNull(tags.projectId);

    if (type) {
      return await db
        .select()
        .from(tags)
        .where(and(scopeCondition, eq(tags.type, type)));
    }
    return await db.select().from(tags).where(scopeCondition);
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
    await addTagToNodeRelation(nodeId, tagId);
  }

  /**
   * Remove a tag from a node
   */
  async removeTagFromNode(nodeId: string, tagId: string): Promise<void> {
    await removeTagFromNodeRelation(nodeId, tagId);
  }

  /**
   * Add a tag to multiple nodes in one call
   */
  async bulkAddToNodes(nodeIds: string[], tagId: string): Promise<void> {
    await Promise.all(
      nodeIds.map((nodeId) => this.addTagToNode(nodeId, tagId)),
    );
  }

  /**
   * Remove a tag from multiple nodes in one call
   */
  async bulkRemoveFromNodes(nodeIds: string[], tagId: string): Promise<void> {
    await Promise.all(
      nodeIds.map((nodeId) => this.removeTagFromNode(nodeId, tagId)),
    );
  }

  /**
   * Get all tags for a node
   */
  async getNodeTags(nodeId: string): Promise<Tag[]> {
    return getNodeTagsRelation(nodeId);
  }

  /**
   * Get all nodes with a specific tag
   */
  async getNodesByTag(tagId: string): Promise<Node[]> {
    return getNodesByTagRelation(tagId);
  }

  // ─── Tag Navigation Methods ─────────────────────────────────────────────

  /**
   * Get nodes that have ALL (AND) or ANY (OR) of the specified tag IDs.
   */
  async getNodesByTags(
    tagIds: string[],
    operator: "AND" | "OR" = "OR",
  ): Promise<Node[]> {
    return getNodesByTagsRelation(tagIds, operator);
  }

  /**
   * Get all tags with their node usage count (for tag cloud).
   */
  async getTagsWithCounts(): Promise<(Tag & { nodeCount: number })[]> {
    return getTagsWithCountsRelation();
  }

  /**
   * Get tags that co-occur with a given tag (related tags).
   * Returns tags that share at least one node with the given tag,
   * ordered by the number of shared nodes (descending).
   */
  async getRelatedTags(
    tagId: string,
    limit = 10,
  ): Promise<(Tag & { sharedCount: number })[]> {
    return getRelatedTagsRelation(tagId, limit);
  }

  /**
   * Link a tag to an existing entity node
   */
  async linkEntityNode(tagId: string, entityNodeId: string): Promise<Tag> {
    return linkEntityNodeForTag(tagId, entityNodeId);
  }

  /**
   * Unlink a tag from its entity node
   */
  async unlinkEntityNode(tagId: string): Promise<Tag> {
    return unlinkEntityNodeForTag(tagId);
  }

  /**
   * Create a new entity node for a tag and link it.
   * The entity node is created as a "note" type child of the given parent project/folder.
   */
  async createEntityNode(
    tagId: string,
    parentId: string,
  ): Promise<{ tag: Tag; node: Node }> {
    return createEntityNodeForTag(tagId, parentId);
  }
}
