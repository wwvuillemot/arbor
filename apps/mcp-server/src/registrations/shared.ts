import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ExportService } from "@server/services/export-service";
import { LocalEmbeddingProvider } from "@server/services/embedding-service";
import { NodeService } from "@server/services/node-service";
import { SearchService } from "@server/services/search-service";
import { TagService } from "@server/services/tag-service";

export const nodeTypeSchema = z.enum([
  "project",
  "folder",
  "note",
  "link",
  "ai_suggestion",
  "audio_note",
]);

export const tagTypeSchema = z.enum([
  "general",
  "character",
  "location",
  "event",
  "concept",
]);

export interface McpServerServices {
  nodeService: NodeService;
  tagService: TagService;
  exportService: ExportService;
  searchService: SearchService;
}

export type McpRegistration = (
  server: McpServer,
  services: McpServerServices,
) => void;

export function createMcpServerServices(): McpServerServices {
  return {
    nodeService: new NodeService(),
    tagService: new TagService(),
    exportService: new ExportService(),
    searchService: new SearchService(new LocalEmbeddingProvider()),
  };
}

export function createJsonContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

export function createTextContent(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function createJsonResourceContents(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        text: JSON.stringify(data),
        mimeType: "application/json",
      },
    ],
  };
}
