import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Database connection string
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://arbor:local_dev_only@localhost:5432/arbor";

// Create postgres client
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export schema for use in queries
export { schema };

// Helper to close connection (for testing)
export const closeConnection = async () => {
  await client.end();
};
