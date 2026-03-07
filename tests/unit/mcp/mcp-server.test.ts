import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "@mcp/server";
import {
  createTestProject,
  createTestFolder,
  createTestNote,
} from "@tests/helpers/fixtures";
import { TagService } from "@server/services/tag-service";
import { NodeService } from "@server/services/node-service";

describe("MCP Server", () => {
  let client: Client;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const server = createMcpServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  // ─── Tool Discovery ─────────────────────────────────────────────────

  describe("tool discovery", () => {
    it("should list all registered tools", async () => {
      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      expect(toolNames).toContain("create_node");
      expect(toolNames).toContain("update_node");
      expect(toolNames).toContain("search_nodes");
      expect(toolNames).toContain("delete_node");
      expect(toolNames).toContain("move_node");
      expect(toolNames).toContain("list_nodes");
      expect(toolNames).toContain("search_semantic");
      expect(toolNames).toContain("add_tag");
      expect(toolNames).toContain("remove_tag");
      expect(toolNames).toContain("list_tags");
      expect(toolNames).toContain("export_node");
      expect(toolNames).toContain("export_project");
      expect(result.tools.length).toBe(12);
    });

    it("should have proper descriptions for each tool", async () => {
      const result = await client.listTools();
      const createNodeTool = result.tools.find((t) => t.name === "create_node");

      expect(createNodeTool).toBeDefined();
      expect(createNodeTool!.description).toContain("Create a new node");
    });
  });

  // ─── create_node Tool ───────────────────────────────────────────────

  describe("create_node tool", () => {
    it("should create a project node", async () => {
      const result = await client.callTool({
        name: "create_node",
        arguments: { type: "project", name: "MCP Test Project" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const node = JSON.parse(content[0].text);

      expect(node.name).toBe("MCP Test Project");
      expect(node.type).toBe("project");
      expect(node.id).toBeDefined();
      expect(node.createdBy).toBe("llm:mcp-client");
    });

    it("should create a note under a project", async () => {
      const project = await createTestProject("Parent Project");

      const result = await client.callTool({
        name: "create_node",
        arguments: {
          type: "note",
          name: "Test Note",
          parentId: project.id,
          content: { text: "Hello from MCP" },
        },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const node = JSON.parse(content[0].text);

      expect(node.name).toBe("Test Note");
      expect(node.parentId).toBe(project.id);
    });
  });

  // ─── update_node Tool ───────────────────────────────────────────────

  describe("update_node tool", () => {
    it("should update a node name", async () => {
      const project = await createTestProject("Original Name");

      const result = await client.callTool({
        name: "update_node",
        arguments: { id: project.id, name: "Updated Name" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const node = JSON.parse(content[0].text);

      expect(node.name).toBe("Updated Name");
      expect(node.updatedBy).toBe("llm:mcp-client");
    });
  });

  // ─── search_nodes Tool ──────────────────────────────────────────────

  describe("search_nodes tool", () => {
    it("should search nodes by name", async () => {
      await createTestProject("Searchable Alpha");
      await createTestProject("Searchable Beta");
      await createTestProject("Other Project");

      const result = await client.callTool({
        name: "search_nodes",
        arguments: { query: "Searchable" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const nodes = JSON.parse(content[0].text);

      expect(nodes.length).toBe(2);
    });

    it("should search nodes by type", async () => {
      const project = await createTestProject("Type Search Project");
      await createTestNote("A Note", project.id, "content");

      const result = await client.callTool({
        name: "search_nodes",
        arguments: { type: "note" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const nodes = JSON.parse(content[0].text);

      expect(nodes.length).toBeGreaterThanOrEqual(1);
      expect(nodes.every((n: any) => n.type === "note")).toBe(true);
    });

    it("should return all nodes when no filters provided", async () => {
      await createTestProject("All Nodes Project");

      const result = await client.callTool({
        name: "search_nodes",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const nodes = JSON.parse(content[0].text);

      expect(nodes.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Resources ────────────────────────────────────────────────────────

  describe("resources", () => {
    it("should list resource templates", async () => {
      const result = await client.listResourceTemplates();

      const templateUris = result.resourceTemplates.map((t) => t.uriTemplate);
      expect(templateUris).toContain("node:///{id}");
    });

    it("should list static resources", async () => {
      const result = await client.listResources();

      const resourceUris = result.resources.map((r) => r.uri);
      expect(resourceUris).toContain("project://list");
    });

    it("should read a node resource by ID", async () => {
      const project = await createTestProject("Resource Test Project");

      const result = await client.readResource({
        uri: `node:///${project.id}`,
      });

      expect(result.contents.length).toBe(1);
      const node = JSON.parse((result.contents[0] as { text: string }).text);

      expect(node.name).toBe("Resource Test Project");
      expect(node.type).toBe("project");
    });

    it("should return error for non-existent node resource", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await expect(
        client.readResource({ uri: `node:///${fakeId}` }),
      ).rejects.toThrow();
    });

    it("should read project list resource", async () => {
      await createTestProject("Project Alpha");
      await createTestProject("Project Beta");

      const result = await client.readResource({ uri: "project://list" });

      expect(result.contents.length).toBe(1);
      const projects = JSON.parse(
        (result.contents[0] as { text: string }).text,
      );

      expect(projects.length).toBeGreaterThanOrEqual(2);
      expect(projects.every((p: any) => p.type === "project")).toBe(true);
    });
  });

  // ─── Prompts ──────────────────────────────────────────────────────────

  describe("prompts", () => {
    it("should list all registered prompts", async () => {
      const result = await client.listPrompts();
      const promptNames = result.prompts.map((p) => p.name);

      expect(promptNames).toContain("summarize_project");
      expect(promptNames).toContain("outline_structure");
      expect(result.prompts.length).toBe(2);
    });

    it("should generate summarize_project prompt", async () => {
      const project = await createTestProject("Summary Test Project");
      await createTestNote("Chapter 1", project.id, "content");
      await createTestFolder("Research", project.id);

      const result = await client.getPrompt({
        name: "summarize_project",
        arguments: { projectId: project.id },
      });

      expect(result.messages.length).toBe(1);
      expect(result.messages[0].role).toBe("user");

      const text = (
        result.messages[0].content as { type: string; text: string }
      ).text;
      expect(text).toContain("Summary Test Project");
      expect(text).toContain("2 items");
    });

    it("should generate outline_structure prompt", async () => {
      const project = await createTestProject("Outline Test Project");
      await createTestNote("Scene 1", project.id, "content");

      const result = await client.getPrompt({
        name: "outline_structure",
        arguments: { projectId: project.id },
      });

      expect(result.messages.length).toBe(1);
      const text = (
        result.messages[0].content as { type: string; text: string }
      ).text;
      expect(text).toContain("Outline Test Project");
      expect(text).toContain("hierarchical outline");
    });

    it("should throw for non-existent project in prompt", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await expect(
        client.getPrompt({
          name: "summarize_project",
          arguments: { projectId: fakeId },
        }),
      ).rejects.toThrow();
    });
  });

  // ─── delete_node Tool ────────────────────────────────────────────────

  describe("delete_node tool", () => {
    it("should delete an existing node", async () => {
      const project = await createTestProject("To Delete");

      const result = await client.callTool({
        name: "delete_node",
        arguments: { id: project.id },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.deleted).toBe(true);
      expect(parsed.id).toBe(project.id);

      // Verify deletion
      const nodeService = new NodeService();
      const node = await nodeService.getNodeById(project.id);
      expect(node).toBeNull();
    });

    it("should cascade delete children", async () => {
      const project = await createTestProject("Parent To Delete");
      await createTestNote("Child Note", project.id, "content");

      const result = await client.callTool({
        name: "delete_node",
        arguments: { id: project.id },
      });

      expect(result.isError).toBeFalsy();
    });
  });

  // ─── move_node Tool ─────────────────────────────────────────────────

  describe("move_node tool", () => {
    it("should move a node to a new parent", async () => {
      const project1 = await createTestProject("Source Project");
      const project2 = await createTestProject("Target Project");
      const note = await createTestNote("Moving Note", project1.id, "content");

      const result = await client.callTool({
        name: "move_node",
        arguments: { id: note.id, newParentId: project2.id },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const moved = JSON.parse(content[0].text);
      expect(moved.parentId).toBe(project2.id);
    });

    it("should move a node with position", async () => {
      const project = await createTestProject("Move Pos Project");
      const folder = await createTestFolder("Target Folder", project.id);
      const note = await createTestNote("Pos Note", project.id, "content");

      const result = await client.callTool({
        name: "move_node",
        arguments: { id: note.id, newParentId: folder.id, position: 5 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const moved = JSON.parse(content[0].text);
      expect(moved.parentId).toBe(folder.id);
      expect(moved.position).toBe(5);
    });
  });

  // ─── list_nodes Tool ────────────────────────────────────────────────

  describe("list_nodes tool", () => {
    it("should list children of a parent", async () => {
      const project = await createTestProject("List Parent");
      await createTestNote("Note A", project.id, "a");
      await createTestNote("Note B", project.id, "b");
      await createTestFolder("Folder C", project.id);

      const result = await client.callTool({
        name: "list_nodes",
        arguments: { parentId: project.id },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const children = JSON.parse(content[0].text);
      expect(children.length).toBe(3);
    });

    it("should filter children by type", async () => {
      const project = await createTestProject("Filter Parent");
      await createTestNote("Note 1", project.id, "n1");
      await createTestNote("Note 2", project.id, "n2");
      await createTestFolder("Folder 1", project.id);

      const result = await client.callTool({
        name: "list_nodes",
        arguments: { parentId: project.id, type: "note" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const children = JSON.parse(content[0].text);
      expect(children.length).toBe(2);
      expect(children.every((c: any) => c.type === "note")).toBe(true);
    });

    it("should return empty array for parent with no children", async () => {
      const project = await createTestProject("Empty Parent");

      const result = await client.callTool({
        name: "list_nodes",
        arguments: { parentId: project.id },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const children = JSON.parse(content[0].text);
      expect(children.length).toBe(0);
    });
  });

  // ─── search_semantic Tool ───────────────────────────────────────────

  describe("search_semantic tool", () => {
    it("should search nodes by keyword", async () => {
      const project = await createTestProject("Semantic Search Project");
      await createTestNote("Dragon Lore", project.id, "Dragons breathe fire");
      await createTestNote("Elf History", project.id, "Elves live forever");

      const result = await client.callTool({
        name: "search_semantic",
        arguments: { query: "Dragon" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const results = JSON.parse(content[0].text);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].name).toContain("Dragon");
    });

    it("should respect topK limit", async () => {
      const project = await createTestProject("TopK Project");
      await createTestNote("Alpha Note", project.id, "alpha content");
      await createTestNote("Alpha Two", project.id, "alpha details");
      await createTestNote("Alpha Three", project.id, "alpha more");

      const result = await client.callTool({
        name: "search_semantic",
        arguments: { query: "Alpha", topK: 2 },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const results = JSON.parse(content[0].text);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should return empty array for no matches", async () => {
      const result = await client.callTool({
        name: "search_semantic",
        arguments: { query: "xyznonexistent12345" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const results = JSON.parse(content[0].text);
      expect(results.length).toBe(0);
    });
  });

  // ─── add_tag Tool ──────────────────────────────────────────────────

  describe("add_tag tool", () => {
    it("should create and add a new tag to a node", async () => {
      const project = await createTestProject("Tag Project");
      const note = await createTestNote("Tag Note", project.id, "content");

      const result = await client.callTool({
        name: "add_tag",
        arguments: { nodeId: note.id, tagName: "important" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.tagged).toBe(true);
      expect(parsed.tag.name).toBe("important");

      // Verify tag is on the node
      const tagService = new TagService();
      const nodeTags = await tagService.getNodeTags(note.id);
      expect(nodeTags).toHaveLength(1);
      expect(nodeTags[0].name).toBe("important");
    });

    it("should reuse existing tag by name", async () => {
      const tagService = new TagService();
      const existingTag = await tagService.createTag({
        name: "reuse-me",
        type: "general",
      });

      const project = await createTestProject("Reuse Tag Project");
      const note = await createTestNote("Reuse Note", project.id, "content");

      const result = await client.callTool({
        name: "add_tag",
        arguments: { nodeId: note.id, tagName: "reuse-me" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.tag.id).toBe(existingTag.id);
    });

    it("should create tag with specified type", async () => {
      const project = await createTestProject("Type Tag Project");
      const note = await createTestNote("Char Note", project.id, "content");

      const result = await client.callTool({
        name: "add_tag",
        arguments: {
          nodeId: note.id,
          tagName: "Hero",
          tagType: "character",
        },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.tag.type).toBe("character");
    });
  });

  // ─── remove_tag Tool ───────────────────────────────────────────────

  describe("remove_tag tool", () => {
    it("should remove an existing tag from a node", async () => {
      const tagService = new TagService();
      const project = await createTestProject("Remove Tag Project");
      const note = await createTestNote("Remove Note", project.id, "content");
      const tag = await tagService.createTag({ name: "to-remove" });
      await tagService.addTagToNode(note.id, tag.id);

      const result = await client.callTool({
        name: "remove_tag",
        arguments: { nodeId: note.id, tagName: "to-remove" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.removed).toBe(true);

      // Verify removal
      const nodeTags = await tagService.getNodeTags(note.id);
      expect(nodeTags).toHaveLength(0);
    });

    it("should return removed=false for non-existent tag on node", async () => {
      const project = await createTestProject("No Tag Project");
      const note = await createTestNote("No Tag Note", project.id, "content");

      const result = await client.callTool({
        name: "remove_tag",
        arguments: { nodeId: note.id, tagName: "nonexistent" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(content[0].text);
      expect(parsed.removed).toBe(false);
    });
  });

  // ─── list_tags Tool ────────────────────────────────────────────────

  describe("list_tags tool", () => {
    it("should list all tags", async () => {
      const tagService = new TagService();
      await tagService.createTag({ name: "tag-a", type: "general" });
      await tagService.createTag({ name: "tag-b", type: "character" });
      await tagService.createTag({ name: "tag-c", type: "location" });

      const result = await client.callTool({
        name: "list_tags",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const allTags = JSON.parse(content[0].text);
      expect(allTags.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter tags by type", async () => {
      const tagService = new TagService();
      await tagService.createTag({ name: "warrior", type: "character" });
      await tagService.createTag({ name: "castle", type: "location" });
      await tagService.createTag({ name: "mage", type: "character" });

      const result = await client.callTool({
        name: "list_tags",
        arguments: { type: "character" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const filteredTags = JSON.parse(content[0].text);
      expect(filteredTags.every((t: any) => t.type === "character")).toBe(true);
      expect(filteredTags.length).toBeGreaterThanOrEqual(2);
    });

    it("should return empty array when no tags exist of type", async () => {
      const result = await client.callTool({
        name: "list_tags",
        arguments: { type: "event" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      const allTags = JSON.parse(content[0].text);
      expect(allTags.length).toBe(0);
    });
  });

  // ─── export_node Tool ──────────────────────────────────────────────

  describe("export_node tool", () => {
    it("should export a node as markdown by default", async () => {
      const project = await createTestProject("Export Project");
      const note = await createTestNote("Export Note", project.id, "content");

      const result = await client.callTool({
        name: "export_node",
        arguments: { nodeId: note.id },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("Export Note");
    });

    it("should export a node as HTML", async () => {
      const project = await createTestProject("HTML Export Project");
      const note = await createTestNote("HTML Note", project.id, "content");

      const result = await client.callTool({
        name: "export_node",
        arguments: { nodeId: note.id, format: "html" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("<html");
    });
  });

  // ─── export_project Tool ──────────────────────────────────────────

  describe("export_project tool", () => {
    it("should export a project as markdown", async () => {
      const project = await createTestProject("Full Export");
      await createTestNote("Chapter 1", project.id, "chapter content");
      await createTestFolder("Research", project.id);

      const result = await client.callTool({
        name: "export_project",
        arguments: { projectId: project.id },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("Full Export");
      expect(content[0].text).toContain("Chapter 1");
    });

    it("should export a project as HTML", async () => {
      const project = await createTestProject("HTML Full Export");
      await createTestNote("Scene 1", project.id, "scene content");

      const result = await client.callTool({
        name: "export_project",
        arguments: { projectId: project.id, format: "html" },
      });

      expect(result.isError).toBeFalsy();
      const content = result.content as Array<{ type: string; text: string }>;
      expect(content[0].text).toContain("<html");
      expect(content[0].text).toContain("HTML Full Export");
    });
  });
});
