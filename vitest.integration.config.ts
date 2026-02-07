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
      include: [
        "apps/api/src/**/*.ts", // Only include API source files
      ],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.config.*",
        "**/dist/**",
        "**/.next/**",
        "apps/web/**", // Exclude web app from API integration test coverage
        "apps/desktop/**", // Exclude desktop app from API integration test coverage
        "apps/key-value-store/**", // Exclude Redis service from coverage
        "coverage/**", // Exclude coverage reports
        "**/coverage/**", // Exclude coverage reports (nested)
        "**/*\x00*", // Exclude files with null bytes (Vite internals)
        "**/*.js", // Exclude generated JS files (coverage reports, etc.)
      ],
      // Integration test thresholds: Locked at current levels
      thresholds: {
        lines: 46,
        functions: 39,
        branches: 83,
        statements: 46,
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
