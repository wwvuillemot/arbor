import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./apps/api/src/db/schema.ts",
  out: "./apps/api/src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || "arbor",
    password: process.env.DB_PASSWORD || "local_dev_only",
    database: process.env.DB_NAME || "arbor_dev",
  },
  verbose: true,
  strict: true,
});
