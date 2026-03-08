import { db } from "../db/index";
import { nodes, type Node } from "../db/schema";

export interface NodeTreeLookup {
  getNodeById(id: string): Promise<Node | null>;
  getNodesByParentId(parentId: string): Promise<Node[]>;
}

export async function resolveProjectIdForNode(
  nodeLookup: NodeTreeLookup,
  nodeId: string,
): Promise<string> {
  let currentNode = await nodeLookup.getNodeById(nodeId);

  if (!currentNode) {
    throw new Error("Node not found");
  }

  while (currentNode.parentId) {
    const parentNode = await nodeLookup.getNodeById(currentNode.parentId);

    if (!parentNode) {
      throw new Error("Parent node not found");
    }

    currentNode = parentNode;
  }

  if (currentNode.type !== "project") {
    throw new Error("Top-level node is not a project");
  }

  return currentNode.id;
}

export async function getNodeDescendants(
  nodeLookup: NodeTreeLookup,
  nodeId: string,
  maxDepth?: number,
  currentDepth = 0,
): Promise<Node[]> {
  if (maxDepth !== undefined && currentDepth >= maxDepth) {
    return [];
  }

  const childNodes = await nodeLookup.getNodesByParentId(nodeId);
  const descendantNodes = [...childNodes];

  for (const childNode of childNodes) {
    const childDescendants = await getNodeDescendants(
      nodeLookup,
      childNode.id,
      maxDepth,
      currentDepth + 1,
    );
    descendantNodes.push(...childDescendants);
  }

  return descendantNodes;
}

export async function getNodeDepth(
  nodeLookup: NodeTreeLookup,
  nodeId: string,
): Promise<number> {
  let depth = 0;
  let currentNode = await nodeLookup.getNodeById(nodeId);

  while (currentNode?.parentId) {
    depth += 1;
    currentNode = await nodeLookup.getNodeById(currentNode.parentId);
  }

  return depth;
}

export async function getMaxSubtreeDepth(
  nodeLookup: NodeTreeLookup,
  nodeId: string,
): Promise<number> {
  const childNodes = await nodeLookup.getNodesByParentId(nodeId);
  if (childNodes.length === 0) {
    return 0;
  }

  let maxDepth = 0;
  for (const childNode of childNodes) {
    const childDepth = await getMaxSubtreeDepth(nodeLookup, childNode.id);
    maxDepth = Math.max(maxDepth, childDepth + 1);
  }

  return maxDepth;
}

export async function deepCopyNodeTree(
  nodeLookup: NodeTreeLookup,
  sourceNode: Node,
  targetParentId: string,
): Promise<Node> {
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

  const childNodes = await nodeLookup.getNodesByParentId(sourceNode.id);
  for (const childNode of childNodes) {
    await deepCopyNodeTree(nodeLookup, childNode, copiedNode.id);
  }

  return copiedNode;
}
