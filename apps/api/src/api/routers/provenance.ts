import { router, publicProcedure } from "../trpc";
import { ProvenanceService } from "../../services/provenance-service";
import {
  buildAuditLogFilterParams,
  buildAuditLogParams,
  buildHistoryInRangeParams,
  compareVersionsInputSchema,
  exportAuditReportInputSchema,
  getAuditLogCountInputSchema,
  getAuditLogInputSchema,
  getHistoryByActorInputSchema,
  getHistoryInputSchema,
  getHistoryInRangeInputSchema,
  getNodeVersionOrThrow,
  getVersionInputSchema,
  nodeIdInputSchema,
  rollbackInputSchema,
  searchHistoryInputSchema,
} from "./provenance-router-helpers";

const provenanceService = new ProvenanceService();

export const provenanceRouter = router({
  /**
   * Get version history for a node (newest first)
   */
  getHistory: publicProcedure
    .input(getHistoryInputSchema)
    .query(async ({ input }) => {
      return await provenanceService.getHistory(input);
    }),

  /**
   * Get a specific version of a node
   */
  getVersion: publicProcedure
    .input(getVersionInputSchema)
    .query(async ({ input }) => {
      return await getNodeVersionOrThrow(
        provenanceService,
        input.nodeId,
        input.version,
        `Version ${input.version} not found for node ${input.nodeId}`,
      );
    }),

  /**
   * Get the latest version of a node
   */
  getLatestVersion: publicProcedure
    .input(nodeIdInputSchema)
    .query(async ({ input }) => {
      return await provenanceService.getLatestVersion(input.nodeId);
    }),

  /**
   * Get version count for a node
   */
  getVersionCount: publicProcedure
    .input(nodeIdInputSchema)
    .query(async ({ input }) => {
      return await provenanceService.getVersionCount(input.nodeId);
    }),

  /**
   * Get history filtered by actor type (user vs LLM)
   */
  getHistoryByActor: publicProcedure
    .input(getHistoryByActorInputSchema)
    .query(async ({ input }) => {
      return await provenanceService.getHistoryByActor(input);
    }),

  /**
   * Get history within a date range
   */
  getHistoryInRange: publicProcedure
    .input(getHistoryInRangeInputSchema)
    .query(async ({ input }) => {
      return await provenanceService.getHistoryInRange(
        buildHistoryInRangeParams(input),
      );
    }),

  /**
   * Checkout a specific version (read-only view of content at that version)
   */
  checkout: publicProcedure
    .input(getVersionInputSchema)
    .query(async ({ input }) => {
      return await provenanceService.checkout(input.nodeId, input.version);
    }),

  /**
   * Compare two versions of a node
   */
  compareVersions: publicProcedure
    .input(compareVersionsInputSchema)
    .query(async ({ input }) => {
      const [vA, vB] = await Promise.all([
        getNodeVersionOrThrow(
          provenanceService,
          input.nodeId,
          input.versionA,
          `Version ${input.versionA} not found`,
        ),
        getNodeVersionOrThrow(
          provenanceService,
          input.nodeId,
          input.versionB,
          `Version ${input.versionB} not found`,
        ),
      ]);

      const diff = provenanceService.computeDiff(
        vA.contentAfter,
        vB.contentAfter,
      );

      return { versionA: vA, versionB: vB, diff };
    }),

  /**
   * Rollback a node to a specific version
   */
  rollback: publicProcedure
    .input(rollbackInputSchema)
    .mutation(async ({ input }) => {
      return await provenanceService.rollbackToVersion(
        input.nodeId,
        input.targetVersion,
        "user",
        input.actorId,
      );
    }),

  // ─── Audit Log (Cross-Node) ─────────────────────────────────────────

  /**
   * Get audit log across all nodes with filters
   */
  getAuditLog: publicProcedure
    .input(getAuditLogInputSchema)
    .query(async ({ input }) => {
      return await provenanceService.getAuditLog(buildAuditLogParams(input));
    }),

  /**
   * Get total count of audit log entries matching filters
   */
  getAuditLogCount: publicProcedure
    .input(getAuditLogCountInputSchema)
    .query(async ({ input }) => {
      return await provenanceService.getAuditLogCount(
        buildAuditLogFilterParams(input),
      );
    }),

  /**
   * Search within change history
   */
  searchHistory: publicProcedure
    .input(searchHistoryInputSchema)
    .query(async ({ input }) => {
      return await provenanceService.searchHistory(input);
    }),

  /**
   * Export audit report (CSV or HTML for PDF)
   */
  exportAuditReport: publicProcedure
    .input(exportAuditReportInputSchema)
    .query(async ({ input }) => {
      const filterParams = buildAuditLogFilterParams(input);

      if (input.format === "csv") {
        return await provenanceService.exportAuditCsv(filterParams);
      }
      return await provenanceService.exportAuditHtml(filterParams);
    }),
});
