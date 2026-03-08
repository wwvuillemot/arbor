import { db } from "../db/index";
import { chatMessages, chatThreads, type ChatMessage } from "../db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";

import type { CreateMessageParams } from "./chat-service";

export async function createChatMessage(
  params: CreateMessageParams,
): Promise<ChatMessage> {
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

  await db
    .update(chatThreads)
    .set({ updatedAt: new Date() })
    .where(eq(chatThreads.id, params.threadId));

  return message;
}

export async function listThreadMessages(
  threadId: string,
): Promise<ChatMessage[]> {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(asc(chatMessages.createdAt));
}

export async function getChatMessageById(
  id: string,
): Promise<ChatMessage | null> {
  const [message] = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, id));

  return message || null;
}

export async function deleteChatMessage(id: string): Promise<boolean> {
  const result = await db
    .delete(chatMessages)
    .where(eq(chatMessages.id, id))
    .returning({ id: chatMessages.id });

  return result.length > 0;
}

export async function countThreadMessages(threadId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId));

  return result?.count ?? 0;
}

export async function getThreadTokenUsageTotal(
  threadId: string,
): Promise<number> {
  const [result] = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(tokens_used), 0)::int`,
    })
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId));

  return result?.totalTokens ?? 0;
}

export async function getRecentThreadMessages(
  threadId: string,
  limit: number,
): Promise<ChatMessage[]> {
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  return messages.reverse();
}
