import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "@mcp/server";
import {
  createTestProject,
  createTestFolder,
  createTestNote,
} from "@tests/helpers/fixtures";

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
      expect(result.tools.length).toBe(3);
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
      const node = JSON.parse(result.contents[0].text as string);

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
      const projects = JSON.parse(result.contents[0].text as string);

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
});
