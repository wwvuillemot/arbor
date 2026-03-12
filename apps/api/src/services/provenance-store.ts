import { db } from "../db/index";
import {
  nodeHistory,
  nodes,
  type ActorType,
  type Node,
  type NodeHistory,
} from "../db/schema";
import { and, between, count, desc, eq, or, sql } from "drizzle-orm";
import { buildAuditLogWhereClause } from "./provenance-audit";
import type {
  AuditLogFilterParams,
  GetAuditLogParams,
  GetHistoryByActorParams,
  GetHistoryInRangeParams,
  GetHistoryParams,
  RecordChangeParams,
  SearchHistoryParams,
} from "./provenance-types";

interface CreateNodeHistoryEntryParams extends RecordChangeParams {
  version: number;
  diff: unknown;
}

export async function createNodeHistoryEntry(
  params: CreateNodeHistoryEntryParams,
): Promise<NodeHistory> {
  const [entry] = await db
    .insert(nodeHistory)
    .values({
      nodeId: params.nodeId,
      version: params.version,
      actorType: params.actorType,
      actorId: params.actorId ?? null,
      action: params.action,
      contentBefore: params.contentBefore ?? null,
      contentAfter: params.contentAfter ?? null,
      diff: params.diff,
      metadata: params.metadata ?? {},
    })
    .returning();

  return entry;
}

export async function getNextNodeHistoryVersion(
  nodeId: string,
): Promise<number> {
  const [result] = await db
    .select({
      maxVersion: sql<number>`COALESCE(MAX(${nodeHistory.version}), 0)`,
    })
    .from(nodeHistory)
    .where(eq(nodeHistory.nodeId, nodeId));

  return (result?.maxVersion ?? 0) + 1;
}

export async function listNodeHistory(
  params: GetHistoryParams,
): Promise<NodeHistory[]> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  return db
    .select()
    .from(nodeHistory)
    .where(eq(nodeHistory.nodeId, params.nodeId))
    .orderBy(desc(nodeHistory.version))
    .limit(limit)
    .offset(offset);
}

export async function getNodeHistoryVersion(
  nodeId: string,
  version: number,
): Promise<NodeHistory | null> {
  const [entry] = await db
    .select()
    .from(nodeHistory)
    .where(
      and(eq(nodeHistory.nodeId, nodeId), eq(nodeHistory.version, version)),
    )
    .limit(1);

  return entry ?? null;
}

export async function getLatestNodeHistoryVersion(
  nodeId: string,
): Promise<NodeHistory | null> {
  const [entry] = await db
    .select()
    .from(nodeHistory)
    .where(eq(nodeHistory.nodeId, nodeId))
    .orderBy(desc(nodeHistory.version))
    .limit(1);

  return entry ?? null;
}

export async function deleteNodeHistoryEntry(entryId: string): Promise<void> {
  await db.delete(nodeHistory).where(eq(nodeHistory.id, entryId));
}

export async function countNodeHistoryVersions(
  nodeId: string,
): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(nodeHistory)
    .where(eq(nodeHistory.nodeId, nodeId));

  return result?.total ?? 0;
}

export async function listNodeHistoryByActor(
  params: GetHistoryByActorParams,
): Promise<NodeHistory[]> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  return db
    .select()
    .from(nodeHistory)
    .where(
      and(
        eq(nodeHistory.nodeId, params.nodeId),
        eq(nodeHistory.actorType, params.actorType),
      ),
    )
    .orderBy(desc(nodeHistory.version))
    .limit(limit)
    .offset(offset);
}

export async function listNodeHistoryInRange(
  params: GetHistoryInRangeParams,
): Promise<NodeHistory[]> {
  return db
    .select()
    .from(nodeHistory)
    .where(
      and(
        eq(nodeHistory.nodeId, params.nodeId),
        between(nodeHistory.createdAt, params.startDate, params.endDate),
      ),
    )
    .orderBy(desc(nodeHistory.version));
}

export async function listAuditLogEntries(
  params: GetAuditLogParams,
): Promise<NodeHistory[]> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const whereClause = buildAuditLogWhereClause(params);

  return db
    .select()
    .from(nodeHistory)
    .where(whereClause)
    .orderBy(desc(nodeHistory.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countAuditLogEntries(
  params: AuditLogFilterParams,
): Promise<number> {
  const whereClause = buildAuditLogWhereClause(params);

  const [result] = await db
    .select({ total: count() })
    .from(nodeHistory)
    .where(whereClause);

  return result?.total ?? 0;
}

export async function searchNodeHistory(
  params: SearchHistoryParams,
): Promise<NodeHistory[]> {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  const pattern = `%${params.query}%`;

  return db
    .select()
    .from(nodeHistory)
    .where(
      or(
        sql`${nodeHistory.contentBefore}::text ILIKE ${pattern}`,
        sql`${nodeHistory.contentAfter}::text ILIKE ${pattern}`,
        sql`${nodeHistory.actorId} ILIKE ${pattern}`,
      ),
    )
    .orderBy(desc(nodeHistory.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getNodeById(nodeId: string): Promise<Node | null> {
  const [node] = await db
    .select()
    .from(nodes)
    .where(eq(nodes.id, nodeId))
    .limit(1);
  return node ?? null;
}

export async function updateNodeContentForRollback(params: {
  nodeId: string;
  restoredContent: unknown;
  actorType: ActorType;
  actorId?: string;
}): Promise<void> {
  await db
    .update(nodes)
    .set({
      content: params.restoredContent,
      updatedAt: new Date(),
      updatedBy: params.actorId ?? `${params.actorType}:system`,
    })
    .where(eq(nodes.id, params.nodeId));
}
