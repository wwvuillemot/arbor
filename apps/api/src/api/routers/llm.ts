import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  LLMService,
  LocalLLMProvider,
  OpenAIProvider,
  AnthropicProvider,
} from "../../services/llm-service";
import { SettingsService } from "../../services/settings-service";
import { PreferencesService } from "../../services/preferences-service";

const settingsService = new SettingsService();
const preferencesService = new PreferencesService();

/**
 * Initialize LLM service with all available providers based on configured API keys
 */
async function getInitializedLLMService(): Promise<LLMService> {
  // Start with local provider (always available, can be stub mode)
  const localProvider = new LocalLLMProvider(
    "http://localhost:11434/v1",
    "llama3.2",
    true, // stub mode by default
  );
  const llmService = new LLMService(localProvider);

  try {
    // Get master key for decrypting API keys
    const masterKey = await preferencesService.getOrGenerateMasterKey();

    // Try to register OpenAI provider
    try {
      const openaiKey = await settingsService.getSetting(
        "openai_api_key",
        masterKey,
      );
      if (openaiKey && openaiKey.trim() !== "") {
        const openaiProvider = new OpenAIProvider(openaiKey);
        llmService.registerProvider(openaiProvider);
      }
    } catch (err) {
      console.warn("Failed to initialize OpenAI provider:", err);
    }

    // Try to register Anthropic provider
    try {
      const anthropicKey = await settingsService.getSetting(
        "anthropic_api_key",
        masterKey,
      );
      if (anthropicKey && anthropicKey.trim() !== "") {
        const anthropicProvider = new AnthropicProvider(anthropicKey);
        llmService.registerProvider(anthropicProvider);
      }
    } catch (err) {
      console.warn("Failed to initialize Anthropic provider:", err);
    }
  } catch (err) {
    console.warn("Failed to get master key for LLM service:", err);
  }

  return llmService;
}

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
    const llmService = await getInitializedLLMService();
    return await llmService.getAllModels();
  }),

  /**
   * Check if a model supports temperature control
   * Reasoning models (o1, o3, DeepSeek R1, etc.) do not support temperature
   */
  supportsTemperature: publicProcedure
    .input(z.object({ modelId: z.string() }))
    .query(async ({ input }) => {
      const llmService = await getInitializedLLMService();
      return await llmService.supportsTemperature(input.modelId);
    }),
});
