import { router, publicProcedure } from "../trpc";
import { SettingsService } from "../../services/settings-service";
import {
  createSettingExistsResponse,
  createSettingSuccessResponse,
  createSettingValueResponse,
  deleteSettingInputSchema,
  getAllSettingsInputSchema,
  getAllSettingsOrEmpty,
  getSettingInputSchema,
  hasSettingInputSchema,
  setSettingInputSchema,
} from "./settings-router-helpers";

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
    .input(getSettingInputSchema)
    .query(async ({ input }) => {
      const value = await settingsService.getSetting(
        input.key,
        input.masterKey,
      );
      return createSettingValueResponse(input.key, value);
    }),

  /**
   * Get all settings (decrypted)
   */
  getAllSettings: publicProcedure
    .input(getAllSettingsInputSchema)
    .query(async ({ input }) => {
      return getAllSettingsOrEmpty(settingsService, input.masterKey);
    }),

  /**
   * Set a setting (encrypted)
   */
  setSetting: publicProcedure
    .input(setSettingInputSchema)
    .mutation(async ({ input }) => {
      await settingsService.setSetting(input.key, input.value, input.masterKey);
      return createSettingSuccessResponse(input.key);
    }),

  /**
   * Delete a setting
   */
  deleteSetting: publicProcedure
    .input(deleteSettingInputSchema)
    .mutation(async ({ input }) => {
      await settingsService.deleteSetting(input.key);
      return createSettingSuccessResponse(input.key);
    }),

  /**
   * Check if a setting exists
   */
  hasSetting: publicProcedure
    .input(hasSettingInputSchema)
    .query(async ({ input }) => {
      const exists = await settingsService.hasSetting(input.key);
      return createSettingExistsResponse(input.key, exists);
    }),

  /**
   * Get all setting keys (without decrypting values)
   * Useful for listing available settings without needing the master key
   */
  getAllKeys: publicProcedure.query(async () => {
    return await settingsService.getAllKeys();
  }),
});
