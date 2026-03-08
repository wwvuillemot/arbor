/**
 * MCP Integration Service
 *
 * Bridges the MCP server with the chat system, converting MCP tools to LLM tool definitions
 * and executing MCP tools when the LLM requests them.
 */

import { buildMcpToolDefinitions } from "./mcp-tool-definitions";
import type { ToolDefinition } from "./llm-service";
export { executeMCPTool } from "./mcp-tool-executor";

/**
 * Get all MCP tools as LLM ToolDefinition format
 */
export async function getMCPTools(): Promise<ToolDefinition[]> {
  return buildMcpToolDefinitions();
}
