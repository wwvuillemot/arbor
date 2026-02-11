/**
 * Agent Mode Service
 *
 * Manages agent mode configurations from the database.
 * Supports both built-in modes and custom user-created modes.
 *
 * Built-in modes (cannot be deleted/modified):
 *   - assistant: General-purpose helper, all tools available
 *   - planner: Structure & organization focus, limited tools
 *   - editor: Content refinement & improvement, limited tools
 *   - researcher: Information gathering & synthesis, limited tools
 *
 * Custom modes can be created with specific tool restrictions and guidelines.
 */

import { db } from "../db/index";
import {
  agentModes,
  type AgentMode,
  type AgentModeRow,
  type NewAgentModeRow,
} from "../db/schema";
import { eq } from "drizzle-orm";
import type { ToolDefinition } from "./llm-service";

// ─── Agent Mode Configuration ──────────────────────────────────────────────────

/**
 * Agent mode configuration interface
 * Matches the database schema but with parsed types
 */
export interface AgentModeConfig {
  /** Unique ID */
  id: string;
  /** Mode identifier (e.g., "assistant", "my-custom-mode") */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of what this mode does */
  description: string;
  /** Tool names this mode is allowed to use */
  allowedTools: string[];
  /** Specific behavioral guidelines for the LLM */
  guidelines: string;
  /** Suggested temperature for this mode (0.0 - 1.0) */
  temperature: number;
  /** Whether this is a built-in mode (cannot be deleted/modified) */
  isBuiltIn: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Convert database row to AgentModeConfig
 */
function rowToConfig(row: AgentModeRow): AgentModeConfig {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    allowedTools: row.allowedTools as string[],
    guidelines: row.guidelines,
    temperature: parseFloat(row.temperature),
    isBuiltIn: row.isBuiltIn,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── CRUD Operations ───────────────────────────────────────────────────────────

/**
 * Create a new custom agent mode
 * @throws Error if name already exists or if trying to create a built-in mode
 */
export async function createAgentMode(params: {
  name: string;
  displayName: string;
  description: string;
  allowedTools: string[];
  guidelines: string;
  temperature: number;
}): Promise<AgentModeConfig> {
  // Validate name format (alphanumeric + hyphens/underscores)
  if (!/^[a-z0-9_-]+$/.test(params.name)) {
    throw new Error(
      "Invalid mode name. Use only lowercase letters, numbers, hyphens, and underscores.",
    );
  }

  // Prevent creating modes with built-in names
  const builtInNames = ["assistant", "planner", "editor", "researcher"];
  if (builtInNames.includes(params.name)) {
    throw new Error(
      `Cannot create mode with built-in name: ${params.name}. Built-in modes already exist.`,
    );
  }

  // Validate temperature range
  if (params.temperature < 0 || params.temperature > 1) {
    throw new Error("Temperature must be between 0.0 and 1.0");
  }

  const [mode] = await db
    .insert(agentModes)
    .values({
      name: params.name,
      displayName: params.displayName,
      description: params.description,
      allowedTools: params.allowedTools,
      guidelines: params.guidelines,
      temperature: params.temperature.toFixed(2),
      isBuiltIn: false,
    })
    .returning();

  return rowToConfig(mode);
}

/**
 * Update an existing custom agent mode
 * @throws Error if mode doesn't exist or if trying to modify a built-in mode
 */
export async function updateAgentMode(
  id: string,
  params: Partial<{
    displayName: string;
    description: string;
    allowedTools: string[];
    guidelines: string;
    temperature: number;
  }>,
): Promise<AgentModeConfig> {
  // Check if mode exists and is not built-in
  const [existing] = await db
    .select()
    .from(agentModes)
    .where(eq(agentModes.id, id));

  if (!existing) {
    throw new Error(`Agent mode not found: ${id}`);
  }

  if (existing.isBuiltIn) {
    throw new Error(
      `Cannot modify built-in mode: ${existing.name}. Built-in modes are read-only.`,
    );
  }

  // Validate temperature if provided
  if (params.temperature !== undefined) {
    if (params.temperature < 0 || params.temperature > 1) {
      throw new Error("Temperature must be between 0.0 and 1.0");
    }
  }

  const updates: Partial<NewAgentModeRow> = {
    updatedAt: new Date(),
  };

  if (params.displayName !== undefined)
    updates.displayName = params.displayName;
  if (params.description !== undefined)
    updates.description = params.description;
  if (params.allowedTools !== undefined)
    updates.allowedTools = params.allowedTools;
  if (params.guidelines !== undefined) updates.guidelines = params.guidelines;
  if (params.temperature !== undefined)
    updates.temperature = params.temperature.toFixed(2);

  const [updated] = await db
    .update(agentModes)
    .set(updates)
    .where(eq(agentModes.id, id))
    .returning();

  return rowToConfig(updated);
}

/**
 * Delete a custom agent mode
 * @throws Error if mode doesn't exist or if trying to delete a built-in mode
 */
export async function deleteAgentMode(id: string): Promise<boolean> {
  // Check if mode exists and is not built-in
  const [existing] = await db
    .select()
    .from(agentModes)
    .where(eq(agentModes.id, id));

  if (!existing) {
    throw new Error(`Agent mode not found: ${id}`);
  }

  if (existing.isBuiltIn) {
    throw new Error(
      `Cannot delete built-in mode: ${existing.name}. Built-in modes are permanent.`,
    );
  }

  const result = await db
    .delete(agentModes)
    .where(eq(agentModes.id, id))
    .returning({ id: agentModes.id });

  return result.length > 0;
}

// ─── Query Operations ──────────────────────────────────────────────────────────

/**
 * Get all available mode configurations as an array.
 */
export async function getAllAgentModes(): Promise<AgentModeConfig[]> {
  const rows = await db.select().from(agentModes);
  return rows.map(rowToConfig);
}

/**
 * Get the mode configuration for a given mode name.
 * Returns null if the mode is not recognized.
 */
export async function getAgentModeConfig(
  mode: string,
): Promise<AgentModeConfig | null> {
  const [row] = await db
    .select()
    .from(agentModes)
    .where(eq(agentModes.name, mode));

  return row ? rowToConfig(row) : null;
}

/**
 * Get the mode configuration by ID.
 * Returns null if the mode is not found.
 */
export async function getAgentModeById(
  id: string,
): Promise<AgentModeConfig | null> {
  const [row] = await db.select().from(agentModes).where(eq(agentModes.id, id));

  return row ? rowToConfig(row) : null;
}

/**
 * List all custom (non-built-in) agent modes.
 */
export async function listCustomAgentModes(): Promise<AgentModeConfig[]> {
  const rows = await db
    .select()
    .from(agentModes)
    .where(eq(agentModes.isBuiltIn, false));

  return rows.map(rowToConfig);
}

// ─── System Prompt Generation ──────────────────────────────────────────────────

/**
 * Generate a system prompt for the given agent mode and project context.
 */
export async function buildSystemPrompt(
  mode: AgentMode,
  projectName?: string,
): Promise<string> {
  const config = await getAgentModeConfig(mode);
  if (!config) {
    throw new Error(`Unknown agent mode: ${mode}`);
  }

  const toolList =
    config.allowedTools.length > 0
      ? config.allowedTools.join(", ")
      : "None (read-only mode)";

  const projectLine = projectName
    ? `Current Project: ${projectName}`
    : "No project selected";

  return `You are ${config.displayName}, an AI assistant for Arbor.

Role: ${config.description}

Available Tools: ${toolList}

Guidelines:
${config.guidelines}

${projectLine}`;
}

// ─── Tool Filtering ────────────────────────────────────────────────────────────

/**
 * Filter tool definitions to only include tools allowed by the given mode.
 */
export async function filterToolsForMode(
  mode: AgentMode,
  allTools: ToolDefinition[],
): Promise<ToolDefinition[]> {
  const config = await getAgentModeConfig(mode);
  if (!config) {
    throw new Error(`Unknown agent mode: ${mode}`);
  }

  return allTools.filter((tool) =>
    config.allowedTools.includes(tool.function.name),
  );
}

/**
 * Check if a tool name is allowed for a given mode.
 */
export async function isToolAllowedForMode(
  mode: AgentMode,
  toolName: string,
): Promise<boolean> {
  const config = await getAgentModeConfig(mode);
  if (!config) {
    return false;
  }
  return config.allowedTools.includes(toolName);
}

/**
 * Validate tool names against available MCP tools
 * @param toolNames Array of tool names to validate
 * @param availableTools Array of available tool names from MCP
 * @returns Array of invalid tool names (empty if all valid)
 */
export function validateToolNames(
  toolNames: string[],
  availableTools: string[],
): string[] {
  return toolNames.filter((name) => !availableTools.includes(name));
}

// ─── Backward Compatibility ────────────────────────────────────────────────────

/**
 * DEPRECATED: Hardcoded agent modes for backward compatibility with tests.
 * New code should use getAllAgentModes() or getAgentModeConfig() instead.
 * This will be removed in a future version.
 */
export const AGENT_MODES = {
  assistant: {
    name: "assistant",
    displayName: "Assistant",
    description:
      "General-purpose writing assistant. Helps with brainstorming, drafting, editing, organizing, and any other writing tasks.",
    allowedTools: [
      "create_node",
      "update_node",
      "delete_node",
      "move_node",
      "list_nodes",
      "search_nodes",
      "search_semantic",
      "add_tag",
      "remove_tag",
      "list_tags",
      "export_node",
      "export_project",
    ],
    guidelines: `- Be helpful and versatile across all writing tasks
- Balance creativity with accuracy
- Offer suggestions proactively when appropriate
- Use all available tools to assist the user
- Maintain a friendly, collaborative tone`,
    temperature: 0.7,
  },
  planner: {
    name: "planner",
    displayName: "Planner",
    description:
      "Focuses on story structure, project organization, and outlining. Helps plan chapters, scenes, character arcs, and narrative flow.",
    allowedTools: ["create_node", "move_node", "list_nodes", "add_tag"],
    guidelines: `- Focus on high-level structure and organization
- Think about narrative arcs, pacing, and flow
- Suggest hierarchical structures for projects
- Help create outlines and chapter plans
- Prioritize logical reasoning over creative generation
- Ask clarifying questions about story goals and structure`,
    temperature: 0.4,
  },
  editor: {
    name: "editor",
    displayName: "Editor",
    description:
      "Content refinement specialist. Focuses on improving clarity, grammar, style, tone, and readability of existing text.",
    allowedTools: ["update_node", "search_nodes", "list_nodes"],
    guidelines: `- Focus on improving existing text, not generating new content
- Pay attention to clarity, grammar, spelling, and punctuation
- Maintain the author's voice while suggesting improvements
- Provide specific, actionable feedback
- Consider readability, sentence structure, and paragraph flow
- Flag inconsistencies in tone or style`,
    temperature: 0.3,
  },
  researcher: {
    name: "researcher",
    displayName: "Researcher",
    description:
      "Information gathering and synthesis. Helps find relevant content within the project, identify patterns, and compile research notes.",
    allowedTools: [
      "search_semantic",
      "search_nodes",
      "list_nodes",
      "list_tags",
    ],
    guidelines: `- Focus on finding and synthesizing information from the project
- Cite specific nodes and content when referencing material
- Identify patterns, themes, and connections across the project
- Provide accurate, well-organized summaries
- Suggest areas that need more research or development
- Prioritize accuracy over creativity`,
    temperature: 0.2,
  },
} as const;
