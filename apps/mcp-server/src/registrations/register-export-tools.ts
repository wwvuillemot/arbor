import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTextContent, type McpServerServices } from "./shared.js";

export function registerExportTools(
  server: McpServer,
  services: McpServerServices,
): void {
  const { exportService } = services;

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
      const exportFormat = format ?? "markdown";
      const content =
        exportFormat === "html"
          ? await exportService.exportNodeAsHtml(nodeId)
          : await exportService.exportNodeAsMarkdown(nodeId);
      return createTextContent(content);
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
      const exportFormat = format ?? "markdown";
      const content =
        exportFormat === "html"
          ? await exportService.exportProjectAsHtml(projectId)
          : await exportService.exportProjectAsMarkdown(projectId);
      return createTextContent(content);
    },
  );
}
