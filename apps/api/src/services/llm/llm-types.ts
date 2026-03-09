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
  reasoning?: string | null;
  reasoningTokens?: number;
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
  supportsReasoning?: boolean;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<StreamChunk>;
  models(): Promise<ModelInfo[]>;
  countTokens(messages: ChatMessage[]): number;
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateMessagesTokenCount(messages: ChatMessage[]): number {
  let tokenCount = 0;
  for (const message of messages) {
    tokenCount += 4;
    if (message.content) {
      tokenCount += estimateTokenCount(message.content);
    }
    if (message.toolCalls) {
      for (const toolCall of message.toolCalls) {
        tokenCount += estimateTokenCount(toolCall.function.name);
        tokenCount += estimateTokenCount(toolCall.function.arguments);
        tokenCount += 4;
      }
    }
  }
  return tokenCount;
}
