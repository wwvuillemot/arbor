import { router, publicProcedure } from "./trpc";
import { nodesRouter } from "./routers/nodes";
import { preferencesRouter } from "./routers/preferences";
import { settingsRouter } from "./routers/settings";
import { configurationRouter } from "./routers/configuration";
import { setupRouter } from "./routers/setup";

/**
 * Main application router
 * Merge all sub-routers here
 */
export const appRouter = router({
  nodes: nodesRouter,
  preferences: preferencesRouter,
  settings: settingsRouter,
  configuration: configurationRouter,
  setup: setupRouter,

  // Health check endpoint
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  })),
});

// Export type definition for client
export type AppRouter = typeof appRouter;
