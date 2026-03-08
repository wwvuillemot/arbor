import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  ModelInfo,
  StreamChunk,
} from "./llm-types";
import {
  formatOpenAICompatibleMessages,
  mapOpenAICompatibleFinishReason,
  parseOpenAICompatibleToolCalls,
  type OpenAIChatResponse,
  type OpenAIStreamChunk,
} from "./openai-compatible";

const OPENAI_REASONING_MODELS = new Set([
  "o1",
  "o1-mini",
  "o1-preview",
  "o3",
  "o3-mini",
  "o4-mini",
]);

export const OPENAI_MODELS: ModelInfo[] = [
  {
    id: "gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    contextWindow: 1047576,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kInput: 0.002,
    costPer1kOutput: 0.008,
  },
  {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    contextWindow: 1047576,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kInput: 0.0004,
    costPer1kOutput: 0.0016,
  },
  {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    contextWindow: 1047576,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
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
    id: "o4-mini",
    name: "o4-mini",
    provider: "openai",
    contextWindow: 200000,
    supportsTools: true,
    supportsVision: true,
    supportsStreaming: true,
    supportsReasoning: true,
    costPer1kInput: 0.0011,
    costPer1kOutput: 0.0044,
  },
];

export function buildOpenAIRequestBody(
  messages: ChatMessage[],
  model: string,
  options?: ChatOptions,
  stream = false,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: formatOpenAICompatibleMessages(messages, options?.systemPrompt),
  };

  if (stream) body.stream = true;
  if (options?.temperature !== undefined)
    body.temperature = options.temperature;
  if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
  if (options?.tools && options.tools.length > 0) body.tools = options.tools;
  if (options?.stopSequences) body.stop = options.stopSequences;

  return body;
}

export function parseOpenAIChatResponse(
  data: unknown,
  requestedModel: string,
): ChatResponse {
  const response = data as OpenAIChatResponse;
  const choice = response.choices[0];

  return {
    content: choice.message.content,
    model: response.model,
    tokensUsed:
      (response.usage?.prompt_tokens ?? 0) +
      (response.usage?.completion_tokens ?? 0),
    toolCalls: parseOpenAICompatibleToolCalls(choice.message.tool_calls),
    finishReason: mapOpenAICompatibleFinishReason(choice.finish_reason),
    reasoning: OPENAI_REASONING_MODELS.has(requestedModel)
      ? (choice.message.reasoning_content ?? null)
      : null,
    reasoningTokens:
      response.usage?.completion_tokens_details?.reasoning_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

export function parseOpenAIStreamLine(line: string): StreamChunk[] {
  const trimmedLine = line.trim();
  if (!trimmedLine || !trimmedLine.startsWith("data: ")) {
    return [];
  }

  const data = trimmedLine.slice(6);
  if (data === "[DONE]") {
    return [{ type: "done" }];
  }

  try {
    const parsed = JSON.parse(data) as OpenAIStreamChunk;
    const choice = parsed.choices?.[0];
    const delta = choice?.delta;
    if (!delta) {
      return [];
    }

    const streamChunks: StreamChunk[] = [];

    if (delta.reasoning_content) {
      streamChunks.push({
        type: "reasoning",
        reasoning: delta.reasoning_content,
      });
    }

    if (delta.content) {
      streamChunks.push({ type: "text", content: delta.content });
    }

    if (delta.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        streamChunks.push({
          type: "tool_call",
          toolCall: {
            id: toolCall.id,
            type: "function",
            function: toolCall.function
              ? {
                  name: toolCall.function.name || "",
                  arguments: toolCall.function.arguments || "",
                }
              : undefined,
          },
        });
      }
    }

    if (choice.finish_reason) {
      streamChunks.push({
        type: "done",
        finishReason: choice.finish_reason,
        model: parsed.model,
      });
    }

    return streamChunks;
  } catch {
    return [];
  }
}
