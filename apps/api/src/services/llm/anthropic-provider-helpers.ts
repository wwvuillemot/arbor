import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ToolCall,
} from "./llm-types";

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
    thinking?: string;
    id?: string;
    name?: string;
    input?: unknown;
  }>;
  stop_reason: string;
  usage?: { input_tokens: number; output_tokens: number };
}

interface AnthropicStreamEvent {
  type: string;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function buildAnthropicRequestBody(
  messages: ChatMessage[],
  model: string,
  options?: ChatOptions,
  stream = false,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: formatAnthropicMessages(messages),
    max_tokens: options?.maxTokens || 4096,
  };

  if (stream) body.stream = true;
  if (options?.systemPrompt) body.system = options.systemPrompt;
  if (options?.temperature !== undefined)
    body.temperature = options.temperature;
  if (options?.tools && options.tools.length > 0) {
    body.tools = options.tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));
  }
  if (options?.stopSequences) body.stop_sequences = options.stopSequences;

  return body;
}

export function parseAnthropicChatResponse(data: unknown): ChatResponse {
  const response = data as AnthropicResponse;
  let content: string | null = null;
  let reasoning: string | null = null;
  const toolCalls: ToolCall[] = [];

  for (const block of response.content) {
    if (block.type === "thinking" && block.thinking) {
      reasoning = (reasoning || "") + block.thinking;
    } else if (block.type === "text") {
      content = (content || "") + block.text;
    } else if (block.type === "tool_use" && block.id && block.name) {
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
    model: response.model,
    tokensUsed:
      (response.usage?.input_tokens ?? 0) +
      (response.usage?.output_tokens ?? 0),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    finishReason: response.stop_reason === "tool_use" ? "tool_calls" : "stop",
    reasoning,
  };
}

export function parseAnthropicStreamLine(
  line: string,
  model: string,
): StreamChunk[] {
  const trimmedLine = line.trim();
  if (!trimmedLine || !trimmedLine.startsWith("data: ")) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmedLine.slice(6)) as AnthropicStreamEvent;

    if (parsed.type === "content_block_delta") {
      if (parsed.delta?.type === "thinking_delta" && parsed.delta.thinking) {
        return [{ type: "reasoning", reasoning: parsed.delta.thinking }];
      }
      if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
        return [{ type: "text", content: parsed.delta.text }];
      }
      if (
        parsed.delta?.type === "input_json_delta" &&
        parsed.delta.partial_json
      ) {
        return [
          {
            type: "tool_call",
            toolCall: {
              function: { name: "", arguments: parsed.delta.partial_json },
            },
          },
        ];
      }
      return [];
    }

    if (parsed.type === "message_stop") {
      return [{ type: "done", model }];
    }

    if (parsed.type === "message_delta" && parsed.usage) {
      return [
        {
          type: "done",
          tokensUsed:
            (parsed.usage.input_tokens ?? 0) +
            (parsed.usage.output_tokens ?? 0),
          finishReason: parsed.delta?.stop_reason || "stop",
          model,
        },
      ];
    }

    return [];
  } catch {
    return [];
  }
}

function formatAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      if (message.role === "tool") {
        return {
          role: "user" as const,
          content: [
            {
              type: "tool_result" as const,
              tool_use_id: message.toolCallId || "",
              content: message.content || "",
            },
          ],
        };
      }

      const contentBlocks: AnthropicContentBlock[] = [];
      if (message.content) {
        contentBlocks.push({ type: "text", text: message.content });
      }
      if (message.toolCalls) {
        for (const toolCall of message.toolCalls) {
          contentBlocks.push({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments),
          });
        }
      }

      return {
        role:
          message.role === "assistant"
            ? ("assistant" as const)
            : ("user" as const),
        content:
          contentBlocks.length === 1 && contentBlocks[0].type === "text"
            ? contentBlocks[0].text
            : contentBlocks,
      };
    });
}
