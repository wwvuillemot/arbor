import { db } from "../db/index";
import { chatThreads, type ChatThread } from "../db/schema";
import { desc, eq } from "drizzle-orm";

import type { CreateThreadParams, UpdateThreadParams } from "./chat-service";

function buildThreadUpdates(
  params: UpdateThreadParams,
): Record<string, unknown> {
  const threadUpdates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (params.name !== undefined) {
    threadUpdates.name = params.name;
  }
  if (params.agentMode !== undefined) {
    threadUpdates.agentMode = params.agentMode;
  }
  if (params.model !== undefined) {
    threadUpdates.model = params.model;
  }

  return threadUpdates;
}

export async function createChatThread(
  params: CreateThreadParams,
): Promise<ChatThread> {
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

export async function getChatThreadById(
  id: string,
): Promise<ChatThread | null> {
  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.id, id));

  return thread || null;
}

export async function listChatThreads(
  projectId?: string,
): Promise<ChatThread[]> {
  if (projectId) {
    return db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.projectId, projectId))
      .orderBy(desc(chatThreads.updatedAt));
  }

  return db.select().from(chatThreads).orderBy(desc(chatThreads.updatedAt));
}

export async function updateChatThread(
  id: string,
  params: UpdateThreadParams,
): Promise<ChatThread | null> {
  const [thread] = await db
    .update(chatThreads)
    .set(buildThreadUpdates(params))
    .where(eq(chatThreads.id, id))
    .returning();

  return thread || null;
}

export async function deleteChatThread(id: string): Promise<boolean> {
  const result = await db
    .delete(chatThreads)
    .where(eq(chatThreads.id, id))
    .returning({ id: chatThreads.id });

  return result.length > 0;
}
