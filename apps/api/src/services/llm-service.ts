/**
 * LLM Service - public facade for shared LLM contracts and providers.
 */

import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  LLMProvider,
  ModelInfo,
  StreamChunk,
} from "./llm/llm-types";

export type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  LLMProvider,
  ModelInfo,
  StreamChunk,
  ToolCall,
  ToolDefinition,
} from "./llm/llm-types";
export {
  estimateMessagesTokenCount,
  estimateTokenCount,
} from "./llm/llm-types";
export { AnthropicProvider } from "./llm/anthropic-provider";
export { LocalLLMProvider } from "./llm/local-provider";
export { OpenAIProvider } from "./llm/openai-provider";

export class LLMService {
  private providers: Map<string, LLMProvider> = new Map();
  private activeProvider: LLMProvider;

  constructor(defaultProvider: LLMProvider) {
    this.activeProvider = defaultProvider;
    this.providers.set(defaultProvider.name, defaultProvider);
  }

  /**
   * Register an additional provider
   */
  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Set the active provider by name
   */
  setActiveProvider(providerName: string): void {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(
        `Unknown provider: ${providerName}. Available: ${Array.from(this.providers.keys()).join(", ")}`,
      );
    }
    this.activeProvider = provider;
  }

  /**
   * Get the active provider
   */
  getActiveProvider(): LLMProvider {
    return this.activeProvider;
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * List all registered provider names
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Send a chat completion via the active provider
   */
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    return this.activeProvider.chat(messages, options);
  }

  /**
   * Stream a chat completion via the active provider
   */
  chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<StreamChunk> {
    return this.activeProvider.chatStream(messages, options);
  }

  /**
   * Get all available models across all providers
   */
  async getAllModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];
    for (const provider of this.providers.values()) {
      const models = await provider.models();
      allModels.push(...models);
    }
    return allModels;
  }

  /**
   * Count tokens for messages using active provider
   */
  countTokens(messages: ChatMessage[]): number {
    return this.activeProvider.countTokens(messages);
  }

  /**
   * Check if a model supports temperature control
   * Reasoning models (o1, o3, DeepSeek R1, etc.) do not support temperature
   */
  async supportsTemperature(modelId: string): Promise<boolean> {
    const allModels = await this.getAllModels();
    const model = allModels.find((m) => m.id === modelId);
    if (!model) {
      // Unknown model, assume it supports temperature
      return true;
    }
    // Reasoning models don't support temperature
    return !model.supportsReasoning;
  }
}
