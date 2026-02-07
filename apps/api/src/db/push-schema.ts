import { sql } from "drizzle-orm";
import { db } from "./index";

async function pushSchema() {
  console.log("🔨 Creating database schema...");

  try {
    // Create nodes table
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

    // Create indexes
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

    console.log("✅ Schema created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to create schema:", error);
    process.exit(1);
  }
}

pushSchema();
