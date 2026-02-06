import { beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestDb, cleanupTestDb, resetTestDb } from './helpers/db';

// Global test setup
beforeAll(async () => {
  // Ensure test database connection is ready
  await getTestDb();
});

// Clean up after all tests
afterAll(async () => {
  await cleanupTestDb();
});

// Reset database before each test to ensure isolation
beforeEach(async () => {
  await resetTestDb();
});

