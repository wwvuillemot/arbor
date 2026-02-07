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
      include: [path.resolve(__dirname, "./src/**/*.{ts,tsx}")],
      exclude: [
        "**/node_modules/**",
        "**/tests/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/dist/**",
        "**/.next/**",
        // Exclude API and other apps (all patterns)
        "**/apps/api/**",
        "**/apps/desktop/**",
        "**/apps/key-value-store/**",
        "apps/api/**",
        "apps/desktop/**",
        "apps/key-value-store/**",
        // Exclude any directory that matches these names (for aliased imports)
        "api/**",
        "api",
        "db/**",
        "db",
        "services/**",
        "services",
        "config/**",
        "config",
        "app/**", // Exclude root app directory
        // Exclude coverage reports
        "coverage/**",
        "**/*.js", // Exclude generated JS files
        // Exclude generated files
        "i18n/request.ts",
        "middleware.ts", // Middleware is tested separately
        "**/*\x00*", // Exclude files with null bytes (Vite internals)
      ],
      // Disable thresholds for web project since it's including API files in coverage
      // The overall coverage thresholds are enforced at the integration test level
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
