import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createJsonContent,
  tagTypeSchema,
  type McpServerServices,
} from "./shared.js";

export function registerTagTools(
  server: McpServer,
  services: McpServerServices,
): void {
  const { tagService } = services;

  server.registerTool(
    "add_tag",
    {
      title: "Add Tag",
      description: "Add a tag to a node (creates the tag if it doesn't exist)",
      inputSchema: {
        nodeId: z.string().uuid(),
        tagName: z.string().min(1),
        tagType: tagTypeSchema.optional(),
      },
    },
    async ({ nodeId, tagName, tagType }) => {
      const allTags = await tagService.getAllTags();
      let tag = allTags.find((existingTag) => existingTag.name === tagName);
      if (!tag) {
        tag = await tagService.createTag({
          name: tagName,
          type: tagType ?? "general",
        });
      }
      await tagService.addTagToNode(nodeId, tag.id);
      return createJsonContent({ tagged: true, nodeId, tag });
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
      const tag = nodeTagsList.find(
        (existingTag) => existingTag.name === tagName,
      );
      if (!tag) {
        return createJsonContent({
          removed: false,
          reason: `Tag "${tagName}" not found on node`,
        });
      }
      await tagService.removeTagFromNode(nodeId, tag.id);
      return createJsonContent({ removed: true, nodeId, tagName });
    },
  );

  server.registerTool(
    "list_tags",
    {
      title: "List Tags",
      description: "List all tags, optionally filtered by type",
      inputSchema: { type: tagTypeSchema.optional() },
    },
    async ({ type }) =>
      createJsonContent(
        type
          ? await tagService.getAllTags(type)
          : await tagService.getAllTags(),
      ),
  );
}
