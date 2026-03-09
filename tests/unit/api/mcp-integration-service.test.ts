import { beforeEach, describe, expect, it } from "vitest";
import {
  executeMCPTool,
  getMCPTools,
} from "@server/services/mcp-integration-service";
import { NodeService } from "@server/services/node-service";
import { TagService } from "@server/services/tag-service";
import { resetTestDb } from "@tests/helpers/db";
import {
  createTestNode,
  createTestProject,
  createTestNote,
} from "@tests/helpers/fixtures";

const nodeService = new NodeService();
const tagService = new TagService();

describe("mcp-integration-service", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("returns MCP tool definitions in LLM function format", async () => {
    const tools = await getMCPTools();
    const toolNames = tools.map((tool) => tool.function.name);
    const createNodeTool = tools.find(
      (tool) => tool.function.name === "create_node",
    );
    const exportProjectTool = tools.find(
      (tool) => tool.function.name === "export_project",
    );

    expect(toolNames).toEqual([
      "create_node",
      "update_node",
      "delete_node",
      "move_node",
      "get_node",
      "list_nodes",
      "search_nodes",
      "search_semantic",
      "add_tag",
      "remove_tag",
      "list_tags",
      "export_node",
      "export_project",
      "get_node_content",
      "generate_image",
    ]);
    expect(tools.every((tool) => tool.type === "function")).toBe(true);
    expect(createNodeTool?.function.parameters).toMatchObject({
      type: "object",
      required: ["type", "name"],
    });
    expect(exportProjectTool?.function.parameters).toMatchObject({
      type: "object",
      required: ["projectId"],
    });
  });

  it("creates nodes with chat-agent provenance", async () => {
    const rawResult = await executeMCPTool("create_node", {
      type: "project",
      name: "Agent Created Project",
    });

    const createdNode = JSON.parse(rawResult);

    expect(createdNode.name).toBe("Agent Created Project");
    expect(createdNode.type).toBe("project");
    expect(createdNode.createdBy).toBe("llm:chat-agent");
    expect(createdNode.updatedBy).toBe("llm:chat-agent");
  });

  it("preserves existing image nodes when markdown updates replace content", async () => {
    const project = await createTestProject("Illustrated Project");
    const note = await createTestNode({
      type: "note",
      name: "Illustrated Note",
      parentId: project.id,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Original copy" }],
          },
          {
            type: "image",
            attrs: {
              src: "https://example.com/dragon.png",
              alt: "Dragon concept art",
            },
          },
        ],
      },
    });

    const rawResult = await executeMCPTool("update_node", {
      id: note.id,
      content: "# Revised\n\nFresh narrative copy.",
    });

    const updatedNode = JSON.parse(rawResult);
    const storedNode = await nodeService.getNodeById(note.id);
    const storedContent = storedNode?.content as {
      content?: Array<{ type: string }>;
    };

    expect(updatedNode.updatedBy).toBe("llm:chat-agent");
    expect(storedContent.content?.some((node) => node.type === "heading")).toBe(
      true,
    );
    expect(storedContent.content?.some((node) => node.type === "image")).toBe(
      true,
    );
  });

  it("creates typed tags and associates them to nodes", async () => {
    const project = await createTestProject("Tagged Project");
    const note = await createTestNote("Tagged Note", project.id, "content");

    const rawResult = await executeMCPTool("add_tag", {
      nodeId: note.id,
      tagName: "Hero",
      tagType: "character",
    });

    const parsedResult = JSON.parse(rawResult);
    const nodeTags = await tagService.getNodeTags(note.id);

    expect(parsedResult.tagged).toBe(true);
    expect(parsedResult.tag.type).toBe("character");
    expect(nodeTags.map((tag) => tag.name)).toContain("Hero");
  });

  it("returns structured errors for unknown tools", async () => {
    const rawResult = await executeMCPTool("not_a_real_tool", { sample: true });
    const parsedResult = JSON.parse(rawResult);

    expect(parsedResult.error).toContain("Unknown tool");
    expect(parsedResult.toolName).toBe("not_a_real_tool");
    expect(parsedResult.args).toEqual({ sample: true });
  });
});
