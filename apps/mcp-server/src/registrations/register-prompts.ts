import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type McpServerServices } from "./shared.js";

function formatChildList(
  children: Array<{ type: string; name: string; position: number | null }>,
  includePosition: boolean,
): string {
  return children
    .map((child) =>
      includePosition
        ? `  - [${child.type}] ${child.name} (position: ${child.position ?? "unset"})`
        : `  - [${child.type}] ${child.name}`,
    )
    .join("\n");
}

export function registerPrompts(
  server: McpServer,
  services: McpServerServices,
): void {
  const { nodeService } = services;

  server.registerPrompt(
    "summarize_project",
    {
      title: "Summarize Project",
      description: "Generate a summary of a project and its contents",
      argsSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const project = await nodeService.getNodeById(projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const children = await nodeService.getNodesByParentId(projectId);
      const childList = formatChildList(children, false);
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
      argsSchema: { projectId: z.string().uuid() },
    },
    async ({ projectId }) => {
      const project = await nodeService.getNodeById(projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const children = await nodeService.getNodesByParentId(projectId);
      const childList = formatChildList(children, true);
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
}
