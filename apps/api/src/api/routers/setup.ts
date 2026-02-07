import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../../db";
import { userPreferences } from "../../db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Setup Router
 *
 * Handles setup and health check operations for cold-start and warm-start flows
 */
export const setupRouter = router({
  /**
   * Check health of all services
   */
  checkHealth: publicProcedure.query(async () => {
    const results = {
      database: false,
      redis: false,
      timestamp: new Date().toISOString(),
    };

    // Check database
    try {
      await db.select().from(userPreferences).limit(1);
      results.database = true;
    } catch (error) {
      console.error("Database health check failed:", error);
    }

    // Check Redis
    try {
      const redis = createClient({ url: REDIS_URL });
      await redis.connect();
      await redis.ping();
      await redis.disconnect();
      results.redis = true;
    } catch (error) {
      console.error("Redis health check failed:", error);
    }

    return results;
  }),

  /**
   * Run database seed
   */
  runSeed: publicProcedure.mutation(async () => {
    try {
      // Import and run seed
      const { seed } = await import("../../db/seed");
      await seed();
      return { success: true };
    } catch (error) {
      console.error("Seed failed:", error);
      throw new Error(`Failed to seed database: ${error}`);
    }
  }),

  /**
   * Get setup status
   */
  getSetupStatus: publicProcedure.query(async () => {
    try {
      const result = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "setup_completed"))
        .limit(1);

      return {
        setupCompleted: result.length > 0 && result[0].value === true,
      };
    } catch (error) {
      console.error("Failed to get setup status:", error);
      return { setupCompleted: false };
    }
  }),

  /**
   * Mark setup as complete
   */
  markSetupComplete: publicProcedure.mutation(async () => {
    try {
      // Check if setup_completed already exists
      const existing = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "setup_completed"))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(userPreferences)
          .set({
            value: true,
          })
          .where(eq(userPreferences.key, "setup_completed"));
      } else {
        // Insert new
        await db.insert(userPreferences).values({
          key: "setup_completed",
          value: true,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to mark setup complete:", error);
      throw new Error(`Failed to mark setup complete: ${error}`);
    }
  }),

  /**
   * Check if database schema is initialized
   */
  checkDatabaseSchema: publicProcedure.query(async () => {
    try {
      // Try to query the user_preferences table
      await db.select().from(userPreferences).limit(1);
      return { initialized: true };
    } catch (error) {
      console.error("Database schema check failed:", error);
      return { initialized: false };
    }
  }),
});
