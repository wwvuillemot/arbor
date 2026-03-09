import {
  estimateMessagesTokenCount,
  type ChatMessage,
  type ChatOptions,
  type ChatResponse,
  type ModelInfo,
  type StreamChunk,
} from "./llm-types";
import {
  formatOpenAICompatibleMessages,
  mapOpenAICompatibleFinishReason,
  parseOpenAICompatibleToolCalls,
  type OpenAIChatResponse,
  type OpenAIStreamChunk,
} from "./openai-compatible";

interface LocalModelsResponse {
  data: Array<{ id: string; owned_by?: string }>;
}

export const LOCAL_STUB_MODELS: ModelInfo[] = [
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

export function buildLocalRequestBody(
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

export function parseLocalReasoningFromContent(rawContent: string | null): {
  content: string | null;
  reasoning: string | null;
} {
  if (!rawContent) {
    return { content: null, reasoning: null };
  }

  const thinkMatch = rawContent.match(
    /^<think>([\s\S]*?)<\/think>\s*([\s\S]*)$/,
  );
  if (thinkMatch) {
    return {
      reasoning: thinkMatch[1].trim() || null,
      content: thinkMatch[2].trim() || null,
    };
  }

  return { content: rawContent, reasoning: null };
}

export function buildLocalStubChatResponse(
  messages: ChatMessage[],
): ChatResponse {
  const lastMessage = messages[messages.length - 1];
  const prompt = lastMessage?.content || "";

  return {
    content: `[Stub response to: "${prompt.slice(0, 50)}${prompt.length > 50 ? "..." : ""}"]`,
    model: "stub",
    tokensUsed: estimateMessagesTokenCount(messages) + 20,
    finishReason: "stop",
  };
}

export function buildLocalStubStreamChunks(
  messages: ChatMessage[],
  model: string,
): StreamChunk[] {
  const response = buildLocalStubChatResponse(messages);
  const streamChunks: StreamChunk[] = [];

  if (response.reasoning) {
    streamChunks.push({ type: "reasoning", reasoning: response.reasoning });
  }

  if (response.content) {
    for (const word of response.content.split(" ")) {
      streamChunks.push({ type: "text", content: `${word} ` });
    }
  }

  streamChunks.push({ type: "done", model });
  return streamChunks;
}

export function parseLocalChatResponse(data: unknown): ChatResponse {
  const response = data as OpenAIChatResponse;
  const choice = response.choices[0];
  const parsedReasoning = parseLocalReasoningFromContent(
    choice.message.content,
  );
  const toolCalls = parseOpenAICompatibleToolCalls(choice.message.tool_calls);
  const finishReason =
    choice.finish_reason === "tool_calls" || (toolCalls?.length ?? 0) > 0
      ? "tool_calls"
      : mapOpenAICompatibleFinishReason(choice.finish_reason);

  return {
    content: parsedReasoning.content,
    model: response.model,
    tokensUsed:
      (response.usage?.prompt_tokens ?? 0) +
      (response.usage?.completion_tokens ?? 0),
    toolCalls,
    finishReason,
    reasoning: parsedReasoning.reasoning,
  };
}

export function parseLocalStreamLine(line: string): StreamChunk[] {
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

export function parseLocalModelsResponse(data: unknown): ModelInfo[] {
  const response = data as LocalModelsResponse;

  return response.data.map((model) => ({
    id: model.id,
    name: model.id,
    provider: "local",
    contextWindow: 4096,
    supportsTools: false,
    supportsVision: false,
    supportsStreaming: true,
  }));
}
