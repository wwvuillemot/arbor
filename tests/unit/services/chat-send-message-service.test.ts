import { describe, expect, it, vi } from "vitest";
import type { ChatMessage as StoredChatMessage, ChatThread } from "@/db/schema";
import {
  ChatSendMessageService,
  type ChatCompletionService,
  type ChatContextNodeService,
  type ChatPersistenceService,
  type ChatSendMessageDependencies,
} from "@/services/chat-send-message-service";
import type {
  ChatMessage as LlmChatMessage,
  ChatResponse,
  ToolCall,
  ToolDefinition,
} from "@/services/llm-service";
import type { AgentModeConfig } from "@/services/agent-mode-types";

type ContextNodeRecord = NonNullable<
  Awaited<ReturnType<ChatContextNodeService["getNodeById"]>>
>;
type ChatRequestOptions = Parameters<ChatCompletionService["chat"]>[1];

function createThreadRecord(overrides: Partial<ChatThread> = {}): ChatThread {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: null,
    name: "Test Thread",
    agentMode: "assistant",
    model: "gpt-4o-mini",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createStoredMessage(
  overrides: Partial<StoredChatMessage> = {},
): StoredChatMessage {
  return {
    id: `message-${Math.random().toString(36).slice(2)}`,
    threadId: "11111111-1111-4111-8111-111111111111",
    role: "user",
    content: null,
    model: null,
    tokensUsed: null,
    toolCalls: null,
    metadata: {},
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createChatResponse(
  overrides: Partial<ChatResponse> = {},
): ChatResponse {
  return {
    content: "Assistant reply",
    model: "gpt-4o-mini",
    tokensUsed: 64,
    finishReason: "stop",
    ...overrides,
  };
}

function cloneToolCall(toolCall: ToolCall): ToolCall {
  return {
    ...toolCall,
    function: { ...toolCall.function },
  };
}

function cloneLlmMessage(message: LlmChatMessage): LlmChatMessage {
  return {
    ...message,
    toolCalls: message.toolCalls?.map(cloneToolCall),
  };
}

function cloneChatOptions(
  options?: ChatRequestOptions,
): ChatRequestOptions | undefined {
  if (!options) {
    return undefined;
  }

  return {
    ...options,
    tools: options.tools?.map((tool) => ({
      ...tool,
      function: {
        ...tool.function,
        parameters: { ...tool.function.parameters },
      },
    })),
  };
}

function createContextNodeRecord(
  overrides: Partial<ContextNodeRecord>,
): ContextNodeRecord {
  return {
    id: "node-1",
    name: "Node",
    type: "note",
    parentId: null,
    content: null,
    ...overrides,
  };
}

function createAgentModeConfig(
  overrides: Partial<AgentModeConfig> = {},
): AgentModeConfig {
  return {
    id: "assistant",
    name: "assistant",
    displayName: "Assistant",
    description: "General-purpose assistant",
    allowedTools: [],
    guidelines: "",
    temperature: 0.7,
    isBuiltIn: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function createToolDefinition(name: string): ToolDefinition {
  return {
    type: "function",
    function: {
      name,
      description: `Tool: ${name}`,
      parameters: { type: "object", properties: {} },
    },
  };
}

function createServiceHarness(options?: {
  thread?: ChatThread;
  history?: StoredChatMessage[];
  llmResponses?: ChatResponse[];
  supportsTemperature?: boolean;
  nodesById?: Record<string, ContextNodeRecord>;
  descendantsByNodeId?: Record<string, ContextNodeRecord[]>;
  tools?: ToolDefinition[];
  toolResultsByName?: Record<string, string>;
  agentModeConfig?: Partial<AgentModeConfig>;
}) {
  const thread = options?.thread ?? createThreadRecord();
  const storedMessages = [...(options?.history ?? [])];
  const llmResponses = [...(options?.llmResponses ?? [createChatResponse()])];
  const llmChatCalls: Array<{
    messages: LlmChatMessage[];
    options?: ChatRequestOptions;
  }> = [];
  let createdMessageCount = 0;

  const chatService: ChatPersistenceService = {
    getThreadById: vi.fn(async (threadId: string) => {
      return threadId === thread.id ? thread : null;
    }),
    getMessages: vi.fn(async () => [...storedMessages]),
    addMessage: vi.fn(async (params) => {
      createdMessageCount += 1;
      const storedMessage = createStoredMessage({
        id: `generated-message-${createdMessageCount}`,
        threadId: params.threadId,
        role: params.role,
        content: params.content ?? null,
        model: params.model ?? null,
        tokensUsed: params.tokensUsed ?? null,
        toolCalls: params.toolCalls ?? null,
        metadata: params.metadata ?? {},
      });
      storedMessages.push(storedMessage);
      return storedMessage;
    }),
  };

  const nodeService: ChatContextNodeService = {
    getNodeById: vi.fn(
      async (nodeId: string) => options?.nodesById?.[nodeId] ?? null,
    ),
    getDescendants: vi.fn(
      async (nodeId: string) => options?.descendantsByNodeId?.[nodeId] ?? [],
    ),
  };

  const llmService: ChatCompletionService = {
    chat: vi.fn(async (messages, requestOptions) => {
      llmChatCalls.push({
        messages: messages.map(cloneLlmMessage),
        options: cloneChatOptions(requestOptions),
      });
      const nextResponse = llmResponses.shift();
      if (!nextResponse) {
        throw new Error("Unexpected LLM chat call");
      }
      return nextResponse;
    }),
    getActiveProvider: vi.fn(() => ({ name: "test-provider" })),
    supportsTemperature: vi.fn(
      async () => options?.supportsTemperature ?? true,
    ),
  };

  const executeMcpTool = vi.fn(
    async (toolName: string, args: Record<string, unknown>) => {
      return (
        options?.toolResultsByName?.[toolName] ??
        JSON.stringify({ toolName, args })
      );
    },
  );

  const toolNames = (options?.tools ?? []).map((t) => t.function.name);
  const resolvedAgentModeConfig = createAgentModeConfig({
    // Default: allow all provided tools so existing tests are unaffected
    allowedTools: toolNames,
    ...options?.agentModeConfig,
  });

  const dependencies: ChatSendMessageDependencies = {
    chatService,
    nodeService,
    getAgentModeConfig: vi.fn(async () => resolvedAgentModeConfig),
    buildSystemPrompt: vi.fn(async (mode: string) => `Base prompt for ${mode}`),
    initializeLLMService: vi.fn(async () => llmService),
    getMcpTools: vi.fn(async () => options?.tools ?? []),
    executeMcpTool,
  };

  return {
    dependencies,
    executeMcpTool,
    llmChatCalls,
    llmService,
    service: new ChatSendMessageService(dependencies),
    storedMessages,
    thread,
  };
}

describe("ChatSendMessageService", () => {
  it("builds the system prompt with project outline and pinned node context", async () => {
    const projectId = "22222222-2222-4222-8222-222222222222";
    const contextNodeId = "33333333-3333-4333-8333-333333333333";

    const harness = createServiceHarness({
      nodesById: {
        [projectId]: createContextNodeRecord({
          id: projectId,
          name: "Story Project",
          type: "project",
        }),
        [contextNodeId]: createContextNodeRecord({
          id: contextNodeId,
          name: "Pinned Scene",
          type: "note",
          parentId: projectId,
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Pinned context text" }],
              },
            ],
          },
        }),
      },
      descendantsByNodeId: {
        [projectId]: [
          createContextNodeRecord({
            id: "folder-1",
            name: "Characters",
            type: "folder",
            parentId: projectId,
          }),
          createContextNodeRecord({
            id: "note-1",
            name: "Lead Hero",
            type: "note",
            parentId: "folder-1",
          }),
        ],
      },
    });

    const result = await harness.service.sendMessage({
      threadId: harness.thread.id,
      content: "Help me outline this story",
      masterKey: "test-master-key",
      projectId,
      contextNodeIds: [contextNodeId],
    });

    expect(result.userMessage.content).toBe("Help me outline this story");
    expect(result.assistantMessage.content).toBe("Assistant reply");
    expect(harness.llmChatCalls).toHaveLength(1);
    expect(harness.llmChatCalls[0]?.options?.systemPrompt).toContain(
      "Base prompt for assistant",
    );
    expect(harness.llmChatCalls[0]?.options?.systemPrompt).toContain(
      "Current Project Context",
    );
    expect(harness.llmChatCalls[0]?.options?.systemPrompt).toContain(
      "Story Project",
    );
    expect(harness.llmChatCalls[0]?.options?.systemPrompt).toContain(
      "- [folder] Characters",
    );
    expect(harness.llmChatCalls[0]?.options?.systemPrompt).toContain(
      "### Pinned Scene (note)",
    );
    expect(harness.llmChatCalls[0]?.options?.systemPrompt).toContain(
      "Pinned context text",
    );
    expect(harness.llmChatCalls[0]?.messages.at(-1)?.content).toBe(
      "Help me outline this story",
    );
  });

  it("drops incomplete historical tool-call sequences before invoking the LLM", async () => {
    const danglingToolCall: ToolCall = {
      id: "call-1",
      type: "function",
      function: {
        name: "search_nodes",
        arguments: '{"query":"hero"}',
      },
    };

    const history = [
      createStoredMessage({ role: "user", content: "Find the hero notes" }),
      createStoredMessage({
        role: "assistant",
        content: null,
        toolCalls: [danglingToolCall],
      }),
      createStoredMessage({
        role: "assistant",
        content: "Previous complete reply",
      }),
    ];

    const harness = createServiceHarness({ history });

    await harness.service.sendMessage({
      threadId: harness.thread.id,
      content: "What should I do next?",
      masterKey: "test-master-key",
    });

    expect(harness.llmChatCalls).toHaveLength(1);
    expect(
      harness.llmChatCalls[0]?.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ).toEqual([
      { role: "user", content: "Find the hero notes" },
      { role: "assistant", content: "Previous complete reply" },
      { role: "user", content: "What should I do next?" },
    ]);
    expect(
      harness.llmChatCalls[0]?.messages.some(
        (message) =>
          Array.isArray(message.toolCalls) && message.toolCalls.length > 0,
      ),
    ).toBe(false);
  });

  it("executes tool calls, persists tool results, and re-enters the LLM", async () => {
    const searchToolCall: ToolCall = {
      id: "call-search-1",
      type: "function",
      function: {
        name: "search_nodes",
        arguments: '{"query":"hero"}',
      },
    };

    const searchToolDefinition: ToolDefinition = {
      type: "function",
      function: {
        name: "search_nodes",
        description: "Search nodes",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
        },
      },
    };

    const harness = createServiceHarness({
      llmResponses: [
        createChatResponse({
          content: null,
          finishReason: "tool_calls",
          toolCalls: [searchToolCall],
          tokensUsed: 120,
        }),
        createChatResponse({
          content: "I found the hero notes.",
          finishReason: "stop",
          tokensUsed: 180,
        }),
      ],
      toolResultsByName: {
        search_nodes: JSON.stringify({ results: [{ id: "note-1" }] }),
      },
      tools: [searchToolDefinition],
    });

    const result = await harness.service.sendMessage({
      threadId: harness.thread.id,
      content: "Search for the hero notes",
      masterKey: "test-master-key",
    });

    expect(harness.executeMcpTool).toHaveBeenCalledWith(
      "search_nodes",
      { query: "hero" },
      "test-master-key",
    );
    expect(harness.llmChatCalls).toHaveLength(2);
    expect(harness.storedMessages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
    expect(harness.storedMessages[1]?.toolCalls).toEqual([searchToolCall]);
    expect(harness.storedMessages[2]?.metadata).toEqual(
      expect.objectContaining({
        toolCallId: "call-search-1",
        toolName: "search_nodes",
      }),
    );
    expect(result.assistantMessage.metadata).toEqual(
      expect.objectContaining({ totalIterations: 1 }),
    );
  });

  describe("agent mode tool filtering", () => {
    const allToolNames = [
      "create_node",
      "update_node",
      "delete_node",
      "move_node",
      "list_nodes",
      "search_nodes",
      "search_semantic",
      "add_tag",
    ];
    const allTools = allToolNames.map(createToolDefinition);

    it("planner mode only receives its 4 allowed tools", async () => {
      const harness = createServiceHarness({
        tools: allTools,
        agentModeConfig: {
          name: "planner",
          allowedTools: ["create_node", "move_node", "list_nodes", "add_tag"],
        },
      });

      await harness.service.sendMessage({
        threadId: harness.thread.id,
        content: "Plan my story",
        masterKey: "test-master-key",
      });

      const sentToolNames =
        harness.llmChatCalls[0]?.options?.tools?.map((t) => t.function.name) ??
        [];
      expect(sentToolNames).toHaveLength(4);
      expect(sentToolNames).toContain("create_node");
      expect(sentToolNames).toContain("move_node");
      expect(sentToolNames).toContain("list_nodes");
      expect(sentToolNames).toContain("add_tag");
      expect(sentToolNames).not.toContain("update_node");
      expect(sentToolNames).not.toContain("search_semantic");
      expect(sentToolNames).not.toContain("delete_node");
    });

    it("editor mode only receives its 3 allowed tools", async () => {
      const harness = createServiceHarness({
        tools: allTools,
        agentModeConfig: {
          name: "editor",
          allowedTools: ["update_node", "search_nodes", "list_nodes"],
        },
      });

      await harness.service.sendMessage({
        threadId: harness.thread.id,
        content: "Edit my chapter",
        masterKey: "test-master-key",
      });

      const sentToolNames =
        harness.llmChatCalls[0]?.options?.tools?.map((t) => t.function.name) ??
        [];
      expect(sentToolNames).toHaveLength(3);
      expect(sentToolNames).toContain("update_node");
      expect(sentToolNames).toContain("search_nodes");
      expect(sentToolNames).toContain("list_nodes");
      expect(sentToolNames).not.toContain("create_node");
      expect(sentToolNames).not.toContain("search_semantic");
      expect(sentToolNames).not.toContain("delete_node");
    });

    it("assistant mode with all tools receives all tools", async () => {
      const harness = createServiceHarness({
        tools: allTools,
        agentModeConfig: {
          name: "assistant",
          allowedTools: allToolNames,
        },
      });

      await harness.service.sendMessage({
        threadId: harness.thread.id,
        content: "Help me write",
        masterKey: "test-master-key",
      });

      const sentToolNames =
        harness.llmChatCalls[0]?.options?.tools?.map((t) => t.function.name) ??
        [];
      expect(sentToolNames).toHaveLength(allToolNames.length);
    });
  });

  it("compacts long histories into a summary before the main LLM call", async () => {
    const longHistory = Array.from({ length: 16 }, (_, index) => {
      const role = index % 2 === 0 ? "user" : "assistant";
      return createStoredMessage({
        id: `history-${index + 1}`,
        role,
        content: `${role}-message-${index + 1}: ${"A".repeat(3000)}`,
      });
    });

    const harness = createServiceHarness({
      history: longHistory,
      llmResponses: [
        createChatResponse({ content: "Condensed summary" }),
        createChatResponse({ content: "Final answer after compaction" }),
      ],
    });

    await harness.service.sendMessage({
      threadId: harness.thread.id,
      content: "Continue from here",
      masterKey: "test-master-key",
    });

    expect(harness.llmChatCalls).toHaveLength(2);
    expect(harness.llmChatCalls[0]?.messages).toEqual([
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining(
          "Summarize this conversation concisely",
        ),
      }),
    ]);
    expect(
      harness.llmChatCalls[1]?.messages.some(
        (message) =>
          message.role === "assistant" &&
          message.content?.includes(
            "[Context summary of earlier conversation:",
          ),
      ),
    ).toBe(true);
    expect(
      harness.storedMessages.some(
        (message) =>
          message.role === "assistant" &&
          (message.metadata as Record<string, unknown>)?.isSummary === true,
      ),
    ).toBe(true);
    expect(harness.llmChatCalls[1]?.messages.length).toBeLessThan(
      longHistory.length + 1,
    );
  });
});
