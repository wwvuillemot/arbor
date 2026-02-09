import { db } from "../db/index";
import { nodes } from "../db/schema";
import type { NodeType, AuthorType } from "../db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";

export interface CreateNodeParams {
  type: NodeType;
  name: string;
  parentId?: string | null;
  slug?: string;
  content?: any; // JSONB content (can be object, string, or null)
  metadata?: Record<string, any>;
  authorType?: AuthorType; // DEPRECATED: Use createdBy/updatedBy instead
  position?: number; // Position for ordering siblings
  createdBy?: string; // Provenance: "user:{id}" or "llm:{model}"
  updatedBy?: string; // Provenance: "user:{id}" or "llm:{model}"
}

export interface UpdateNodeParams {
  name?: string;
  slug?: string;
  content?: any; // JSONB content (can be object, string, or null)
  metadata?: Record<string, any>;
  authorType?: AuthorType; // DEPRECATED: Use updatedBy instead
  position?: number; // Position for ordering siblings
  updatedBy?: string; // Provenance: "user:{id}" or "llm:{model}"
}

export class NodeService {
  /**
   * Create a new node with validation
   */
  async createNode(params: CreateNodeParams) {
    // Validation: Projects cannot have a parent
    if (params.type === "project" && params.parentId) {
      throw new Error("Projects cannot have a parent");
    }

    // Validation: Only projects can be top-level nodes
    if (params.type !== "project" && !params.parentId) {
      throw new Error("Only projects can be top-level nodes");
    }

    // Auto-generate slug if not provided
    const slug = params.slug || this.generateSlug(params.name);

    const [node] = await db
      .insert(nodes)
      .values({
        type: params.type,
        name: params.name,
        parentId: params.parentId || null,
        slug,
        content: params.content,
        metadata: params.metadata || {},
        authorType: params.authorType || "human", // DEPRECATED
        position: params.position ?? 0, // Default to 0 if not provided
        createdBy: params.createdBy || "user:system", // Default to user:system
        updatedBy: params.updatedBy || "user:system", // Default to user:system
      })
      .returning();

    return node;
  }

  /**
   * Get a node by ID
   */
  async getNodeById(id: string) {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, id));

    return node || null;
  }

  /**
   * Get all children of a node, ordered by position
   */
  async getNodesByParentId(parentId: string) {
    return await db
      .select()
      .from(nodes)
      .where(eq(nodes.parentId, parentId))
      .orderBy(asc(nodes.position));
  }

  /**
   * Get all top-level projects
   */
  async getAllProjects() {
    return await db
      .select()
      .from(nodes)
      .where(and(eq(nodes.type, "project"), isNull(nodes.parentId)));
  }

  /**
   * Update a node
   */
  async updateNode(id: string, updates: UpdateNodeParams) {
    // Check if node exists
    const existing = await this.getNodeById(id);
    if (!existing) {
      throw new Error("Node not found");
    }

    const [updated] = await db
      .update(nodes)
      .set({
        ...updates,
        updatedAt: new Date(),
        // If updatedBy is not provided, keep the existing value
        // (don't override with default)
      })
      .where(eq(nodes.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete a node (cascade delete handled by database)
   */
  async deleteNode(id: string) {
    await db.delete(nodes).where(eq(nodes.id, id));
  }

  /**
   * Move a node to a new parent with optional position
   */
  async moveNode(nodeId: string, newParentId: string, position?: number) {
    // Check node exists
    const node = await this.getNodeById(nodeId);
    if (!node) {
      throw new Error("Node not found");
    }

    // Projects cannot be moved (they are always top-level)
    if (node.type === "project") {
      throw new Error("Projects cannot be moved");
    }

    // Check new parent exists
    const newParent = await this.getNodeById(newParentId);
    if (!newParent) {
      throw new Error("Target parent not found");
    }

    // Check for circular reference: newParentId must not be a descendant of nodeId
    const descendants = await this.getDescendantsInternal(nodeId);
    const descendantIds = descendants.map((d) => d.id);
    if (descendantIds.includes(newParentId)) {
      throw new Error("Cannot move a node into its own descendant");
    }

    // Check depth limit: compute depth of newParentId from root
    const parentDepth = await this.getNodeDepth(newParentId);
    // The moved node (and any subtree) adds at least 1 more level
    const maxSubtreeDepth = await this.getMaxSubtreeDepth(nodeId);
    if (parentDepth + 1 + maxSubtreeDepth >= 10) {
      throw new Error("Move would exceed maximum path depth of 10 levels");
    }

    const updateData: Record<string, any> = {
      parentId: newParentId,
      updatedAt: new Date(),
    };
    if (position !== undefined) {
      updateData.position = position;
    }

    const [updated] = await db
      .update(nodes)
      .set(updateData)
      .where(eq(nodes.id, nodeId))
      .returning();

    return updated;
  }

  /**
   * Deep copy a node and all its children to a new parent
   */
  async copyNode(nodeId: string, targetParentId: string) {
    // Check source node exists
    const sourceNode = await this.getNodeById(nodeId);
    if (!sourceNode) {
      throw new Error("Source node not found");
    }

    // Check target parent exists
    const targetParent = await this.getNodeById(targetParentId);
    if (!targetParent) {
      throw new Error("Target parent not found");
    }

    return this.deepCopyNode(sourceNode, targetParentId);
  }

  /**
   * Get all descendants of a node, optionally limited by depth
   */
  async getDescendants(nodeId: string, maxDepth?: number) {
    // Check node exists
    const node = await this.getNodeById(nodeId);
    if (!node) {
      throw new Error("Node not found");
    }

    return this.getDescendantsInternal(nodeId, maxDepth);
  }

  /**
   * Reorder children of a parent by specifying the new order of child IDs
   */
  async reorderChildren(parentId: string, childIds: string[]) {
    // Check parent exists
    const parent = await this.getNodeById(parentId);
    if (!parent) {
      throw new Error("Parent not found");
    }

    // Update each child's position based on its index in the array
    for (let i = 0; i < childIds.length; i++) {
      await db
        .update(nodes)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(nodes.id, childIds[i]));
    }
  }

  /**
   * Generate a URL-friendly slug from a name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/-+/g, "-"); // Replace multiple hyphens with single hyphen
  }

  /**
   * Internal: get descendants without existence check (used by moveNode)
   */
  private async getDescendantsInternal(
    nodeId: string,
    maxDepth?: number,
    currentDepth = 0,
  ): Promise<any[]> {
    if (maxDepth !== undefined && currentDepth >= maxDepth) {
      return [];
    }

    const children = await this.getNodesByParentId(nodeId);
    const descendants = [...children];

    for (const child of children) {
      const childDescendants = await this.getDescendantsInternal(
        child.id,
        maxDepth,
        currentDepth + 1,
      );
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  /**
   * Get the depth of a node from the root (project = 0)
   */
  private async getNodeDepth(nodeId: string): Promise<number> {
    let depth = 0;
    let currentNode = await this.getNodeById(nodeId);

    while (currentNode && currentNode.parentId) {
      depth++;
      currentNode = await this.getNodeById(currentNode.parentId);
    }

    return depth;
  }

  /**
   * Get the maximum depth of a node's subtree (0 for leaf nodes)
   */
  private async getMaxSubtreeDepth(nodeId: string): Promise<number> {
    const children = await this.getNodesByParentId(nodeId);
    if (children.length === 0) return 0;

    let maxDepth = 0;
    for (const child of children) {
      const childDepth = await this.getMaxSubtreeDepth(child.id);
      maxDepth = Math.max(maxDepth, childDepth + 1);
    }
    return maxDepth;
  }

  /**
   * Deep copy a node and all its children recursively
   */
  private async deepCopyNode(sourceNode: any, targetParentId: string) {
    // Create copy of the node
    const [copiedNode] = await db
      .insert(nodes)
      .values({
        type: sourceNode.type,
        name: sourceNode.name,
        parentId: targetParentId,
        slug: sourceNode.slug,
        content: sourceNode.content,
        metadata: sourceNode.metadata || {},
        authorType: sourceNode.authorType || "human",
        position: sourceNode.position ?? 0,
        createdBy: sourceNode.createdBy || "user:system",
        updatedBy: sourceNode.updatedBy || "user:system",
      })
      .returning();

    // Recursively copy children
    const children = await this.getNodesByParentId(sourceNode.id);
    for (const child of children) {
      await this.deepCopyNode(child, copiedNode.id);
    }

    return copiedNode;
  }
}
