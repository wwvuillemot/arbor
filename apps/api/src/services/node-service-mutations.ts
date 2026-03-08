import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { nodes, type Node } from "../db/schema";
import {
  getMaxSubtreeDepth,
  getNodeDepth,
  getNodeDescendants,
  type NodeTreeLookup,
} from "./node-service-tree";
import type { CreateNodeParams, UpdateNodeParams } from "./node-service";

export function validateCreateNodeParams(params: CreateNodeParams): void {
  if (params.type === "project" && params.parentId) {
    throw new Error("Projects cannot have a parent");
  }

  if (params.type !== "project" && !params.parentId) {
    throw new Error("Only projects can be top-level nodes");
  }
}

export async function createNodeRecord(
  params: CreateNodeParams,
): Promise<Node> {
  const [createdNode] = await db
    .insert(nodes)
    .values(buildCreateNodeValues(params))
    .returning();

  return createdNode;
}

export async function updateNodeRecord(
  nodeId: string,
  updates: UpdateNodeParams,
): Promise<Node> {
  const [updatedNode] = await db
    .update(nodes)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(nodes.id, nodeId))
    .returning();

  return updatedNode;
}

export function getUpdatedFieldNames(updates: UpdateNodeParams): string[] {
  return Object.keys(updates).filter((fieldName) => fieldName !== "updatedBy");
}

export async function validateMoveNode(
  nodeLookup: NodeTreeLookup,
  node: Node,
  newParentId: string,
): Promise<void> {
  if (node.type === "project") {
    throw new Error("Projects cannot be moved");
  }

  const targetParent = await nodeLookup.getNodeById(newParentId);
  if (!targetParent) {
    throw new Error("Target parent not found");
  }

  const descendantNodes = await getNodeDescendants(nodeLookup, node.id);
  const descendantIds = descendantNodes.map(
    (descendantNode) => descendantNode.id,
  );
  if (descendantIds.includes(newParentId)) {
    throw new Error("Cannot move a node into its own descendant");
  }

  const targetParentDepth = await getNodeDepth(nodeLookup, newParentId);
  const maxSubtreeDepth = await getMaxSubtreeDepth(nodeLookup, node.id);
  if (targetParentDepth + 1 + maxSubtreeDepth >= 10) {
    throw new Error("Move would exceed maximum path depth of 10 levels");
  }
}

export async function moveNodeRecord(
  nodeId: string,
  newParentId: string,
  position?: number,
): Promise<Node> {
  const [updatedNode] = await db
    .update(nodes)
    .set(buildMoveNodeValues(newParentId, position))
    .where(eq(nodes.id, nodeId))
    .returning();

  return updatedNode;
}

export async function reorderNodeChildren(childIds: string[]): Promise<void> {
  for (const [childIndex, childId] of childIds.entries()) {
    await db
      .update(nodes)
      .set({ position: childIndex, updatedAt: new Date() })
      .where(eq(nodes.id, childId));
  }
}

function buildCreateNodeValues(params: CreateNodeParams) {
  const slug = params.slug || generateNodeSlug(params.name);

  return {
    type: params.type,
    name: params.name,
    parentId: params.parentId || null,
    slug,
    content: params.content,
    metadata: params.metadata || {},
    authorType: params.authorType || "human",
    position: params.position ?? 0,
    createdBy: params.createdBy || "user:system",
    updatedBy: params.updatedBy || "user:system",
  };
}

function buildMoveNodeValues(newParentId: string, position?: number) {
  const moveUpdate = {
    parentId: newParentId,
    updatedAt: new Date(),
  } as {
    parentId: string;
    updatedAt: Date;
    position?: number;
  };

  if (position !== undefined) {
    moveUpdate.position = position;
  }

  return moveUpdate;
}

function generateNodeSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
