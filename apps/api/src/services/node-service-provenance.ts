import type { ActorType, Node } from "../db/schema";
import type { ProvenanceService } from "./provenance-service";

/**
 * Parse a provenance string ("user:{id}" or "llm:{model}") into actor details.
 */
export function parseProvenance(provenance?: string): {
  actorType: ActorType;
  actorId: string;
} {
  if (!provenance) {
    return { actorType: "user", actorId: "user:system" };
  }

  if (provenance.startsWith("llm:")) {
    return { actorType: "llm", actorId: provenance };
  }

  return { actorType: "user", actorId: provenance };
}

export async function recordNodeCreated(
  provenanceService: ProvenanceService,
  node: Node,
  provenance?: string,
): Promise<void> {
  const { actorType, actorId } = parseProvenance(provenance);

  await provenanceService.recordChange({
    nodeId: node.id,
    actorType,
    actorId,
    action: "create",
    contentBefore: null,
    contentAfter: node.content,
    metadata: { name: node.name, type: node.type },
  });
}

export async function recordNodeUpdated(params: {
  provenanceService: ProvenanceService;
  nodeId: string;
  previousNode: Node;
  updatedNode: Node;
  updatedBy?: string;
  updatedFieldNames: string[];
}): Promise<void> {
  const { actorType, actorId } = parseProvenance(
    params.updatedBy || params.previousNode.updatedBy,
  );

  await params.provenanceService.recordChange({
    nodeId: params.nodeId,
    actorType,
    actorId,
    action: "update",
    contentBefore: params.previousNode.content,
    contentAfter: params.updatedNode.content,
    metadata: { updatedFields: params.updatedFieldNames },
  });
}

export async function recordNodeDeleted(params: {
  provenanceService: ProvenanceService;
  node: Node;
  deletedBy?: string;
}): Promise<void> {
  const { actorType, actorId } = parseProvenance(
    params.deletedBy || params.node.updatedBy,
  );

  await params.provenanceService.recordChange({
    nodeId: params.node.id,
    actorType,
    actorId,
    action: "delete",
    contentBefore: params.node.content,
    contentAfter: null,
    metadata: { name: params.node.name, type: params.node.type },
  });
}

export async function recordNodeMoved(params: {
  provenanceService: ProvenanceService;
  previousNode: Node;
  updatedNode: Node;
  newParentId: string;
  oldParentId: string | null;
  position?: number;
}): Promise<void> {
  const { actorType, actorId } = parseProvenance(params.previousNode.updatedBy);

  await params.provenanceService.recordChange({
    nodeId: params.previousNode.id,
    actorType,
    actorId,
    action: "move",
    contentBefore: params.previousNode.content,
    contentAfter: params.updatedNode.content,
    metadata: {
      oldParentId: params.oldParentId,
      newParentId: params.newParentId,
      position: params.position ?? params.updatedNode.position,
    },
  });
}
