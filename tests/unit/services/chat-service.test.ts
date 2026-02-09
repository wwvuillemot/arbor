import { describe, it, expect } from "vitest";
import { ChatService } from "@/services/chat-service";
import { createTestProject } from "@tests/helpers/fixtures";

describe("ChatService", () => {
  const chatService = new ChatService();

  // ─── Thread CRUD ─────────────────────────────────────────────────────

  describe("createThread", () => {
    it("should create a thread with only a name", async () => {
      const thread = await chatService.createThread({ name: "New Chat" });

      expect(thread).toBeDefined();
      expect(thread.id).toBeDefined();
      expect(thread.name).toBe("New Chat");
      expect(thread.agentMode).toBe("assistant");
      expect(thread.projectId).toBeNull();
      expect(thread.createdAt).toBeDefined();
      expect(thread.updatedAt).toBeDefined();
    });

    it("should create a thread linked to a project", async () => {
      const project = await createTestProject("Chat Project");
      const thread = await chatService.createThread({
        name: "Project Chat",
        projectId: project.id,
      });

      expect(thread.name).toBe("Project Chat");
      expect(thread.projectId).toBe(project.id);
    });

    it("should create a thread with a specific agent mode", async () => {
      const thread = await chatService.createThread({
        name: "Planning Chat",
        agentMode: "planner",
      });

      expect(thread.agentMode).toBe("planner");
    });

    it("should create threads with all agent modes", async () => {
      const modes = ["assistant", "planner", "editor", "researcher"] as const;
      for (const mode of modes) {
        const thread = await chatService.createThread({
          name: `${mode} chat`,
          agentMode: mode,
        });
        expect(thread.agentMode).toBe(mode);
      }
    });
  });

  describe("getThreadById", () => {
    it("should return a thread by ID", async () => {
      const created = await chatService.createThread({ name: "Find Me" });
      const found = await chatService.getThreadById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe("Find Me");
    });

    it("should return null for non-existent thread", async () => {
      const found = await chatService.getThreadById(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeNull();
    });
  });

  describe("getThreads", () => {
    it("should return all threads ordered by updatedAt desc", async () => {
      await chatService.createThread({ name: "Thread A" });
      await chatService.createThread({ name: "Thread B" });
      await chatService.createThread({ name: "Thread C" });

      const threads = await chatService.getThreads();
      expect(threads).toHaveLength(3);
      // Most recently created should be first
      expect(threads[0].name).toBe("Thread C");
    });

    it("should filter threads by project ID", async () => {
      const projectA = await createTestProject("Project A");
      const projectB = await createTestProject("Project B");

      await chatService.createThread({
        name: "Chat A1",
        projectId: projectA.id,
      });
      await chatService.createThread({
        name: "Chat A2",
        projectId: projectA.id,
      });
      await chatService.createThread({
        name: "Chat B1",
        projectId: projectB.id,
      });

      const threadsA = await chatService.getThreads(projectA.id);
      expect(threadsA).toHaveLength(2);
      expect(threadsA.every((t) => t.projectId === projectA.id)).toBe(true);

      const threadsB = await chatService.getThreads(projectB.id);
      expect(threadsB).toHaveLength(1);
    });

    it("should return empty array when no threads exist", async () => {
      const threads = await chatService.getThreads();
      expect(threads).toHaveLength(0);
    });
  });

  describe("updateThread", () => {
    it("should update thread name", async () => {
      const thread = await chatService.createThread({ name: "Original" });
      const updated = await chatService.updateThread(thread.id, {
        name: "Updated",
      });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe("Updated");
    });

    it("should update agent mode", async () => {
      const thread = await chatService.createThread({ name: "Mode Test" });
      const updated = await chatService.updateThread(thread.id, {
        agentMode: "editor",
      });

      expect(updated!.agentMode).toBe("editor");
    });

    it("should update updatedAt on change", async () => {
      const thread = await chatService.createThread({ name: "Timestamp" });
      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = await chatService.updateThread(thread.id, {
        name: "Changed",
      });

      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        thread.updatedAt.getTime(),
      );
    });

    it("should return null for non-existent thread", async () => {
      const result = await chatService.updateThread(
        "00000000-0000-0000-0000-000000000000",
        { name: "Ghost" },
      );
      expect(result).toBeNull();
    });
  });

  describe("deleteThread", () => {
    it("should delete a thread", async () => {
      const thread = await chatService.createThread({ name: "Delete Me" });
      const deleted = await chatService.deleteThread(thread.id);

      expect(deleted).toBe(true);

      const found = await chatService.getThreadById(thread.id);
      expect(found).toBeNull();
    });

    it("should cascade delete messages when thread is deleted", async () => {
      const thread = await chatService.createThread({ name: "Cascade" });
      await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "Hello",
      });
      await chatService.addMessage({
        threadId: thread.id,
        role: "assistant",
        content: "Hi there!",
      });

      const messagesBefore = await chatService.getMessages(thread.id);
      expect(messagesBefore).toHaveLength(2);

      await chatService.deleteThread(thread.id);

      const messagesAfter = await chatService.getMessages(thread.id);
      expect(messagesAfter).toHaveLength(0);
    });

    it("should return false for non-existent thread", async () => {
      const deleted = await chatService.deleteThread(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(deleted).toBe(false);
    });
  });

  // ─── Message CRUD ────────────────────────────────────────────────────

  describe("addMessage", () => {
    it("should add a user message", async () => {
      const thread = await chatService.createThread({ name: "Msg Test" });
      const message = await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "Hello, AI!",
      });

      expect(message).toBeDefined();
      expect(message.id).toBeDefined();
      expect(message.threadId).toBe(thread.id);
      expect(message.role).toBe("user");
      expect(message.content).toBe("Hello, AI!");
      expect(message.model).toBeNull();
      expect(message.tokensUsed).toBeNull();
      expect(message.createdAt).toBeDefined();
    });

    it("should add an assistant message with model info", async () => {
      const thread = await chatService.createThread({ name: "AI Msg" });
      const message = await chatService.addMessage({
        threadId: thread.id,
        role: "assistant",
        content: "Hello! How can I help?",
        model: "gpt-4o",
        tokensUsed: 150,
      });

      expect(message.role).toBe("assistant");
      expect(message.model).toBe("gpt-4o");
      expect(message.tokensUsed).toBe(150);
    });

    it("should add a message with tool calls", async () => {
      const thread = await chatService.createThread({ name: "Tool Call" });
      const toolCalls = [
        {
          id: "call_123",
          type: "function",
          function: { name: "search_nodes", arguments: '{"query":"hero"}' },
        },
      ];
      const message = await chatService.addMessage({
        threadId: thread.id,
        role: "assistant",
        content: null,
        toolCalls,
      });

      expect(message.toolCalls).toEqual(toolCalls);
    });

    it("should add a system message", async () => {
      const thread = await chatService.createThread({ name: "System" });
      const message = await chatService.addMessage({
        threadId: thread.id,
        role: "system",
        content: "You are a helpful writing assistant.",
      });

      expect(message.role).toBe("system");
    });

    it("should add a tool result message", async () => {
      const thread = await chatService.createThread({ name: "Tool Result" });
      const message = await chatService.addMessage({
        threadId: thread.id,
        role: "tool",
        content: '{"results": []}',
        metadata: { toolCallId: "call_123" },
      });

      expect(message.role).toBe("tool");
      expect(message.metadata).toEqual({ toolCallId: "call_123" });
    });

    it("should update thread updatedAt when message is added", async () => {
      const thread = await chatService.createThread({ name: "TS Update" });
      await new Promise((resolve) => setTimeout(resolve, 10));

      await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "Trigger update",
      });

      const updatedThread = await chatService.getThreadById(thread.id);
      expect(updatedThread!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        thread.updatedAt.getTime(),
      );
    });
  });

  describe("getMessages", () => {
    it("should return messages in chronological order", async () => {
      const thread = await chatService.createThread({ name: "Order Test" });
      await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "First",
      });
      await chatService.addMessage({
        threadId: thread.id,
        role: "assistant",
        content: "Second",
      });
      await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "Third",
      });

      const messages = await chatService.getMessages(thread.id);
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe("First");
      expect(messages[1].content).toBe("Second");
      expect(messages[2].content).toBe("Third");
    });

    it("should return empty array for thread with no messages", async () => {
      const thread = await chatService.createThread({ name: "Empty" });
      const messages = await chatService.getMessages(thread.id);
      expect(messages).toHaveLength(0);
    });
  });

  describe("getMessageById", () => {
    it("should return a message by ID", async () => {
      const thread = await chatService.createThread({ name: "Find Msg" });
      const created = await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "Find me",
      });

      const found = await chatService.getMessageById(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.content).toBe("Find me");
    });

    it("should return null for non-existent message", async () => {
      const found = await chatService.getMessageById(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(found).toBeNull();
    });
  });

  describe("deleteMessage", () => {
    it("should delete a message", async () => {
      const thread = await chatService.createThread({ name: "Del Msg" });
      const message = await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "Delete me",
      });

      const deleted = await chatService.deleteMessage(message.id);
      expect(deleted).toBe(true);

      const found = await chatService.getMessageById(message.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent message", async () => {
      const deleted = await chatService.deleteMessage(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(deleted).toBe(false);
    });
  });

  describe("countMessages", () => {
    it("should count messages in a thread", async () => {
      const thread = await chatService.createThread({ name: "Count" });
      await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "One",
      });
      await chatService.addMessage({
        threadId: thread.id,
        role: "assistant",
        content: "Two",
      });

      const messageCount = await chatService.countMessages(thread.id);
      expect(messageCount).toBe(2);
    });

    it("should return 0 for empty thread", async () => {
      const thread = await chatService.createThread({ name: "Zero" });
      const messageCount = await chatService.countMessages(thread.id);
      expect(messageCount).toBe(0);
    });
  });

  describe("getThreadTokenUsage", () => {
    it("should sum tokens across messages", async () => {
      const thread = await chatService.createThread({ name: "Tokens" });
      await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "Hello",
        tokensUsed: 10,
      });
      await chatService.addMessage({
        threadId: thread.id,
        role: "assistant",
        content: "World",
        tokensUsed: 50,
      });
      await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "More",
        tokensUsed: 15,
      });

      const totalTokens = await chatService.getThreadTokenUsage(thread.id);
      expect(totalTokens).toBe(75);
    });

    it("should return 0 when no tokens tracked", async () => {
      const thread = await chatService.createThread({ name: "No Tokens" });
      await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "No tokens",
      });

      const totalTokens = await chatService.getThreadTokenUsage(thread.id);
      expect(totalTokens).toBe(0);
    });
  });

  describe("getRecentMessages", () => {
    it("should return last N messages in chronological order", async () => {
      const thread = await chatService.createThread({ name: "Recent" });
      for (let i = 1; i <= 5; i++) {
        await chatService.addMessage({
          threadId: thread.id,
          role: i % 2 === 1 ? "user" : "assistant",
          content: `Message ${i}`,
        });
      }

      const recent = await chatService.getRecentMessages(thread.id, 3);
      expect(recent).toHaveLength(3);
      expect(recent[0].content).toBe("Message 3");
      expect(recent[1].content).toBe("Message 4");
      expect(recent[2].content).toBe("Message 5");
    });

    it("should return all messages if less than limit", async () => {
      const thread = await chatService.createThread({ name: "Few" });
      await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "Only one",
      });

      const recent = await chatService.getRecentMessages(thread.id, 10);
      expect(recent).toHaveLength(1);
      expect(recent[0].content).toBe("Only one");
    });
  });

  // ─── Cascade Behavior ───────────────────────────────────────────────

  describe("project cascade", () => {
    it("should delete threads when project is deleted", async () => {
      const project = await createTestProject("Cascade Project");
      const thread = await chatService.createThread({
        name: "Will be deleted",
        projectId: project.id,
      });
      await chatService.addMessage({
        threadId: thread.id,
        role: "user",
        content: "Goodbye",
      });

      // Delete project directly via DB to trigger cascade
      const { db } = await import("@/db/index");
      const { nodes } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(nodes).where(eq(nodes.id, project.id));

      // Thread and messages should be gone
      const foundThread = await chatService.getThreadById(thread.id);
      expect(foundThread).toBeNull();
    });
  });
});
