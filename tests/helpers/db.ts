import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@server/db/schema";
import { sql } from "drizzle-orm";

// CRITICAL: Use a separate test database to avoid wiping production data!
// Tests run resetTestDb() before each test which DELETES ALL DATA
// NEVER use DATABASE_URL - always use arbor_test!
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://arbor:local_dev_only@localhost:5432/arbor_test";

// Log which database we're using to help debug connection issues
if (process.env.NODE_ENV !== "production") {
  console.log(`🔍 Test database URL: ${TEST_DATABASE_URL}`);
  if (process.env.DATABASE_URL) {
    console.warn(
      `⚠️  DATABASE_URL is set to: ${process.env.DATABASE_URL} (but tests will use TEST_DATABASE_URL)`,
    );
  }
}

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
  if (!testClient) {
    getTestDb(); // Initialize the connection
  }

  // Use the raw postgres client to ensure the TRUNCATE is committed immediately
  // Drizzle's execute() might wrap queries in transactions
  try {
    // First, verify we're using the test database
    const result = await testClient!`SELECT current_database()`;
    const dbName = result[0].current_database;
    if (dbName !== "arbor_test") {
      throw new Error(
        `CRITICAL: Attempting to reset non-test database: ${dbName}`,
      );
    }

    // Use raw SQL to truncate all tables
    // TRUNCATE is faster than DELETE and resets auto-increment sequences
    // CASCADE ensures that dependent rows in other tables are also deleted
    await testClient!`TRUNCATE TABLE media_attachments, nodes, user_preferences, app_settings RESTART IDENTITY CASCADE`;

    // Verify the truncate worked
    const counts = await testClient!`
      SELECT
        (SELECT COUNT(*) FROM nodes) as nodes_count,
        (SELECT COUNT(*) FROM user_preferences) as prefs_count,
        (SELECT COUNT(*) FROM app_settings) as settings_count,
        (SELECT COUNT(*) FROM media_attachments) as media_count
    `;
    const { nodes_count, prefs_count, settings_count, media_count } = counts[0];
    if (
      nodes_count !== "0" ||
      prefs_count !== "0" ||
      settings_count !== "0" ||
      media_count !== "0"
    ) {
      console.error(
        `⚠️  TRUNCATE did not clear all data! nodes=${nodes_count}, prefs=${prefs_count}, settings=${settings_count}, media=${media_count}`,
      );
    }
  } catch (error) {
    // If TRUNCATE fails (e.g., tables don't exist yet), fall back to DELETE
    const db = getTestDb();
    try {
      await db.delete(schema.mediaAttachments);
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
