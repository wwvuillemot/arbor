# MCP OS-Level Capabilities with Approval Controls

## Overview

This document outlines the plan to extend Arbor's MCP server with OS-level capabilities (filesystem, shell commands) while maintaining strict user approval controls for security.

## Current State

**Existing MCP Server** (`apps/mcp-server/src/server.ts`):

- ✅ Node operations (create, update, delete, move, list, search)
- ✅ Tag management (add, remove, list)
- ✅ Export functionality (markdown, HTML)
- ✅ Semantic search
- ✅ Resources (node://, project://list)
- ✅ Prompts (summarize_project, outline_structure)

**Limitations:**

- ❌ No filesystem access outside Arbor's database
- ❌ No shell command execution
- ❌ No file read/write operations
- ❌ No git operations

## Proposed Capabilities

### 1. Filesystem Operations

**Tools to Add:**

- `read_file` - Read file contents with path validation
- `write_file` - Write/create files with user approval
- `list_directory` - List directory contents
- `create_directory` - Create directories
- `delete_file` - Delete files (requires approval)
- `move_file` - Move/rename files
- `get_file_info` - Get file metadata (size, modified date, permissions)

**Security Controls:**

- Configurable allowed directories (whitelist)
- Path traversal prevention
- File size limits
- Extension filtering (optional)
- User approval for destructive operations

### 2. Shell Command Execution

**Tools to Add:**

- `execute_command` - Execute shell commands with approval
- `execute_script` - Run scripts with approval

**Security Controls:**

- **MANDATORY user approval** for ALL commands
- Command whitelist (optional - for auto-approved safe commands)
- Working directory restrictions
- Timeout limits
- Output size limits
- Environment variable controls

### 3. Git Operations

**Tools to Add:**

- `git_status` - Get repository status
- `git_diff` - Show changes
- `git_log` - View commit history
- `git_commit` - Commit changes (requires approval)
- `git_branch` - List/create branches
- `git_checkout` - Switch branches (requires approval)

**Security Controls:**

- Repository path validation
- Approval for write operations (commit, push, checkout)
- Read-only operations allowed without approval

## MCP Ecosystem Overview

### What is MCP CLI?

There are actually **multiple MCP CLI tools** in the ecosystem:

1. **MCP Inspector** (`@modelcontextprotocol/inspector`)
   - Official visual testing tool from Anthropic
   - Interactive UI for testing MCP servers
   - Run with: `npx @modelcontextprotocol/inspector node path/to/server.js`
   - **Use Case**: Development and debugging of MCP servers
   - **For Arbor**: We can use this to test our new filesystem/shell tools before integrating

2. **Third-Party MCP CLIs** (e.g., `mcp-cli`, `mcpc`)
   - Community-built command-line clients
   - Allow calling MCP server tools from terminal
   - **Use Case**: Scripting and automation
   - **For Arbor**: Could be used to automate Arbor operations from scripts

3. **MCP Clients** (Claude Desktop, IDEs, etc.)
   - Applications that connect to MCP servers
   - Claude Desktop is the most common MCP client
   - **Use Case**: End-user interaction with MCP servers
   - **For Arbor**: Our web/desktop app acts as an MCP client when using the agent

### How MCP CLI Fits Into Arbor

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Architecture                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  MCP CLIENTS (consume tools)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Claude       │  │ Arbor Web    │  │ MCP Inspector│      │
│  │ Desktop      │  │ App (Chat)   │  │ (Testing)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         └─────────────────┼──────────────────┘               │
│                           │                                  │
│                           ▼                                  │
│  MCP SERVER (provides tools)                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Arbor MCP Server (apps/mcp-server)                   │   │
│  │                                                       │   │
│  │ Current Tools:                                       │   │
│  │  • Node operations (create, update, delete)          │   │
│  │  • Tags, Export, Search                              │   │
│  │                                                       │   │
│  │ NEW Tools (with approval):                           │   │
│  │  • Filesystem (read_file, write_file, etc.)          │   │
│  │  • Shell (execute_command)                           │   │
│  │  • Git (status, commit, etc.)                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  APPROVAL SYSTEM (security layer)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • User approval dialog in Arbor web app              │   │
│  │ • Whitelist/blacklist rules                          │   │
│  │ • Audit logging                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Testing Workflow with MCP Inspector

**Before adding to production:**

```bash
# 1. Start Arbor MCP server in development mode
cd apps/mcp-server
pnpm dev

# 2. In another terminal, launch MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js

# 3. Test new tools interactively:
#    - Call read_file with different paths
#    - Test approval flow for write_file
#    - Verify execute_command shows approval dialog
#    - Check error handling for invalid paths
```

**Benefits:**

- ✅ Test tools without needing Claude Desktop
- ✅ Inspect request/response payloads
- ✅ Debug approval flow
- ✅ Verify security controls work correctly

### Integration Points

**Where approval happens:**

- **NOT in MCP CLI/Inspector** - These are just testing tools
- **IN the Arbor web app** - Real-time approval dialog
- **Flow**: MCP Server → Approval Service → Web App UI → User Decision → Execute

**Why this matters:**

- MCP Inspector can test the tools, but won't have the approval UI
- For testing, we can add a "test mode" that auto-approves
- In production, approval ALWAYS goes through the web app

## Implementation Plan

### Phase 0: Testing Infrastructure (NEW)

**Set up MCP Inspector for development:**

```bash
# Add to package.json scripts
"mcp:inspect": "npx @modelcontextprotocol/inspector node apps/mcp-server/dist/index.js"
```

**Create test mode flag:**

```typescript
// apps/mcp-server/src/server.ts
const TEST_MODE = process.env.MCP_TEST_MODE === 'true';

// In approval checks:
if (TEST_MODE) {
  console.log('[TEST MODE] Auto-approving:', operation);
  return true;
}
```

### Phase 1: Approval System Infrastructure

**Create Approval Service** (`apps/api/src/services/approval-service.ts`):

```typescript
interface ApprovalRequest {
  id: string;
  type: 'filesystem' | 'shell' | 'git';
  operation: string;
  details: Record<string, any>;
  timestamp: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}

class ApprovalService {
  async requestApproval(request: ApprovalRequest): Promise<boolean>
  async approveRequest(id: string): Promise<void>
  async rejectRequest(id: string): Promise<void>
  async getPendingRequests(): Promise<ApprovalRequest[]>
}
```

**UI Components:**

- Approval dialog in web app
- Real-time notifications for pending approvals
- Approval history view
- Settings for auto-approval rules

### Phase 2: Filesystem Tools

**Add to MCP Server:**

```typescript
server.registerTool('read_file', {
  title: 'Read File',
  description: 'Read contents of a file',
  inputSchema: {
    path: z.string(),
    encoding: z.enum(['utf-8', 'base64']).optional()
  }
}, async ({ path, encoding }) => {
  // Validate path is in allowed directories
  // Read file
  // Return contents
});

server.registerTool('write_file', {
  title: 'Write File',
  description: 'Write contents to a file (requires approval)',
  inputSchema: {
    path: z.string(),
    content: z.string(),
    encoding: z.enum(['utf-8', 'base64']).optional()
  }
}, async ({ path, content, encoding }) => {
  // Request user approval
  // Validate path
  // Write file
  // Return success
});
```

### Phase 3: Shell Command Tools

**Add to MCP Server:**

```typescript
server.registerTool('execute_command', {
  title: 'Execute Shell Command',
  description: 'Execute a shell command (ALWAYS requires user approval)',
  inputSchema: {
    command: z.string(),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    timeout: z.number().optional()
  }
}, async ({ command, args, cwd, timeout }) => {
  // ALWAYS request user approval with full command details
  // Show command, args, working directory
  // Execute if approved
  // Return stdout, stderr, exit code
});
```
