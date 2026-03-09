import {
  type ChatThread,
  type ChatMessage,
  type AgentMode,
  type ChatRole,
} from "../db/schema";
import {
  createChatMessage,
  getChatMessageById,
  deleteChatMessage,
  listThreadMessages,
  countThreadMessages,
  getThreadTokenUsageTotal,
  getRecentThreadMessages,
} from "./chat-service-messages";
import {
  createChatThread,
  deleteChatThread,
  getChatThreadById,
  listChatThreads,
  updateChatThread,
} from "./chat-service-threads";

export interface CreateThreadParams {
  name: string;
  projectId?: string | null;
  agentMode?: AgentMode;
  model?: string | null;
}

export interface UpdateThreadParams {
  name?: string;
  agentMode?: AgentMode;
  model?: string | null;
}

export interface CreateMessageParams {
  threadId: string;
  role: ChatRole;
  content?: string | null;
  model?: string | null;
  tokensUsed?: number | null;
  toolCalls?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * ChatService
 *
 * Manages chat threads and messages for the LLM chat system.
 * Threads can be linked to projects and have different agent modes.
 */
export class ChatService {
  // ─── Thread Operations ───────────────────────────────────────────────
  async createThread(params: CreateThreadParams): Promise<ChatThread> {
    return createChatThread(params);
  }

  async getThreadById(id: string): Promise<ChatThread | null> {
    return getChatThreadById(id);
  }

  async getThreads(projectId?: string): Promise<ChatThread[]> {
    return listChatThreads(projectId);
  }

  async updateThread(
    id: string,
    params: UpdateThreadParams,
  ): Promise<ChatThread | null> {
    return updateChatThread(id, params);
  }

  async deleteThread(id: string): Promise<boolean> {
    return deleteChatThread(id);
  }

  // ─── Message Operations ──────────────────────────────────────────────

  async addMessage(params: CreateMessageParams): Promise<ChatMessage> {
    return createChatMessage(params);
  }

  async getMessages(threadId: string): Promise<ChatMessage[]> {
    return listThreadMessages(threadId);
  }

  async getMessageById(id: string): Promise<ChatMessage | null> {
    return getChatMessageById(id);
  }

  async deleteMessage(id: string): Promise<boolean> {
    return deleteChatMessage(id);
  }

  async countMessages(threadId: string): Promise<number> {
    return countThreadMessages(threadId);
  }

  async getThreadTokenUsage(threadId: string): Promise<number> {
    return getThreadTokenUsageTotal(threadId);
  }

  async getRecentMessages(
    threadId: string,
    limit: number = 20,
  ): Promise<ChatMessage[]> {
    return getRecentThreadMessages(threadId, limit);
  }
}
