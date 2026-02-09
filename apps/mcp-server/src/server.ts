import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NodeService } from "@server/services/node-service";
import { db } from "@server/db/index";
import { nodes } from "@server/db/schema";
import { ilike, eq, and } from "drizzle-orm";

/**
 * Creates and configures the Arbor MCP server with tools, resources, and prompts.
 *
 * Tools:
 *   - create_node: Create a new node in the hierarchy
 *   - update_node: Update an existing node by ID
 *   - search_nodes: Search for nodes by name and/or type
 *
 * Resources:
 *   - node://{id}: Read a single node by ID
 *   - project://list: List all projects
 *
 * Prompts:
 *   - summarize_project: Generate a project summary prompt
 *   - outline_structure: Generate a project structure outline prompt
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "arbor-mcp",
    version: "0.1.0",
  });

  const nodeService = new NodeService();

  // ─── Tools ───────────────────────────────────────────────────────────

  server.registerTool(
    "create_node",
    {
      title: "Create Node",
      description:
        "Create a new node in the Arbor hierarchy (project, folder, note, etc.)",
      inputSchema: {
        type: z.enum([
          "project",
          "folder",
          "note",
          "link",
          "ai_suggestion",
          "audio_note",
        ]),
        name: z.string().min(1),
        parentId: z.string().uuid().optional(),
        content: z.any().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      },
    },
    async ({ type, name, parentId, content, metadata }) => {
      const node = await nodeService.createNode({
        type,
        name,
        parentId: parentId || null,
        content,
        metadata,
        createdBy: "llm:mcp-client",
        updatedBy: "llm:mcp-client",
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(node) }],
      };
    },
  );

  server.registerTool(
    "update_node",
    {
      title: "Update Node",
      description: "Update an existing node by its ID",
      inputSchema: {
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        content: z.any().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        position: z.number().int().optional(),
      },
    },
    async ({ id, name, content, metadata, position }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (content !== undefined) updates.content = content;
      if (metadata !== undefined) updates.metadata = metadata;
      if (position !== undefined) updates.position = position;
      updates.updatedBy = "llm:mcp-client";

      const node = await nodeService.updateNode(id, updates);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(node) }],
      };
    },
  );

  server.registerTool(
    "search_nodes",
    {
      title: "Search Nodes",
      description: "Search for nodes by name and/or type",
      inputSchema: {
        query: z.string().optional(),
        type: z
          .enum([
            "project",
            "folder",
            "note",
            "link",
            "ai_suggestion",
            "audio_note",
          ])
          .optional(),
      },
    },
    async ({ query, type }) => {
      const conditions = [];
      if (query) {
        conditions.push(ilike(nodes.name, `%${query}%`));
      }
      if (type) {
        conditions.push(eq(nodes.type, type));
      }

      const results =
        conditions.length > 0
          ? await db
              .select()
              .from(nodes)
              .where(and(...conditions))
              .limit(50)
          : await db.select().from(nodes).limit(50);

      return {
        content: [{ type: "text" as const, text: JSON.stringify(results) }],
      };
    },
  );

  // ─── Resources ───────────────────────────────────────────────────────

  server.registerResource(
    "node",
    new ResourceTemplate("node:///{id}", { list: undefined }),
    {
      title: "Node",
      description: "Read a single node by its ID",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const nodeId = variables.id as string;
      const node = await nodeService.getNodeById(nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(node),
            mimeType: "application/json",
          },
        ],
      };
    },
  );

  server.registerResource(
    "project-list",
    "project://list",
    {
      title: "Project List",
      description: "List all projects in Arbor",
      mimeType: "application/json",
    },
    async (uri) => {
      const projects = await nodeService.getAllProjects();
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(projects),
            mimeType: "application/json",
          },
        ],
      };
    },
  );

  // ─── Prompts ──────────────────────────────────────────────────────────

  server.registerPrompt(
    "summarize_project",
    {
      title: "Summarize Project",
      description: "Generate a summary of a project and its contents",
      argsSchema: {
        projectId: z.string().uuid(),
      },
    },
    async ({ projectId }) => {
      const project = await nodeService.getNodeById(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      const children = await nodeService.getNodesByParentId(projectId);

      const childList = children
        .map((child) => `  - [${child.type}] ${child.name}`)
        .join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Please summarize this writing project:\n\nProject: ${project.name}\nType: ${project.type}\nChildren: ${children.length} items\n${childList ? `\nContents:\n${childList}` : ""}\n\nProvide a brief overview of the project structure and content.`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    "outline_structure",
    {
      title: "Outline Project Structure",
      description: "Generate an outline of a project's hierarchical structure",
      argsSchema: {
        projectId: z.string().uuid(),
      },
    },
    async ({ projectId }) => {
      const project = await nodeService.getNodeById(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      const children = await nodeService.getNodesByParentId(projectId);

      const childList = children
        .map(
          (child) =>
            `  - [${child.type}] ${child.name} (position: ${child.position ?? "unset"})`,
        )
        .join("\n");

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Please create a detailed hierarchical outline for this writing project:\n\nProject: ${project.name}\nDirect children: ${children.length}\n${childList ? `\nCurrent structure:\n${childList}` : ""}\n\nGenerate a tree-like structure showing how all folders and notes are organized. Suggest improvements to the structure if appropriate.`,
            },
          },
        ],
      };
    },
  );

  return server;
}
