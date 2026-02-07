import { db } from "../db/index";
import { userPreferences } from "../db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "redis";

/**
 * PreferencesService
 *
 * Manages both session-scope and app-scope user preferences:
 * - Session-scope: Stored in Redis, cleared when session ends
 * - App-scope: Stored in PostgreSQL, persisted permanently
 */
export class PreferencesService {
  private redisClient: ReturnType<typeof createClient> | null = null;

  constructor() {
    this.initRedis();
  }

  /**
   * Initialize Redis connection for session preferences
   */
  private async initRedis() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || "redis://arbor-redis:6379",
      });

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
    const [pref] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.key, key));

    return pref ? pref.value : null;
  }

  /**
   * Set app-scope preference (to PostgreSQL)
   */
  async setAppPreference(key: string, value: any): Promise<void> {
    const existing = await this.getAppPreference(key);

    if (existing) {
      // Update existing preference
      await db
        .update(userPreferences)
        .set({
          value,
        })
        .where(eq(userPreferences.key, key));
    } else {
      // Create new preference
      await db.insert(userPreferences).values({
        key,
        value,
      });
    }
  }

  /**
   * Delete app-scope preference
   */
  async deleteAppPreference(key: string): Promise<void> {
    await db.delete(userPreferences).where(eq(userPreferences.key, key));
  }

  /**
   * Get all app-scope preferences
   */
  async getAllAppPreferences(): Promise<Record<string, any>> {
    const prefs = await db.select().from(userPreferences);

    return prefs.reduce(
      (acc, pref) => {
        acc[pref.key] = pref.value;
        return acc;
      },
      {} as Record<string, any>,
    );
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
      const redisKey = `session:${sessionId}:pref:${key}`;
      const value = await this.redisClient.get(redisKey);
      return value ? JSON.parse(value.toString()) : null;
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
      const redisKey = `session:${sessionId}:pref:${key}`;
      const serialized = JSON.stringify(value);

      if (ttl) {
        await this.redisClient.setEx(redisKey, ttl, serialized);
      } else {
        // Default TTL: 24 hours
        await this.redisClient.setEx(redisKey, 86400, serialized);
      }
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
      const redisKey = `session:${sessionId}:pref:${key}`;
      await this.redisClient.del(redisKey);
    } catch (error) {
      console.error("Error deleting session preference:", error);
    }
  }
}
