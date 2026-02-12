# Chat UX Improvements

## Current State Analysis

### ❌ **Critical Issues Found:**

1. **MCP Tools Are NOT Connected to Chat**
   - MCP server exists (`apps/mcp-server/src/server.ts`) with 12 tools registered
   - Chat system (`apps/api/src/api/routers/chat.ts`) does NOT pass tools to LLM
   - Line 250-253 in chat.ts: `llmService.chat(llmMessages, { model, systemPrompt })` - **NO tools parameter!**
   - Result: Agents can't use any MCP tools (create_node, search_nodes, etc.)

2. **No Tool Call Iteration Loop**
   - `sendMessage` endpoint calls LLM once and stores response
   - If LLM returns `finishReason: "tool_calls"`, nothing happens
   - No code to execute tools and send results back to LLM
   - Result: Limited to 1 iteration (no tool execution)

3. **Tool Calls Not Displayed in UI**
   - `ChatMessage` component doesn't render `toolCalls` field
   - Messages stored with `toolCalls` in database, but UI ignores them
   - Result: Users can't see what tools the agent tried to use

4. **No Context Window Indicator**
   - Token usage is tracked (`tokensUsed` field in messages)
   - No UI component to show remaining context window
   - `getTokenUsage` endpoint exists but not used in frontend

5. **Single Conversation Only**
   - Threads exist, but no way to create multiple conversations
   - Sidebar shows threads, but they're all in one conversation
   - No concept of separate "conversations" vs "threads"

6. **No Project Context Injection**
   - Threads have `projectId` field (nullable)
   - System prompt doesn't include project context
   - No way to inject current node context

## Required Changes

### 1. Connect MCP Tools to Chat (CRITICAL)

**Backend Changes:**

```typescript
// apps/api/src/api/routers/chat.ts - sendMessage endpoint

// After line 277 (getting agent mode config):
const agentModeConfig = await getAgentModeConfig(thread.agentMode);

// ADD: Get MCP tools and filter by agent mode
import { getMCPTools } from '../../services/mcp-integration-service'; // NEW SERVICE
const allTools = await getMCPTools();
const allowedTools = await filterToolsForMode(thread.agentMode, allTools);

// MODIFY: Pass tools to LLM
const response = await llmService.chat(llmMessages, {
  model: thread.model ?? undefined,
  systemPrompt,
  tools: allowedTools, // ADD THIS
});
```

**New Service Needed:**

```typescript
// apps/api/src/services/mcp-integration-service.ts
import { createMcpServer } from '@mcp-server/server';
import type { ToolDefinition } from './llm-service';

export async function getMCPTools(): Promise<ToolDefinition[]> {
  const mcpServer = createMcpServer();
  // Convert MCP tool definitions to LLM ToolDefinition format
  // Return array of tools
}

export async function executeMCPTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const mcpServer = createMcpServer();
  // Execute the tool
  // Return result as string
}
```

### 2. Implement Tool Call Iteration Loop

**Backend Changes:**

```typescript
// apps/api/src/api/routers/chat.ts - sendMessage endpoint

// REPLACE single LLM call with iteration loop:
const MAX_ITERATIONS = 5;
let iteration = 0;
let currentMessages = [...llmMessages, { role: 'user', content }];

while (iteration < MAX_ITERATIONS) {
  const response = await llmService.chat(currentMessages, {
    model: thread.model ?? undefined,
    systemPrompt,
    tools: allowedTools,
  });

  // Store assistant message with tool calls
  const assistantMessage = await chatService.addMessage({
    threadId,
    role: 'assistant',
    content: response.content,
    toolCalls: response.toolCalls,
    // ... other fields
  });

  // If no tool calls, we're done
  if (response.finishReason !== 'tool_calls' || !response.toolCalls) {
    break;
  }

  // Execute each tool call
  for (const toolCall of response.toolCalls) {
    const result = await executeMCPTool(
      toolCall.function.name,
      JSON.parse(toolCall.function.arguments)
    );

    // Add tool result message
    const toolMessage = await chatService.addMessage({
      threadId,
      role: 'tool',
      content: result,
      metadata: { toolCallId: toolCall.id },
    });

    // Add to conversation for next iteration
    currentMessages.push({
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
    });
    currentMessages.push({
      role: 'tool',
      content: result,
      toolCallId: toolCall.id,
    });
  }

  iteration++;
}
```

### 3. Display Tool Calls in UI

**Frontend Changes:**

```typescript
// apps/web/src/components/chat/chat-message.tsx

// ADD: Render tool calls section
{message.toolCalls && message.toolCalls.length > 0 && (
  <div className="mt-2 space-y-1">
    {message.toolCalls.map((tc, idx) => (
      <div key={idx} className="text-xs bg-muted p-2 rounded">
        <div className="font-mono text-primary">
          🔧 {tc.function.name}
        </div>
        <details className="mt-1">
          <summary className="cursor-pointer text-muted-foreground">
            Arguments
          </summary>
          <pre className="mt-1 text-xs overflow-x-auto">
            {JSON.stringify(JSON.parse(tc.function.arguments), null, 2)}
          </pre>
        </details>
      </div>
    ))}
  </div>
)}

// ADD: Render tool result messages
{message.role === 'tool' && (
  <div className="text-xs bg-green-50 dark:bg-green-950 p-2 rounded">
    <div className="font-mono text-green-700 dark:text-green-300">
      ✅ Tool Result
    </div>
    <pre className="mt-1 text-xs overflow-x-auto">
      {message.content}
    </pre>
  </div>
)}
```

### 4. Add Context Window Indicator

**Frontend Changes:**

```typescript
// apps/web/src/components/chat/chat-panel.tsx

// ADD: Query for token usage
const tokenUsage = trpc.chat.getTokenUsage.useQuery(
  { threadId: selectedThreadId! },
  { enabled: !!selectedThreadId, refetchInterval: 5000 }
);

// ADD: Get model context window
const selectedModelInfo = availableModels.find(m => m.id === selectedModel);
const contextWindow = selectedModelInfo?.contextWindow ?? 128000;
const tokensUsed = tokenUsage.data?.totalTokens ?? 0;
const tokensRemaining = contextWindow - tokensUsed;
const percentUsed = (tokensUsed / contextWindow) * 100;

// ADD: Context window indicator in UI (above input area)
<div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
  <div className="flex items-center justify-between">
    <span>Context: {tokensUsed.toLocaleString()} / {contextWindow.toLocaleString()} tokens</span>
    <span className={percentUsed > 90 ? 'text-destructive' : percentUsed > 75 ? 'text-warning' : ''}>
      {tokensRemaining.toLocaleString()} remaining ({(100 - percentUsed).toFixed(1)}%)
    </span>
  </div>
  <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
    <div
      className={`h-full transition-all ${
        percentUsed > 90 ? 'bg-destructive' :
        percentUsed > 75 ? 'bg-warning' :
        'bg-primary'
      }`}
      style={{ width: `${percentUsed}%` }}
    />
  </div>
</div>
```

### 5. Enable Multiple Conversations

**Database Schema Changes:**

```sql
-- Add conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  project_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Modify chat_threads to reference conversations
ALTER TABLE chat_threads ADD COLUMN conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;
```

**Backend Changes:**

```typescript
// apps/api/src/services/conversation-service.ts (NEW)
export class ConversationService {
  async createConversation(params: { name: string; projectId?: string }): Promise<Conversation>
  async getConversations(): Promise<Conversation[]>
  async deleteConversation(id: string): Promise<boolean>
}

// apps/api/src/api/routers/chat.ts
// ADD conversation endpoints
export const chatRouter = router({
  // ... existing endpoints

  createConversation: publicProcedure
    .input(z.object({ name: z.string(), projectId: z.string().uuid().optional() }))
    .mutation(async ({ input }) => conversationService.createConversation(input)),

  getConversations: publicProcedure
    .query(async () => conversationService.getConversations()),
});
```

**Frontend Changes:**

```typescript
// apps/web/src/components/chat/chat-sidebar.tsx

// ADD: Conversation selector at top
<div className="p-2 border-b">
  <select
    value={selectedConversationId}
    onChange={(e) => setSelectedConversationId(e.target.value)}
    className="w-full p-2 rounded border"
  >
    {conversations.map(conv => (
      <option key={conv.id} value={conv.id}>{conv.name}</option>
    ))}
  </select>
  <button onClick={handleCreateConversation} className="mt-2 w-full">
    + New Conversation
  </button>
</div>

// MODIFY: Filter threads by conversation
const threadsInConversation = threads.filter(
  t => t.conversationId === selectedConversationId
);
```

### 6. Inject Project Context

**Backend Changes:**

```typescript
// apps/api/src/services/agent-mode-service.ts - buildSystemPrompt

export async function buildSystemPrompt(
  mode: AgentMode,
  projectId?: string | null,
  nodeIds?: string[]
): Promise<string> {
  const config = await getAgentModeConfig(mode);
  if (!config) {
    throw new Error(`Unknown agent mode: ${mode}`);
  }

  let contextSection = '';

  // ADD: Project context
  if (projectId) {
    const nodeService = new NodeService();
    const project = await nodeService.getNodeById(projectId);
    if (project) {
      contextSection += `\n\nCurrent Project: ${project.name}`;
      contextSection += `\nProject ID: ${project.id}`;

      // Get project structure
      const children = await nodeService.getNodesByParentId(projectId);
      if (children.length > 0) {
        contextSection += `\n\nProject Structure:`;
        for (const child of children) {
          contextSection += `\n- [${child.type}] ${child.name} (${child.id})`;
        }
      }
    }
  }

  // ADD: Current node context
  if (nodeIds && nodeIds.length > 0) {
    const nodeService = new NodeService();
    contextSection += `\n\nCurrent Nodes:`;
    for (const nodeId of nodeIds) {
      const node = await nodeService.getNodeById(nodeId);
      if (node) {
        contextSection += `\n- [${node.type}] ${node.name}`;
        if (node.content) {
          contextSection += `\n  Content: ${JSON.stringify(node.content).substring(0, 200)}...`;
        }
      }
    }
  }

  return `${config.systemPrompt}${contextSection}`;
}
```

**Frontend Changes:**

```typescript
// apps/web/src/components/chat/chat-panel.tsx

// ADD: Get current project from file tree context
const { selectedProjectId, selectedNodeIds } = useFileTreeContext();

// MODIFY: Pass context when sending message
sendMessage.mutate({
  threadId: selectedThreadId,
  content: inputValue.trim(),
  masterKey,
  projectId: selectedProjectId, // ADD
  nodeIds: selectedNodeIds,     // ADD
});
```

## Implementation Priority

1. **CRITICAL - Connect MCP Tools** (Without this, agents are useless)
2. **CRITICAL - Tool Call Iteration Loop** (Enable multi-step reasoning)
3. **HIGH - Display Tool Calls in UI** (Transparency for users)
4. **MEDIUM - Context Window Indicator** (Prevent context overflow)
5. **MEDIUM - Inject Project Context** (Make agents project-aware)
6. **LOW - Multiple Conversations** (Nice to have, not blocking)

## Testing Strategy

For each change:

1. Write unit tests for new services
2. Write integration tests for tool execution
3. Update existing chat tests
4. Maintain >75% coverage
5. Test with MCP Inspector before production
