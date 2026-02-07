import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "api-integration",
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["apps/**", "**/node_modules/**", "**/dist/**", "**/.next/**"],
    // Run tests sequentially to avoid database conflicts
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage/api-integration",
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.config.*",
        "**/dist/**",
        "**/.next/**",
      ],
      // Integration test thresholds: 50% line and branch coverage
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/api/src"),
      "@server": path.resolve(__dirname, "./apps/api/src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },
});
