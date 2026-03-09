import { randomBytes } from "crypto";

import {
  deleteStoredAppPreference,
  getStoredAppPreference,
  listStoredAppPreferences,
  setStoredAppPreference,
} from "./preferences-app-store";
import {
  createSessionPreferencesRedisClient,
  deleteStoredSessionPreference,
  getStoredSessionPreference,
  setStoredSessionPreference,
  type SessionPreferencesRedisClient,
} from "./preferences-session-store";

/**
 * PreferencesService
 *
 * Manages both session-scope and app-scope user preferences:
 * - Session-scope: Stored in Redis, cleared when session ends
 * - App-scope: Stored in PostgreSQL, persisted permanently
 */
export class PreferencesService {
  private redisClient: SessionPreferencesRedisClient | null = null;

  constructor() {
    this.initRedis();
  }

  /**
   * Initialize Redis connection for session preferences
   */
  private async initRedis() {
    try {
      this.redisClient = createSessionPreferencesRedisClient(
        process.env.REDIS_URL || "redis://redis.arbor.local:6379",
      );

      this.redisClient.on("error", (err) => {
        console.error("Redis Client Error:", err);
      });

      await this.redisClient.connect();
      console.log("✅ Redis connected for session preferences");
    } catch (error) {
      console.error("❌ Failed to connect to Redis:", error);
      this.redisClient = null;
    }
  }

  /**
   * Get app-scope preference (from PostgreSQL)
   */
  async getAppPreference(key: string): Promise<any | null> {
    return getStoredAppPreference(key);
  }

  /**
   * Set app-scope preference (to PostgreSQL)
   */
  async setAppPreference(key: string, value: any): Promise<void> {
    await setStoredAppPreference(key, value);
  }

  /**
   * Delete app-scope preference
   */
  async deleteAppPreference(key: string): Promise<void> {
    await deleteStoredAppPreference(key);
  }

  /**
   * Get all app-scope preferences
   */
  async getAllAppPreferences(): Promise<Record<string, any>> {
    return listStoredAppPreferences();
  }

  /**
   * Get session-scope preference (from Redis)
   */
  async getSessionPreference(
    sessionId: string,
    key: string,
  ): Promise<any | null> {
    if (!this.redisClient) {
      console.warn("Redis not available, session preferences disabled");
      return null;
    }

    try {
      return await getStoredSessionPreference(this.redisClient, sessionId, key);
    } catch (error) {
      console.error("Error getting session preference:", error);
      return null;
    }
  }

  /**
   * Set session-scope preference (to Redis)
   */
  async setSessionPreference(
    sessionId: string,
    key: string,
    value: any,
    ttl?: number,
  ): Promise<void> {
    if (!this.redisClient) {
      console.warn("Redis not available, session preferences disabled");
      return;
    }

    try {
      await setStoredSessionPreference(
        this.redisClient,
        sessionId,
        key,
        value,
        ttl,
      );
    } catch (error) {
      console.error("Error setting session preference:", error);
    }
  }

  /**
   * Delete session-scope preference
   */
  async deleteSessionPreference(sessionId: string, key: string): Promise<void> {
    if (!this.redisClient) {
      return;
    }

    try {
      await deleteStoredSessionPreference(this.redisClient, sessionId, key);
    } catch (error) {
      console.error("Error deleting session preference:", error);
    }
  }

  /**
   * Convenience aliases for app-scope preferences
   * (for backward compatibility with existing code)
   */
  async getPreference(key: string): Promise<any | null> {
    return this.getAppPreference(key);
  }

  async setPreference(key: string, value: any): Promise<void> {
    return this.setAppPreference(key, value);
  }

  async deletePreference(key: string): Promise<void> {
    return this.deleteAppPreference(key);
  }

  /**
   * Master Key Management
   *
   * The master key is used to encrypt sensitive settings (API keys, tokens, etc.)
   * It's stored in the database as a base64-encoded 32-byte random value.
   *
   * This is a simple approach suitable for single-user deployments.
   * When multi-user auth is added, this can be upgraded to password-derived keys.
   */

  /**
   * Generate a new master key and store it in the database
   * If a master key already exists, returns the existing key (idempotent)
   * @returns Base64-encoded 32-byte master key
   */
  async generateMasterKey(): Promise<string> {
    // Check if master key already exists
    const existing = await this.getPreference("master_key");
    if (existing) {
      return existing as string;
    }

    // Generate a new 32-byte (256-bit) random key
    const keyBuffer = randomBytes(32);
    const masterKey = keyBuffer.toString("base64");

    // Store in database
    await this.setPreference("master_key", masterKey);

    console.log("✅ Generated new master key for encryption");
    return masterKey;
  }

  /**
   * Get the master key from the database
   * @returns Base64-encoded master key, or null if not found
   */
  async getMasterKey(): Promise<string | null> {
    const masterKey = await this.getPreference("master_key");
    return masterKey as string | null;
  }

  /**
   * Get the master key, or generate one if it doesn't exist
   * This is the recommended method for most use cases
   * @returns Base64-encoded 32-byte master key
   */
  async getOrGenerateMasterKey(): Promise<string> {
    const existing = await this.getMasterKey();
    if (existing) {
      return existing;
    }
    return this.generateMasterKey();
  }
}
