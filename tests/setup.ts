import { beforeAll, afterAll, beforeEach } from "vitest";
import { getTestDb, cleanupTestDb, resetTestDb } from "./helpers/db";

// Skip database setup for tests that don't need it
const SKIP_DB_SETUP = process.env.SKIP_DB_SETUP === "true";

// Global test setup
beforeAll(async () => {
  if (SKIP_DB_SETUP) {
    return;
  }
  // Ensure test database connection is ready
  await getTestDb();
});

// Clean up after all tests
afterAll(async () => {
  if (SKIP_DB_SETUP) {
    return;
  }
  await cleanupTestDb();
});

// Reset database before each test to ensure isolation
beforeEach(async () => {
  if (SKIP_DB_SETUP) {
    return;
  }
  await resetTestDb();
});
