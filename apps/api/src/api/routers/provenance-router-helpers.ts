import { z } from "zod";
import type { NodeHistory, ActorType, HistoryAction } from "../../db/schema";
import type {
  AuditLogFilterParams,
  GetAuditLogParams,
  GetHistoryInRangeParams,
} from "../../services/provenance-types";
import type { ProvenanceService } from "../../services/provenance-service";

const nodeIdSchema = z.string().uuid();
const positiveIntSchema = z.number().int().positive();
const paginationFields = {
  limit: positiveIntSchema.max(100).optional(),
  offset: z.number().int().min(0).optional(),
};

export const actorTypeValues = ["user", "llm", "system"] as const;
export const actionTypeValues = [
  "create",
  "update",
  "delete",
  "move",
  "restore",
] as const;

export const getHistoryInputSchema = z.object({
  nodeId: nodeIdSchema,
  ...paginationFields,
});
export const getVersionInputSchema = z.object({
  nodeId: nodeIdSchema,
  version: positiveIntSchema,
});
export const nodeIdInputSchema = z.object({ nodeId: nodeIdSchema });
export const getHistoryByActorInputSchema = z.object({
  nodeId: nodeIdSchema,
  actorType: z.enum(actorTypeValues),
  ...paginationFields,
});
export const getHistoryInRangeInputSchema = z.object({
  nodeId: nodeIdSchema,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});
export const compareVersionsInputSchema = z.object({
  nodeId: nodeIdSchema,
  versionA: positiveIntSchema,
  versionB: positiveIntSchema,
});
export const rollbackInputSchema = z.object({
  nodeId: nodeIdSchema,
  targetVersion: positiveIntSchema,
  actorId: z.string().optional(),
});
export const getAuditLogInputSchema = z.object({
  ...paginationFields,
  actorType: z.enum(actorTypeValues).optional(),
  action: z.enum(actionTypeValues).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  nodeId: nodeIdSchema.optional(),
});
export const getAuditLogCountInputSchema = z.object({
  actorType: z.enum(actorTypeValues).optional(),
  action: z.enum(actionTypeValues).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  nodeId: nodeIdSchema.optional(),
});
export const searchHistoryInputSchema = z.object({
  query: z.string().min(1),
  ...paginationFields,
});
export const exportAuditReportInputSchema = z.object({
  format: z.enum(["csv", "html"]),
  actorType: z.enum(actorTypeValues).optional(),
  action: z.enum(actionTypeValues).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  nodeId: nodeIdSchema.optional(),
});

type AuditFilterInput = {
  actorType?: ActorType;
  action?: HistoryAction;
  startDate?: string;
  endDate?: string;
  nodeId?: string;
};

export function buildHistoryInRangeParams(
  input: z.infer<typeof getHistoryInRangeInputSchema>,
): GetHistoryInRangeParams {
  return {
    nodeId: input.nodeId,
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
  };
}

export function buildAuditLogParams(
  input: z.infer<typeof getAuditLogInputSchema>,
): GetAuditLogParams {
  return {
    limit: input.limit,
    offset: input.offset,
    ...buildAuditLogFilterParams(input),
  };
}

export function buildAuditLogFilterParams(
  input: AuditFilterInput,
): AuditLogFilterParams {
  return {
    actorType: input.actorType,
    action: input.action,
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    nodeId: input.nodeId,
  };
}

export async function getNodeVersionOrThrow(
  provenanceService: Pick<ProvenanceService, "getVersion">,
  nodeId: string,
  version: number,
  errorMessage: string,
): Promise<NodeHistory> {
  const entry = await provenanceService.getVersion(nodeId, version);
  if (!entry) {
    throw new Error(errorMessage);
  }

  return entry;
}
