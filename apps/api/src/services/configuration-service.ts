import { db } from '../db';
import { userPreferences } from '../db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_CONFIG, CONFIG_KEYS, type ConfigKey } from '../config/defaults';

/**
 * ConfigurationService
 * 
 * Manages application configuration settings with sensible defaults.
 * Configuration values are stored in the user_preferences table with a 'config.' prefix.
 * 
 * When a configuration value is not set, the service returns the default value.
 * This allows the app to work out of the box without requiring manual configuration.
 */
export class ConfigurationService {
  /**
   * Get a configuration value
   * Returns the stored value if it exists, otherwise returns the default value
   */
  async getConfiguration(key: ConfigKey): Promise<string> {
    const dbKey = CONFIG_KEYS[key];
    
    const [result] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.key, dbKey))
      .limit(1);

    // If value exists and is not empty, return it
    if (result && result.value && typeof result.value === 'string' && result.value.trim() !== '') {
      return result.value;
    }

    // Otherwise return the default
    return DEFAULT_CONFIG[key];
  }

  /**
   * Set a configuration value
   * Creates a new entry or updates an existing one
   */
  async setConfiguration(key: ConfigKey, value: string): Promise<void> {
    const dbKey = CONFIG_KEYS[key];

    // Check if the configuration already exists
    const [existing] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.key, dbKey))
      .limit(1);

    if (existing) {
      // Update existing configuration
      await db
        .update(userPreferences)
        .set({ 
          value,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.key, dbKey));
    } else {
      // Insert new configuration
      await db.insert(userPreferences).values({
        key: dbKey,
        value,
      });
    }
  }

  /**
   * Get all configuration values
   * Returns a mix of stored and default values
   */
  async getAllConfiguration(): Promise<Record<ConfigKey, string>> {
    const config: Record<string, string> = {};

    // Get all configuration keys
    const keys = Object.keys(DEFAULT_CONFIG) as ConfigKey[];

    // Fetch each configuration value
    for (const key of keys) {
      config[key] = await this.getConfiguration(key);
    }

    return config as Record<ConfigKey, string>;
  }

  /**
   * Reset a configuration value to its default
   * Deletes the stored value so the default will be used
   */
  async resetConfiguration(key: ConfigKey): Promise<void> {
    const dbKey = CONFIG_KEYS[key];

    await db
      .delete(userPreferences)
      .where(eq(userPreferences.key, dbKey));
  }

  /**
   * Check if a configuration value has been customized
   * Returns true if the value differs from the default
   */
  async isCustomized(key: ConfigKey): Promise<boolean> {
    const currentValue = await this.getConfiguration(key);
    return currentValue !== DEFAULT_CONFIG[key];
  }
}

