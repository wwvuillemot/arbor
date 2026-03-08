import { db } from "../db/index";
import { nodes } from "../db/schema";
import type { NodeType, AuthorType, Node } from "../db/schema";
import { eq, isNull, and, sql } from "drizzle-orm";
import { ProvenanceService } from "./provenance-service";
import {
  recordNodeCreated,
  recordNodeDeleted,
  recordNodeMoved,
  recordNodeUpdated,
} from "./node-service-provenance";
import {
  createNodeRecord,
  getUpdatedFieldNames,
  moveNodeRecord,
  reorderNodeChildren,
  updateNodeRecord,
  validateCreateNodeParams,
  validateMoveNode,
} from "./node-service-mutations";
import {
  deepCopyNodeTree,
  getNodeDescendants,
  resolveProjectIdForNode,
} from "./node-service-tree";

const provenanceService = new ProvenanceService();

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
  async createNode(params: CreateNodeParams): Promise<Node> {
    validateCreateNodeParams(params);

    const node = await createNodeRecord(params);

    // Record provenance
    await recordNodeCreated(
      provenanceService,
      node,
      params.createdBy || params.updatedBy,
    );

    return node;
  }

  /**
   * Get a node by ID
   */
  async getNodeById(id: string): Promise<Node | null> {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, id));

    return node || null;
  }

  /**
   * Get all children of a node, ordered by position
   */
  async getNodesByParentId(parentId: string): Promise<Node[]> {
    return await db
      .select()
      .from(nodes)
      .where(eq(nodes.parentId, parentId))
      .orderBy(nodes.position, sql`lower(${nodes.name}) asc`);
  }

  /**
   * Get all top-level projects
   */
  async getAllProjects(): Promise<Node[]> {
    return await db
      .select()
      .from(nodes)
      .where(and(eq(nodes.type, "project"), isNull(nodes.parentId)))
      .orderBy(nodes.position, sql`lower(${nodes.name}) asc`);
  }

  /**
   * Resolve the top-level project ID for any node in a project tree.
   */
  async getProjectIdForNode(nodeId: string): Promise<string> {
    return resolveProjectIdForNode(this, nodeId);
  }

  /**
   * Update a node
   */
  async updateNode(id: string, updates: UpdateNodeParams): Promise<Node> {
    // Check if node exists
    const existing = await this.getNodeById(id);
    if (!existing) {
      throw new Error("Node not found");
    }

    const updated = await updateNodeRecord(id, updates);

    // Record provenance for content or name changes
    await recordNodeUpdated({
      provenanceService,
      nodeId: id,
      previousNode: existing,
      updatedNode: updated,
      updatedBy: updates.updatedBy,
      updatedFieldNames: getUpdatedFieldNames(updates),
    });

    return updated;
  }

  /**
   * Delete a node (cascade delete handled by database).
   * Optionally accepts deletedBy for provenance tracking.
   */
  async deleteNode(id: string, deletedBy?: string) {
    // Capture content before deletion for provenance
    const existing = await this.getNodeById(id);
    if (existing) {
      await recordNodeDeleted({
        provenanceService,
        node: existing,
        deletedBy,
      });
    }

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

    await validateMoveNode(this, node, newParentId);

    const oldParentId = node.parentId;

    const updated = await moveNodeRecord(nodeId, newParentId, position);

    // Record provenance for move
    await recordNodeMoved({
      provenanceService,
      previousNode: node,
      updatedNode: updated,
      oldParentId,
      newParentId,
      position,
    });

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

    return deepCopyNodeTree(this, sourceNode, targetParentId);
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

    return getNodeDescendants(this, nodeId, maxDepth);
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

    await reorderNodeChildren(childIds);
  }
}
