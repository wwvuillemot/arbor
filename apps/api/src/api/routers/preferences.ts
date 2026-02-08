import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { PreferencesService } from "../../services/preferences-service";

const preferencesService = new PreferencesService();

/**
 * Preferences Router
 *
 * Handles both session-scope and app-scope preferences:
 * - Session-scope: Temporary, stored in Redis, cleared on session end
 * - App-scope: Persistent, stored in PostgreSQL
 */
export const preferencesRouter = router({
  // ============================================
  // App-Scope Preferences (Persistent)
  // ============================================

  /**
   * Get a single app-scope preference
   */
  getAppPreference: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const value = await preferencesService.getAppPreference(input.key);
      return { key: input.key, value };
    }),

  /**
   * Get all app-scope preferences
   */
  getAllAppPreferences: publicProcedure.query(async () => {
    return await preferencesService.getAllAppPreferences();
  }),

  /**
   * Set an app-scope preference
   */
  setAppPreference: publicProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.any(),
      }),
    )
    .mutation(async ({ input }) => {
      await preferencesService.setAppPreference(input.key, input.value);
      return { success: true, key: input.key };
    }),

  /**
   * Delete an app-scope preference
   */
  deleteAppPreference: publicProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      await preferencesService.deleteAppPreference(input.key);
      return { success: true, key: input.key };
    }),

  // ============================================
  // Session-Scope Preferences (Temporary)
  // ============================================

  /**
   * Get a single session-scope preference
   */
  getSessionPreference: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        key: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const value = await preferencesService.getSessionPreference(
        input.sessionId,
        input.key,
      );
      return { key: input.key, value };
    }),

  /**
   * Set a session-scope preference
   */
  setSessionPreference: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        key: z.string(),
        value: z.any(),
        ttl: z.number().optional(), // Time to live in seconds
      }),
    )
    .mutation(async ({ input }) => {
      await preferencesService.setSessionPreference(
        input.sessionId,
        input.key,
        input.value,
        input.ttl,
      );
      return { success: true, key: input.key };
    }),

  /**
   * Delete a session-scope preference
   */
  deleteSessionPreference: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        key: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await preferencesService.deleteSessionPreference(
        input.sessionId,
        input.key,
      );
      return { success: true, key: input.key };
    }),

  // ============================================
  // Master Key Management
  // ============================================

  /**
   * Get or generate the master encryption key
   * This key is used to encrypt sensitive settings (API keys, tokens, etc.)
   *
   * The key is automatically generated on first access and stored in the database.
   * Subsequent calls return the same key (idempotent).
   */
  getMasterKey: publicProcedure.query(async () => {
    const masterKey = await preferencesService.getOrGenerateMasterKey();
    return { masterKey };
  }),

  // ============================================
  // Batch Operations
  // ============================================

  /**
   * Set multiple app-scope preferences at once
   */
  setAppPreferences: publicProcedure
    .input(z.record(z.string(), z.any()))
    .mutation(async ({ input }) => {
      const promises = Object.entries(input).map(([key, value]) =>
        preferencesService.setAppPreference(key, value),
      );
      await Promise.all(promises);
      return { success: true, count: Object.keys(input).length };
    }),

  /**
   * Set multiple session-scope preferences at once
   */
  setSessionPreferences: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        preferences: z.record(z.string(), z.any()),
        ttl: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const promises = Object.entries(input.preferences).map(([key, value]) =>
        preferencesService.setSessionPreference(
          input.sessionId,
          key,
          value,
          input.ttl,
        ),
      );
      await Promise.all(promises);
      return { success: true, count: Object.keys(input.preferences).length };
    }),
});
