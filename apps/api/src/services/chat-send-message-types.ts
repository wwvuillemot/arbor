import type {
  ChatMessage as StoredChatMessage,
  ChatThread,
} from "../db/schema";
import type { CreateMessageParams } from "./chat-service";
import type {
  ChatMessage as LLMChatMessage,
  ChatResponse,
  ToolDefinition,
} from "./llm-service";

export interface SendMessageParams {
  threadId: string;
  content: string;
  masterKey: string;
  projectId?: string | null;
  contextNodeIds?: string[];
}

export interface SendMessageResult {
  userMessage: StoredChatMessage;
  assistantMessage: StoredChatMessage;
}

export interface AgentModeConfiguration {
  name: string;
  allowedTools: string[];
  temperature: number;
}

export interface ProjectNodeRecord {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  content?: unknown;
}

export interface ChatPersistenceService {
  getThreadById(id: string): Promise<ChatThread | null>;
  getMessages(threadId: string): Promise<StoredChatMessage[]>;
  addMessage(params: CreateMessageParams): Promise<StoredChatMessage>;
}

export interface ChatContextNodeService {
  getNodeById(id: string): Promise<ProjectNodeRecord | null>;
  getDescendants(nodeId: string): Promise<ProjectNodeRecord[]>;
}

export interface ChatCompletionService {
  chat(
    messages: LLMChatMessage[],
    options?: {
      model?: string;
      temperature?: number;
      tools?: ToolDefinition[];
      systemPrompt?: string;
    },
  ): Promise<ChatResponse>;
  getActiveProvider(): { name: string };
  supportsTemperature(modelId: string): Promise<boolean>;
}

export interface ChatSendMessageDependencies {
  chatService: ChatPersistenceService;
  nodeService: ChatContextNodeService;
  getAgentModeConfig(mode: string): Promise<AgentModeConfiguration | null>;
  buildSystemPrompt(mode: string): Promise<string>;
  initializeLLMService(
    masterKey: string,
    modelId?: string | null,
  ): Promise<ChatCompletionService>;
  getMcpTools(): Promise<ToolDefinition[]>;
  executeMcpTool(
    toolName: string,
    args: Record<string, unknown>,
    masterKey?: string,
  ): Promise<string>;
}
