import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@server/db/schema";
import { sql } from "drizzle-orm";

// CRITICAL: Use a separate test database to avoid wiping production data!
// Tests run resetTestDb() before each test which DELETES ALL DATA
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://arbor:local_dev_only@localhost:5432/arbor_test";

let testClient: postgres.Sql | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

/**
 * Get or create test database connection
 */
export function getTestDb() {
  if (!testDb) {
    testClient = postgres(TEST_DATABASE_URL, {
      max: 1, // Single connection for tests
      idle_timeout: 20,
      connect_timeout: 10,
    });
    testDb = drizzle(testClient, { schema });
  }
  return testDb;
}

/**
 * Reset test database - delete all data from tables
 */
export async function resetTestDb() {
  const db = getTestDb();

  // Delete all data from tables using TRUNCATE for better performance and to reset sequences
  // TRUNCATE is faster than DELETE and resets auto-increment sequences
  // CASCADE ensures that dependent rows in other tables are also deleted
  try {
    await db.execute(sql`TRUNCATE TABLE nodes, user_preferences, app_settings RESTART IDENTITY CASCADE`);
  } catch (error) {
    // If TRUNCATE fails (e.g., tables don't exist yet), fall back to DELETE
    try {
      await db.delete(schema.nodes);
      await db.delete(schema.userPreferences);
      await db.delete(schema.appSettings);
    } catch (deleteError) {
      // Tables don't exist yet, ignore
    }
  }
}

/**
 * Cleanup test database connection
 */
export async function cleanupTestDb() {
  if (testClient) {
    await testClient.end();
    testClient = null;
    testDb = null;
  }
}

/**
 * Create test database schema (run once before tests)
 */
export async function createTestSchema() {
  const db = getTestDb();

  // Create nodes table if it doesn't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255),
      content TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      author_type VARCHAR(20) DEFAULT 'human',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      deleted_at TIMESTAMP
    )
  `);

  // Create user_preferences table if it doesn't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(255) NOT NULL UNIQUE,
      value JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // Create indexes for nodes
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_nodes_slug ON nodes(slug)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at ON nodes(deleted_at)`,
  );

  // Create indexes for user_preferences
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key)`,
  );
}

/**
 * Drop test database schema (cleanup after all tests)
 */
export async function dropTestSchema() {
  const db = getTestDb();
  await db.execute(sql`DROP TABLE IF EXISTS user_preferences CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS nodes CASCADE`);
}
