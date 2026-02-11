/**
 * LLM Service - Provider abstraction for Large Language Model chat
 *
 * Provides a unified interface for interacting with different LLM providers
 * (OpenAI, Anthropic, local models via Ollama/LM Studio).
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  systemPrompt?: string;
  stopSequences?: string[];
}

export interface ChatResponse {
  content: string | null;
  model: string;
  tokensUsed: number;
  toolCalls?: ToolCall[];
  finishReason: "stop" | "tool_calls" | "length" | "error";
  /** Reasoning/thinking content from reasoning models (o1, o3, DeepSeek R1, etc.) */
  reasoning?: string | null;
  /** Number of tokens used for reasoning/thinking */
  reasoningTokens?: number;
  /** Number of tokens used for output (excluding reasoning) */
  outputTokens?: number;
}

export interface StreamChunk {
  type: "text" | "tool_call" | "done" | "error" | "reasoning";
  content?: string;
  toolCall?: Partial<ToolCall>;
  model?: string;
  tokensUsed?: number;
  finishReason?: string;
  error?: string;
  /** Reasoning/thinking content chunk */
  reasoning?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  /** Whether this model supports reasoning/thinking (e.g. o1, o3, DeepSeek R1) */
  supportsReasoning?: boolean;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

// ─── Provider Interface ────────────────────────────────────────────────────────

/**
 * LLMProvider interface for extensibility.
 * Each provider implementation handles API-specific details.
 */
export interface LLMProvider {
  /** Provider name for identification */
  readonly name: string;

  /** Default model ID for this provider */
  readonly defaultModel: string;

  /** Send a chat completion request */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /** Stream a chat completion request */
  chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<StreamChunk>;

  /** List available models */
  models(): Promise<ModelInfo[]>;

  /** Count tokens for a set of messages (estimate) */
  countTokens(messages: ChatMessage[]): number;
}

// ─── Token Estimation Utility ──────────────────────────────────────────────────

/**
 * Estimate token count from text using the ~4 chars per token heuristic.
 * This is a rough approximation; real counting requires a tokenizer.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a list of chat messages
 */
export function estimateMessagesTokenCount(messages: ChatMessage[]): number {
  let tokenCount = 0;
  for (const msg of messages) {
    // ~4 tokens per message overhead (role, separators)
    tokenCount += 4;
    if (msg.content) {
      tokenCount += estimateTokenCount(msg.content);
    }
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        tokenCount += estimateTokenCount(tc.function.name);
        tokenCount += estimateTokenCount(tc.function.arguments);
        tokenCount += 4; // overhead per tool call
      }
    }
  }
  return tokenCount;
}

// ─── OpenAI Provider ───────────────────────────────────────────────────────────

/** Model IDs that support reasoning/thinking */
const OPENAI_REASONING_MODELS = new Set(["o1", "o3", "o3-mini"]);

const OPENAI_MODELS: ModelInfo[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  {
    id: "o1",
    name: "o1",
    provider: "openai",
    contextWindow: 200000,
    supportsTools: false,
    supportsVision: true,
    supportsStreaming: true,
    supportsReasoning: true,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.06,
  },
  {
    id: "o3",
    name: "o3",
    provider: "openai",
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsReasoning: true,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.04,
  },
  {
    id: "o3-mini",
    name: "o3-mini",
    provider: "openai",
    contextWindow: 200000,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: true,
    supportsReasoning: true,
    costPer1kInput: 0.0011,
    costPer1kOutput: 0.0044,
  },
];

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  readonly defaultModel = "gpt-4o";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.openai.com/v1") {
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("OpenAI API key is required");
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const model = options?.model || this.defaultModel;
    const formattedMessages = this.formatMessages(messages, options?.systemPrompt);

    // Debug logging
    console.log("🔍 Formatted messages for OpenAI:", JSON.stringify(formattedMessages, null, 2));

    const body: Record<string, unknown> = {
      model,
      messages: formattedMessages,
    };

    if (options?.temperature !== undefined)
      body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options?.tools && options.tools.length > 0) body.tools = options.tools;
    if (options?.stopSequences) body.stop = options.stopSequences;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const choice = data.choices[0];

    // Extract reasoning content from reasoning models (o1, o3, o3-mini)
    const isReasoningModel = OPENAI_REASONING_MODELS.has(model);
    const reasoningContent = isReasoningModel
      ? (choice.message.reasoning_content ?? null)
      : null;
    const reasoningTokens =
      data.usage?.completion_tokens_details?.reasoning_tokens;
    const outputTokens = data.usage?.completion_tokens;

    return {
      content: choice.message.content,
      model: data.model,
      tokensUsed:
        (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
      finishReason: this.mapFinishReason(choice.finish_reason),
      reasoning: reasoningContent,
      reasoningTokens,
      outputTokens,
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<StreamChunk> {
    const model = options?.model || this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages, options?.systemPrompt),
      stream: true,
    };

    if (options?.temperature !== undefined)
      body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options?.tools && options.tools.length > 0) body.tools = options.tools;
    if (options?.stopSequences) body.stop = options.stopSequences;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      yield {
        type: "error",
        error: `OpenAI API error (${response.status}): ${errorBody}`,
      };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            yield { type: "done" };
            return;
          }

          try {
            const parsed = JSON.parse(data) as OpenAIStreamChunk;
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;

            // Reasoning content from o1/o3 models
            if (delta.reasoning_content) {
              yield { type: "reasoning", reasoning: delta.reasoning_content };
            }

            if (delta.content) {
              yield { type: "text", content: delta.content };
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                yield {
                  type: "tool_call",
                  toolCall: {
                    id: tc.id,
                    type: "function",
                    function: tc.function
                      ? {
                        name: tc.function.name || "",
                        arguments: tc.function.arguments || "",
                      }
                      : undefined,
                  },
                };
              }
            }

            if (parsed.choices?.[0]?.finish_reason) {
              yield {
                type: "done",
                finishReason: parsed.choices[0].finish_reason,
                model: parsed.model,
              };
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async models(): Promise<ModelInfo[]> {
    return OPENAI_MODELS;
  }

  countTokens(messages: ChatMessage[]): number {
    return estimateMessagesTokenCount(messages);
  }

  private formatMessages(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): OpenAIMessage[] {
    const formatted: OpenAIMessage[] = [];

    if (systemPrompt) {
      formatted.push({ role: "system", content: systemPrompt });
    }

    for (const msg of messages) {
      const openaiMsg: OpenAIMessage = {
        role: msg.role,
        content: msg.content ?? "", // OpenAI requires content to be a string, not null
      };
      if (msg.toolCalls) {
        openaiMsg.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }
      if (msg.toolCallId) {
        openaiMsg.tool_call_id = msg.toolCallId;
      }
      formatted.push(openaiMsg);
    }

    return formatted;
  }

  private mapFinishReason(
    reason: string,
  ): "stop" | "tool_calls" | "length" | "error" {
    switch (reason) {
      case "stop":
        return "stop";
      case "tool_calls":
        return "tool_calls";
      case "length":
        return "length";
      default:
        return "stop";
    }
  }
}

// OpenAI-specific response types
interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAIChatResponse {
  model: string;
  choices: Array<{
    message: {
      content: string | null;
      /** Reasoning content from o1/o3 models */
      reasoning_content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    /** Detailed token breakdown (available for reasoning models) */
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
}

interface OpenAIStreamChunk {
  model?: string;
  choices?: Array<{
    delta: {
      content?: string;
      /** Reasoning content chunk from o1/o3 models */
      reasoning_content?: string;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string;
  }>;
}

// ─── Anthropic Provider ────────────────────────────────────────────────────────

const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
  },
  {
    id: "claude-opus-4-20250514",
    name: "Claude Opus 4",
    provider: "anthropic",
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
  },
];

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly defaultModel = "claude-sonnet-4-20250514";
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.anthropic.com") {
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("Anthropic API key is required");
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    const model = options?.model || this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages),
      max_tokens: options?.maxTokens || 4096,
    };

    if (options?.systemPrompt) body.system = options.systemPrompt;
    if (options?.temperature !== undefined)
      body.temperature = options.temperature;
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }
    if (options?.stopSequences) body.stop_sequences = options.stopSequences;

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as AnthropicResponse;

    let content: string | null = null;
    let reasoning: string | null = null;
    const toolCalls: ToolCall[] = [];

    for (const block of data.content) {
      if (block.type === "thinking" && block.thinking) {
        reasoning = (reasoning || "") + block.thinking;
      } else if (block.type === "text") {
        content = (content || "") + block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      content,
      model: data.model,
      tokensUsed:
        (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: data.stop_reason === "tool_use" ? "tool_calls" : "stop",
      reasoning,
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<StreamChunk> {
    const model = options?.model || this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages),
      max_tokens: options?.maxTokens || 4096,
      stream: true,
    };

    if (options?.systemPrompt) body.system = options.systemPrompt;
    if (options?.temperature !== undefined)
      body.temperature = options.temperature;
    if (options?.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      yield {
        type: "error",
        error: `Anthropic API error (${response.status}): ${errorBody}`,
      };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);

          try {
            const parsed = JSON.parse(data) as AnthropicStreamEvent;

            if (parsed.type === "content_block_delta") {
              if (
                parsed.delta?.type === "thinking_delta" &&
                parsed.delta.thinking
              ) {
                yield { type: "reasoning", reasoning: parsed.delta.thinking };
              } else if (
                parsed.delta?.type === "text_delta" &&
                parsed.delta.text
              ) {
                yield { type: "text", content: parsed.delta.text };
              } else if (
                parsed.delta?.type === "input_json_delta" &&
                parsed.delta.partial_json
              ) {
                yield {
                  type: "tool_call",
                  toolCall: {
                    function: {
                      name: "",
                      arguments: parsed.delta.partial_json,
                    },
                  },
                };
              }
            } else if (parsed.type === "message_stop") {
              yield { type: "done", model };
            } else if (parsed.type === "message_delta") {
              if (parsed.usage) {
                yield {
                  type: "done",
                  tokensUsed:
                    (parsed.usage.input_tokens ?? 0) +
                    (parsed.usage.output_tokens ?? 0),
                  finishReason: parsed.delta?.stop_reason || "stop",
                  model,
                };
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async models(): Promise<ModelInfo[]> {
    return ANTHROPIC_MODELS;
  }

  countTokens(messages: ChatMessage[]): number {
    return estimateMessagesTokenCount(messages);
  }

  private formatMessages(messages: ChatMessage[]): AnthropicMessage[] {
    return messages
      .filter((m) => m.role !== "system")
      .map((msg) => {
        if (msg.role === "tool") {
          return {
            role: "user" as const,
            content: [
              {
                type: "tool_result" as const,
                tool_use_id: msg.toolCallId || "",
                content: msg.content || "",
              },
            ],
          };
        }

        const contentBlocks: AnthropicContentBlock[] = [];
        if (msg.content) {
          contentBlocks.push({ type: "text", text: msg.content });
        }
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            contentBlocks.push({
              type: "tool_use",
              id: tc.id,
              name: tc.function.name,
              input: JSON.parse(tc.function.arguments),
            });
          }
        }

        return {
          role:
            msg.role === "assistant"
              ? ("assistant" as const)
              : ("user" as const),
          content:
            contentBlocks.length === 1 && contentBlocks[0].type === "text"
              ? contentBlocks[0].text!
              : contentBlocks,
        };
      });
  }
}

// Anthropic-specific types
type AnthropicContentBlock =
  | { type: "text"; text: string; id?: never; name?: never; input?: never }
  | { type: "tool_use"; id: string; name: string; input: unknown; text?: never }
  | {
    type: "tool_result";
    tool_use_id: string;
    content: string;
    text?: never;
    id?: never;
    name?: never;
    input?: never;
  };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface AnthropicResponse {
  model: string;
  content: Array<{
    type: string;
    text?: string;
    /** Thinking/reasoning content from extended thinking */
    thinking?: string;
    id?: string;
    name?: string;
    input?: unknown;
  }>;
  stop_reason: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  delta?: {
    type?: string;
    text?: string;
    /** Thinking content chunk from extended thinking */
    thinking?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

// ─── Local Provider (Ollama / LM Studio / Testing) ─────────────────────────────

/**
 * LocalLLMProvider
 *
 * Uses an OpenAI-compatible local API (Ollama, LM Studio, etc.)
 * Also serves as a test stub when no actual server is running.
 */
export class LocalLLMProvider implements LLMProvider {
  readonly name = "local";
  readonly defaultModel: string;
  private baseUrl: string;
  private stubMode: boolean;

  constructor(
    baseUrl = "http://localhost:11434/v1",
    defaultModel = "llama3.2",
    stubMode = false,
  ) {
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
    this.stubMode = stubMode;
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResponse> {
    if (this.stubMode) {
      return this.stubChat(messages);
    }

    // Use OpenAI-compatible API format (Ollama and LM Studio both support this)
    const model = options?.model || this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (options?.systemPrompt) {
      (
        body.messages as Array<{ role: string; content: string | null }>
      ).unshift({
        role: "system",
        content: options.systemPrompt,
      });
    }

    if (options?.temperature !== undefined)
      body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Local LLM API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const choice = data.choices[0];

    // DeepSeek R1 embeds reasoning in <think>...</think> tags within content
    const rawContent = choice.message.content;
    const parsed = LocalLLMProvider.parseReasoningFromContent(rawContent);

    return {
      content: parsed.content,
      model: data.model,
      tokensUsed:
        (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
      finishReason: "stop",
      reasoning: parsed.reasoning,
    };
  }

  /**
   * Parse DeepSeek R1's <think>...</think> reasoning tags from content.
   * Returns separated content and reasoning.
   */
  static parseReasoningFromContent(rawContent: string | null): {
    content: string | null;
    reasoning: string | null;
  } {
    if (!rawContent) return { content: null, reasoning: null };

    const thinkMatch = rawContent.match(
      /^<think>([\s\S]*?)<\/think>\s*([\s\S]*)$/,
    );
    if (thinkMatch) {
      const reasoning = thinkMatch[1].trim() || null;
      const content = thinkMatch[2].trim() || null;
      return { content, reasoning };
    }

    return { content: rawContent, reasoning: null };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<StreamChunk> {
    if (this.stubMode) {
      const response = await this.stubChat(messages);
      if (response.reasoning) {
        yield { type: "reasoning", reasoning: response.reasoning };
      }
      if (response.content) {
        // Simulate streaming by yielding word by word
        const words = response.content.split(" ");
        for (const word of words) {
          yield { type: "text", content: word + " " };
        }
      }
      yield { type: "done", model: this.defaultModel };
      return;
    }

    // Use OpenAI-compatible streaming
    const model = options?.model || this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    };

    if (options?.systemPrompt) {
      (
        body.messages as Array<{ role: string; content: string | null }>
      ).unshift({
        role: "system",
        content: options.systemPrompt,
      });
    }
    if (options?.temperature !== undefined)
      body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      yield {
        type: "error",
        error: `Local LLM API error (${response.status}): ${errorBody}`,
      };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            yield { type: "done" };
            return;
          }
          try {
            const parsed = JSON.parse(data) as OpenAIStreamChunk;
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: "text", content: delta.content };
            }
            if (parsed.choices?.[0]?.finish_reason) {
              yield { type: "done", model: parsed.model };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async models(): Promise<ModelInfo[]> {
    if (this.stubMode) {
      return [
        {
          id: "stub",
          name: "Stub Model (Testing)",
          provider: "local",
          contextWindow: 4096,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: true,
        },
        {
          id: "deepseek-r1",
          name: "DeepSeek R1",
          provider: "local",
          contextWindow: 65536,
          supportsTools: false,
          supportsVision: false,
          supportsStreaming: true,
          supportsReasoning: true,
        },
      ];
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`);
      if (!response.ok) return [];
      const data = (await response.json()) as {
        data: Array<{ id: string; owned_by?: string }>;
      };
      return data.data.map((m) => ({
        id: m.id,
        name: m.id,
        provider: "local",
        contextWindow: 4096,
        supportsTools: false,
        supportsVision: false,
        supportsStreaming: true,
      }));
    } catch {
      return [];
    }
  }

  countTokens(messages: ChatMessage[]): number {
    return estimateMessagesTokenCount(messages);
  }

  private async stubChat(messages: ChatMessage[]): Promise<ChatResponse> {
    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage?.content || "";
    return {
      content: `[Stub response to: "${prompt.slice(0, 50)}${prompt.length > 50 ? "..." : ""}"]`,
      model: "stub",
      tokensUsed: estimateMessagesTokenCount(messages) + 20,
      finishReason: "stop",
    };
  }
}

// ─── LLM Service (manages provider selection) ──────────────────────────────────

/**
 * LLMService
 *
 * High-level service that manages LLM provider selection and provides
 * a unified interface for chat operations.
 */
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
}
