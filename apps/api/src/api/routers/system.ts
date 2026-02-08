import { router, publicProcedure } from "../trpc";
import { db } from "../../db";
import { sql } from "drizzle-orm";

export const systemRouter = router({
  /**
   * Get system information including database version
   */
  getInfo: publicProcedure.query(async () => {
    try {
      // Get migration count
      const result = await db.execute(
        sql`SELECT COUNT(*) as count FROM drizzle.__drizzle_migrations`,
      );

      // Drizzle execute returns an array directly, not { rows: [] }
      const count = Number((result[0] as any)?.count || 0);

      return {
        version: "0.1.0",
        database: {
          version: count > 0 ? `Migration ${count}` : "No migrations",
          latestMigration: null,
        },
        environment: process.env.NODE_ENV || "development",
      };
    } catch (error) {
      // If migrations table doesn't exist yet, return default values
      return {
        version: "0.1.0",
        database: {
          version: "Not initialized",
          latestMigration: null,
        },
        environment: process.env.NODE_ENV || "development",
      };
    }
  }),
});

