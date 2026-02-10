import { describe, it, expect, vi } from "vitest";
import {
  estimateTokenCount,
  estimateMessagesTokenCount,
  OpenAIProvider,
  AnthropicProvider,
  LocalLLMProvider,
  LLMService,
  type ChatMessage,
} from "@/services/llm-service";

// ─── Token Estimation ──────────────────────────────────────────────────────────

describe("estimateTokenCount", () => {
  it("should return 0 for empty string", () => {
    expect(estimateTokenCount("")).toBe(0);
  });

  it("should estimate ~1 token per 4 chars", () => {
    expect(estimateTokenCount("hello world")).toBe(3); // 11 chars
  });

  it("should round up fractional tokens", () => {
    expect(estimateTokenCount("Hi")).toBe(1); // 2 chars → ceil(0.5)=1
  });

  it("should handle long text", () => {
    expect(estimateTokenCount("a".repeat(1000))).toBe(250);
  });
});

describe("estimateMessagesTokenCount", () => {
  it("should return 0 for empty messages", () => {
    expect(estimateMessagesTokenCount([])).toBe(0);
  });

  it("should count single message with overhead", () => {
    const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
    expect(estimateMessagesTokenCount(messages)).toBe(6); // 4 overhead + 2
  });

  it("should count multiple messages", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];
    const count = estimateMessagesTokenCount(messages);
    expect(count).toBeGreaterThan(12); // 3×4 overhead + content
  });

  it("should count tool calls", () => {
    const messages: ChatMessage[] = [
      {
        role: "assistant",
        content: null,
        toolCalls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "search_nodes", arguments: '{"query":"hero"}' },
          },
        ],
      },
    ];
    expect(estimateMessagesTokenCount(messages)).toBeGreaterThan(8);
  });

  it("should handle null content", () => {
    const messages: ChatMessage[] = [{ role: "assistant", content: null }];
    expect(estimateMessagesTokenCount(messages)).toBe(4); // Just overhead
  });
});

// ─── OpenAI Provider ───────────────────────────────────────────────────────────

describe("OpenAIProvider", () => {
  it("should have correct name and default model", () => {
    const provider = new OpenAIProvider("sk-test-key");
    expect(provider.name).toBe("openai");
    expect(provider.defaultModel).toBe("gpt-4o");
  });

  it("should throw if API key is empty", () => {
    expect(() => new OpenAIProvider("")).toThrow("OpenAI API key is required");
  });

  it("should throw if API key is whitespace", () => {
    expect(() => new OpenAIProvider("   ")).toThrow(
      "OpenAI API key is required",
    );
  });

  it("should return model list with GPT-4o", async () => {
    const provider = new OpenAIProvider("sk-test");
    const models = await provider.models();
    expect(models.length).toBe(5);
    expect(models.every((m) => m.provider === "openai")).toBe(true);
    const gpt4o = models.find((m) => m.id === "gpt-4o");
    expect(gpt4o).toBeDefined();
    expect(gpt4o!.supportsTools).toBe(true);
    expect(gpt4o!.supportsVision).toBe(true);
    expect(gpt4o!.contextWindow).toBe(128000);
  });

  it("should count tokens using estimation", () => {
    const provider = new OpenAIProvider("sk-test");
    const count = provider.countTokens([
      { role: "user", content: "Hello world" },
    ]);
    expect(count).toBeGreaterThan(0);
  });

  it("should call chat API and parse response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "gpt-4o",
          choices: [
            {
              message: { content: "Hi there!", tool_calls: undefined },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAIProvider("sk-test-key");
    const result = await provider.chat([{ role: "user", content: "Hello" }]);

    expect(result.content).toBe("Hi there!");
    expect(result.model).toBe("gpt-4o");
    expect(result.tokensUsed).toBe(15);
    expect(result.finishReason).toBe("stop");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
    fetchSpy.mockRestore();
  });

  it("should pass options to chat API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "gpt-4o-mini",
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAIProvider("sk-test");
    await provider.chat([{ role: "user", content: "Hi" }], {
      model: "gpt-4o-mini",
      temperature: 0.5,
      maxTokens: 100,
      systemPrompt: "Be brief",
    });

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(callBody.model).toBe("gpt-4o-mini");
    expect(callBody.temperature).toBe(0.5);
    expect(callBody.max_tokens).toBe(100);
    expect(callBody.messages[0]).toEqual({
      role: "system",
      content: "Be brief",
    });
    fetchSpy.mockRestore();
  });

  it("should handle tool calls in response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "gpt-4o",
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: "call_abc",
                    type: "function",
                    function: {
                      name: "search_nodes",
                      arguments: '{"query":"test"}',
                    },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAIProvider("sk-test");
    const result = await provider.chat([
      { role: "user", content: "Search for test" },
    ]);

    expect(result.content).toBeNull();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].id).toBe("call_abc");
    expect(result.toolCalls![0].function.name).toBe("search_nodes");
    expect(result.finishReason).toBe("tool_calls");
    fetchSpy.mockRestore();
  });

  it("should throw on API error", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("Rate limit exceeded", { status: 429 }),
      );

    const provider = new OpenAIProvider("sk-test");
    await expect(
      provider.chat([{ role: "user", content: "Hello" }]),
    ).rejects.toThrow("OpenAI API error (429)");
    fetchSpy.mockRestore();
  });

  it("should use custom base URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "gpt-4o",
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAIProvider("sk-test", "https://custom.api.com/v1");
    await provider.chat([{ role: "user", content: "Hi" }]);

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://custom.api.com/v1/chat/completions",
    );
    fetchSpy.mockRestore();
  });
});

// ─── Anthropic Provider ──────────────────────────────────────────────────────

describe("AnthropicProvider", () => {
  it("should have correct name and default model", () => {
    const provider = new AnthropicProvider("sk-ant-test");
    expect(provider.name).toBe("anthropic");
    expect(provider.defaultModel).toBe("claude-sonnet-4-20250514");
  });

  it("should throw if API key is empty", () => {
    expect(() => new AnthropicProvider("")).toThrow(
      "Anthropic API key is required",
    );
  });

  it("should throw if API key is whitespace", () => {
    expect(() => new AnthropicProvider("   ")).toThrow(
      "Anthropic API key is required",
    );
  });

  it("should return model list with Claude models", async () => {
    const provider = new AnthropicProvider("sk-ant-test");
    const models = await provider.models();
    expect(models.length).toBe(3);
    expect(models.every((m) => m.provider === "anthropic")).toBe(true);
    const sonnet = models.find((m) => m.id === "claude-sonnet-4-20250514");
    expect(sonnet).toBeDefined();
    expect(sonnet!.supportsTools).toBe(true);
    expect(sonnet!.contextWindow).toBe(200000);
  });

  it("should count tokens using estimation", () => {
    const provider = new AnthropicProvider("sk-ant-test");
    const count = provider.countTokens([
      { role: "user", content: "Hello world" },
    ]);
    expect(count).toBeGreaterThan(0);
  });

  it("should call Anthropic Messages API and parse response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "claude-sonnet-4-20250514",
          content: [{ type: "text", text: "Hello! I can help with that." }],
          stop_reason: "end_turn",
          usage: { input_tokens: 12, output_tokens: 8 },
        }),
        { status: 200 },
      ),
    );

    const provider = new AnthropicProvider("sk-ant-test");
    const result = await provider.chat([{ role: "user", content: "Hello" }]);

    expect(result.content).toBe("Hello! I can help with that.");
    expect(result.model).toBe("claude-sonnet-4-20250514");
    expect(result.tokensUsed).toBe(20);
    expect(result.finishReason).toBe("stop");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({ method: "POST" }),
    );
    fetchSpy.mockRestore();
  });

  it("should send correct headers", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "claude-sonnet-4-20250514",
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 1 },
        }),
        { status: 200 },
      ),
    );

    const provider = new AnthropicProvider("sk-ant-test");
    await provider.chat([{ role: "user", content: "Hi" }]);

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    fetchSpy.mockRestore();
  });

  it("should handle tool_use content blocks", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "claude-sonnet-4-20250514",
          content: [
            {
              type: "tool_use",
              id: "tu_1",
              name: "search",
              input: { query: "test" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 15, output_tokens: 10 },
        }),
        { status: 200 },
      ),
    );

    const provider = new AnthropicProvider("sk-ant-test");
    const result = await provider.chat([
      { role: "user", content: "Search test" },
    ]);

    expect(result.content).toBeNull();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].id).toBe("tu_1");
    expect(result.toolCalls![0].function.name).toBe("search");
    expect(result.finishReason).toBe("tool_calls");
    fetchSpy.mockRestore();
  });

  it("should throw on API error", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Overloaded", { status: 529 }));

    const provider = new AnthropicProvider("sk-ant-test");
    await expect(
      provider.chat([{ role: "user", content: "Hello" }]),
    ).rejects.toThrow("Anthropic API error (529)");
    fetchSpy.mockRestore();
  });

  it("should pass system prompt and options", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 5, output_tokens: 1 },
        }),
        { status: 200 },
      ),
    );

    const provider = new AnthropicProvider("sk-ant-test");
    await provider.chat([{ role: "user", content: "Hi" }], {
      model: "claude-3-5-haiku-20241022",
      temperature: 0.7,
      systemPrompt: "Be concise",
    });

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(callBody.model).toBe("claude-3-5-haiku-20241022");
    expect(callBody.temperature).toBe(0.7);
    expect(callBody.system).toBe("Be concise");
    fetchSpy.mockRestore();
  });
});

// ─── Local LLM Provider ─────────────────────────────────────────────────────

describe("LocalLLMProvider", () => {
  it("should have correct name and default model", () => {
    const provider = new LocalLLMProvider();
    expect(provider.name).toBe("local");
    expect(provider.defaultModel).toBe("llama3.2");
  });

  it("should accept custom baseUrl and model", () => {
    const provider = new LocalLLMProvider(
      "http://localhost:1234/v1",
      "mistral",
    );
    expect(provider.defaultModel).toBe("mistral");
  });

  describe("stub mode", () => {
    it("should return stub response in chat", async () => {
      const provider = new LocalLLMProvider(
        "http://unused",
        "stub-model",
        true,
      );
      const result = await provider.chat([
        { role: "user", content: "What is the meaning of life?" },
      ]);

      expect(result.content).toContain("[Stub response to:");
      expect(result.content).toContain("What is the meaning of life?");
      expect(result.model).toBe("stub");
      expect(result.finishReason).toBe("stop");
      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it("should truncate long prompts in stub response", async () => {
      const provider = new LocalLLMProvider(
        "http://unused",
        "stub-model",
        true,
      );
      const longPrompt = "a".repeat(100);
      const result = await provider.chat([
        { role: "user", content: longPrompt },
      ]);

      expect(result.content).toContain("...");
    });

    it("should stream stub response word by word", async () => {
      const provider = new LocalLLMProvider(
        "http://unused",
        "stub-model",
        true,
      );
      const chunks: string[] = [];

      for await (const chunk of provider.chatStream([
        { role: "user", content: "Hello" },
      ])) {
        if (chunk.type === "text" && chunk.content) {
          chunks.push(chunk.content);
        }
        if (chunk.type === "done") break;
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should return stub models including DeepSeek R1 in models()", async () => {
      const provider = new LocalLLMProvider(
        "http://unused",
        "stub-model",
        true,
      );
      const models = await provider.models();
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe("stub");
      expect(models[0].provider).toBe("local");
      expect(models[1].id).toBe("deepseek-r1");
      expect(models[1].supportsReasoning).toBe(true);
    });
  });

  it("should count tokens using estimation", () => {
    const provider = new LocalLLMProvider();
    const count = provider.countTokens([
      { role: "user", content: "Hello world" },
    ]);
    expect(count).toBeGreaterThan(0);
  });

  it("should call local API for chat in non-stub mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          model: "llama3.2",
          choices: [
            { message: { content: "Local response" }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
        }),
        { status: 200 },
      ),
    );

    const provider = new LocalLLMProvider(
      "http://localhost:11434/v1",
      "llama3.2",
      false,
    );
    const result = await provider.chat([{ role: "user", content: "Hello" }]);

    expect(result.content).toBe("Local response");
    expect(result.model).toBe("llama3.2");
    expect(fetchSpy.mock.calls[0][0]).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
    fetchSpy.mockRestore();
  });

  it("should throw on local API error", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Server error", { status: 500 }));

    const provider = new LocalLLMProvider(
      "http://localhost:11434/v1",
      "llama3.2",
      false,
    );
    await expect(
      provider.chat([{ role: "user", content: "Hello" }]),
    ).rejects.toThrow("Local LLM API error (500)");
    fetchSpy.mockRestore();
  });

  it("should return empty array when models endpoint fails", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Connection refused"));

    const provider = new LocalLLMProvider(
      "http://localhost:11434/v1",
      "llama3.2",
      false,
    );
    const models = await provider.models();
    expect(models).toEqual([]);
    fetchSpy.mockRestore();
  });
});

// ─── LLM Service ────────────────────────────────────────────────────────────

describe("LLMService", () => {
  it("should initialize with default provider", () => {
    const stub = new LocalLLMProvider("http://unused", "stub", true);
    const service = new LLMService(stub);
    expect(service.getActiveProvider().name).toBe("local");
  });

  it("should register and switch providers", () => {
    const stub = new LocalLLMProvider("http://unused", "stub", true);
    const openai = new OpenAIProvider("sk-test");
    const service = new LLMService(stub);

    service.registerProvider(openai);
    expect(service.getProviderNames()).toContain("openai");
    expect(service.getProviderNames()).toContain("local");

    service.setActiveProvider("openai");
    expect(service.getActiveProvider().name).toBe("openai");
  });

  it("should throw when switching to unknown provider", () => {
    const stub = new LocalLLMProvider("http://unused", "stub", true);
    const service = new LLMService(stub);
    expect(() => service.setActiveProvider("nonexistent")).toThrow(
      "Unknown provider: nonexistent",
    );
  });

  it("should get provider by name", () => {
    const stub = new LocalLLMProvider("http://unused", "stub", true);
    const service = new LLMService(stub);
    expect(service.getProvider("local")).toBe(stub);
    expect(service.getProvider("nonexistent")).toBeUndefined();
  });

  it("should delegate chat to active provider", async () => {
    const stub = new LocalLLMProvider("http://unused", "stub", true);
    const service = new LLMService(stub);
    const result = await service.chat([{ role: "user", content: "Hello" }]);
    expect(result.content).toContain("[Stub response to:");
    expect(result.model).toBe("stub");
  });

  it("should delegate chatStream to active provider", async () => {
    const stub = new LocalLLMProvider("http://unused", "stub", true);
    const service = new LLMService(stub);
    const chunks: string[] = [];

    for await (const chunk of service.chatStream([
      { role: "user", content: "Hi" },
    ])) {
      if (chunk.type === "text" && chunk.content) chunks.push(chunk.content);
      if (chunk.type === "done") break;
    }

    expect(chunks.length).toBeGreaterThan(0);
  });

  it("should aggregate models from all providers", async () => {
    const stub = new LocalLLMProvider("http://unused", "stub", true);
    const openai = new OpenAIProvider("sk-test");
    const anthropic = new AnthropicProvider("sk-ant-test");

    const service = new LLMService(stub);
    service.registerProvider(openai);
    service.registerProvider(anthropic);

    const allModels = await service.getAllModels();
    // 2 local (stub + deepseek-r1) + 5 openai (gpt-4o, gpt-4o-mini, o1, o3, o3-mini) + 3 anthropic = 10
    expect(allModels.length).toBe(10);
    expect(allModels.some((m) => m.provider === "local")).toBe(true);
    expect(allModels.some((m) => m.provider === "openai")).toBe(true);
    expect(allModels.some((m) => m.provider === "anthropic")).toBe(true);
  });

  it("should delegate countTokens to active provider", () => {
    const stub = new LocalLLMProvider("http://unused", "stub", true);
    const service = new LLMService(stub);
    const count = service.countTokens([
      { role: "user", content: "Hello world" },
    ]);
    expect(count).toBeGreaterThan(0);
  });

  it("should list provider names", () => {
    const stub = new LocalLLMProvider("http://unused", "stub", true);
    const service = new LLMService(stub);
    expect(service.getProviderNames()).toEqual(["local"]);
  });
});

// ─── Reasoning Model Support ─────────────────────────────────────────────────

describe("Reasoning Model Support", () => {
  describe("OpenAI reasoning models", () => {
    it("should mark o1 as supporting reasoning", async () => {
      const provider = new OpenAIProvider("sk-test");
      const models = await provider.models();
      const o1Model = models.find((m) => m.id === "o1");
      expect(o1Model).toBeDefined();
      expect(o1Model!.supportsReasoning).toBe(true);
    });

    it("should mark o3 as supporting reasoning", async () => {
      const provider = new OpenAIProvider("sk-test");
      const models = await provider.models();
      const o3Model = models.find((m) => m.id === "o3");
      expect(o3Model).toBeDefined();
      expect(o3Model!.supportsReasoning).toBe(true);
    });

    it("should mark o3-mini as supporting reasoning", async () => {
      const provider = new OpenAIProvider("sk-test");
      const models = await provider.models();
      const o3MiniModel = models.find((m) => m.id === "o3-mini");
      expect(o3MiniModel).toBeDefined();
      expect(o3MiniModel!.supportsReasoning).toBe(true);
    });

    it("should NOT mark gpt-4o as supporting reasoning", async () => {
      const provider = new OpenAIProvider("sk-test");
      const models = await provider.models();
      const gpt4oModel = models.find((m) => m.id === "gpt-4o");
      expect(gpt4oModel).toBeDefined();
      expect(gpt4oModel!.supportsReasoning).toBeUndefined();
    });

    it("should extract reasoning from o1 chat response", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "o1",
            choices: [
              {
                message: {
                  content: "The answer is 42.",
                  reasoning_content: "Let me think step by step...",
                },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 50,
              total_tokens: 60,
              completion_tokens_details: { reasoning_tokens: 30 },
            },
          }),
          { status: 200 },
        ),
      );

      const provider = new OpenAIProvider("sk-test");
      const result = await provider.chat(
        [{ role: "user", content: "What is the meaning of life?" }],
        { model: "o1" },
      );

      expect(result.content).toBe("The answer is 42.");
      expect(result.reasoning).toBe("Let me think step by step...");
      expect(result.reasoningTokens).toBe(30);
      expect(result.outputTokens).toBe(50);
      fetchSpy.mockRestore();
    });

    it("should return null reasoning for non-reasoning models", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            model: "gpt-4o",
            choices: [
              {
                message: { content: "Hello!" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
          }),
          { status: 200 },
        ),
      );

      const provider = new OpenAIProvider("sk-test");
      const result = await provider.chat([{ role: "user", content: "Hi" }], {
        model: "gpt-4o",
      });

      expect(result.content).toBe("Hello!");
      expect(result.reasoning).toBeNull();
      fetchSpy.mockRestore();
    });
  });

  describe("DeepSeek R1 reasoning parsing", () => {
    it("should parse <think> tags from content", () => {
      const result = LocalLLMProvider.parseReasoningFromContent(
        "<think>Step 1: analyze the problem\nStep 2: solve it</think>\nThe answer is 42.",
      );
      expect(result.reasoning).toBe(
        "Step 1: analyze the problem\nStep 2: solve it",
      );
      expect(result.content).toBe("The answer is 42.");
    });

    it("should return null reasoning when no <think> tags", () => {
      const result = LocalLLMProvider.parseReasoningFromContent(
        "Just a normal response",
      );
      expect(result.reasoning).toBeNull();
      expect(result.content).toBe("Just a normal response");
    });

    it("should return null for null content", () => {
      const result = LocalLLMProvider.parseReasoningFromContent(null);
      expect(result.reasoning).toBeNull();
      expect(result.content).toBeNull();
    });

    it("should handle empty think tags", () => {
      const result = LocalLLMProvider.parseReasoningFromContent(
        "<think></think>\nHello",
      );
      expect(result.reasoning).toBeNull();
      expect(result.content).toBe("Hello");
    });

    it("should handle think tags with only whitespace", () => {
      const result = LocalLLMProvider.parseReasoningFromContent(
        "<think>   \n  </think>\nResult here",
      );
      expect(result.reasoning).toBeNull();
      expect(result.content).toBe("Result here");
    });

    it("should include DeepSeek R1 in local stub models with supportsReasoning", async () => {
      const provider = new LocalLLMProvider("http://unused", "stub", true);
      const models = await provider.models();
      const deepseekModel = models.find((m) => m.id === "deepseek-r1");
      expect(deepseekModel).toBeDefined();
      expect(deepseekModel!.supportsReasoning).toBe(true);
      expect(deepseekModel!.name).toBe("DeepSeek R1");
    });
  });
});
