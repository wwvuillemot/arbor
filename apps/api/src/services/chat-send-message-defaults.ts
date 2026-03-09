import { buildSystemPrompt, getAgentModeConfig } from "./agent-mode-service";
import { ChatService } from "./chat-service";
import type {
  ChatCompletionService,
  ChatSendMessageDependencies,
} from "./chat-send-message-types";
import {
  AnthropicProvider,
  LLMService,
  LocalLLMProvider,
  OpenAIProvider,
} from "./llm-service";
import { executeMCPTool, getMCPTools } from "./mcp-integration-service";
import { NodeService } from "./node-service";
import { SettingsService } from "./settings-service";

const defaultSettingsService = new SettingsService();

export async function initializeDefaultLLMService(
  masterKey: string,
  modelId?: string | null,
): Promise<ChatCompletionService> {
  const localProvider = new LocalLLMProvider(
    "http://localhost:11434/v1",
    "llama3.2",
    true,
  );
  const llmService = new LLMService(localProvider);

  let hasOpenAiProvider = false;
  let hasAnthropicProvider = false;

  try {
    const openAiApiKey = await defaultSettingsService.getSetting(
      "openai_api_key",
      masterKey,
    );
    console.log(
      "OpenAI key retrieved:",
      openAiApiKey ? `YES (length: ${openAiApiKey.length})` : "NO",
    );

    if (openAiApiKey && openAiApiKey.trim() !== "") {
      llmService.registerProvider(new OpenAIProvider(openAiApiKey));
      hasOpenAiProvider = true;
      console.log("✅ OpenAI provider registered");
    }
  } catch (error) {
    console.warn("Failed to initialize OpenAI provider:", error);
  }

  try {
    const anthropicApiKey = await defaultSettingsService.getSetting(
      "anthropic_api_key",
      masterKey,
    );
    console.log(
      "Anthropic key retrieved:",
      anthropicApiKey ? `YES (length: ${anthropicApiKey.length})` : "NO",
    );

    if (anthropicApiKey && anthropicApiKey.trim() !== "") {
      llmService.registerProvider(new AnthropicProvider(anthropicApiKey));
      hasAnthropicProvider = true;
      console.log("✅ Anthropic provider registered");
    }
  } catch (error) {
    console.warn("Failed to initialize Anthropic provider:", error);
  }

  if (modelId) {
    if (
      modelId.startsWith("gpt-") ||
      modelId.startsWith("o1") ||
      modelId.startsWith("o2") ||
      modelId.startsWith("o3") ||
      modelId.startsWith("o4")
    ) {
      if (hasOpenAiProvider) {
        llmService.setActiveProvider("openai");
        console.log("🎯 Selected OpenAI provider for model:", modelId);
      } else {
        console.warn("⚠️ Model requires OpenAI but no API key configured");
      }
    } else if (modelId.startsWith("claude-")) {
      if (hasAnthropicProvider) {
        llmService.setActiveProvider("anthropic");
        console.log("🎯 Selected Anthropic provider for model:", modelId);
      } else {
        console.warn("⚠️ Model requires Anthropic but no API key configured");
      }
    }
  } else if (hasOpenAiProvider) {
    llmService.setActiveProvider("openai");
    console.log("🎯 Default to OpenAI provider");
  } else if (hasAnthropicProvider) {
    llmService.setActiveProvider("anthropic");
    console.log("🎯 Default to Anthropic provider");
  }

  console.log("🔧 Active LLM provider:", llmService.getActiveProvider().name);
  return llmService;
}

export function createDefaultDependencies(): ChatSendMessageDependencies {
  return {
    chatService: new ChatService(),
    nodeService: new NodeService(),
    getAgentModeConfig,
    buildSystemPrompt: async (mode: string) => await buildSystemPrompt(mode),
    initializeLLMService: initializeDefaultLLMService,
    getMcpTools: getMCPTools,
    executeMcpTool: executeMCPTool,
  };
}
