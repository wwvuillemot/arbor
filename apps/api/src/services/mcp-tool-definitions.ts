import type { ToolDefinition } from "./llm-service";

const NODE_TYPES = [
  "project",
  "folder",
  "note",
  "link",
  "ai_suggestion",
  "audio_note",
];

const TAG_TYPES = ["general", "character", "location", "event", "concept"];
const EXPORT_FORMATS = ["markdown", "html"];

function createStringProperty(
  description: string,
  extraProperties: Record<string, unknown> = {},
): Record<string, unknown> {
  return { type: "string", description, ...extraProperties };
}

function createIntegerProperty(description: string): Record<string, unknown> {
  return { type: "integer", description };
}

function createObjectProperty(description: string): Record<string, unknown> {
  return { type: "object", description };
}

function createObjectSchema(
  properties: Record<string, unknown>,
  required: string[],
): Record<string, unknown> {
  return { type: "object", properties, required };
}

function createFunctionTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
): ToolDefinition {
  return { type: "function", function: { name, description, parameters } };
}

export function buildMcpToolDefinitions(): ToolDefinition[] {
  return [
    createFunctionTool(
      "create_node",
      "Create a new node in the Arbor hierarchy (project, folder, note, etc.)",
      createObjectSchema(
        {
          type: createStringProperty("Type of node to create", {
            enum: NODE_TYPES,
          }),
          name: createStringProperty("Name of the node"),
          parentId: createStringProperty("UUID of the parent node (optional)"),
          content: createObjectProperty("Content of the node (optional)"),
          metadata: createObjectProperty("Metadata for the node (optional)"),
        },
        ["type", "name"],
      ),
    ),
    createFunctionTool(
      "update_node",
      "Update an existing node by its ID",
      createObjectSchema(
        {
          id: createStringProperty("UUID of the node to update"),
          name: createStringProperty("New name for the node (optional)"),
          content: createStringProperty(
            "New content for the node as Markdown text (optional). Will be converted to the editor format automatically.",
          ),
          metadata: createObjectProperty(
            "New metadata for the node (optional)",
          ),
          position: createIntegerProperty(
            "New position for the node (optional)",
          ),
        },
        ["id"],
      ),
    ),
    createFunctionTool(
      "delete_node",
      "Delete a node by its ID (cascades to children)",
      createObjectSchema(
        { id: createStringProperty("UUID of the node to delete") },
        ["id"],
      ),
    ),
    createFunctionTool(
      "move_node",
      "Move a node to a new parent with optional position",
      createObjectSchema(
        {
          id: createStringProperty("UUID of the node to move"),
          newParentId: createStringProperty("UUID of the new parent node"),
          position: createIntegerProperty(
            "Position in the new parent (optional)",
          ),
        },
        ["id", "newParentId"],
      ),
    ),
    createFunctionTool(
      "list_nodes",
      "List child nodes of a parent, optionally filtered by type. Omit parentId (or pass null) to list all top-level nodes (projects).",
      createObjectSchema(
        {
          parentId: createStringProperty(
            "UUID of the parent node. Omit to list top-level nodes.",
          ),
          type: createStringProperty("Filter by node type (optional)", {
            enum: NODE_TYPES,
          }),
        },
        [],
      ),
    ),
    createFunctionTool(
      "search_nodes",
      "Search for nodes by name and/or type",
      createObjectSchema(
        {
          query: createStringProperty("Search query for node names (optional)"),
          type: createStringProperty("Filter by node type (optional)", {
            enum: NODE_TYPES,
          }),
        },
        [],
      ),
    ),
    createFunctionTool(
      "search_semantic",
      "Search nodes using keyword matching across names and content",
      createObjectSchema(
        {
          query: createStringProperty("Search query"),
          topK: createIntegerProperty(
            "Number of results to return (1-100, default 10)",
          ),
          projectId: createStringProperty(
            "Limit search to specific project (optional)",
          ),
        },
        ["query"],
      ),
    ),
    createFunctionTool(
      "add_tag",
      "Add a tag to a node (creates the tag if it doesn't exist)",
      createObjectSchema(
        {
          nodeId: createStringProperty("UUID of the node to tag"),
          tagName: createStringProperty("Name of the tag"),
          tagType: createStringProperty(
            "Type of tag (optional, default: general)",
            {
              enum: TAG_TYPES,
            },
          ),
        },
        ["nodeId", "tagName"],
      ),
    ),
    createFunctionTool(
      "remove_tag",
      "Remove a tag from a node by tag name",
      createObjectSchema(
        {
          nodeId: createStringProperty("UUID of the node"),
          tagName: createStringProperty("Name of the tag to remove"),
        },
        ["nodeId", "tagName"],
      ),
    ),
    createFunctionTool(
      "list_tags",
      "List all tags, optionally filtered by type",
      createObjectSchema(
        {
          type: createStringProperty("Filter by tag type (optional)", {
            enum: TAG_TYPES,
          }),
        },
        [],
      ),
    ),
    createFunctionTool(
      "export_node",
      "Export a node's content in markdown or HTML format",
      createObjectSchema(
        {
          nodeId: createStringProperty("UUID of the node to export"),
          format: createStringProperty("Export format (default: markdown)", {
            enum: EXPORT_FORMATS,
          }),
        },
        ["nodeId"],
      ),
    ),
    createFunctionTool(
      "export_project",
      "Export a project and all its contents in markdown or HTML format",
      createObjectSchema(
        {
          projectId: createStringProperty("UUID of the project to export"),
          format: createStringProperty("Export format (default: markdown)", {
            enum: EXPORT_FORMATS,
          }),
        },
        ["projectId"],
      ),
    ),
  ];
}
