/**
 * Agent Mode Service
 *
 * Defines agent mode configurations, system prompt templates,
 * and tool filtering logic for the chat system.
 *
 * Modes:
 *   - assistant: General-purpose helper, all tools available
 *   - planner: Structure & organization focus, limited tools
 *   - editor: Content refinement & improvement, limited tools
 *   - researcher: Information gathering & synthesis, limited tools
 */

import type { AgentMode } from "../db/schema";
import type { ToolDefinition } from "./llm-service";

// ─── Agent Mode Configuration ──────────────────────────────────────────────────

export interface AgentModeConfig {
  /** Mode identifier */
  name: AgentMode;
  /** Human-readable display name */
  displayName: string;
  /** Description of what this mode does */
  description: string;
  /** Tool names this mode is allowed to use */
  allowedTools: string[];
  /** Specific behavioral guidelines for the LLM */
  guidelines: string;
  /** Suggested temperature for this mode */
  temperature: number;
}

/**
 * All available agent mode configurations
 */
export const AGENT_MODES: Record<AgentMode, AgentModeConfig> = {
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
};

// ─── System Prompt Generation ──────────────────────────────────────────────────

/**
 * Generate a system prompt for the given agent mode and project context.
 */
export function buildSystemPrompt(
  mode: AgentMode,
  projectName?: string,
): string {
  const config = AGENT_MODES[mode];
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
export function filterToolsForMode(
  mode: AgentMode,
  allTools: ToolDefinition[],
): ToolDefinition[] {
  const config = AGENT_MODES[mode];
  if (!config) {
    throw new Error(`Unknown agent mode: ${mode}`);
  }

  return allTools.filter((tool) =>
    config.allowedTools.includes(tool.function.name),
  );
}

/**
 * Get the mode configuration for a given mode name.
 * Returns null if the mode is not recognized.
 */
export function getAgentModeConfig(mode: string): AgentModeConfig | null {
  if (mode in AGENT_MODES) {
    return AGENT_MODES[mode as AgentMode];
  }
  return null;
}

/**
 * Get all available mode configurations as an array.
 */
export function getAllAgentModes(): AgentModeConfig[] {
  return Object.values(AGENT_MODES);
}

/**
 * Check if a tool name is allowed for a given mode.
 */
export function isToolAllowedForMode(
  mode: AgentMode,
  toolName: string,
): boolean {
  const config = AGENT_MODES[mode];
  if (!config) {
    return false;
  }
  return config.allowedTools.includes(toolName);
}
