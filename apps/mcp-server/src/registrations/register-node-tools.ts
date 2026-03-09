import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@server/db/index";
import { nodes } from "@server/db/schema";
import {
  createJsonContent,
  nodeTypeSchema,
  type McpServerServices,
} from "./shared.js";

export function registerNodeTools(
  server: McpServer,
  services: McpServerServices,
): void {
  const { nodeService, searchService } = services;

  server.registerTool(
    "create_node",
    {
      title: "Create Node",
      description:
        "Create a new node in the Arbor hierarchy (project, folder, note, etc.)",
      inputSchema: {
        type: nodeTypeSchema,
        name: z.string().min(1),
        parentId: z.string().uuid().optional(),
        content: z.any().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      },
    },
    async ({ type, name, parentId, content, metadata }) =>
      createJsonContent(
        await nodeService.createNode({
          type,
          name,
          parentId: parentId ?? null,
          content,
          metadata,
          createdBy: "llm:mcp-client",
          updatedBy: "llm:mcp-client",
        }),
      ),
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
      const updates: Record<string, unknown> = { updatedBy: "llm:mcp-client" };
      if (name !== undefined) updates.name = name;
      if (content !== undefined) updates.content = content;
      if (metadata !== undefined) updates.metadata = metadata;
      if (position !== undefined) updates.position = position;
      return createJsonContent(await nodeService.updateNode(id, updates));
    },
  );

  server.registerTool(
    "search_nodes",
    {
      title: "Search Nodes",
      description: "Search for nodes by name and/or type",
      inputSchema: {
        query: z.string().optional(),
        type: nodeTypeSchema.optional(),
      },
    },
    async ({ query, type }) => {
      const conditions: Array<
        ReturnType<typeof ilike> | ReturnType<typeof eq>
      > = [];
      if (query) conditions.push(ilike(nodes.name, `%${query}%`));
      if (type) conditions.push(eq(nodes.type, type));
      const results =
        conditions.length === 0
          ? await db.select().from(nodes).limit(50)
          : await db
              .select()
              .from(nodes)
              .where(and(...conditions))
              .limit(50);
      return createJsonContent(results);
    },
  );

  server.registerTool(
    "delete_node",
    {
      title: "Delete Node",
      description: "Delete a node by its ID (cascades to children)",
      inputSchema: { id: z.string().uuid() },
    },
    async ({ id }) => {
      await nodeService.deleteNode(id);
      return createJsonContent({ deleted: true, id });
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
    async ({ id, newParentId, position }) =>
      createJsonContent(await nodeService.moveNode(id, newParentId, position)),
  );

  server.registerTool(
    "list_nodes",
    {
      title: "List Nodes",
      description: "List child nodes of a parent, optionally filtered by type",
      inputSchema: {
        parentId: z.string().uuid(),
        type: nodeTypeSchema.optional(),
      },
    },
    async ({ parentId, type }) => {
      const children = await nodeService.getNodesByParentId(parentId);
      return createJsonContent(
        type ? children.filter((child) => child.type === type) : children,
      );
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
        { limit: topK ?? 10 },
      );
      return createJsonContent(
        results.map((result) => ({ ...result.node, score: result.score })),
      );
    },
  );
}
