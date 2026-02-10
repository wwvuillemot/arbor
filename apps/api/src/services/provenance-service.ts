import { db } from "../db/index";
import {
  nodeHistory,
  nodes,
  type NodeHistory,
  type ActorType,
  type HistoryAction,
} from "../db/schema";
import {
  eq,
  desc,
  and,
  asc,
  sql,
  count,
  between,
  inArray,
  or,
} from "drizzle-orm";
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

  // ─── Audit Log (Cross-Node) ────────────────────────────────────────

  /**
   * Get audit log across all nodes with optional filters.
   */
  async getAuditLog(params: GetAuditLogParams): Promise<NodeHistory[]> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    const conditions = [];
    if (params.actorType) {
      conditions.push(eq(nodeHistory.actorType, params.actorType));
    }
    if (params.action) {
      conditions.push(eq(nodeHistory.action, params.action));
    }
    if (params.startDate && params.endDate) {
      conditions.push(
        between(nodeHistory.createdAt, params.startDate, params.endDate),
      );
    }
    if (params.nodeId) {
      conditions.push(eq(nodeHistory.nodeId, params.nodeId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return db
      .select()
      .from(nodeHistory)
      .where(whereClause)
      .orderBy(desc(nodeHistory.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count total audit log entries matching filters.
   */
  async getAuditLogCount(
    params: Omit<GetAuditLogParams, "limit" | "offset">,
  ): Promise<number> {
    const conditions = [];
    if (params.actorType) {
      conditions.push(eq(nodeHistory.actorType, params.actorType));
    }
    if (params.action) {
      conditions.push(eq(nodeHistory.action, params.action));
    }
    if (params.startDate && params.endDate) {
      conditions.push(
        between(nodeHistory.createdAt, params.startDate, params.endDate),
      );
    }
    if (params.nodeId) {
      conditions.push(eq(nodeHistory.nodeId, params.nodeId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [result] = await db
      .select({ total: count() })
      .from(nodeHistory)
      .where(whereClause);

    return result?.total ?? 0;
  }

  /**
   * Search within change history (contentBefore/contentAfter as JSONB text).
   */
  async searchHistory(params: SearchHistoryParams): Promise<NodeHistory[]> {
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

  /**
   * Export audit log as CSV string.
   */
  async exportAuditCsv(
    params: Omit<GetAuditLogParams, "limit" | "offset">,
  ): Promise<string> {
    const entries = await this.getAuditLog({ ...params, limit: 10000 });

    const header = "id,nodeId,version,actorType,actorId,action,createdAt";
    const rows = entries.map((entry) => {
      const actorId = (entry.actorId ?? "").replace(/,/g, ";");
      return `${entry.id},${entry.nodeId},${entry.version},${entry.actorType},${actorId},${entry.action},${entry.createdAt.toISOString()}`;
    });

    return [header, ...rows].join("\n");
  }

  /**
   * Export audit log as HTML string (for PDF printing via browser).
   */
  async exportAuditHtml(
    params: Omit<GetAuditLogParams, "limit" | "offset">,
  ): Promise<string> {
    const entries = await this.getAuditLog({ ...params, limit: 10000 });

    const tableRows = entries
      .map(
        (entry) =>
          `<tr><td>${entry.version}</td><td>${entry.actorType}</td><td>${this.escapeHtml(entry.actorId ?? "")}</td><td>${entry.action}</td><td>${entry.nodeId}</td><td>${entry.createdAt.toISOString()}</td></tr>`,
      )
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Audit Report</title>
  <style>
    body { font-family: sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9em; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    .meta { color: #666; margin-bottom: 16px; }
    @media print { body { padding: 0; } @page { margin: 1.5cm; } }
  </style>
</head>
<body>
  <h1>Audit Report</h1>
  <p class="meta">Generated: ${new Date().toISOString()} | Entries: ${entries.length}</p>
  <table>
    <thead><tr><th>Version</th><th>Actor</th><th>Actor ID</th><th>Action</th><th>Node ID</th><th>Timestamp</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
  }

  /**
   * Escape HTML special characters.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
