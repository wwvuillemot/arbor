import {
  buildAnthropicRequestBody,
  parseAnthropicChatResponse,
  parseAnthropicStreamLine,
} from "./anthropic-provider-helpers";
import {
  estimateMessagesTokenCount,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type LLMProvider,
  type ModelInfo,
  type StreamChunk,
} from "./llm-types";

const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: false,
    supportsStreaming: true,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
  },
];

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly defaultModel = "claude-sonnet-4-6";
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
    const body = buildAnthropicRequestBody(messages, model, options);

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

    return parseAnthropicChatResponse(await response.json());
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<StreamChunk> {
    const model = options?.model || this.defaultModel;
    const body = buildAnthropicRequestBody(messages, model, options, true);

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
          for (const chunk of parseAnthropicStreamLine(line, model)) {
            yield chunk;
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
}
