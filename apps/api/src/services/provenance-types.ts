import type { ActorType, HistoryAction } from "../db/schema";

export interface RecordChangeParams {
  nodeId: string;
  actorType: ActorType;
  actorId?: string | null;
  action: HistoryAction;
  contentBefore?: unknown;
  contentAfter?: unknown;
  metadata?: Record<string, unknown>;
}

export interface GetHistoryParams {
  nodeId: string;
  limit?: number;
  offset?: number;
}

export interface GetHistoryByActorParams {
  nodeId: string;
  actorType: ActorType;
  limit?: number;
  offset?: number;
}

export interface GetHistoryInRangeParams {
  nodeId: string;
  startDate: Date;
  endDate: Date;
}

export interface GetAuditLogParams {
  limit?: number;
  offset?: number;
  actorType?: ActorType;
  action?: HistoryAction;
  startDate?: Date;
  endDate?: Date;
  nodeId?: string;
}

export interface SearchHistoryParams {
  query: string;
  limit?: number;
  offset?: number;
}

export type AuditLogFilterParams = Omit<GetAuditLogParams, "limit" | "offset">;

export interface ProvenanceCheckoutResult {
  version: number;
  content: unknown;
  action: HistoryAction;
  actorType: ActorType;
  actorId: string | null;
  createdAt: Date;
}
