import type { ChatMessage as StoredChatMessage } from "../db/schema";
import type { ChatMessage as LLMChatMessage, ToolCall } from "./llm-service";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isToolCall(value: unknown): value is ToolCall {
  if (!isRecord(value)) {
    return false;
  }

  const toolFunction = value.function;
  return (
    value.type === "function" &&
    typeof value.id === "string" &&
    isRecord(toolFunction) &&
    typeof toolFunction.name === "string" &&
    typeof toolFunction.arguments === "string"
  );
}

function getToolCalls(value: unknown): ToolCall[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const toolCalls = value.filter(isToolCall);
  return toolCalls.length > 0 ? toolCalls : undefined;
}

function getToolCallId(metadata: unknown): string | undefined {
  if (!isRecord(metadata) || typeof metadata.toolCallId !== "string") {
    return undefined;
  }

  return metadata.toolCallId;
}

export function extractTextFromTipTap(node: Record<string, unknown>): string {
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }

  const childNodes = node.content ?? node.children;
  if (!Array.isArray(childNodes)) {
    return "";
  }

  const childText = childNodes
    .filter(isRecord)
    .map((childNode) => extractTextFromTipTap(childNode))
    .join("");

  const blockTypes = new Set([
    "paragraph",
    "heading",
    "blockquote",
    "listItem",
    "codeBlock",
    "bulletList",
    "orderedList",
  ]);

  if (typeof node.type === "string" && blockTypes.has(node.type)) {
    return `${childText}\n`;
  }

  return childText;
}

export function toLlmMessage(message: StoredChatMessage): LLMChatMessage {
  return {
    role: message.role,
    content: message.content,
    toolCalls: getToolCalls(message.toolCalls),
    toolCallId: getToolCallId(message.metadata),
  };
}

export function sanitizeMessageHistory(
  messages: LLMChatMessage[],
): LLMChatMessage[] {
  const sanitizedMessages: LLMChatMessage[] = [];
  let currentIndex = 0;

  while (currentIndex < messages.length) {
    const message = messages[currentIndex];

    if (
      message.role === "assistant" &&
      message.toolCalls &&
      message.toolCalls.length > 0
    ) {
      const expectedToolCallIds = new Set(
        message.toolCalls.map((toolCall) => toolCall.id),
      );
      const followingToolMessages: LLMChatMessage[] = [];
      let nextIndex = currentIndex + 1;

      while (
        nextIndex < messages.length &&
        messages[nextIndex]?.role === "tool"
      ) {
        followingToolMessages.push(messages[nextIndex]!);
        nextIndex++;
      }

      const returnedToolCallIds = new Set(
        followingToolMessages
          .map((toolMessage) => toolMessage.toolCallId)
          .filter((toolCallId): toolCallId is string => Boolean(toolCallId)),
      );

      const hasCompleteToolResults =
        expectedToolCallIds.size > 0 &&
        [...expectedToolCallIds].every((toolCallId) =>
          returnedToolCallIds.has(toolCallId),
        );

      if (hasCompleteToolResults) {
        sanitizedMessages.push(message, ...followingToolMessages);
      } else {
        console.warn(
          `⚠️ Dropping incomplete tool call sequence (${expectedToolCallIds.size} calls, ${returnedToolCallIds.size} results)`,
        );
      }

      currentIndex = nextIndex;
      continue;
    }

    sanitizedMessages.push(message);
    currentIndex++;
  }

  return sanitizedMessages;
}

export function estimateMessageCharacters(messages: LLMChatMessage[]): number {
  return messages.reduce((totalCharacters, message) => {
    if (typeof message.content !== "string") {
      return totalCharacters;
    }

    return totalCharacters + message.content.length;
  }, 0);
}

export function parseToolArguments(
  toolCall: ToolCall,
): Record<string, unknown> {
  const parsedArguments = JSON.parse(toolCall.function.arguments) as unknown;

  if (!isRecord(parsedArguments)) {
    throw new Error("Tool arguments must be a JSON object");
  }

  return parsedArguments;
}
