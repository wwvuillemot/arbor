import type { ChatMessage, ToolCall } from "./llm-types";

export interface OpenAICompatibleToolCallPayload {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

export interface PartialOpenAICompatibleToolCallPayload {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

export interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAICompatibleToolCallPayload[];
  tool_call_id?: string;
}

export interface OpenAIChatResponse {
  model: string;
  choices: Array<{
    message: {
      content: string | null;
      reasoning_content?: string | null;
      tool_calls?: OpenAICompatibleToolCallPayload[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
}

export interface OpenAIStreamChunk {
  model?: string;
  choices?: Array<{
    delta: {
      content?: string;
      reasoning_content?: string;
      tool_calls?: PartialOpenAICompatibleToolCallPayload[];
    };
    finish_reason?: string;
  }>;
}

export function formatOpenAICompatibleMessages(
  messages: ChatMessage[],
  systemPrompt?: string,
): OpenAIMessage[] {
  const formattedMessages: OpenAIMessage[] = [];

  if (systemPrompt) {
    formattedMessages.push({ role: "system", content: systemPrompt });
  }

  for (const message of messages) {
    const formattedMessage: OpenAIMessage = {
      role: message.role,
      content: message.content ?? "",
    };

    if (message.toolCalls) {
      formattedMessage.tool_calls = message.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: "function",
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        },
      }));
    }

    if (message.toolCallId) {
      formattedMessage.tool_call_id = message.toolCallId;
    }

    formattedMessages.push(formattedMessage);
  }

  return formattedMessages;
}

export function parseOpenAICompatibleToolCalls(
  toolCalls?: OpenAICompatibleToolCallPayload[],
): ToolCall[] | undefined {
  return toolCalls?.map((toolCall) => ({
    id: toolCall.id,
    type: "function",
    function: {
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
    },
  }));
}

export function mapOpenAICompatibleFinishReason(
  reason?: string,
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
