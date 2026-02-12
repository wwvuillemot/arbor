/**
 * MCP Integration Service
 *
 * Bridges the MCP server with the chat system, converting MCP tools to LLM tool definitions
 * and executing MCP tools when the LLM requests them.
 */

import { NodeService } from "./node-service";
import { TagService } from "./tag-service";
import { ExportService } from "./export-service";
import { SearchService } from "./search-service";
import { LocalEmbeddingProvider } from "./embedding-service";
import type { ToolDefinition } from "./llm-service";

// Initialize services for tool execution
const nodeService = new NodeService();
const tagService = new TagService();
const exportService = new ExportService();
const searchService = new SearchService(new LocalEmbeddingProvider());

/**
 * Get all MCP tools as LLM ToolDefinition format
 */
export async function getMCPTools(): Promise<ToolDefinition[]> {
  // Define all MCP tools in LLM ToolDefinition format
  // These match the tools registered in apps/mcp-server/src/server.ts
  const mcpTools = [
    {
      name: "create_node",
      description:
        "Create a new node in the Arbor hierarchy (project, folder, note, etc.)",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["project", "folder", "note", "link", "ai_suggestion", "audio_note"],
            description: "Type of node to create",
          },
          name: {
            type: "string",
            description: "Name of the node",
          },
          parentId: {
            type: "string",
            description: "UUID of the parent node (optional)",
          },
          content: {
            type: "object",
            description: "Content of the node (optional)",
          },
          metadata: {
            type: "object",
            description: "Metadata for the node (optional)",
          },
        },
        required: ["type", "name"],
      },
    },
    {
      name: "update_node",
      description: "Update an existing node by its ID",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "UUID of the node to update",
          },
          name: {
            type: "string",
            description: "New name for the node (optional)",
          },
          content: {
            type: "object",
            description: "New content for the node (optional)",
          },
          metadata: {
            type: "object",
            description: "New metadata for the node (optional)",
          },
          position: {
            type: "integer",
            description: "New position for the node (optional)",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "delete_node",
      description: "Delete a node by its ID (cascades to children)",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "UUID of the node to delete",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "move_node",
      description: "Move a node to a new parent with optional position",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "UUID of the node to move",
          },
          newParentId: {
            type: "string",
            description: "UUID of the new parent node",
          },
          position: {
            type: "integer",
            description: "Position in the new parent (optional)",
          },
        },
        required: ["id", "newParentId"],
      },
    },
    {
      name: "list_nodes",
      description: "List child nodes of a parent, optionally filtered by type",
      parameters: {
        type: "object",
        properties: {
          parentId: {
            type: "string",
            description: "UUID of the parent node",
          },
          type: {
            type: "string",
            enum: ["project", "folder", "note", "link", "ai_suggestion", "audio_note"],
            description: "Filter by node type (optional)",
          },
        },
        required: ["parentId"],
      },
    },
    {
      name: "search_nodes",
      description: "Search for nodes by name and/or type",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query for node names (optional)",
          },
          type: {
            type: "string",
            enum: ["project", "folder", "note", "link", "ai_suggestion", "audio_note"],
            description: "Filter by node type (optional)",
          },
        },
        required: [],
      },
    },
    {
      name: "search_semantic",
      description: "Search nodes using keyword matching across names and content",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
          topK: {
            type: "integer",
            description: "Number of results to return (1-100, default 10)",
          },
          projectId: {
            type: "string",
            description: "Limit search to specific project (optional)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "add_tag",
      description: "Add a tag to a node (creates the tag if it doesn't exist)",
      parameters: {
        type: "object",
        properties: {
          nodeId: {
            type: "string",
            description: "UUID of the node to tag",
          },
          tagName: {
            type: "string",
            description: "Name of the tag",
          },
          tagType: {
            type: "string",
            enum: ["general", "character", "location", "event", "concept"],
            description: "Type of tag (optional, default: general)",
          },
        },
        required: ["nodeId", "tagName"],
      },
    },
    {
      name: "remove_tag",
      description: "Remove a tag from a node by tag name",
      parameters: {
        type: "object",
        properties: {
          nodeId: {
            type: "string",
            description: "UUID of the node",
          },
          tagName: {
            type: "string",
            description: "Name of the tag to remove",
          },
        },
        required: ["nodeId", "tagName"],
      },
    },
    {
      name: "list_tags",
      description: "List all tags, optionally filtered by type",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["general", "character", "location", "event", "concept"],
            description: "Filter by tag type (optional)",
          },
        },
        required: [],
      },
    },
    {
      name: "export_node",
      description: "Export a node's content in markdown or HTML format",
      parameters: {
        type: "object",
        properties: {
          nodeId: {
            type: "string",
            description: "UUID of the node to export",
          },
          format: {
            type: "string",
            enum: ["markdown", "html"],
            description: "Export format (default: markdown)",
          },
        },
        required: ["nodeId"],
      },
    },
    {
      name: "export_project",
      description: "Export a project and all its contents in markdown or HTML format",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "UUID of the project to export",
          },
          format: {
            type: "string",
            enum: ["markdown", "html"],
            description: "Export format (default: markdown)",
          },
        },
        required: ["projectId"],
      },
    },
  ];

  // Convert to LLM ToolDefinition format
  for (const tool of mcpTools) {
    tools.push({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as Record<string, unknown>,
      },
    });
  }

  return tools;
}

/**
 * Execute an MCP tool and return the result as a string
 */
export async function executeMCPTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    let result: unknown;

    switch (toolName) {
      case "create_node": {
        const node = await nodeService.createNode({
          type: args.type as any,
          name: args.name as string,
          parentId: (args.parentId as string | undefined) || null,
          content: args.content,
          metadata: args.metadata as Record<string, unknown> | undefined,
          createdBy: "llm:chat-agent",
          updatedBy: "llm:chat-agent",
        });
        result = node;
        break;
      }

      case "update_node": {
        const updates: Record<string, unknown> = {};
        if (args.name !== undefined) updates.name = args.name;
        if (args.content !== undefined) updates.content = args.content;
        if (args.metadata !== undefined) updates.metadata = args.metadata;
        if (args.position !== undefined) updates.position = args.position;
        updates.updatedBy = "llm:chat-agent";

        const node = await nodeService.updateNode(args.id as string, updates);
        result = node;
        break;
      }

      case "delete_node": {
        await nodeService.deleteNode(args.id as string);
        result = { deleted: true, id: args.id };
        break;
      }

      case "move_node": {
        const node = await nodeService.moveNode(
          args.id as string,
          args.newParentId as string,
          args.position as number | undefined,
        );
        result = node;
        break;
      }

      case "list_nodes": {
        let children = await nodeService.getNodesByParentId(args.parentId as string);
        if (args.type) {
          children = children.filter((c) => c.type === args.type);
        }
        result = children;
        break;
      }

      case "search_nodes": {
        // Import db and nodes schema for search
        const { db } = await import("../db/index");
        const { nodes } = await import("../db/schema");
        const { ilike, eq, and } = await import("drizzle-orm");

        const conditions = [];
        if (args.query) {
          conditions.push(ilike(nodes.name, `%${args.query}%`));
        }
        if (args.type) {
          conditions.push(eq(nodes.type, args.type as any));
        }

        const results =
          conditions.length > 0
            ? await db
              .select()
              .from(nodes)
              .where(and(...conditions))
              .limit(50)
            : await db.select().from(nodes).limit(50);

        result = results;
        break;
      }

      case "search_semantic": {
        const searchResults = await searchService.keywordSearch(
          args.query as string,
          {
            projectId: args.projectId as string | undefined,
            excludeDeleted: true,
          },
          { limit: (args.topK as number | undefined) || 10 },
        );
        result = searchResults.map((r) => ({ ...r.node, score: r.score }));
        break;
      }

      case "add_tag": {
        // Find existing tag by name or create a new one
        const allTags = await tagService.getAllTags();
        let tag = allTags.find((t) => t.name === args.tagName);
        if (!tag) {
          tag = await tagService.createTag({
            name: args.tagName as string,
            type: (args.tagType as any) || "general",
          });
        }
        await tagService.addTagToNode(args.nodeId as string, tag.id);
        result = { tagged: true, nodeId: args.nodeId, tag };
        break;
      }

      case "remove_tag": {
        const nodeTagsList = await tagService.getNodeTags(args.nodeId as string);
        const tag = nodeTagsList.find((t) => t.name === args.tagName);
        if (!tag) {
          result = {
            removed: false,
            reason: `Tag "${args.tagName}" not found on node`,
          };
        } else {
          await tagService.removeTagFromNode(args.nodeId as string, tag.id);
          result = { removed: true, nodeId: args.nodeId, tagName: args.tagName };
        }
        break;
      }

      case "list_tags": {
        const allTags = args.type
          ? await tagService.getAllTags(args.type as any)
          : await tagService.getAllTags();
        result = allTags;
        break;
      }

      case "export_node": {
        const format = (args.format as string) || "markdown";
        const content =
          format === "html"
            ? await exportService.exportNodeAsHtml(args.nodeId as string)
            : await exportService.exportNodeAsMarkdown(args.nodeId as string);
        result = { content, format };
        break;
      }

      case "export_project": {
        const format = (args.format as string) || "markdown";
        const content =
          format === "html"
            ? await exportService.exportProjectAsHtml(args.projectId as string)
            : await exportService.exportProjectAsMarkdown(args.projectId as string);
        result = { content, format };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
      toolName,
      args,
    });
  }
}

