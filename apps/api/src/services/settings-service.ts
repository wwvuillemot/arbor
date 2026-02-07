import { db } from "../db/index";
import { appSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import { EncryptionService } from "./encryption-service";

/**
 * SettingsService
 *
 * Manages encrypted sensitive settings (API keys, tokens, etc.)
 * All values are encrypted at rest using AES-256-GCM with a master key
 * stored in the OS keychain.
 *
 * Separation of concerns:
 * - PreferencesService: Non-sensitive user choices (theme, language)
 * - SettingsService: Encrypted sensitive data (API keys, tokens)
 */
export class SettingsService {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  /**
   * Set a setting (encrypt and store)
   * @param key - Setting key (e.g., 'openai_api_key')
   * @param value - Plaintext value to encrypt
   * @param masterKey - Base64-encoded 32-byte master key from OS keychain
   */
  async setSetting(
    key: string,
    value: string,
    masterKey: string,
  ): Promise<void> {
    if (!key || key.length === 0) {
      throw new Error("Setting key cannot be empty");
    }
    if (!value || value.length === 0) {
      throw new Error("Setting value cannot be empty");
    }

    // Encrypt the value
    const { encryptedValue, iv } = await this.encryptionService.encrypt(
      value,
      masterKey,
    );

    // Check if setting already exists
    const existing = await this.hasSetting(key);

    if (existing) {
      // Update existing setting
      await db
        .update(appSettings)
        .set({
          encryptedValue,
          iv,
          updatedAt: new Date(),
        })
        .where(eq(appSettings.key, key));
    } else {
      // Create new setting
      await db.insert(appSettings).values({
        key,
        encryptedValue,
        iv,
      });
    }
  }

  /**
   * Get a setting (retrieve and decrypt)
   * @param key - Setting key
   * @param masterKey - Base64-encoded 32-byte master key from OS keychain
   * @returns Decrypted value or null if not found
   */
  async getSetting(key: string, masterKey: string): Promise<string | null> {
    const [setting] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key));

    if (!setting) {
      return null;
    }

    // Decrypt the value
    const decrypted = await this.encryptionService.decrypt(
      setting.encryptedValue,
      setting.iv,
      masterKey,
    );

    return decrypted;
  }

  /**
   * Delete a setting
   * @param key - Setting key
   */
  async deleteSetting(key: string): Promise<void> {
    await db.delete(appSettings).where(eq(appSettings.key, key));
  }

  /**
   * Get all settings (decrypted)
   * @param masterKey - Base64-encoded 32-byte master key from OS keychain
   * @returns Object with all settings as key-value pairs
   */
  async getAllSettings(masterKey: string): Promise<Record<string, string>> {
    const settings = await db.select().from(appSettings);

    const decrypted: Record<string, string> = {};

    for (const setting of settings) {
      const value = await this.encryptionService.decrypt(
        setting.encryptedValue,
        setting.iv,
        masterKey,
      );
      decrypted[setting.key] = value;
    }

    return decrypted;
  }

  /**
   * Check if a setting exists
   * @param key - Setting key
   * @returns True if setting exists, false otherwise
   */
  async hasSetting(key: string): Promise<boolean> {
    const [setting] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key));

    return !!setting;
  }

  /**
   * Get all setting keys (without decrypting values)
   * Useful for listing available settings without needing the master key
   * @returns Array of setting keys
   */
  async getAllKeys(): Promise<string[]> {
    const settings = await db
      .select({ key: appSettings.key })
      .from(appSettings);
    return settings.map((s) => s.key);
  }
}
