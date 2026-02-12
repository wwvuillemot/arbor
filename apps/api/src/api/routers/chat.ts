import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { ChatService } from "../../services/chat-service";
import { agentModeEnum, chatRoleEnum } from "../../db/schema";
import {
  getAllAgentModes,
  getAgentModeConfig,
  buildSystemPrompt,
  createAgentMode,
  updateAgentMode,
  deleteAgentMode,
  listCustomAgentModes,
} from "../../services/agent-mode-service";
import {
  LLMService,
  LocalLLMProvider,
  OpenAIProvider,
  AnthropicProvider,
  type ChatMessage as LLMChatMessage,
} from "../../services/llm-service";
import { SettingsService } from "../../services/settings-service";

const chatService = new ChatService();
const settingsService = new SettingsService();

/**
 * Initialize LLM service with configured providers
 * Uses API keys from settings if available, otherwise uses stub mode
 * Automatically selects the correct provider based on the model
 */
async function initializeLLMService(
  masterKey: string,
  modelId?: string | null,
): Promise<LLMService> {
  // Start with local provider (always available, can be stub mode)
  const localProvider = new LocalLLMProvider(
    "http://localhost:11434/v1",
    "llama3.2",
    true, // stub mode by default
  );
  const llmService = new LLMService(localProvider);

  let hasOpenAI = false;
  let hasAnthropic = false;

  try {
    // Try to get OpenAI API key
    const openaiKey = await settingsService.getSetting(
      "openai_api_key",
      masterKey,
    );
    console.log(
      "OpenAI key retrieved:",
      openaiKey ? "YES (length: " + openaiKey.length + ")" : "NO",
    );
    if (openaiKey && openaiKey.trim() !== "") {
      const openaiProvider = new OpenAIProvider(openaiKey);
      llmService.registerProvider(openaiProvider);
      hasOpenAI = true;
      console.log("✅ OpenAI provider registered");
    }
  } catch (err) {
    console.warn("Failed to initialize OpenAI provider:", err);
  }

  try {
    // Try to get Anthropic API key
    const anthropicKey = await settingsService.getSetting(
      "anthropic_api_key",
      masterKey,
    );
    console.log(
      "Anthropic key retrieved:",
      anthropicKey ? "YES (length: " + anthropicKey.length + ")" : "NO",
    );
    if (anthropicKey && anthropicKey.trim() !== "") {
      const anthropicProvider = new AnthropicProvider(anthropicKey);
      llmService.registerProvider(anthropicProvider);
      hasAnthropic = true;
      console.log("✅ Anthropic provider registered");
    }
  } catch (err) {
    console.warn("Failed to initialize Anthropic provider:", err);
  }

  // Auto-select provider based on model
  if (modelId) {
    if (
      modelId.startsWith("gpt-") ||
      modelId.startsWith("o1") ||
      modelId.startsWith("o3")
    ) {
      if (hasOpenAI) {
        llmService.setActiveProvider("openai");
        console.log("🎯 Selected OpenAI provider for model:", modelId);
      } else {
        console.warn("⚠️ Model requires OpenAI but no API key configured");
      }
    } else if (modelId.startsWith("claude-")) {
      if (hasAnthropic) {
        llmService.setActiveProvider("anthropic");
        console.log("🎯 Selected Anthropic provider for model:", modelId);
      } else {
        console.warn("⚠️ Model requires Anthropic but no API key configured");
      }
    }
  } else {
    // No model specified, prefer OpenAI > Anthropic > Local
    if (hasOpenAI) {
      llmService.setActiveProvider("openai");
      console.log("🎯 Default to OpenAI provider");
    } else if (hasAnthropic) {
      llmService.setActiveProvider("anthropic");
      console.log("🎯 Default to Anthropic provider");
    }
  }

  console.log("🔧 Active LLM provider:", llmService.getActiveProvider().name);
  return llmService;
}

/**
 * Chat Router
 *
 * tRPC endpoints for chat thread and message operations.
 */
export const chatRouter = router({
  // ─── Thread Endpoints ──────────────────────────────────────────────

  /**
   * Create a new chat thread
   */
  createThread: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        projectId: z.string().uuid().nullable().optional(),
        agentMode: z.enum(agentModeEnum).optional(),
        model: z.string().max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return await chatService.createThread(input);
    }),

  /**
   * Get a thread by ID
   */
  getThread: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const thread = await chatService.getThreadById(input.id);
      if (!thread) {
        throw new Error("Thread not found");
      }
      return thread;
    }),

  /**
   * List threads, optionally filtered by project
   */
  listThreads: publicProcedure
    .input(
      z
        .object({
          projectId: z.string().uuid().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      return await chatService.getThreads(input?.projectId);
    }),

  /**
   * Update a thread
   */
  updateThread: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        agentMode: z.enum(agentModeEnum).optional(),
        model: z.string().max(100).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const thread = await chatService.updateThread(id, updates);
      if (!thread) {
        throw new Error("Thread not found");
      }
      return thread;
    }),

  /**
   * Delete a thread
   */
  deleteThread: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const deleted = await chatService.deleteThread(input.id);
      return { success: deleted };
    }),

  // ─── Message Endpoints ─────────────────────────────────────────────

  /**
   * Add a message to a thread
   */
  addMessage: publicProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        role: z.enum(chatRoleEnum),
        content: z.string().nullable().optional(),
        model: z.string().max(100).nullable().optional(),
        tokensUsed: z.number().int().nullable().optional(),
        toolCalls: z.any().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return await chatService.addMessage(input);
    }),

  /**
   * Get messages for a thread
   */
  getMessages: publicProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await chatService.getMessages(input.threadId);
    }),

  /**
   * Delete a message
   */
  deleteMessage: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const deleted = await chatService.deleteMessage(input.id);
      return { success: deleted };
    }),

  /**
   * Get message count for a thread
   */
  countMessages: publicProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await chatService.countMessages(input.threadId);
    }),

  /**
   * Send a message and get LLM response
   * This is the main endpoint for chat interaction
   */
  sendMessage: publicProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        content: z.string().min(1),
        masterKey: z.string(), // Required for decrypting API keys
      }),
    )
    .mutation(async ({ input }) => {
      const { threadId, content, masterKey } = input;

      // Get the thread to determine agent mode and model preference
      const thread = await chatService.getThreadById(threadId);
      if (!thread) {
        throw new Error("Thread not found");
      }

      // Get conversation history
      const history = await chatService.getMessages(threadId);

      // Get agent mode config for temperature and system prompt
      const agentModeConfig = await getAgentModeConfig(thread.agentMode);
      if (!agentModeConfig) {
        throw new Error(`Unknown agent mode: ${thread.agentMode}`);
      }

      // Build system prompt based on agent mode
      const systemPrompt = await buildSystemPrompt(thread.agentMode);

      // Convert database messages to LLM format
      console.log(
        "📝 Raw history from database:",
        JSON.stringify(
          history.map((m) => ({
            role: m.role,
            content: m.content,
            contentType: typeof m.content,
          })),
          null,
          2,
        ),
      );

      const llmMessages: LLMChatMessage[] = history.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system" | "tool",
        content: msg.content,
        toolCalls: msg.toolCalls as any,
      }));

      // Add the new user message
      llmMessages.push({
        role: "user",
        content,
      });

      console.log(
        "📤 Messages being sent to LLM:",
        JSON.stringify(
          llmMessages.map((m) => ({
            role: m.role,
            content: m.content,
            contentType: typeof m.content,
          })),
          null,
          2,
        ),
      );

      // Initialize LLM service with API keys and auto-select provider based on model
      const llmService = await initializeLLMService(masterKey, thread.model);

      // Check if the model supports temperature
      const supportsTemp = thread.model
        ? await llmService.supportsTemperature(thread.model)
        : true;

      // Call the LLM with error handling and fallback to stub mode
      let response;
      try {
        console.log(
          "🤖 Calling LLM with provider:",
          llmService.getActiveProvider().name,
          "model:",
          thread.model ?? "default",
          "temperature:",
          supportsTemp ? agentModeConfig.temperature : "N/A (reasoning model)",
        );
        response = await llmService.chat(llmMessages, {
          model: thread.model ?? undefined,
          systemPrompt,
          // Only send temperature if the model supports it
          temperature: supportsTemp ? agentModeConfig.temperature : undefined,
        });
        console.log(
          "✅ LLM response received:",
          response.content.substring(0, 100) + "...",
        );
      } catch (error) {
        // If the API call fails (e.g., invalid API key), fall back to stub mode
        console.warn(
          "❌ LLM API call failed, falling back to stub mode:",
          error,
        );
        const stubProvider = new LocalLLMProvider(
          "http://localhost:11434/v1",
          "llama3.2",
          true, // stub mode
        );
        const stubService = new LLMService(stubProvider);
        response = await stubService.chat(llmMessages, {
          model: thread.model ?? undefined,
          systemPrompt,
          temperature: agentModeConfig.temperature,
        });
        console.log("🔄 Using stub response");
      }

      // Store the user message
      const userMessage = await chatService.addMessage({
        threadId,
        role: "user",
        content,
      });

      // Store the assistant response
      const assistantMessage = await chatService.addMessage({
        threadId,
        role: "assistant",
        content: response.content,
        model: response.model,
        tokensUsed: response.tokensUsed,
        toolCalls: response.toolCalls,
        metadata: {
          finishReason: response.finishReason,
          reasoning: response.reasoning,
          reasoningTokens: response.reasoningTokens,
          outputTokens: response.outputTokens,
        },
      });

      return {
        userMessage,
        assistantMessage,
      };
    }),

  /**
   * Get total token usage for a thread
   */
  getTokenUsage: publicProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .query(async ({ input }) => {
      return await chatService.getThreadTokenUsage(input.threadId);
    }),

  /**
   * Get recent messages (for context window)
   */
  getRecentMessages: publicProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).optional().default(20),
      }),
    )
    .query(async ({ input }) => {
      return await chatService.getRecentMessages(input.threadId, input.limit);
    }),

  // ─── Agent Mode Endpoints ─────────────────────────────────────────

  /**
   * List all available agent modes (built-in + custom)
   */
  listAgentModes: publicProcedure.query(async () => {
    return await getAllAgentModes();
  }),

  /**
   * List only custom (non-built-in) agent modes
   */
  listCustomAgentModes: publicProcedure.query(async () => {
    return await listCustomAgentModes();
  }),

  /**
   * Get a specific agent mode configuration by name
   */
  getAgentMode: publicProcedure
    .input(z.object({ mode: z.string() }))
    .query(async ({ input }) => {
      const config = await getAgentModeConfig(input.mode);
      if (!config) {
        throw new Error(`Unknown agent mode: ${input.mode}`);
      }
      return config;
    }),

  /**
   * Create a new custom agent mode
   */
  createAgentMode: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        displayName: z.string().min(1).max(100),
        description: z.string().min(1),
        allowedTools: z.array(z.string()),
        guidelines: z.string().min(1),
        temperature: z.number().min(0).max(2),
      }),
    )
    .mutation(async ({ input }) => {
      return await createAgentMode(input);
    }),

  /**
   * Update an existing custom agent mode
   */
  updateAgentMode: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        displayName: z.string().min(1).max(100).optional(),
        description: z.string().min(1).optional(),
        allowedTools: z.array(z.string()).optional(),
        guidelines: z.string().min(1).optional(),
        temperature: z.number().min(0).max(2).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...params } = input;
      return await updateAgentMode(id, params);
    }),

  /**
   * Delete a custom agent mode
   */
  deleteAgentMode: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const success = await deleteAgentMode(input.id);
      return { success };
    }),

  /**
   * Build the system prompt for an agent mode, optionally with project context
   */
  buildSystemPrompt: publicProcedure
    .input(
      z.object({
        mode: z.string(),
        projectName: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return {
        prompt: await buildSystemPrompt(input.mode, input.projectName),
      };
    }),
});
