import { beforeEach, describe, expect, it } from "vitest";
import {
  AGENT_MODES,
  buildSystemPrompt,
  createAgentMode,
  deleteAgentMode,
  filterToolsForMode,
  getAgentModeConfig,
  getAgentModeById,
  getAllAgentModes,
  isToolAllowedForMode,
  listCustomAgentModes,
  updateAgentMode,
  validateToolNames,
} from "@/services/agent-mode-service";
import type { ToolDefinition } from "@/services/llm-service";
import { resetTestDb } from "@tests/helpers/db";

beforeEach(async () => {
  await resetTestDb();
});

// ─── AGENT_MODES Configuration ──────────────────────────────────────────────────

describe("AGENT_MODES", () => {
  it("should define all built-in modes", () => {
    expect(Object.keys(AGENT_MODES)).toEqual([
      "assistant",
      "planner",
      "editor",
      "researcher",
      "art_director",
    ]);
  });

  it("assistant mode should allow all tools", () => {
    const assistantTools = AGENT_MODES.assistant.allowedTools;
    expect(assistantTools).toHaveLength(14);
    expect(assistantTools).toContain("get_node");
    expect(assistantTools).toContain("get_node_content");
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
      "get_node",
      "get_node_content",
      "create_node",
      "move_node",
      "list_nodes",
      "add_tag",
    ]);
  });

  it("editor mode should only allow content refinement tools", () => {
    const editorTools = AGENT_MODES.editor.allowedTools;
    expect(editorTools).toEqual([
      "get_node",
      "get_node_content",
      "update_node",
      "search_nodes",
      "list_nodes",
    ]);
  });

  it("researcher mode should only allow research tools", () => {
    const researcherTools = AGENT_MODES.researcher.allowedTools;
    expect(researcherTools).toEqual([
      "get_node",
      "get_node_content",
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
    await expect(
      filterToolsForMode("unknown" as any, allTools),
    ).rejects.toThrow("Unknown agent mode: unknown");
  });
});

// ─── validateToolNames ──────────────────────────────────────────────────────────

describe("validateToolNames", () => {
  it("should return only invalid tool names", () => {
    const invalidToolNames = validateToolNames(
      ["create_node", "unknown_tool", "list_nodes", "missing_tool"],
      ["create_node", "list_nodes", "search_nodes"],
    );

    expect(invalidToolNames).toEqual(["unknown_tool", "missing_tool"]);
  });

  it("should return an empty array when all tool names are valid", () => {
    const invalidToolNames = validateToolNames(
      ["create_node", "list_nodes"],
      ["create_node", "list_nodes", "search_nodes"],
    );

    expect(invalidToolNames).toEqual([]);
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

  it("should return all built-in modes when queried individually", async () => {
    for (const modeName of [
      "assistant",
      "planner",
      "editor",
      "researcher",
      "art_director",
    ]) {
      const config = await getAgentModeConfig(modeName);
      expect(config).not.toBeNull();
      expect(config!.name).toBe(modeName);
    }
  });
});

// ─── getAllAgentModes ────────────────────────────────────────────────────────────

describe("getAllAgentModes", () => {
  it("should return all built-in modes as array", async () => {
    const modes = await getAllAgentModes();
    expect(modes).toHaveLength(5);
    const names = modes.map((m) => m.name);
    expect(names).toContain("assistant");
    expect(names).toContain("planner");
    expect(names).toContain("editor");
    expect(names).toContain("researcher");
    expect(names).toContain("art_director");
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

// ─── CRUD Operations ───────────────────────────────────────────────────────────

describe("createAgentMode", () => {
  it("should create a custom agent mode", async () => {
    const createdMode = await createAgentMode({
      name: "story_coach",
      displayName: "Story Coach",
      description: "Helps strengthen scenes and story beats.",
      allowedTools: ["list_nodes", "update_node"],
      guidelines: "Focus on pacing and scene clarity.",
      temperature: 0.55,
    });

    expect(createdMode.name).toBe("story_coach");
    expect(createdMode.displayName).toBe("Story Coach");
    expect(createdMode.allowedTools).toEqual(["list_nodes", "update_node"]);
    expect(createdMode.temperature).toBe(0.55);
    expect(createdMode.isBuiltIn).toBe(false);
  });
});

describe("getAgentModeById", () => {
  it("should return a created custom mode by id", async () => {
    const createdMode = await createAgentMode({
      name: "line_editor",
      displayName: "Line Editor",
      description: "Refines prose at the sentence level.",
      allowedTools: ["update_node", "search_nodes"],
      guidelines: "Focus on clarity, rhythm, and word choice.",
      temperature: 0.35,
    });

    const foundMode = await getAgentModeById(createdMode.id);

    expect(foundMode).not.toBeNull();
    expect(foundMode?.id).toBe(createdMode.id);
    expect(foundMode?.name).toBe("line_editor");
  });

  it("should return null for an unknown id", async () => {
    const foundMode = await getAgentModeById(
      "00000000-0000-0000-0000-000000000000",
    );

    expect(foundMode).toBeNull();
  });
});

describe("updateAgentMode", () => {
  it("should update a custom agent mode", async () => {
    const createdMode = await createAgentMode({
      name: "outline_helper",
      displayName: "Outline Helper",
      description: "Builds story outlines.",
      allowedTools: ["create_node", "list_nodes"],
      guidelines: "Keep outlines structured and concise.",
      temperature: 0.4,
    });

    const updatedMode = await updateAgentMode(createdMode.id, {
      displayName: "Outline Architect",
      description: "Builds and revises story outlines.",
      allowedTools: ["create_node", "move_node", "list_nodes"],
      guidelines: "Prefer clear hierarchy and concrete next steps.",
      temperature: 0.6,
    });

    expect(updatedMode.id).toBe(createdMode.id);
    expect(updatedMode.name).toBe("outline_helper");
    expect(updatedMode.displayName).toBe("Outline Architect");
    expect(updatedMode.allowedTools).toEqual([
      "create_node",
      "move_node",
      "list_nodes",
    ]);
    expect(updatedMode.temperature).toBe(0.6);
  });
});

describe("deleteAgentMode", () => {
  it("should delete a custom agent mode", async () => {
    const createdMode = await createAgentMode({
      name: "cleanup_mode",
      displayName: "Cleanup Mode",
      description: "Finds and fixes messy passages.",
      allowedTools: ["search_nodes", "update_node"],
      guidelines: "Prefer minimal, high-confidence edits.",
      temperature: 0.25,
    });

    const deleted = await deleteAgentMode(createdMode.id);
    const foundMode = await getAgentModeById(createdMode.id);

    expect(deleted).toBe(true);
    expect(foundMode).toBeNull();
  });

  it("should reject deleting a built-in mode", async () => {
    const assistantMode = await getAgentModeConfig("assistant");

    await expect(deleteAgentMode(assistantMode!.id)).rejects.toThrow(
      "Cannot delete built-in mode: assistant. Built-in modes are permanent.",
    );
  });
});

describe("listCustomAgentModes", () => {
  it("should return only custom modes", async () => {
    await createAgentMode({
      name: "scene_builder",
      displayName: "Scene Builder",
      description: "Improves scene construction.",
      allowedTools: ["create_node", "update_node"],
      guidelines: "Keep scenes focused on conflict and change.",
      temperature: 0.5,
    });
    await createAgentMode({
      name: "fact_checker",
      displayName: "Fact Checker",
      description: "Cross-checks project details.",
      allowedTools: ["search_nodes", "search_semantic", "list_nodes"],
      guidelines: "Prefer precise citations from the project.",
      temperature: 0.2,
    });

    const customModes = await listCustomAgentModes();
    const customModeNames = customModes.map((mode) => mode.name).sort();

    expect(customModeNames).toEqual(["fact_checker", "scene_builder"]);
    expect(customModes.every((mode) => mode.isBuiltIn === false)).toBe(true);
  });
});

// ─── isToolAllowedForMode ───────────────────────────────────────────────────────

describe("isToolAllowedForMode", () => {
  it("should return true for allowed tool in assistant mode", async () => {
    expect(await isToolAllowedForMode("assistant", "create_node")).toBe(true);
    expect(await isToolAllowedForMode("assistant", "delete_node")).toBe(true);
    expect(await isToolAllowedForMode("assistant", "search_semantic")).toBe(
      true,
    );
  });

  it("should return false for disallowed tool in planner mode", async () => {
    expect(await isToolAllowedForMode("planner", "delete_node")).toBe(false);
    expect(await isToolAllowedForMode("planner", "update_node")).toBe(false);
    expect(await isToolAllowedForMode("planner", "search_semantic")).toBe(
      false,
    );
  });

  it("should return true for allowed tool in planner mode", async () => {
    expect(await isToolAllowedForMode("planner", "create_node")).toBe(true);
    expect(await isToolAllowedForMode("planner", "move_node")).toBe(true);
    expect(await isToolAllowedForMode("planner", "add_tag")).toBe(true);
  });

  it("should return false for unknown mode", async () => {
    expect(await isToolAllowedForMode("unknown" as any, "create_node")).toBe(
      false,
    );
  });

  it("should return false for nonexistent tool", async () => {
    expect(await isToolAllowedForMode("assistant", "nonexistent_tool")).toBe(
      false,
    );
  });
});
