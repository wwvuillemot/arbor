import { db } from "../db/index";
import { mediaAttachments, nodes } from "../db/schema";
import type { NodeType, AuthorType, Node } from "../db/schema";
import { eq, isNull, and, inArray, sql } from "drizzle-orm";
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
  summary?: string | null;
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
  summary?: string | null;
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
   * Preserves media attachments that are still referenced elsewhere in the
   * same project so stable /media/:id URLs do not break.
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

      await this.preserveReferencedAttachmentsBeforeDelete(existing);
    }

    await db.delete(nodes).where(eq(nodes.id, id));
  }

  private async preserveReferencedAttachmentsBeforeDelete(
    nodeToDelete: Node,
  ): Promise<void> {
    if (nodeToDelete.type === "project") {
      return;
    }

    const descendantNodes = await this.getDescendants(nodeToDelete.id);
    const subtreeNodes = [nodeToDelete, ...descendantNodes];
    const subtreeNodeIds = subtreeNodes.map((subtreeNode) => subtreeNode.id);

    const attachmentsInSubtree = await db
      .select()
      .from(mediaAttachments)
      .where(inArray(mediaAttachments.nodeId, subtreeNodeIds));

    if (attachmentsInSubtree.length === 0) {
      return;
    }

    const projectId = await this.getProjectIdForNode(nodeToDelete.id);
    const projectNode = await this.getNodeById(projectId);

    if (!projectNode) {
      throw new Error("Project node not found");
    }

    const subtreeNodeIdSet = new Set(subtreeNodeIds);
    const projectDescendants = await this.getDescendants(projectId);
    const externalNodes = [projectNode, ...projectDescendants].filter(
      (projectScopedNode) => !subtreeNodeIdSet.has(projectScopedNode.id),
    );

    if (externalNodes.length === 0) {
      return;
    }

    const attachmentIdsToPreserve = this.collectReferencedAttachmentIds({
      attachmentsInSubtree,
      externalNodes,
    });

    if (attachmentIdsToPreserve.length === 0) {
      return;
    }

    await db
      .update(mediaAttachments)
      .set({ nodeId: projectId })
      .where(inArray(mediaAttachments.id, attachmentIdsToPreserve));
  }

  private collectReferencedAttachmentIds({
    attachmentsInSubtree,
    externalNodes,
  }: {
    attachmentsInSubtree: Array<{ id: string }>;
    externalNodes: Node[];
  }): string[] {
    const externallyReferencedAttachmentIds = new Set<string>();

    for (const externalNode of externalNodes) {
      if (externalNode.content == null) {
        continue;
      }

      const serializedContent = JSON.stringify(externalNode.content);
      for (const attachment of attachmentsInSubtree) {
        if (serializedContent.includes(`/media/${attachment.id}`)) {
          externallyReferencedAttachmentIds.add(attachment.id);
        }
      }
    }

    return [...externallyReferencedAttachmentIds];
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
   * Set or clear the hero image attachment for a node.
   * Stores the attachment ID in metadata.heroAttachmentId.
   */
  async setHeroImage(
    nodeId: string,
    attachmentId: string | null,
  ): Promise<Node> {
    const node = await this.getNodeById(nodeId);
    if (!node) {
      throw new Error("Node not found");
    }

    const meta = (node.metadata as Record<string, unknown>) ?? {};

    return this.updateNode(nodeId, {
      metadata: { ...meta, heroAttachmentId: attachmentId },
    });
  }

  /**
   * Toggle the isFavorite flag in a node's metadata.
   * Returns the updated node.
   */
  async toggleFavorite(nodeId: string): Promise<Node> {
    const node = await this.getNodeById(nodeId);
    if (!node) {
      throw new Error("Node not found");
    }

    const meta = (node.metadata as Record<string, unknown>) ?? {};
    const isFavorite = meta.isFavorite === true;

    return this.updateNode(nodeId, {
      metadata: { ...meta, isFavorite: !isFavorite },
    });
  }

  /**
   * Get all favorited nodes (metadata.isFavorite === true) that are
   * descendants of the given project node.
   */
  async getFavoriteNodes(projectId: string): Promise<Node[]> {
    const descendants = await this.getDescendants(projectId);
    return descendants.filter(
      (node) =>
        (node.metadata as Record<string, unknown> | null)?.isFavorite === true,
    );
  }

  /**
   * Get all favorited nodes across all projects, each annotated with its
   * top-level project ID (resolved via a single recursive CTE query).
   */
  async getAllFavoriteNodes(): Promise<
    {
      id: string;
      name: string;
      type: string;
      content: unknown;
      metadata: unknown;
      updatedAt: Date;
      projectId: string;
      projectName: string;
      firstMediaId: string | null;
      tags: { id: string; name: string; color: string | null }[];
    }[]
  > {
    const result = await db.execute(sql`
      WITH RECURSIVE ancestor_chain AS (
        SELECT id, parent_id, type, id AS favorite_id
        FROM nodes
        WHERE metadata->>'isFavorite' = 'true'

        UNION ALL

        SELECT n.id, n.parent_id, n.type, ac.favorite_id
        FROM nodes n
        JOIN ancestor_chain ac ON n.id = ac.parent_id
        WHERE ac.type <> 'project'
      ),
      project_roots AS (
        SELECT DISTINCT ON (favorite_id) favorite_id, id AS project_id
        FROM ancestor_chain
        WHERE type = 'project'
      ),
      first_media AS (
        SELECT DISTINCT ON (node_id) node_id, id AS media_id
        FROM media_attachments
        WHERE mime_type LIKE 'image/%'
        ORDER BY node_id, created_at ASC
      )
      SELECT
        n.id, n.name, n.type, n.content, n.metadata, n.updated_at,
        pr.project_id,
        pn.name AS project_name,
        fm.media_id AS first_media_id,
        COALESCE(
          json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
            FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tags
      FROM nodes n
      JOIN project_roots pr ON pr.favorite_id = n.id
      JOIN nodes pn ON pn.id = pr.project_id
      LEFT JOIN first_media fm ON fm.node_id = n.id
      LEFT JOIN node_tags nt ON nt.node_id = n.id
      LEFT JOIN tags t ON t.id = nt.tag_id
      GROUP BY n.id, pr.project_id, pn.name, fm.media_id
      ORDER BY n.updated_at DESC
    `);

    return Array.from(result).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as string,
        name: row.name as string,
        type: row.type as string,
        content: row.content,
        metadata: row.metadata,
        updatedAt: row.updated_at as Date,
        projectId: row.project_id as string,
        projectName: row.project_name as string,
        firstMediaId: (row.first_media_id as string) ?? null,
        tags:
          (row.tags as { id: string; name: string; color: string | null }[]) ??
          [],
      };
    });
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
