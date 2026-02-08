import { db } from "../db/index";
import { nodes } from "../db/schema";
import type { NodeType, AuthorType } from "../db/schema";
import { eq, isNull, and } from "drizzle-orm";

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
   * Get all children of a node
   */
  async getNodesByParentId(parentId: string) {
    return await db.select().from(nodes).where(eq(nodes.parentId, parentId));
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
}
