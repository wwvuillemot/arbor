import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    name: "api-unit",
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
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
    fileParallelism: false,
    server: {
      deps: {
        external: ["graphql"],
      },
    },
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
    },
  },
  optimizeDeps: {
    include: ["graphql", "@pothos/core"],
  },
});
