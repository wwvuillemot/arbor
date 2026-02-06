import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // API tests (root level)
  './vitest.config.ts',
  // Web app tests
  './apps/web/vitest.config.ts',
]);

