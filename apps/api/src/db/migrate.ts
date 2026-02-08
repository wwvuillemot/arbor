#!/usr/bin/env tsx
/**
 * Database Migration Runner
 * 
 * Runs all pending migrations in the migrations directory.
 * This is the proper way to update the database schema in production.
 * 
 * Usage:
 *   pnpm run db:migrate        # Run all pending migrations
 *   pnpm run db:migrate:up     # Same as above
 * 
 * To create a new migration:
 *   pnpm run db:generate       # Generates migration from schema changes
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as path from "path";

async function runMigrations() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://arbor:local_dev_only@postgres.arbor.local:5432/arbor";

  console.log("🔄 Running database migrations...");
  console.log(`📍 Connection: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);

  // Create postgres connection for migrations
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    const migrationsFolder = path.join(__dirname, "migrations");
    console.log(`📂 Migrations folder: ${migrationsFolder}`);

    await migrate(db, { migrationsFolder });

    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();

