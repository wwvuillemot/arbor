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

import { type AgentMode } from "../db/schema";
import type { ToolDefinition } from "./llm-service";
import {
  AGENT_MODES,
  buildSystemPromptFromConfig,
  filterToolsForConfig,
  isBuiltInAgentModeName,
  isToolAllowedForConfig,
  validateToolNames,
} from "./agent-mode-helpers";
import {
  createStoredAgentMode,
  deleteStoredAgentMode,
  getStoredAgentModeById,
  getStoredAgentModeConfig,
  getStoredAgentModes,
  listStoredCustomAgentModes,
  updateStoredAgentMode,
  type CreateAgentModeParams,
  type UpdateAgentModeParams,
} from "./agent-mode-store";
import type { AgentModeConfig } from "./agent-mode-types";

export { AGENT_MODES, validateToolNames };
export type { AgentModeConfig };

// ─── CRUD Operations ───────────────────────────────────────────────────────────

/**
 * Create a new custom agent mode
 * @throws Error if name already exists or if trying to create a built-in mode
 */
export async function createAgentMode(
  params: CreateAgentModeParams,
): Promise<AgentModeConfig> {
  // Validate name format (alphanumeric + hyphens/underscores)
  if (!/^[a-z0-9_-]+$/.test(params.name)) {
    throw new Error(
      "Invalid mode name. Use only lowercase letters, numbers, hyphens, and underscores.",
    );
  }

  // Prevent creating modes with built-in names
  if (isBuiltInAgentModeName(params.name)) {
    throw new Error(
      `Cannot create mode with built-in name: ${params.name}. Built-in modes already exist.`,
    );
  }

  // Validate temperature range
  if (params.temperature < 0 || params.temperature > 2) {
    throw new Error("Temperature must be between 0.0 and 2.0");
  }

  return createStoredAgentMode(params);
}

/**
 * Update an existing agent mode (including built-in modes)
 * @throws Error if mode doesn't exist
 */
export async function updateAgentMode(
  id: string,
  params: UpdateAgentModeParams,
): Promise<AgentModeConfig> {
  // Validate temperature if provided
  if (params.temperature !== undefined) {
    if (params.temperature < 0 || params.temperature > 2) {
      throw new Error("Temperature must be between 0.0 and 2.0");
    }
  }

  return updateStoredAgentMode(id, params);
}

/**
 * Delete a custom agent mode
 * @throws Error if mode doesn't exist or if trying to delete a built-in mode
 */
export async function deleteAgentMode(id: string): Promise<boolean> {
  return deleteStoredAgentMode(id);
}

// ─── Query Operations ──────────────────────────────────────────────────────────

/**
 * Get all available mode configurations as an array.
 */
export async function getAllAgentModes(): Promise<AgentModeConfig[]> {
  return getStoredAgentModes();
}

/**
 * Get the mode configuration for a given mode name.
 * Returns null if the mode is not recognized.
 */
export async function getAgentModeConfig(
  mode: string,
): Promise<AgentModeConfig | null> {
  return getStoredAgentModeConfig(mode);
}

/**
 * Get the mode configuration by ID.
 * Returns null if the mode is not found.
 */
export async function getAgentModeById(
  id: string,
): Promise<AgentModeConfig | null> {
  return getStoredAgentModeById(id);
}

/**
 * List all custom (non-built-in) agent modes.
 */
export async function listCustomAgentModes(): Promise<AgentModeConfig[]> {
  return listStoredCustomAgentModes();
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

  return buildSystemPromptFromConfig(config, projectName);
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

  return filterToolsForConfig(config, allTools);
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
  return isToolAllowedForConfig(config, toolName);
}

// ─── Backward Compatibility ────────────────────────────────────────────────────
