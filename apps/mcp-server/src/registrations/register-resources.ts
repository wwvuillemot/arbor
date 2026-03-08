import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createJsonResourceContents,
  type McpServerServices,
} from "./shared.js";

export function registerResources(
  server: McpServer,
  services: McpServerServices,
): void {
  const { nodeService } = services;

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
      if (!node) throw new Error(`Node not found: ${nodeId}`);
      return createJsonResourceContents(uri.href, node);
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
    async (uri) =>
      createJsonResourceContents(uri.href, await nodeService.getAllProjects()),
  );
}
