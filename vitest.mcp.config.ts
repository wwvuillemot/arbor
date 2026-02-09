import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "mcp-unit",
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // CRITICAL: Set DATABASE_URL to test database to prevent tests from using production database
    env: {
      DATABASE_URL:
        "postgresql://arbor:local_dev_only@localhost:5432/arbor_test",
      TEST_DATABASE_URL:
        "postgresql://arbor:local_dev_only@localhost:5432/arbor_test",
      MINIO_ENDPOINT: "minio.arbor.local",
      MINIO_ACCESS_KEY: "arbor",
      MINIO_SECRET_KEY: "local_dev_only",
    },
    include: ["tests/unit/mcp/**/*.test.ts"],
    exclude: ["apps/**", "**/node_modules/**", "**/dist/**", "**/.next/**"],
    // Run tests sequentially to avoid database conflicts
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      reportsDirectory: "./coverage/mcp-unit",
      include: ["apps/mcp-server/src/**/*.ts"],
      exclude: ["node_modules/", "tests/", "**/*.config.*", "**/dist/**"],
    },
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/api/src"),
      "@server": path.resolve(__dirname, "./apps/api/src"),
      "@mcp": path.resolve(__dirname, "./apps/mcp-server/src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
});
