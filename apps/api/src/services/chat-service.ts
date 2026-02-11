import { db } from "../db/index";
import {
  chatThreads,
  chatMessages,
  type ChatThread,
  type ChatMessage,
  type AgentMode,
  type ChatRole,
} from "../db/schema";
import { eq, desc, and, asc, sql } from "drizzle-orm";

export interface CreateThreadParams {
  name: string;
  projectId?: string | null;
  agentMode?: AgentMode;
  model?: string | null;
}

export interface UpdateThreadParams {
  name?: string;
  agentMode?: AgentMode;
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

  /**
   * Create a new chat thread
   */
  async createThread(params: CreateThreadParams): Promise<ChatThread> {
    const [thread] = await db
      .insert(chatThreads)
      .values({
        name: params.name,
        projectId: params.projectId ?? null,
        agentMode: params.agentMode || "assistant",
        model: params.model ?? null,
      })
      .returning();

    return thread;
  }

  /**
   * Get a thread by ID
   */
  async getThreadById(id: string): Promise<ChatThread | null> {
    const [thread] = await db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.id, id));
    return thread || null;
  }

  /**
   * Get all threads, optionally filtered by project
   */
  async getThreads(projectId?: string): Promise<ChatThread[]> {
    if (projectId) {
      return db
        .select()
        .from(chatThreads)
        .where(eq(chatThreads.projectId, projectId))
        .orderBy(desc(chatThreads.updatedAt));
    }
    return db.select().from(chatThreads).orderBy(desc(chatThreads.updatedAt));
  }

  /**
   * Update a thread
   */
  async updateThread(
    id: string,
    params: UpdateThreadParams,
  ): Promise<ChatThread | null> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (params.name !== undefined) updates.name = params.name;
    if (params.agentMode !== undefined) updates.agentMode = params.agentMode;

    const [thread] = await db
      .update(chatThreads)
      .set(updates)
      .where(eq(chatThreads.id, id))
      .returning();

    return thread || null;
  }

  /**
   * Delete a thread (cascade deletes messages)
   */
  async deleteThread(id: string): Promise<boolean> {
    const result = await db
      .delete(chatThreads)
      .where(eq(chatThreads.id, id))
      .returning({ id: chatThreads.id });
    return result.length > 0;
  }

  // ─── Message Operations ──────────────────────────────────────────────

  /**
   * Add a message to a thread
   */
  async addMessage(params: CreateMessageParams): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values({
        threadId: params.threadId,
        role: params.role,
        content: params.content ?? null,
        model: params.model ?? null,
        tokensUsed: params.tokensUsed ?? null,
        toolCalls: params.toolCalls ?? null,
        metadata: params.metadata ?? {},
      })
      .returning();

    // Update thread's updatedAt timestamp
    await db
      .update(chatThreads)
      .set({ updatedAt: new Date() })
      .where(eq(chatThreads.id, params.threadId));

    return message;
  }

  /**
   * Get all messages in a thread, ordered by creation time
   */
  async getMessages(threadId: string): Promise<ChatMessage[]> {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(asc(chatMessages.createdAt));
  }

  /**
   * Get a message by ID
   */
  async getMessageById(id: string): Promise<ChatMessage | null> {
    const [message] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, id));
    return message || null;
  }

  /**
   * Delete a message by ID
   */
  async deleteMessage(id: string): Promise<boolean> {
    const result = await db
      .delete(chatMessages)
      .where(eq(chatMessages.id, id))
      .returning({ id: chatMessages.id });
    return result.length > 0;
  }

  /**
   * Count messages in a thread
   */
  async countMessages(threadId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId));
    return result?.count ?? 0;
  }

  /**
   * Get total tokens used in a thread
   */
  async getThreadTokenUsage(threadId: string): Promise<number> {
    const [result] = await db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(tokens_used), 0)::int`,
      })
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId));
    return result?.totalTokens ?? 0;
  }

  /**
   * Get the last N messages from a thread (for context window)
   */
  async getRecentMessages(
    threadId: string,
    limit: number = 20,
  ): Promise<ChatMessage[]> {
    // Get last N messages in reverse order, then reverse for chronological order
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return messages.reverse();
  }
}
