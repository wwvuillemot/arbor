import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NodeService } from "@server/services/node-service";
import { TagService } from "@server/services/tag-service";
import { ExportService } from "@server/services/export-service";
import { SearchService } from "@server/services/search-service";
import { LocalEmbeddingProvider } from "@server/services/embedding-service";
import { db } from "@server/db/index";
import { nodes } from "@server/db/schema";
import { ilike, eq, and } from "drizzle-orm";

/**
 * Creates and configures the Arbor MCP server with tools, resources, and prompts.
 *
 * Tools:
 *   - create_node: Create a new node in the hierarchy
 *   - update_node: Update an existing node by ID
 *   - delete_node: Delete a node by ID
 *   - move_node: Move a node to a new parent
 *   - list_nodes: List child nodes of a parent
 *   - search_nodes: Search for nodes by name and/or type
 *   - search_semantic: Semantic keyword search across nodes
 *   - add_tag: Add a tag to a node (creates tag if needed)
 *   - remove_tag: Remove a tag from a node
 *   - list_tags: List all tags
 *   - export_node: Export a node as markdown or HTML
 *   - export_project: Export a project as markdown or HTML
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
  const tagService = new TagService();
  const exportService = new ExportService();
  const searchService = new SearchService(new LocalEmbeddingProvider());

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

  server.registerTool(
    "delete_node",
    {
      title: "Delete Node",
      description: "Delete a node by its ID (cascades to children)",
      inputSchema: {
        id: z.string().uuid(),
      },
    },
    async ({ id }) => {
      await nodeService.deleteNode(id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ deleted: true, id }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "move_node",
    {
      title: "Move Node",
      description: "Move a node to a new parent with optional position",
      inputSchema: {
        id: z.string().uuid(),
        newParentId: z.string().uuid(),
        position: z.number().int().optional(),
      },
    },
    async ({ id, newParentId, position }) => {
      const node = await nodeService.moveNode(id, newParentId, position);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(node) }],
      };
    },
  );

  server.registerTool(
    "list_nodes",
    {
      title: "List Nodes",
      description: "List child nodes of a parent, optionally filtered by type",
      inputSchema: {
        parentId: z.string().uuid(),
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
    async ({ parentId, type }) => {
      let children = await nodeService.getNodesByParentId(parentId);
      if (type) {
        children = children.filter((c) => c.type === type);
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(children) }],
      };
    },
  );

  server.registerTool(
    "search_semantic",
    {
      title: "Semantic Search",
      description:
        "Search nodes using keyword matching across names and content",
      inputSchema: {
        query: z.string().min(1),
        topK: z.number().int().min(1).max(100).optional(),
        projectId: z.string().uuid().optional(),
      },
    },
    async ({ query, topK, projectId }) => {
      const results = await searchService.keywordSearch(
        query,
        { projectId, excludeDeleted: true },
        { limit: topK || 10 },
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              results.map((r) => ({ ...r.node, score: r.score })),
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "add_tag",
    {
      title: "Add Tag",
      description: "Add a tag to a node (creates the tag if it doesn't exist)",
      inputSchema: {
        nodeId: z.string().uuid(),
        tagName: z.string().min(1),
        tagType: z
          .enum(["general", "character", "location", "event", "concept"])
          .optional(),
      },
    },
    async ({ nodeId, tagName, tagType }) => {
      // Find existing tag by name or create a new one
      const allTags = await tagService.getAllTags();
      let tag = allTags.find((t) => t.name === tagName);
      if (!tag) {
        tag = await tagService.createTag({
          name: tagName,
          type: tagType || "general",
        });
      }
      await tagService.addTagToNode(nodeId, tag.id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ tagged: true, nodeId, tag }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "remove_tag",
    {
      title: "Remove Tag",
      description: "Remove a tag from a node by tag name",
      inputSchema: {
        nodeId: z.string().uuid(),
        tagName: z.string().min(1),
      },
    },
    async ({ nodeId, tagName }) => {
      const nodeTagsList = await tagService.getNodeTags(nodeId);
      const tag = nodeTagsList.find((t) => t.name === tagName);
      if (!tag) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                removed: false,
                reason: `Tag "${tagName}" not found on node`,
              }),
            },
          ],
        };
      }
      await tagService.removeTagFromNode(nodeId, tag.id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ removed: true, nodeId, tagName }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_tags",
    {
      title: "List Tags",
      description: "List all tags, optionally filtered by type",
      inputSchema: {
        type: z
          .enum(["general", "character", "location", "event", "concept"])
          .optional(),
      },
    },
    async ({ type }) => {
      const allTags = type
        ? await tagService.getAllTags(type)
        : await tagService.getAllTags();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(allTags) }],
      };
    },
  );

  server.registerTool(
    "export_node",
    {
      title: "Export Node",
      description: "Export a node's content in markdown or HTML format",
      inputSchema: {
        nodeId: z.string().uuid(),
        format: z.enum(["markdown", "html"]).optional(),
      },
    },
    async ({ nodeId, format }) => {
      const fmt = format || "markdown";
      const content =
        fmt === "html"
          ? await exportService.exportNodeAsHtml(nodeId)
          : await exportService.exportNodeAsMarkdown(nodeId);
      return {
        content: [{ type: "text" as const, text: content }],
      };
    },
  );

  server.registerTool(
    "export_project",
    {
      title: "Export Project",
      description:
        "Export a project and all its contents in markdown or HTML format",
      inputSchema: {
        projectId: z.string().uuid(),
        format: z.enum(["markdown", "html"]).optional(),
      },
    },
    async ({ projectId, format }) => {
      const fmt = format || "markdown";
      const content =
        fmt === "html"
          ? await exportService.exportProjectAsHtml(projectId)
          : await exportService.exportProjectAsMarkdown(projectId);
      return {
        content: [{ type: "text" as const, text: content }],
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
