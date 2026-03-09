import { router, publicProcedure } from "../trpc";
import { ConfigurationService } from "../../services/configuration-service";
import {
  configurationKeyInputSchema,
  setConfigurationInputSchema,
} from "./configuration-router-helpers";

const configurationService = new ConfigurationService();

export const configurationRouter = router({
  /**
   * Get a single configuration value
   * Returns the stored value if it exists, otherwise returns the default
   */
  getConfiguration: publicProcedure
    .input(configurationKeyInputSchema)
    .query(async ({ input }) => {
      return await configurationService.getConfiguration(input.key);
    }),

  /**
   * Set a configuration value
   * Creates a new entry or updates an existing one
   */
  setConfiguration: publicProcedure
    .input(setConfigurationInputSchema)
    .mutation(async ({ input }) => {
      await configurationService.setConfiguration(input.key, input.value);
    }),

  /**
   * Get all configuration values
   * Returns a mix of stored and default values
   */
  getAllConfiguration: publicProcedure.query(async () => {
    return await configurationService.getAllConfiguration();
  }),

  /**
   * Reset a configuration value to its default
   * Deletes the stored value so the default will be used
   */
  resetConfiguration: publicProcedure
    .input(configurationKeyInputSchema)
    .mutation(async ({ input }) => {
      await configurationService.resetConfiguration(input.key);
    }),

  /**
   * Check if a configuration value has been customized
   * Returns true if the value differs from the default
   */
  isCustomized: publicProcedure
    .input(configurationKeyInputSchema)
    .query(async ({ input }) => {
      return await configurationService.isCustomized(input.key);
    }),
});
