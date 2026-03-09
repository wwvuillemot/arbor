import type { ChatThread } from "../db/schema";
import { buildSystemPromptWithContext } from "./chat-send-message-context";
import { createDefaultDependencies } from "./chat-send-message-defaults";
import {
  estimateMessageCharacters,
  sanitizeMessageHistory,
  toLlmMessage,
} from "./chat-send-message-helpers";
import { runChatToolLoop } from "./chat-send-message-tool-loop";
import { filterToolsForConfig } from "./agent-mode-helpers";
import type {
  ChatCompletionService,
  ChatSendMessageDependencies,
  SendMessageParams,
  SendMessageResult,
} from "./chat-send-message-types";
import type {
  ChatMessage as LLMChatMessage,
  ChatResponse,
} from "./llm-service";

export type {
  ChatCompletionService,
  ChatContextNodeService,
  ChatPersistenceService,
  ChatSendMessageDependencies,
  SendMessageParams,
  SendMessageResult,
} from "./chat-send-message-types";

const CONTEXT_COMPACTION_CHAR_THRESHOLD = 24_000;
const CONTEXT_COMPACTION_KEEP_RECENT_MESSAGES = 12;

export class ChatSendMessageService {
  constructor(
    private readonly dependencies: ChatSendMessageDependencies = createDefaultDependencies(),
  ) {}

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const { threadId, content, masterKey, projectId, contextNodeIds } = params;
    const thread = await this.dependencies.chatService.getThreadById(threadId);

    if (!thread) {
      throw new Error("Thread not found");
    }

    const fullHistory =
      await this.dependencies.chatService.getMessages(threadId);

    // If a previous compaction saved a summary message, use only that summary
    // and everything after it — the messages before it were already summarized
    // and should not be re-sent to the LLM.
    let lastSummaryIdx = -1;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
      if (
        (fullHistory[i]!.metadata as Record<string, unknown> | null)
          ?.isSummary === true
      ) {
        lastSummaryIdx = i;
        break;
      }
    }
    const history =
      lastSummaryIdx >= 0 ? fullHistory.slice(lastSummaryIdx) : fullHistory;

    const agentModeConfig = await this.dependencies.getAgentModeConfig(
      thread.agentMode,
    );

    if (!agentModeConfig) {
      throw new Error(`Unknown agent mode: ${thread.agentMode}`);
    }

    const systemPrompt = await buildSystemPromptWithContext({
      buildBaseSystemPrompt: this.dependencies.buildSystemPrompt,
      nodeService: this.dependencies.nodeService,
      thread,
      projectId,
      contextNodeIds,
    });
    // Persist user message immediately so it appears in the UI before the LLM responds.
    const userMessage = await this.dependencies.chatService.addMessage({
      threadId,
      role: "user",
      content,
    });

    const rawMessages = history.map((message) => toLlmMessage(message));
    let llmMessages = sanitizeMessageHistory(rawMessages);
    llmMessages.push({ role: "user", content });

    const llmService = await this.dependencies.initializeLLMService(
      masterKey,
      thread.model,
    );

    llmMessages = await this.compactContextIfNeeded({
      llmMessages,
      llmService,
      thread,
      threadId,
    });

    const supportsTemperature = thread.model
      ? await llmService.supportsTemperature(thread.model)
      : true;
    const allTools = await this.dependencies.getMcpTools();
    const tools = filterToolsForConfig(agentModeConfig, allTools);

    console.log(
      `🔧 Loaded ${tools.length}/${allTools.length} MCP tools for agent mode "${agentModeConfig.name}"`,
    );

    let response: ChatResponse;
    try {
      console.log(
        "🤖 Calling LLM with provider:",
        llmService.getActiveProvider().name,
        "model:",
        thread.model ?? "default",
        "temperature:",
        supportsTemperature
          ? agentModeConfig.temperature
          : "N/A (reasoning model)",
        "tools:",
        tools.length,
      );

      response = await llmService.chat(llmMessages, {
        model: thread.model ?? undefined,
        systemPrompt,
        temperature: supportsTemperature
          ? agentModeConfig.temperature
          : undefined,
        tools,
      });
      console.log(
        "✅ LLM response received:",
        response.content?.substring(0, 100) + "...",
        "finishReason:",
        response.finishReason,
      );
    } catch (error) {
      console.error("❌ LLM API call failed:", error);
      throw error;
    }

    const finalResponse = await runChatToolLoop({
      initialResponse: response,
      llmMessages,
      llmService,
      thread,
      threadId,
      systemPrompt,
      supportsTemperature,
      temperature: agentModeConfig.temperature,
      tools,
      chatService: this.dependencies.chatService,
      executeMcpTool: this.dependencies.executeMcpTool,
      masterKey,
    });

    const assistantMessage = await this.dependencies.chatService.addMessage({
      threadId,
      role: "assistant",
      content: finalResponse.content,
      model: finalResponse.model,
      tokensUsed: finalResponse.tokensUsed,
      toolCalls: finalResponse.toolCalls,
      metadata: {
        finishReason: finalResponse.finishReason,
        reasoning: finalResponse.reasoning,
        reasoningTokens: finalResponse.reasoningTokens,
        outputTokens: finalResponse.outputTokens,
        totalIterations: finalResponse.totalIterations,
      },
    });

    return { userMessage, assistantMessage };
  }

  private async compactContextIfNeeded({
    llmMessages,
    llmService,
    thread,
    threadId,
  }: {
    llmMessages: LLMChatMessage[];
    llmService: ChatCompletionService;
    thread: ChatThread;
    threadId: string;
  }): Promise<LLMChatMessage[]> {
    const systemMessages = llmMessages.filter(
      (message) => message.role === "system",
    );
    const nonSystemMessages = llmMessages.filter(
      (message) => message.role !== "system",
    );

    // If the first non-system message is a prior summary, measure only the
    // messages that have accumulated SINCE that summary (not the summary
    // itself). This prevents re-compacting immediately after a compaction
    // because the summary text alone pushes us over the threshold.
    const firstMessage = nonSystemMessages[0];
    const hasPriorSummary =
      firstMessage?.role === "assistant" &&
      typeof firstMessage.content === "string" &&
      firstMessage.content.startsWith("[Context summary");

    const messagesToMeasure = hasPriorSummary
      ? nonSystemMessages.slice(1)
      : nonSystemMessages;

    const shouldCompactContext =
      estimateMessageCharacters(messagesToMeasure) >
        CONTEXT_COMPACTION_CHAR_THRESHOLD &&
      messagesToMeasure.length > CONTEXT_COMPACTION_KEEP_RECENT_MESSAGES + 2;

    if (!shouldCompactContext) {
      return llmMessages;
    }

    const messagesToSummarize = nonSystemMessages.slice(
      0,
      nonSystemMessages.length - CONTEXT_COMPACTION_KEEP_RECENT_MESSAGES,
    );
    const recentMessages = nonSystemMessages.slice(
      nonSystemMessages.length - CONTEXT_COMPACTION_KEEP_RECENT_MESSAGES,
    );

    console.log(
      `📦 Compacting context: summarizing ${messagesToSummarize.length} messages, keeping ${recentMessages.length}`,
    );

    try {
      const summarySourceText = messagesToSummarize
        .filter(
          (message) => message.role === "user" || message.role === "assistant",
        )
        .map((message) => `${message.role}: ${message.content}`)
        .join("\n\n");

      // Use no specific model for summarization so the provider picks its default
      // (typically a non-reasoning, lower-cost model). This avoids doubling latency
      // when the thread model is a slow reasoning model.
      const summaryResponse = await llmService.chat(
        [
          {
            role: "user",
            content: `Summarize this conversation concisely, preserving key facts, decisions, and context:\n\n${summarySourceText}`,
          },
        ],
        {},
      );

      const summaryMessage: LLMChatMessage = {
        role: "assistant",
        content: `[Context summary of earlier conversation: ${summaryResponse.content}]`,
      };

      await this.dependencies.chatService.addMessage({
        threadId,
        role: "assistant",
        content: summaryMessage.content,
        metadata: { isSummary: true },
      });

      console.log(
        `✅ Context compacted. New message count: ${systemMessages.length + recentMessages.length + 1}`,
      );

      return [...systemMessages, summaryMessage, ...recentMessages];
    } catch (error) {
      console.warn(
        "⚠️ Context compaction failed, proceeding with full history:",
        error,
      );
      return llmMessages;
    }
  }
}
