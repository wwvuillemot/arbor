import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  // API unit tests (root level)
  "./vitest.config.ts",
  // API integration tests
  "./vitest.integration.config.ts",
  // Web app tests
  "./apps/web/vitest.config.ts",
]);
