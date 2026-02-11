import { router, publicProcedure } from "../trpc";
import { LLMService, LocalLLMProvider } from "../../services/llm-service";

// Initialize LLM service with stub provider for testing
const stubProvider = new LocalLLMProvider(
  "http://localhost:11434/v1",
  "llama3.2",
  true, // stubMode
);
const llmService = new LLMService(stubProvider);

/**
 * LLM Router
 *
 * tRPC endpoints for LLM operations including model listing.
 */
export const llmRouter = router({
  /**
   * List all available models across all configured providers
   */
  listAvailableModels: publicProcedure.query(async () => {
    return await llmService.getAllModels();
  }),
});
