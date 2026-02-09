import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "api-unit",
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
    include: ["tests/**/*.test.ts"],
    exclude: [
      "apps/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      // Exclude integration tests from unit test runs
      "tests/integration/**",
    ],
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
      reportsDirectory: "./coverage/api-unit",
      include: [
        "apps/api/src/**/*.ts", // Only include API source files
      ],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.config.*",
        "**/dist/**",
        "**/.next/**",
        "**/app/**", // Exclude Vite virtual modules
        "**/coverage/**", // Exclude coverage reports
        "**/*.js", // Exclude generated JS files
        "**/*\x00*", // Exclude files with null bytes (Vite internals)
      ],
      // Unit test thresholds: Current coverage levels locked in
      // Note: Aggregated across API and web projects
      thresholds: {
        lines: 46,
        functions: 39,
        branches: 83,
        statements: 46,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/api/src"),
      "@server": path.resolve(__dirname, "./apps/api/src"),
      "@tests": path.resolve(__dirname, "./tests"),
      // Force all graphql imports to use the same instance
      graphql: path.resolve(__dirname, "./node_modules/graphql/index.js"),
    },
    dedupe: ["graphql"],
  },
  optimizeDeps: {
    include: ["graphql", "@pothos/core"],
  },
});
