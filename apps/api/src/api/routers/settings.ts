import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { SettingsService } from "../../services/settings-service";

const settingsService = new SettingsService();

/**
 * Settings Router
 *
 * Handles encrypted sensitive settings (API keys, tokens, etc.)
 * All values are encrypted at rest using AES-256-GCM with a master key
 * stored in the OS keychain.
 *
 * Separation of concerns:
 * - Preferences Router: Non-sensitive user choices (theme, language)
 * - Settings Router: Encrypted sensitive data (API keys, tokens)
 */
export const settingsRouter = router({
  /**
   * Get a single setting (decrypted)
   */
  getSetting: publicProcedure
    .input(
      z.object({
        key: z.string(),
        masterKey: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const value = await settingsService.getSetting(
        input.key,
        input.masterKey,
      );
      return { key: input.key, value };
    }),

  /**
   * Get all settings (decrypted)
   */
  getAllSettings: publicProcedure
    .input(
      z.object({
        masterKey: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await settingsService.getAllSettings(input.masterKey);
      } catch (error) {
        console.error("Failed to get all settings:", error);
        // Return empty object on error to prevent UI from breaking
        // The error will be logged for debugging
        return {};
      }
    }),

  /**
   * Set a setting (encrypted)
   */
  setSetting: publicProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.string(),
        masterKey: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await settingsService.setSetting(input.key, input.value, input.masterKey);
      return { success: true, key: input.key };
    }),

  /**
   * Delete a setting
   */
  deleteSetting: publicProcedure
    .input(
      z.object({
        key: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await settingsService.deleteSetting(input.key);
      return { success: true, key: input.key };
    }),

  /**
   * Check if a setting exists
   */
  hasSetting: publicProcedure
    .input(
      z.object({
        key: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const exists = await settingsService.hasSetting(input.key);
      return { key: input.key, exists };
    }),

  /**
   * Get all setting keys (without decrypting values)
   * Useful for listing available settings without needing the master key
   */
  getAllKeys: publicProcedure.query(async () => {
    return await settingsService.getAllKeys();
  }),
});
