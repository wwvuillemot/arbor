import {
  buildLocalRequestBody,
  buildLocalStubChatResponse,
  buildLocalStubStreamChunks,
  LOCAL_STUB_MODELS,
  parseLocalChatResponse,
  parseLocalModelsResponse,
  parseLocalReasoningFromContent,
  parseLocalStreamLine,
} from "./local-provider-helpers";
import {
  estimateMessagesTokenCount,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type LLMProvider,
  type ModelInfo,
  type StreamChunk,
} from "./llm-types";

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
      return buildLocalStubChatResponse(messages);
    }

    const model = options?.model || this.defaultModel;
    const body = buildLocalRequestBody(messages, model, options);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Local LLM API error (${response.status}): ${errorBody}`);
    }

    return parseLocalChatResponse(await response.json());
  }

  static parseReasoningFromContent(rawContent: string | null): {
    content: string | null;
    reasoning: string | null;
  } {
    return parseLocalReasoningFromContent(rawContent);
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<StreamChunk> {
    if (this.stubMode) {
      for (const chunk of buildLocalStubStreamChunks(
        messages,
        this.defaultModel,
      )) {
        yield chunk;
      }
      return;
    }

    const model = options?.model || this.defaultModel;
    const body = buildLocalRequestBody(messages, model, options, true);

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
          for (const chunk of parseLocalStreamLine(line)) {
            yield chunk;
            if (chunk.type === "done" && chunk.finishReason === undefined) {
              return;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async models(): Promise<ModelInfo[]> {
    if (this.stubMode) {
      return LOCAL_STUB_MODELS;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`);
      if (!response.ok) return [];
      return parseLocalModelsResponse(await response.json());
    } catch {
      return [];
    }
  }

  countTokens(messages: ChatMessage[]): number {
    return estimateMessagesTokenCount(messages);
  }
}
