import { type NodeHistory, type ActorType } from "../db/schema";
import { formatAuditCsv, formatAuditHtml } from "./provenance-audit";
import {
  applyDiff as applyStoredDiff,
  computeDiff as computeStoredDiff,
  contentToText as serializeContentToText,
} from "./provenance-diff";
import {
  countAuditLogEntries,
  countNodeHistoryVersions,
  createNodeHistoryEntry,
  deleteNodeHistoryEntry,
  getLatestNodeHistoryVersion,
  getNextNodeHistoryVersion,
  getNodeById,
  getNodeHistoryVersion,
  listAuditLogEntries,
  listNodeHistory,
  listNodeHistoryByActor,
  listNodeHistoryInRange,
  searchNodeHistory,
  updateNodeContentForRollback,
} from "./provenance-store";
import type {
  GetAuditLogParams,
  GetHistoryByActorParams,
  GetHistoryInRangeParams,
  GetHistoryParams,
  ProvenanceCheckoutResult,
  RecordChangeParams,
  SearchHistoryParams,
} from "./provenance-types";
export type {
  AuditLogFilterParams,
  GetAuditLogParams,
  GetHistoryByActorParams,
  GetHistoryInRangeParams,
  GetHistoryParams,
  ProvenanceCheckoutResult,
  RecordChangeParams,
  SearchHistoryParams,
} from "./provenance-types";

// ─── Service ──────────────────────────────────────────────────────────

/**
 * ProvenanceService
 *
 * Tracks all changes to nodes with granular provenance (user vs LLM).
 * Computes diffs between content versions using diff-match-patch.
 * Supports version history retrieval, rollback, and audit queries.
 */
export class ProvenanceService {
  private isNodeLocked(node: { metadata: unknown }): boolean {
    const metadata = (node.metadata as Record<string, unknown> | null) ?? {};
    return metadata.isLocked === true;
  }

  // ─── Recording Changes ──────────────────────────────────────────────

  /**
   * Record a change to a node in the history table.
   * Automatically computes the next version number and diff.
   */
  async recordChange(params: RecordChangeParams): Promise<NodeHistory> {
    // Get the next version number for this node
    const nextVersion = await getNextNodeHistoryVersion(params.nodeId);

    // Compute diff between before and after content
    const computedDiff = this.computeDiff(
      params.contentBefore,
      params.contentAfter,
    );

    return createNodeHistoryEntry({
      ...params,
      version: nextVersion,
      diff: computedDiff,
    });
  }

  // ─── Version Queries ────────────────────────────────────────────────

  /**
   * Get version history for a node, newest first.
   */
  async getHistory(params: GetHistoryParams): Promise<NodeHistory[]> {
    return listNodeHistory(params);
  }

  /**
   * Get a specific version of a node.
   */
  async getVersion(
    nodeId: string,
    version: number,
  ): Promise<NodeHistory | null> {
    return getNodeHistoryVersion(nodeId, version);
  }

  /**
   * Get the latest version entry for a node.
   */
  async getLatestVersion(nodeId: string): Promise<NodeHistory | null> {
    return getLatestNodeHistoryVersion(nodeId);
  }

  /**
   * Get total version count for a node.
   */
  async getVersionCount(nodeId: string): Promise<number> {
    return countNodeHistoryVersions(nodeId);
  }

  /**
   * Delete a specific version entry for a node.
   */
  async deleteVersion(nodeId: string, version: number): Promise<NodeHistory> {
    const currentNode = await getNodeById(nodeId);

    if (!currentNode) {
      throw new Error(`Node ${nodeId} not found`);
    }

    if (this.isNodeLocked(currentNode)) {
      throw new Error("Node is locked");
    }

    const entry = await getNodeHistoryVersion(nodeId, version);
    if (!entry) {
      throw new Error(`Version ${version} not found for node ${nodeId}`);
    }

    await deleteNodeHistoryEntry(entry.id);
    return entry;
  }

  // ─── Filtering ──────────────────────────────────────────────────────

  /**
   * Get history entries filtered by actor type (user vs LLM).
   */
  async getHistoryByActor(
    params: GetHistoryByActorParams,
  ): Promise<NodeHistory[]> {
    return listNodeHistoryByActor(params);
  }

  /**
   * Get history entries within a date range.
   */
  async getHistoryInRange(
    params: GetHistoryInRangeParams,
  ): Promise<NodeHistory[]> {
    return listNodeHistoryInRange(params);
  }

  // ─── Audit Log (Cross-Node) ────────────────────────────────────────

  /**
   * Get audit log across all nodes with optional filters.
   */
  async getAuditLog(params: GetAuditLogParams): Promise<NodeHistory[]> {
    return listAuditLogEntries(params);
  }

  /**
   * Count total audit log entries matching filters.
   */
  async getAuditLogCount(
    params: Omit<GetAuditLogParams, "limit" | "offset">,
  ): Promise<number> {
    return countAuditLogEntries(params);
  }

  /**
   * Search within change history (contentBefore/contentAfter as JSONB text).
   */
  async searchHistory(params: SearchHistoryParams): Promise<NodeHistory[]> {
    return searchNodeHistory(params);
  }

  /**
   * Export audit log as CSV string.
   */
  async exportAuditCsv(
    params: Omit<GetAuditLogParams, "limit" | "offset">,
  ): Promise<string> {
    const entries = await this.getAuditLog({ ...params, limit: 10000 });
    return formatAuditCsv(entries);
  }

  /**
   * Export audit log as HTML string (for PDF printing via browser).
   */
  async exportAuditHtml(
    params: Omit<GetAuditLogParams, "limit" | "offset">,
  ): Promise<string> {
    const entries = await this.getAuditLog({ ...params, limit: 10000 });
    return formatAuditHtml(entries);
  }

  // ─── Checkout (Read-Only) ─────────────────────────────────────────

  /**
   * Checkout a specific version of a node (read-only).
   * Returns the content at that version without modifying the node.
   */
  async checkout(
    nodeId: string,
    version: number,
  ): Promise<ProvenanceCheckoutResult> {
    const entry = await getNodeHistoryVersion(nodeId, version);
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
    const targetEntry = await getNodeHistoryVersion(nodeId, targetVersion);
    if (!targetEntry) {
      throw new Error(`Version ${targetVersion} not found for node ${nodeId}`);
    }

    // Get the current node content
    const currentNode = await getNodeById(nodeId);

    if (!currentNode) {
      throw new Error(`Node ${nodeId} not found`);
    }

    if (this.isNodeLocked(currentNode)) {
      throw new Error("Node is locked");
    }

    const restoredContent = targetEntry.contentAfter;

    // Update the node with the restored content
    await updateNodeContentForRollback({
      nodeId,
      restoredContent,
      actorType,
      actorId,
    });

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
    return computeStoredDiff(contentBefore, contentAfter);
  }

  /**
   * Apply a stored diff to content to reconstruct a version.
   */
  applyDiff(content: unknown, diffData: unknown): string {
    return applyStoredDiff(content, diffData);
  }

  /**
   * Convert content (JSONB, string, or null) to text for diff computation.
   */
  contentToText(content: unknown): string {
    return serializeContentToText(content);
  }
}
