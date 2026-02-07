import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "web-e2e",
    root: __dirname,
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "./tests/setup.ts")],
    include: [path.resolve(__dirname, "./tests/e2e/**/*.test.{ts,tsx}")],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    // E2E tests may take even longer
    testTimeout: 60000,
    hookTimeout: 60000,
    // Run E2E tests sequentially to avoid conflicts
    pool: "forks",
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage-e2e",
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**",
        "**/.next/**",
      ],
      // E2E tests focus on critical paths, not full coverage
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 30,
        statements: 30,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
