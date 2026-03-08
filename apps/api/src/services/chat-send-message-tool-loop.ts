import type { ChatThread } from "../db/schema";
import { parseToolArguments } from "./chat-send-message-helpers";
import type {
  ChatCompletionService,
  ChatPersistenceService,
  ChatSendMessageDependencies,
} from "./chat-send-message-types";
import type {
  ChatMessage as LLMChatMessage,
  ChatResponse,
  ToolDefinition,
} from "./llm-service";

const MAX_TOOL_ITERATIONS = 10;

interface RunChatToolLoopParams {
  initialResponse: ChatResponse;
  llmMessages: LLMChatMessage[];
  llmService: ChatCompletionService;
  thread: ChatThread;
  threadId: string;
  systemPrompt: string;
  supportsTemperature: boolean;
  temperature: number;
  tools: ToolDefinition[];
  chatService: ChatPersistenceService;
  executeMcpTool: ChatSendMessageDependencies["executeMcpTool"];
}

function buildToolErrorResult(toolName: string, error: unknown): string {
  return JSON.stringify({
    error: error instanceof Error ? error.message : "Unknown error",
    toolName,
  });
}

export async function runChatToolLoop({
  initialResponse,
  llmMessages,
  llmService,
  thread,
  threadId,
  systemPrompt,
  supportsTemperature,
  temperature,
  tools,
  chatService,
  executeMcpTool,
}: RunChatToolLoopParams): Promise<ChatResponse & { totalIterations: number }> {
  let iteration = 0;
  let finalResponse = initialResponse;

  while (iteration < MAX_TOOL_ITERATIONS) {
    const toolCalls = finalResponse.toolCalls ?? [];
    const hasToolCalls =
      finalResponse.finishReason === "tool_calls" && toolCalls.length > 0;

    if (!hasToolCalls) {
      break;
    }

    console.log(
      `🔄 Iteration ${iteration + 1}: LLM requested ${toolCalls.length} tool calls`,
    );

    await chatService.addMessage({
      threadId,
      role: "assistant",
      content: finalResponse.content,
      model: finalResponse.model,
      tokensUsed: finalResponse.tokensUsed,
      toolCalls: finalResponse.toolCalls,
      metadata: {
        finishReason: finalResponse.finishReason,
        iteration,
      },
    });

    llmMessages.push({
      role: "assistant",
      content: finalResponse.content,
      toolCalls: finalResponse.toolCalls,
    });

    for (const toolCall of toolCalls) {
      console.log(`🔧 Executing tool: ${toolCall.function.name}`);

      try {
        const toolArguments = parseToolArguments(toolCall);
        const toolResult = await executeMcpTool(
          toolCall.function.name,
          toolArguments,
        );

        console.log(`✅ Tool ${toolCall.function.name} executed successfully`);

        await chatService.addMessage({
          threadId,
          role: "tool",
          content: toolResult,
          metadata: {
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
          },
        });

        llmMessages.push({
          role: "tool",
          content: toolResult,
          toolCallId: toolCall.id,
        });
      } catch (error) {
        console.error(`❌ Tool ${toolCall.function.name} failed:`, error);

        const errorResult = buildToolErrorResult(toolCall.function.name, error);

        await chatService.addMessage({
          threadId,
          role: "tool",
          content: errorResult,
          metadata: {
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            error: true,
          },
        });

        llmMessages.push({
          role: "tool",
          content: errorResult,
          toolCallId: toolCall.id,
        });
      }
    }

    iteration++;

    try {
      finalResponse = await llmService.chat(llmMessages, {
        model: thread.model ?? undefined,
        systemPrompt,
        temperature: supportsTemperature ? temperature : undefined,
        tools,
      });
      console.log(
        `✅ Iteration ${iteration} response received, finishReason: ${finalResponse.finishReason}`,
      );
    } catch (error) {
      console.error(`❌ LLM call failed in iteration ${iteration}:`, error);
      break;
    }
  }

  if (iteration >= MAX_TOOL_ITERATIONS) {
    console.warn(
      `⚠️ Reached maximum iterations (${MAX_TOOL_ITERATIONS}), stopping tool execution loop`,
    );
  }

  return {
    ...finalResponse,
    totalIterations: iteration,
  };
}
