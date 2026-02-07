import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "web-integration",
    root: __dirname,
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "./tests/setup.ts")],
    include: [
      path.resolve(__dirname, "./tests/integration/**/*.test.{ts,tsx}"),
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    // Integration tests may take longer
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage-integration",
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**",
        "**/.next/**",
      ],
      // Integration test thresholds: 50% line and branch coverage
      // (lower due to higher runtime and maintenance costs)
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
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
