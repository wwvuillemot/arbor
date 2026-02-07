import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "web",
    root: __dirname,
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "./tests/setup.ts")],
    include: [path.resolve(__dirname, "./tests/**/*.test.{ts,tsx}")],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      // Exclude integration and e2e tests from unit test runs
      "**/tests/integration/**",
      "**/tests/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      reportsDirectory: path.resolve(__dirname, "./coverage"),
      all: false, // Don't include all files, only tested ones
      exclude: [
        "**/node_modules/**",
        "**/tests/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**",
        "**/.next/**",
        // Exclude API and other apps
        "**/apps/api/**",
        "**/apps/desktop/**",
        "**/apps/key-value-store/**",
        "**/app/**", // Exclude root app directory
        // Exclude generated files
        "**/i18n/request.ts",
        "**/middleware.ts", // Middleware is tested separately
        "**/*\x00*", // Exclude files with null bytes (Vite internals)
      ],
      // Unit test thresholds: Current coverage levels locked in
      // Note: These are lower than actual web coverage due to vitest including API files in aggregation
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
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
