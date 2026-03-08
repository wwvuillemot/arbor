import {
  buildOpenAIRequestBody,
  OPENAI_MODELS,
  parseOpenAIChatResponse,
  parseOpenAIStreamLine,
} from "./openai-provider-helpers";
import {
  estimateMessagesTokenCount,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type LLMProvider,
  type StreamChunk,
} from "./llm-types";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  readonly defaultModel = "gpt-4.1";
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
    const body = buildOpenAIRequestBody(messages, model, options);

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

    return parseOpenAIChatResponse(await response.json(), model);
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<StreamChunk> {
    const model = options?.model || this.defaultModel;
    const body = buildOpenAIRequestBody(messages, model, options, true);

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
          for (const chunk of parseOpenAIStreamLine(line)) {
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

  async models() {
    return OPENAI_MODELS;
  }

  countTokens(messages: ChatMessage[]): number {
    return estimateMessagesTokenCount(messages);
  }
}
