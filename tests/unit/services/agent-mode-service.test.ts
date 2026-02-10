import { describe, it, expect } from "vitest";
import {
  AGENT_MODES,
  buildSystemPrompt,
  filterToolsForMode,
  getAgentModeConfig,
  getAllAgentModes,
  isToolAllowedForMode,
  type AgentModeConfig,
} from "@/services/agent-mode-service";
import type { ToolDefinition } from "@/services/llm-service";

// ─── AGENT_MODES Configuration ──────────────────────────────────────────────────

describe("AGENT_MODES", () => {
  it("should define all four modes", () => {
    expect(Object.keys(AGENT_MODES)).toEqual([
      "assistant",
      "planner",
      "editor",
      "researcher",
    ]);
  });

  it("assistant mode should allow all 12 tools", () => {
    const assistantTools = AGENT_MODES.assistant.allowedTools;
    expect(assistantTools).toHaveLength(12);
    expect(assistantTools).toContain("create_node");
    expect(assistantTools).toContain("update_node");
    expect(assistantTools).toContain("delete_node");
    expect(assistantTools).toContain("move_node");
    expect(assistantTools).toContain("list_nodes");
    expect(assistantTools).toContain("search_nodes");
    expect(assistantTools).toContain("search_semantic");
    expect(assistantTools).toContain("add_tag");
    expect(assistantTools).toContain("remove_tag");
    expect(assistantTools).toContain("list_tags");
    expect(assistantTools).toContain("export_node");
    expect(assistantTools).toContain("export_project");
  });

  it("planner mode should only allow structural tools", () => {
    const plannerTools = AGENT_MODES.planner.allowedTools;
    expect(plannerTools).toEqual([
      "create_node",
      "move_node",
      "list_nodes",
      "add_tag",
    ]);
  });

  it("editor mode should only allow content refinement tools", () => {
    const editorTools = AGENT_MODES.editor.allowedTools;
    expect(editorTools).toEqual(["update_node", "search_nodes", "list_nodes"]);
  });

  it("researcher mode should only allow research tools", () => {
    const researcherTools = AGENT_MODES.researcher.allowedTools;
    expect(researcherTools).toEqual([
      "search_semantic",
      "search_nodes",
      "list_nodes",
      "list_tags",
    ]);
  });

  it("each mode should have a display name", () => {
    for (const mode of Object.values(AGENT_MODES)) {
      expect(mode.displayName).toBeDefined();
      expect(mode.displayName.length).toBeGreaterThan(0);
    }
  });

  it("each mode should have a description", () => {
    for (const mode of Object.values(AGENT_MODES)) {
      expect(mode.description).toBeDefined();
      expect(mode.description.length).toBeGreaterThan(10);
    }
  });

  it("each mode should have guidelines", () => {
    for (const mode of Object.values(AGENT_MODES)) {
      expect(mode.guidelines).toBeDefined();
      expect(mode.guidelines.length).toBeGreaterThan(10);
    }
  });

  it("each mode should have a temperature between 0 and 1", () => {
    for (const mode of Object.values(AGENT_MODES)) {
      expect(mode.temperature).toBeGreaterThanOrEqual(0);
      expect(mode.temperature).toBeLessThanOrEqual(1);
    }
  });

  it("planner should have lower temperature than assistant", () => {
    expect(AGENT_MODES.planner.temperature).toBeLessThan(
      AGENT_MODES.assistant.temperature,
    );
  });

  it("editor should have lower temperature than planner", () => {
    expect(AGENT_MODES.editor.temperature).toBeLessThan(
      AGENT_MODES.planner.temperature,
    );
  });
});

// ─── buildSystemPrompt ──────────────────────────────────────────────────────────

describe("buildSystemPrompt", () => {
  it("should generate a prompt for assistant mode", async () => {
    const prompt = await buildSystemPrompt("assistant");
    expect(prompt).toContain("You are Assistant");
    expect(prompt).toContain("Role:");
    expect(prompt).toContain("Available Tools:");
    expect(prompt).toContain("Guidelines:");
    expect(prompt).toContain("create_node");
  });

  it("should generate a prompt for planner mode", async () => {
    const prompt = await buildSystemPrompt("planner");
    expect(prompt).toContain("You are Planner");
    expect(prompt).toContain("create_node");
    expect(prompt).toContain("move_node");
    expect(prompt).not.toContain("delete_node");
  });

  it("should generate a prompt for editor mode", async () => {
    const prompt = await buildSystemPrompt("editor");
    expect(prompt).toContain("You are Editor");
    expect(prompt).toContain("update_node");
    expect(prompt).not.toContain("create_node");
  });

  it("should generate a prompt for researcher mode", async () => {
    const prompt = await buildSystemPrompt("researcher");
    expect(prompt).toContain("You are Researcher");
    expect(prompt).toContain("search_semantic");
    expect(prompt).not.toContain("delete_node");
  });

  it("should include project name when provided", async () => {
    const prompt = await buildSystemPrompt("assistant", "My Novel");
    expect(prompt).toContain("Current Project: My Novel");
  });

  it("should show 'No project selected' when no project given", async () => {
    const prompt = await buildSystemPrompt("assistant");
    expect(prompt).toContain("No project selected");
  });

  it("should throw for unknown mode", async () => {
    await expect(buildSystemPrompt("unknown" as any)).rejects.toThrow(
      "Unknown agent mode: unknown",
    );
  });
});

// ─── filterToolsForMode ─────────────────────────────────────────────────────────

describe("filterToolsForMode", () => {
  const allTools: ToolDefinition[] = [
    {
      type: "function",
      function: {
        name: "create_node",
        description: "Create a node",
        parameters: {},
      },
    },
    {
      type: "function",
      function: {
        name: "update_node",
        description: "Update a node",
        parameters: {},
      },
    },
    {
      type: "function",
      function: {
        name: "delete_node",
        description: "Delete a node",
        parameters: {},
      },
    },
    {
      type: "function",
      function: {
        name: "search_semantic",
        description: "Search semantically",
        parameters: {},
      },
    },
  ];

  it("should return all tools for assistant mode", async () => {
    const filtered = await filterToolsForMode("assistant", allTools);
    expect(filtered).toHaveLength(4);
  });

  it("should only return create_node for planner (from the subset)", async () => {
    const filtered = await filterToolsForMode("planner", allTools);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].function.name).toBe("create_node");
  });

  it("should only return update_node for editor (from the subset)", async () => {
    const filtered = await filterToolsForMode("editor", allTools);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].function.name).toBe("update_node");
  });

  it("should only return search_semantic for researcher (from the subset)", async () => {
    const filtered = await filterToolsForMode("researcher", allTools);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].function.name).toBe("search_semantic");
  });

  it("should return empty array when no tools match", async () => {
    const noMatchTools: ToolDefinition[] = [
      {
        type: "function",
        function: {
          name: "nonexistent_tool",
          description: "Does not exist",
          parameters: {},
        },
      },
    ];
    const filtered = await filterToolsForMode("planner", noMatchTools);
    expect(filtered).toHaveLength(0);
  });

  it("should throw for unknown mode", async () => {
    await expect(filterToolsForMode("unknown" as any, allTools)).rejects.toThrow(
      "Unknown agent mode: unknown",
    );
  });
});

// ─── getAgentModeConfig ─────────────────────────────────────────────────────────

describe("getAgentModeConfig", () => {
  it("should return config for valid mode", async () => {
    const config = await getAgentModeConfig("assistant");
    expect(config).not.toBeNull();
    expect(config!.name).toBe("assistant");
    expect(config!.displayName).toBe("Assistant");
  });

  it("should return null for invalid mode", async () => {
    const config = await getAgentModeConfig("nonexistent");
    expect(config).toBeNull();
  });

  it("should return all four modes when queried individually", async () => {
    for (const modeName of ["assistant", "planner", "editor", "researcher"]) {
      const config = await getAgentModeConfig(modeName);
      expect(config).not.toBeNull();
      expect(config!.name).toBe(modeName);
    }
  });
});

// ─── getAllAgentModes ────────────────────────────────────────────────────────────

describe("getAllAgentModes", () => {
  it("should return all four modes as array", async () => {
    const modes = await getAllAgentModes();
    expect(modes).toHaveLength(4);
    const names = modes.map((m) => m.name);
    expect(names).toContain("assistant");
    expect(names).toContain("planner");
    expect(names).toContain("editor");
    expect(names).toContain("researcher");
  });

  it("should return AgentModeConfig objects", async () => {
    const modes = await getAllAgentModes();
    for (const mode of modes) {
      expect(mode).toHaveProperty("name");
      expect(mode).toHaveProperty("displayName");
      expect(mode).toHaveProperty("description");
      expect(mode).toHaveProperty("allowedTools");
      expect(mode).toHaveProperty("guidelines");
      expect(mode).toHaveProperty("temperature");
    }
  });
});

// ─── isToolAllowedForMode ───────────────────────────────────────────────────────

describe("isToolAllowedForMode", () => {
  it("should return true for allowed tool in assistant mode", async () => {
    expect(await isToolAllowedForMode("assistant", "create_node")).toBe(true);
    expect(await isToolAllowedForMode("assistant", "delete_node")).toBe(true);
    expect(await isToolAllowedForMode("assistant", "search_semantic")).toBe(true);
  });

  it("should return false for disallowed tool in planner mode", async () => {
    expect(await isToolAllowedForMode("planner", "delete_node")).toBe(false);
    expect(await isToolAllowedForMode("planner", "update_node")).toBe(false);
    expect(await isToolAllowedForMode("planner", "search_semantic")).toBe(false);
  });

  it("should return true for allowed tool in planner mode", async () => {
    expect(await isToolAllowedForMode("planner", "create_node")).toBe(true);
    expect(await isToolAllowedForMode("planner", "move_node")).toBe(true);
    expect(await isToolAllowedForMode("planner", "add_tag")).toBe(true);
  });

  it("should return false for unknown mode", async () => {
    expect(await isToolAllowedForMode("unknown" as any, "create_node")).toBe(false);
  });

  it("should return false for nonexistent tool", async () => {
    expect(await isToolAllowedForMode("assistant", "nonexistent_tool")).toBe(false);
  });
});
