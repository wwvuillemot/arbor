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

### 7. Agent Rules Management

**Purpose**: Allow users and agents to collaboratively manage conversation rules/guidelines

**Database Schema Changes:**

```sql
-- Add agent_rules table
CREATE TABLE agent_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  rule_text TEXT NOT NULL,
  created_by VARCHAR(50) NOT NULL, -- 'user' or 'agent'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_agent_rules_thread ON agent_rules(thread_id);
```

**Backend Changes:**

```typescript
// apps/api/src/services/agent-rules-service.ts (NEW)
export interface AgentRule {
  id: string;
  threadId: string;
  ruleText: string;
  createdBy: 'user' | 'agent';
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export class AgentRulesService {
  async createRule(params: {
    threadId: string;
    ruleText: string;
    createdBy: 'user' | 'agent';
  }): Promise<AgentRule> {
    const [rule] = await db
      .insert(agentRules)
      .values({
        threadId: params.threadId,
        ruleText: params.ruleText,
        createdBy: params.createdBy,
      })
      .returning();
    return rule;
  }

  async getRulesForThread(threadId: string): Promise<AgentRule[]> {
    return db
      .select()
      .from(agentRules)
      .where(and(
        eq(agentRules.threadId, threadId),
        eq(agentRules.isActive, true)
      ))
      .orderBy(asc(agentRules.createdAt));
  }

  async updateRule(id: string, ruleText: string): Promise<AgentRule> {
    const [rule] = await db
      .update(agentRules)
      .set({ ruleText, updatedAt: new Date() })
      .where(eq(agentRules.id, id))
      .returning();
    return rule;
  }

  async deleteRule(id: string): Promise<boolean> {
    const result = await db
      .update(agentRules)
      .set({ isActive: false })
      .where(eq(agentRules.id, id))
      .returning({ id: agentRules.id });
    return result.length > 0;
  }
}

// apps/api/src/api/routers/chat.ts
// ADD agent rules endpoints
export const chatRouter = router({
  // ... existing endpoints

  createAgentRule: publicProcedure
    .input(z.object({
      threadId: z.string().uuid(),
      ruleText: z.string().min(1),
      createdBy: z.enum(['user', 'agent'])
    }))
    .mutation(async ({ input }) => agentRulesService.createRule(input)),

  getAgentRules: publicProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .query(async ({ input }) => agentRulesService.getRulesForThread(input.threadId)),

  updateAgentRule: publicProcedure
    .input(z.object({ id: z.string().uuid(), ruleText: z.string().min(1) }))
    .mutation(async ({ input }) => agentRulesService.updateRule(input.id, input.ruleText)),

  deleteAgentRule: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => agentRulesService.deleteRule(input.id)),
});
```

**MCP Tool for Agents:**

```typescript
// apps/mcp-server/src/server.ts
// ADD: Agent rules tools

server.registerTool(
  "add_conversation_rule",
  {
    title: "Add Conversation Rule",
    description: "Add a rule or guideline for the current conversation that both user and agent should follow",
    inputSchema: {
      threadId: z.string().uuid(),
      ruleText: z.string().min(1),
    },
  },
  async ({ threadId, ruleText }) => {
    const rule = await agentRulesService.createRule({
      threadId,
      ruleText,
      createdBy: 'agent',
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(rule) }],
    };
  }
);

server.registerTool(
  "get_conversation_rules",
  {
    title: "Get Conversation Rules",
    description: "Retrieve all active rules for the current conversation",
    inputSchema: {
      threadId: z.string().uuid(),
    },
  },
  async ({ threadId }) => {
    const rules = await agentRulesService.getRulesForThread(threadId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(rules) }],
    };
  }
);
```

**System Prompt Integration:**

```typescript
// apps/api/src/services/agent-mode-service.ts - buildSystemPrompt

export async function buildSystemPrompt(
  mode: AgentMode,
  threadId?: string,
  projectId?: string | null,
  nodeIds?: string[]
): Promise<string> {
  const config = await getAgentModeConfig(mode);
  if (!config) {
    throw new Error(`Unknown agent mode: ${mode}`);
  }

  let contextSection = '';

  // ADD: Conversation rules
  if (threadId) {
    const agentRulesService = new AgentRulesService();
    const rules = await agentRulesService.getRulesForThread(threadId);
    if (rules.length > 0) {
      contextSection += `\n\nConversation Rules (follow these strictly):`;
      for (const rule of rules) {
        contextSection += `\n- ${rule.ruleText} [${rule.createdBy === 'user' ? 'User-defined' : 'Agent-defined'}]`;
      }
    }
  }

  // ... rest of context (project, nodes, etc.)

  return `${config.systemPrompt}${contextSection}`;
}
```

**Frontend UI:**

```typescript
// apps/web/src/components/chat/agent-rules-panel.tsx (NEW)
export function AgentRulesPanel({ threadId }: { threadId: string }) {
  const rules = trpc.chat.getAgentRules.useQuery({ threadId });
  const createRule = trpc.chat.createAgentRule.useMutation();
  const updateRule = trpc.chat.updateAgentRule.useMutation();
  const deleteRule = trpc.chat.deleteAgentRule.useMutation();

  const [newRuleText, setNewRuleText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="p-4 border-l border-border">
      <h3 className="font-semibold mb-4">Conversation Rules</h3>

      {/* Add new rule */}
      <div className="mb-4">
        <textarea
          value={newRuleText}
          onChange={(e) => setNewRuleText(e.target.value)}
          placeholder="Add a rule for this conversation..."
          className="w-full p-2 border rounded text-sm"
          rows={2}
        />
        <button
          onClick={() => {
            createRule.mutate({
              threadId,
              ruleText: newRuleText,
              createdBy: 'user'
            });
            setNewRuleText('');
          }}
          className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
        >
          Add Rule
        </button>
      </div>

      {/* List rules */}
      <div className="space-y-2">
        {rules.data?.map((rule) => (
          <div
            key={rule.id}
            className={`p-2 rounded text-sm ${
              rule.createdBy === 'user'
                ? 'bg-blue-50 dark:bg-blue-950'
                : 'bg-purple-50 dark:bg-purple-950'
            }`}
          >
            {editingId === rule.id ? (
              <textarea
                defaultValue={rule.ruleText}
                onBlur={(e) => {
                  updateRule.mutate({ id: rule.id, ruleText: e.target.value });
                  setEditingId(null);
                }}
                className="w-full p-1 border rounded"
                rows={2}
              />
            ) : (
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p>{rule.ruleText}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {rule.createdBy === 'user' ? '👤 User' : '🤖 Agent'} • {new Date(rule.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => setEditingId(rule.id)}
                    className="p-1 hover:bg-background rounded"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteRule.mutate({ id: rule.id })}
                    className="p-1 hover:bg-background rounded"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// apps/web/src/components/chat/chat-panel.tsx
// ADD: Toggle for rules panel
const [showRules, setShowRules] = useState(false);

<div className="flex-1 flex">
  <div className="flex-1">
    {/* Existing chat UI */}
  </div>
  {showRules && selectedThreadId && (
    <AgentRulesPanel threadId={selectedThreadId} />
  )}
</div>
```

### 8. Agent Task Planning & Management

**Purpose**: Allow agents to create and manage their own task lists for complex work

**Database Schema Changes:**

```sql
-- Add agent_tasks table
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  parent_task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_agent_tasks_thread ON agent_tasks(thread_id);
CREATE INDEX idx_agent_tasks_parent ON agent_tasks(parent_task_id);
```

**Backend Changes:**

```typescript
// apps/api/src/services/agent-tasks-service.ts (NEW)
export interface AgentTask {
  id: string;
  threadId: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  parentTaskId: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export class AgentTasksService {
  async createTask(params: {
    threadId: string;
    title: string;
    description?: string;
    parentTaskId?: string;
  }): Promise<AgentTask> {
    const [task] = await db
      .insert(agentTasks)
      .values({
        threadId: params.threadId,
        title: params.title,
        description: params.description ?? null,
        parentTaskId: params.parentTaskId ?? null,
        status: 'pending',
      })
      .returning();
    return task;
  }

  async getTasksForThread(threadId: string): Promise<AgentTask[]> {
    return db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.threadId, threadId))
      .orderBy(asc(agentTasks.position), asc(agentTasks.createdAt));
  }

  async updateTaskStatus(
    id: string,
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  ): Promise<AgentTask> {
    const updates: any = { status, updatedAt: new Date() };
    if (status === 'completed') {
      updates.completedAt = new Date();
    }

    const [task] = await db
      .update(agentTasks)
      .set(updates)
      .where(eq(agentTasks.id, id))
      .returning();
    return task;
  }

  async updateTask(id: string, params: {
    title?: string;
    description?: string;
    status?: string;
  }): Promise<AgentTask> {
    const [task] = await db
      .update(agentTasks)
      .set({ ...params, updatedAt: new Date() })
      .where(eq(agentTasks.id, id))
      .returning();
    return task;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db
      .delete(agentTasks)
      .where(eq(agentTasks.id, id))
      .returning({ id: agentTasks.id });
    return result.length > 0;
  }
}

// apps/api/src/api/routers/chat.ts
// ADD agent tasks endpoints
export const chatRouter = router({
  // ... existing endpoints

  createAgentTask: publicProcedure
    .input(z.object({
      threadId: z.string().uuid(),
      title: z.string().min(1),
      description: z.string().optional(),
      parentTaskId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input }) => agentTasksService.createTask(input)),

  getAgentTasks: publicProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .query(async ({ input }) => agentTasksService.getTasksForThread(input.threadId)),

  updateAgentTask: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...params } = input;
      return agentTasksService.updateTask(id, params);
    }),

  deleteAgentTask: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => agentTasksService.deleteTask(input.id)),
});
```

**MCP Tools for Agents:**

```typescript
// apps/mcp-server/src/server.ts
// ADD: Agent task management tools

server.registerTool(
  "create_task",
  {
    title: "Create Task",
    description: "Create a task in your task list for the current conversation. Use this to plan and track your work.",
    inputSchema: {
      threadId: z.string().uuid(),
      title: z.string().min(1),
      description: z.string().optional(),
      parentTaskId: z.string().uuid().optional(),
    },
  },
  async ({ threadId, title, description, parentTaskId }) => {
    const task = await agentTasksService.createTask({
      threadId,
      title,
      description,
      parentTaskId,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(task) }],
    };
  }
);

server.registerTool(
  "update_task_status",
  {
    title: "Update Task Status",
    description: "Update the status of a task (pending, in_progress, completed, cancelled)",
    inputSchema: {
      taskId: z.string().uuid(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
    },
  },
  async ({ taskId, status }) => {
    const task = await agentTasksService.updateTaskStatus(taskId, status);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(task) }],
    };
  }
);

server.registerTool(
  "get_tasks",
  {
    title: "Get Tasks",
    description: "Get all tasks for the current conversation to see what work is planned and completed",
    inputSchema: {
      threadId: z.string().uuid(),
    },
  },
  async ({ threadId }) => {
    const tasks = await agentTasksService.getTasksForThread(threadId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(tasks) }],
    };
  }
);

server.registerTool(
  "update_task",
  {
    title: "Update Task",
    description: "Update a task's title, description, or status",
    inputSchema: {
      taskId: z.string().uuid(),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
    },
  },
  async ({ taskId, title, description, status }) => {
    const task = await agentTasksService.updateTask(taskId, {
      title,
      description,
      status,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(task) }],
    };
  }
);
```

**Frontend UI:**

```typescript
// apps/web/src/components/chat/agent-tasks-panel.tsx (NEW)
export function AgentTasksPanel({ threadId }: { threadId: string }) {
  const tasks = trpc.chat.getAgentTasks.useQuery({ threadId });
  const updateTask = trpc.chat.updateAgentTask.useMutation();

  // Build task tree (parent-child relationships)
  const taskTree = useMemo(() => {
    const rootTasks = tasks.data?.filter(t => !t.parentTaskId) ?? [];
    const buildTree = (parentId: string | null): AgentTask[] => {
      return tasks.data?.filter(t => t.parentTaskId === parentId) ?? [];
    };
    return { rootTasks, buildTree };
  }, [tasks.data]);

  const TaskItem = ({ task, depth = 0 }: { task: AgentTask; depth?: number }) => {
    const children = taskTree.buildTree(task.id);
    const statusIcon = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
      cancelled: '❌',
    }[task.status];

    return (
      <div style={{ marginLeft: `${depth * 16}px` }}>
        <div className="flex items-center gap-2 p-2 hover:bg-muted rounded">
          <button
            onClick={() => {
              const nextStatus = {
                pending: 'in_progress',
                in_progress: 'completed',
                completed: 'pending',
                cancelled: 'pending',
              }[task.status] as any;
              updateTask.mutate({ id: task.id, status: nextStatus });
            }}
            className="text-lg"
          >
            {statusIcon}
          </button>
          <div className="flex-1">
            <div className={`text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
              {task.title}
            </div>
            {task.description && (
              <div className="text-xs text-muted-foreground mt-1">
                {task.description}
              </div>
            )}
          </div>
        </div>
        {children.map(child => (
          <TaskItem key={child.id} task={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  const stats = useMemo(() => {
    const total = tasks.data?.length ?? 0;
    const completed = tasks.data?.filter(t => t.status === 'completed').length ?? 0;
    const inProgress = tasks.data?.filter(t => t.status === 'in_progress').length ?? 0;
    const pending = tasks.data?.filter(t => t.status === 'pending').length ?? 0;
    return { total, completed, inProgress, pending };
  }, [tasks.data]);

  return (
    <div className="p-4 border-l border-border">
      <h3 className="font-semibold mb-2">Agent Task Plan</h3>

      {/* Stats */}
      <div className="mb-4 p-2 bg-muted rounded text-xs">
        <div className="flex justify-between">
          <span>Total: {stats.total}</span>
          <span>✅ {stats.completed}</span>
          <span>🔄 {stats.inProgress}</span>
          <span>⏳ {stats.pending}</span>
        </div>
        {stats.total > 0 && (
          <div className="mt-2 h-1 bg-background rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{ width: `${(stats.completed / stats.total) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="space-y-1">
        {taskTree.rootTasks.map(task => (
          <TaskItem key={task.id} task={task} />
        ))}
        {stats.total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tasks yet. The agent will create tasks as it plans its work.
          </p>
        )}
      </div>
    </div>
  );
}

// apps/web/src/components/chat/chat-panel.tsx
// ADD: Toggle for tasks panel
const [showTasks, setShowTasks] = useState(true); // Default to showing tasks

<div className="flex-1 flex">
  <div className="flex-1">
    {/* Existing chat UI */}
  </div>
  {showTasks && selectedThreadId && (
    <AgentTasksPanel threadId={selectedThreadId} />
  )}
  {showRules && selectedThreadId && (
    <AgentRulesPanel threadId={selectedThreadId} />
  )}
</div>
```

## Implementation Priority (UPDATED)

1. **CRITICAL - Connect MCP Tools** (Without this, agents are useless)
2. **CRITICAL - Tool Call Iteration Loop** (Enable multi-step reasoning)
3. **HIGH - Display Tool Calls in UI** (Transparency for users)
4. **HIGH - Agent Task Planning** (Let agents plan and track their work)
5. **MEDIUM - Context Window Indicator** (Prevent context overflow)
6. **MEDIUM - Inject Project Context** (Make agents project-aware)
7. **MEDIUM - Agent Rules Management** (Collaborative rule-setting)
8. **LOW - Multiple Conversations** (Nice to have, not blocking)

## Testing Strategy

For each change:

1. Write unit tests for new services
2. Write integration tests for tool execution
3. Update existing chat tests
4. Maintain >75% coverage
5. Test with MCP Inspector before production
