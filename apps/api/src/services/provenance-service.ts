import { db } from "../db/index";
import {
  nodeHistory,
  nodes,
  type NodeHistory,
  type ActorType,
  type HistoryAction,
} from "../db/schema";
import { eq, desc, and, asc, sql, count, between, inArray } from "drizzle-orm";
import diff_match_patch from "diff-match-patch";

const dmp = new diff_match_patch();

// ─── Interfaces ───────────────────────────────────────────────────────

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

// ─── Service ──────────────────────────────────────────────────────────

/**
 * ProvenanceService
 *
 * Tracks all changes to nodes with granular provenance (user vs LLM).
 * Computes diffs between content versions using diff-match-patch.
 * Supports version history retrieval, rollback, and audit queries.
 */
export class ProvenanceService {
  // ─── Recording Changes ──────────────────────────────────────────────

  /**
   * Record a change to a node in the history table.
   * Automatically computes the next version number and diff.
   */
  async recordChange(params: RecordChangeParams): Promise<NodeHistory> {
    // Get the next version number for this node
    const nextVersion = await this.getNextVersion(params.nodeId);

    // Compute diff between before and after content
    const computedDiff = this.computeDiff(
      params.contentBefore,
      params.contentAfter,
    );

    const [entry] = await db
      .insert(nodeHistory)
      .values({
        nodeId: params.nodeId,
        version: nextVersion,
        actorType: params.actorType,
        actorId: params.actorId ?? null,
        action: params.action,
        contentBefore: params.contentBefore ?? null,
        contentAfter: params.contentAfter ?? null,
        diff: computedDiff,
        metadata: params.metadata ?? {},
      })
      .returning();

    return entry;
  }

  // ─── Version Queries ────────────────────────────────────────────────

  /**
   * Get version history for a node, newest first.
   */
  async getHistory(params: GetHistoryParams): Promise<NodeHistory[]> {
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

  /**
   * Get a specific version of a node.
   */
  async getVersion(
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

  /**
   * Get the latest version entry for a node.
   */
  async getLatestVersion(nodeId: string): Promise<NodeHistory | null> {
    const [entry] = await db
      .select()
      .from(nodeHistory)
      .where(eq(nodeHistory.nodeId, nodeId))
      .orderBy(desc(nodeHistory.version))
      .limit(1);

    return entry ?? null;
  }

  /**
   * Get total version count for a node.
   */
  async getVersionCount(nodeId: string): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(nodeHistory)
      .where(eq(nodeHistory.nodeId, nodeId));

    return result?.total ?? 0;
  }

  // ─── Filtering ──────────────────────────────────────────────────────

  /**
   * Get history entries filtered by actor type (user vs LLM).
   */
  async getHistoryByActor(
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

  /**
   * Get history entries within a date range.
   */
  async getHistoryInRange(
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

  // ─── Checkout (Read-Only) ─────────────────────────────────────────

  /**
   * Checkout a specific version of a node (read-only).
   * Returns the content at that version without modifying the node.
   */
  async checkout(
    nodeId: string,
    version: number,
  ): Promise<{
    version: number;
    content: unknown;
    action: HistoryAction;
    actorType: ActorType;
    actorId: string | null;
    createdAt: Date;
  }> {
    const entry = await this.getVersion(nodeId, version);
    if (!entry) {
      throw new Error(`Version ${version} not found for node ${nodeId}`);
    }

    return {
      version: entry.version,
      content: entry.contentAfter,
      action: entry.action,
      actorType: entry.actorType,
      actorId: entry.actorId,
      createdAt: entry.createdAt,
    };
  }

  // ─── Rollback ───────────────────────────────────────────────────────

  /**
   * Rollback a node to a specific version.
   * Creates a new history entry recording the rollback, then updates the node.
   * Returns the newly created history entry.
   */
  async rollbackToVersion(
    nodeId: string,
    targetVersion: number,
    actorType: ActorType = "user",
    actorId?: string,
  ): Promise<NodeHistory> {
    // Get the target version entry
    const targetEntry = await this.getVersion(nodeId, targetVersion);
    if (!targetEntry) {
      throw new Error(`Version ${targetVersion} not found for node ${nodeId}`);
    }

    // Get the current node content
    const [currentNode] = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, nodeId))
      .limit(1);

    if (!currentNode) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const restoredContent = targetEntry.contentAfter;

    // Update the node with the restored content
    await db
      .update(nodes)
      .set({
        content: restoredContent,
        updatedAt: new Date(),
        updatedBy: actorId ?? `${actorType}:system`,
      })
      .where(eq(nodes.id, nodeId));

    // Record the rollback in history
    return this.recordChange({
      nodeId,
      actorType,
      actorId,
      action: "restore",
      contentBefore: currentNode.content,
      contentAfter: restoredContent,
      metadata: {
        rolledBackToVersion: targetVersion,
        reason: "manual_rollback",
      },
    });
  }

  // ─── Diff Computation ───────────────────────────────────────────────

  /**
   * Compute a structured diff between two content values.
   * Uses diff-match-patch for text content, or JSON comparison for objects.
   */
  computeDiff(contentBefore: unknown, contentAfter: unknown): unknown {
    // Handle null cases
    if (contentBefore == null && contentAfter == null) {
      return null;
    }

    const beforeText = this.contentToText(contentBefore);
    const afterText = this.contentToText(contentAfter);

    // Compute diff using diff-match-patch
    const diffs = dmp.diff_main(beforeText, afterText);
    dmp.diff_cleanupSemantic(diffs);

    // Convert to patch format for storage
    const patches = dmp.patch_make(beforeText, diffs);
    const patchText = dmp.patch_toText(patches);

    return {
      type: "diff-match-patch",
      patches: patchText,
      // Include human-readable summary
      summary: this.diffSummary(diffs),
    };
  }

  /**
   * Apply a stored diff to content to reconstruct a version.
   */
  applyDiff(content: unknown, diffData: unknown): string {
    if (!diffData || typeof diffData !== "object") {
      return this.contentToText(content);
    }

    const data = diffData as Record<string, unknown>;
    if (data.type !== "diff-match-patch" || typeof data.patches !== "string") {
      return this.contentToText(content);
    }

    const patches = dmp.patch_fromText(data.patches as string);
    const [result] = dmp.patch_apply(patches, this.contentToText(content));
    return result;
  }

  // ─── Internal Helpers ───────────────────────────────────────────────

  /**
   * Get the next version number for a node.
   */
  private async getNextVersion(nodeId: string): Promise<number> {
    const [result] = await db
      .select({
        maxVersion: sql<number>`COALESCE(MAX(${nodeHistory.version}), 0)`,
      })
      .from(nodeHistory)
      .where(eq(nodeHistory.nodeId, nodeId));

    return (result?.maxVersion ?? 0) + 1;
  }

  /**
   * Convert content (JSONB, string, or null) to text for diff computation.
   */
  contentToText(content: unknown): string {
    if (content == null) return "";
    if (typeof content === "string") return content;
    return JSON.stringify(content, null, 2);
  }

  /**
   * Generate a human-readable summary of diffs.
   */
  private diffSummary(diffs: Array<[number, string]>): {
    additions: number;
    deletions: number;
    unchanged: number;
  } {
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    for (const [op, text] of diffs) {
      const charCount = text.length;
      if (op === 1) additions += charCount;
      else if (op === -1) deletions += charCount;
      else unchanged += charCount;
    }

    return { additions, deletions, unchanged };
  }
}
