import { router, publicProcedure } from './trpc';
import { nodesRouter } from './routers/nodes';
import { preferencesRouter } from './routers/preferences';

/**
 * Main application router
 * Merge all sub-routers here
 */
export const appRouter = router({
  nodes: nodesRouter,
  preferences: preferencesRouter,

  // Health check endpoint
  health: publicProcedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })),
});

// Export type definition for client
export type AppRouter = typeof appRouter;

