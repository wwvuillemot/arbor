import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { ProvenanceService } from "../../services/provenance-service";

const provenanceService = new ProvenanceService();

const actorTypeEnum = ["user", "llm", "system"] as const;

export const provenanceRouter = router({
  /**
   * Get version history for a node (newest first)
   */
  getHistory: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }),
    )
    .query(async ({ input }) => {
      return await provenanceService.getHistory(input);
    }),

  /**
   * Get a specific version of a node
   */
  getVersion: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        version: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      const entry = await provenanceService.getVersion(
        input.nodeId,
        input.version,
      );
      if (!entry) {
        throw new Error(
          `Version ${input.version} not found for node ${input.nodeId}`,
        );
      }
      return entry;
    }),

  /**
   * Get the latest version of a node
   */
  getLatestVersion: publicProcedure
    .input(z.object({ nodeId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await provenanceService.getLatestVersion(input.nodeId);
    }),

  /**
   * Get version count for a node
   */
  getVersionCount: publicProcedure
    .input(z.object({ nodeId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await provenanceService.getVersionCount(input.nodeId);
    }),

  /**
   * Get history filtered by actor type (user vs LLM)
   */
  getHistoryByActor: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        actorType: z.enum(actorTypeEnum),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }),
    )
    .query(async ({ input }) => {
      return await provenanceService.getHistoryByActor(input);
    }),

  /**
   * Get history within a date range
   */
  getHistoryInRange: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      }),
    )
    .query(async ({ input }) => {
      return await provenanceService.getHistoryInRange({
        nodeId: input.nodeId,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
      });
    }),

  /**
   * Checkout a specific version (read-only view of content at that version)
   */
  checkout: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        version: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      return await provenanceService.checkout(input.nodeId, input.version);
    }),

  /**
   * Compare two versions of a node
   */
  compareVersions: publicProcedure
    .input(
      z.object({
        nodeId: z.string().uuid(),
        versionA: z.number().int().positive(),
        versionB: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      const [vA, vB] = await Promise.all([
        provenanceService.getVersion(input.nodeId, input.versionA),
        provenanceService.getVersion(input.nodeId, input.versionB),
      ]);
      if (!vA)
        throw new Error(`Version ${input.versionA} not found`);
      if (!vB)
        throw new Error(`Version ${input.versionB} not found`);

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
    .input(
      z.object({
        nodeId: z.string().uuid(),
        targetVersion: z.number().int().positive(),
        actorId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return await provenanceService.rollbackToVersion(
        input.nodeId,
        input.targetVersion,
        "user",
        input.actorId,
      );
    }),
});

