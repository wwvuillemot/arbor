import { and, asc, eq, ilike, isNull, type SQL } from "drizzle-orm";
import { db } from "../db/index";
import { nodes } from "../db/schema";
import { LocalEmbeddingProvider } from "./embedding-service";
import { ExportService } from "./export-service";
import { ImageGenerationService } from "./image-generation-service";
import { MediaAttachmentService } from "./media-attachment-service";
import { NodeService, type UpdateNodeParams } from "./node-service";
import { SearchService } from "./search-service";
import { SettingsService } from "./settings-service";
import { TagService } from "./tag-service";
import {
  getListParentId,
  getOptionalContentArg,
  getOptionalExportFormatArg,
  getOptionalNodeTypeArg,
  getOptionalNumberArg,
  getOptionalObjectArg,
  getOptionalStringArg,
  getOptionalTagTypeArg,
  getRequiredNodeTypeArg,
  getRequiredStringArg,
} from "./mcp-tool-executor-args";
import {
  buildUpdatedContent,
  markdownToTipTap,
} from "./mcp-tool-executor-content";
import type { ToolArgs } from "./mcp-tool-executor-types";

const CHAT_AGENT_PROVENANCE = "llm:chat-agent";
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_NODE_SEARCH_RESULTS = 50;

const nodeService = new NodeService();
const tagService = new TagService();
const exportService = new ExportService();
const searchService = new SearchService(new LocalEmbeddingProvider());
const mediaService = new MediaAttachmentService();
const settingsService = new SettingsService();

async function executeCreateNode(args: ToolArgs): Promise<unknown> {
  const content = getOptionalContentArg(args, "content");

  return await nodeService.createNode({
    type: getRequiredNodeTypeArg(args, "type"),
    name: getRequiredStringArg(args, "name"),
    parentId: getOptionalStringArg(args, "parentId") ?? null,
    content: typeof content === "string" ? markdownToTipTap(content) : content,
    metadata: getOptionalObjectArg(args, "metadata"),
    createdBy: CHAT_AGENT_PROVENANCE,
    updatedBy: CHAT_AGENT_PROVENANCE,
  });
}

async function executeUpdateNode(args: ToolArgs): Promise<unknown> {
  const nodeId = getRequiredStringArg(args, "id");
  const existingNode = await nodeService.getNodeById(nodeId);

  const updates: UpdateNodeParams = {
    updatedBy: CHAT_AGENT_PROVENANCE,
  };

  const name = getOptionalStringArg(args, "name");
  if (name !== undefined) {
    updates.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(args, "content")) {
    updates.content = buildUpdatedContent(existingNode?.content, args.content);
  }

  if (Object.prototype.hasOwnProperty.call(args, "metadata")) {
    updates.metadata = getOptionalObjectArg(args, "metadata");
  }

  const position = getOptionalNumberArg(args, "position");
  if (position !== undefined) {
    updates.position = position;
  }

  return await nodeService.updateNode(nodeId, updates);
}

async function executeDeleteNode(args: ToolArgs): Promise<unknown> {
  const nodeId = getRequiredStringArg(args, "id");
  await nodeService.deleteNode(nodeId);
  return { deleted: true, id: nodeId };
}

async function executeMoveNode(args: ToolArgs): Promise<unknown> {
  return await nodeService.moveNode(
    getRequiredStringArg(args, "id"),
    getRequiredStringArg(args, "newParentId"),
    getOptionalNumberArg(args, "position"),
  );
}

function stripNodeContent<T extends { content?: unknown }>(
  node: T,
): Omit<T, "content"> {
  const { content: _content, ...rest } = node;
  return rest;
}

async function executeGetNode(args: ToolArgs): Promise<unknown> {
  const nodeId = getRequiredStringArg(args, "nodeId");
  const node = await nodeService.getNodeById(nodeId);
  if (!node) {
    return { error: `Node ${nodeId} not found` };
  }
  return stripNodeContent(node);
}

async function executeListNodes(args: ToolArgs): Promise<unknown> {
  const parentId = getListParentId(args);
  const nodeType = getOptionalNodeTypeArg(args, "type");

  if (parentId) {
    const childNodes = await nodeService.getNodesByParentId(parentId);
    const filtered = nodeType
      ? childNodes.filter((childNode) => childNode.type === nodeType)
      : childNodes;
    return filtered.map(stripNodeContent);
  }

  const conditions: SQL<unknown>[] = [isNull(nodes.parentId)];
  if (nodeType) {
    conditions.push(eq(nodes.type, nodeType));
  }

  const results = await db
    .select()
    .from(nodes)
    .where(and(...conditions))
    .orderBy(asc(nodes.position));

  return results.map(stripNodeContent);
}

async function executeSearchNodes(args: ToolArgs): Promise<unknown> {
  const query = getOptionalStringArg(args, "query");
  const nodeType = getOptionalNodeTypeArg(args, "type");
  const conditions: SQL<unknown>[] = [];

  if (query) {
    conditions.push(ilike(nodes.name, `%${query}%`));
  }
  if (nodeType) {
    conditions.push(eq(nodes.type, nodeType));
  }

  const results =
    conditions.length === 0
      ? await db.select().from(nodes).limit(MAX_NODE_SEARCH_RESULTS)
      : await db
          .select()
          .from(nodes)
          .where(and(...conditions))
          .limit(MAX_NODE_SEARCH_RESULTS);

  return results.map(stripNodeContent);
}

async function executeSearchSemantic(args: ToolArgs): Promise<unknown> {
  const searchResults = await searchService.keywordSearch(
    getRequiredStringArg(args, "query"),
    {
      projectId: getOptionalStringArg(args, "projectId"),
      excludeDeleted: true,
    },
    {
      limit: getOptionalNumberArg(args, "topK") ?? DEFAULT_SEARCH_LIMIT,
    },
  );

  return searchResults.map((searchResult) => ({
    ...stripNodeContent(searchResult.node),
    score: searchResult.score,
  }));
}

async function executeAddTag(args: ToolArgs): Promise<unknown> {
  const nodeId = getRequiredStringArg(args, "nodeId");
  const tagName = getRequiredStringArg(args, "tagName");
  const tagType = getOptionalTagTypeArg(args, "tagType") ?? "general";

  const existingTags = await tagService.getAllTags();
  let tag = existingTags.find((existingTag) => existingTag.name === tagName);

  if (!tag) {
    tag = await tagService.createTag({
      name: tagName,
      type: tagType,
    });
  }

  await tagService.addTagToNode(nodeId, tag.id);
  return { tagged: true, nodeId, tag };
}

async function executeRemoveTag(args: ToolArgs): Promise<unknown> {
  const nodeId = getRequiredStringArg(args, "nodeId");
  const tagName = getRequiredStringArg(args, "tagName");
  const nodeTags = await tagService.getNodeTags(nodeId);
  const tag = nodeTags.find((candidateTag) => candidateTag.name === tagName);

  if (!tag) {
    return {
      removed: false,
      reason: `Tag "${tagName}" not found on node`,
    };
  }

  await tagService.removeTagFromNode(nodeId, tag.id);
  return {
    removed: true,
    nodeId,
    tagName,
  };
}

async function executeListTags(args: ToolArgs): Promise<unknown> {
  const tagType = getOptionalTagTypeArg(args, "type");
  return tagType
    ? await tagService.getAllTags(tagType)
    : await tagService.getAllTags();
}

async function executeExportNode(args: ToolArgs): Promise<unknown> {
  const nodeId = getRequiredStringArg(args, "nodeId");
  const format = getOptionalExportFormatArg(args, "format") ?? "markdown";
  const content =
    format === "html"
      ? await exportService.exportNodeAsHtml(nodeId)
      : await exportService.exportNodeAsMarkdown(nodeId);

  return { content, format };
}

async function executeGetNodeContent(args: ToolArgs): Promise<unknown> {
  const nodeId = getRequiredStringArg(args, "nodeId");
  const node = await nodeService.getNodeById(nodeId);
  if (!node) {
    return { error: `Node ${nodeId} not found` };
  }
  const markdown = await exportService.exportNodeAsMarkdown(nodeId);
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    content: markdown,
  };
}

async function executeGenerateImage(
  args: ToolArgs,
  masterKey?: string,
): Promise<unknown> {
  if (!masterKey) {
    throw new Error(
      "generate_image requires a masterKey for API key decryption",
    );
  }
  const prompt = getRequiredStringArg(args, "prompt");
  const projectId = getRequiredStringArg(args, "projectId");
  const apiKey = await settingsService.getSetting("openai_api_key", masterKey);
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }
  const imageService = new ImageGenerationService(
    apiKey,
    mediaService,
    nodeService,
  );
  return await imageService.generateImage(prompt, projectId);
}

async function executeExportProject(args: ToolArgs): Promise<unknown> {
  const projectId = getRequiredStringArg(args, "projectId");
  const format = getOptionalExportFormatArg(args, "format") ?? "markdown";
  const content =
    format === "html"
      ? await exportService.exportProjectAsHtml(projectId)
      : await exportService.exportProjectAsMarkdown(projectId);

  return { content, format };
}

async function executeTool(
  toolName: string,
  args: ToolArgs,
  masterKey?: string,
): Promise<unknown> {
  switch (toolName) {
    case "create_node":
      return await executeCreateNode(args);
    case "update_node":
      return await executeUpdateNode(args);
    case "delete_node":
      return await executeDeleteNode(args);
    case "move_node":
      return await executeMoveNode(args);
    case "get_node":
      return await executeGetNode(args);
    case "list_nodes":
      return await executeListNodes(args);
    case "search_nodes":
      return await executeSearchNodes(args);
    case "search_semantic":
      return await executeSearchSemantic(args);
    case "add_tag":
      return await executeAddTag(args);
    case "remove_tag":
      return await executeRemoveTag(args);
    case "list_tags":
      return await executeListTags(args);
    case "export_node":
      return await executeExportNode(args);
    case "export_project":
      return await executeExportProject(args);
    case "get_node_content":
      return await executeGetNodeContent(args);
    case "generate_image":
      return await executeGenerateImage(args, masterKey);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

export async function executeMCPTool(
  toolName: string,
  args: ToolArgs,
  masterKey?: string,
): Promise<string> {
  try {
    const result = await executeTool(toolName, args, masterKey);
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
      toolName,
      args,
    });
  }
}
