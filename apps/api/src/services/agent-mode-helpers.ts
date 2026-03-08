import type { ToolDefinition } from "./llm-service";
import type { AgentModeConfig } from "./agent-mode-types";

type BuiltInAgentModeDefinition = Pick<
  AgentModeConfig,
  | "name"
  | "displayName"
  | "description"
  | "allowedTools"
  | "guidelines"
  | "temperature"
>;

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
} satisfies Record<string, BuiltInAgentModeDefinition>;

type BuiltInAgentModeName = keyof typeof AGENT_MODES;

export const BUILT_IN_AGENT_MODE_NAMES = Object.keys(
  AGENT_MODES,
) as BuiltInAgentModeName[];

export function isBuiltInAgentModeName(name: string): boolean {
  return BUILT_IN_AGENT_MODE_NAMES.includes(name as BuiltInAgentModeName);
}

export function buildSystemPromptFromConfig(
  config: Pick<
    AgentModeConfig,
    "displayName" | "description" | "allowedTools" | "guidelines"
  >,
  projectName?: string,
): string {
  const availableToolList =
    config.allowedTools.length > 0
      ? config.allowedTools.join(", ")
      : "None (read-only mode)";

  const projectContextLine = projectName
    ? `Current Project: ${projectName}`
    : "No project selected";

  return `You are ${config.displayName}, an AI assistant for Arbor.

Role: ${config.description}

Available Tools: ${availableToolList}

Guidelines:
${config.guidelines}

${projectContextLine}`;
}

export function filterToolsForConfig(
  config: Pick<AgentModeConfig, "allowedTools">,
  allTools: ToolDefinition[],
): ToolDefinition[] {
  return allTools.filter((toolDefinition) =>
    config.allowedTools.includes(toolDefinition.function.name),
  );
}

export function isToolAllowedForConfig(
  config: Pick<AgentModeConfig, "allowedTools">,
  toolName: string,
): boolean {
  return config.allowedTools.includes(toolName);
}

export function validateToolNames(
  toolNames: string[],
  availableTools: string[],
): string[] {
  return toolNames.filter((toolName) => !availableTools.includes(toolName));
}
