import { router, publicProcedure } from "./trpc";
import { nodesRouter } from "./routers/nodes";
import { preferencesRouter } from "./routers/preferences";
import { settingsRouter } from "./routers/settings";
import { configurationRouter } from "./routers/configuration";
import { setupRouter } from "./routers/setup";
import { systemRouter } from "./routers/system";
import { mediaRouter } from "./routers/media";
import { tagsRouter } from "./routers/tags";
import { searchRouter } from "./routers/search";
import { ragRouter } from "./routers/rag";
import { chatRouter } from "./routers/chat";
import { provenanceRouter } from "./routers/provenance";
import { llmRouter } from "./routers/llm";
import { mcpRouter } from "./routers/mcp";

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
  system: systemRouter,
  media: mediaRouter,
  tags: tagsRouter,
  search: searchRouter,
  rag: ragRouter,
  chat: chatRouter,
  provenance: provenanceRouter,
  llm: llmRouter,
  mcp: mcpRouter,

  // Health check endpoint
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  })),
});

// Export type definition for client
export type AppRouter = typeof appRouter;
