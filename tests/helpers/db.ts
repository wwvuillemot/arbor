import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@server/db/schema';
import { sql } from 'drizzle-orm';

// Use a separate test database or the same database with a test schema
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgresql://arbor:local_dev_only@localhost:5432/arbor';

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

  // Delete all data from tables
  await db.delete(schema.nodes);

  // Only delete from user_preferences if it exists
  try {
    await db.delete(schema.userPreferences);
  } catch (error) {
    // Table doesn't exist yet, ignore
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
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_nodes_slug ON nodes(slug)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at ON nodes(deleted_at)`);

  // Create indexes for user_preferences
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key)`);
}

/**
 * Drop test database schema (cleanup after all tests)
 */
export async function dropTestSchema() {
  const db = getTestDb();
  await db.execute(sql`DROP TABLE IF EXISTS user_preferences CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS nodes CASCADE`);
}

