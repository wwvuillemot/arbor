import { eq } from "drizzle-orm";
import { db } from "../db/index";
import {
  agentModes,
  type AgentModeRow,
  type NewAgentModeRow,
} from "../db/schema";
import type { AgentModeConfig } from "./agent-mode-types";

export interface CreateAgentModeParams {
  name: string;
  displayName: string;
  description: string;
  allowedTools: string[];
  guidelines: string;
  temperature: number;
}

export interface UpdateAgentModeParams {
  displayName?: string;
  description?: string;
  allowedTools?: string[];
  guidelines?: string;
  temperature?: number;
}

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

async function getStoredAgentModeRowById(
  id: string,
): Promise<AgentModeRow | null> {
  const [row] = await db.select().from(agentModes).where(eq(agentModes.id, id));
  return row ?? null;
}

export async function createStoredAgentMode(
  params: CreateAgentModeParams,
): Promise<AgentModeConfig> {
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

export async function updateStoredAgentMode(
  id: string,
  params: UpdateAgentModeParams,
): Promise<AgentModeConfig> {
  const existingMode = await getStoredAgentModeRowById(id);

  if (!existingMode) {
    throw new Error(`Agent mode not found: ${id}`);
  }

  const updates: Partial<NewAgentModeRow> = {
    updatedAt: new Date(),
  };

  if (params.displayName !== undefined) {
    updates.displayName = params.displayName;
  }
  if (params.description !== undefined) {
    updates.description = params.description;
  }
  if (params.allowedTools !== undefined) {
    updates.allowedTools = params.allowedTools;
  }
  if (params.guidelines !== undefined) {
    updates.guidelines = params.guidelines;
  }
  if (params.temperature !== undefined) {
    updates.temperature = params.temperature.toFixed(2);
  }

  const [updatedMode] = await db
    .update(agentModes)
    .set(updates)
    .where(eq(agentModes.id, id))
    .returning();

  if (!updatedMode) {
    throw new Error(`Agent mode not found: ${id}`);
  }

  return rowToConfig(updatedMode);
}

export async function deleteStoredAgentMode(id: string): Promise<boolean> {
  const existingMode = await getStoredAgentModeRowById(id);

  if (!existingMode) {
    throw new Error(`Agent mode not found: ${id}`);
  }

  if (existingMode.isBuiltIn) {
    throw new Error(
      `Cannot delete built-in mode: ${existingMode.name}. Built-in modes are permanent.`,
    );
  }

  const result = await db
    .delete(agentModes)
    .where(eq(agentModes.id, id))
    .returning({ id: agentModes.id });

  return result.length > 0;
}

export async function getStoredAgentModes(): Promise<AgentModeConfig[]> {
  const rows = await db.select().from(agentModes);
  return rows.map(rowToConfig);
}

export async function getStoredAgentModeConfig(
  modeName: string,
): Promise<AgentModeConfig | null> {
  const [row] = await db
    .select()
    .from(agentModes)
    .where(eq(agentModes.name, modeName));

  return row ? rowToConfig(row) : null;
}

export async function getStoredAgentModeById(
  id: string,
): Promise<AgentModeConfig | null> {
  const row = await getStoredAgentModeRowById(id);
  return row ? rowToConfig(row) : null;
}

export async function listStoredCustomAgentModes(): Promise<AgentModeConfig[]> {
  const rows = await db
    .select()
    .from(agentModes)
    .where(eq(agentModes.isBuiltIn, false));

  return rows.map(rowToConfig);
}
