import type { ChatThread } from "../db/schema";
import { extractTextFromTipTap, isRecord } from "./chat-send-message-helpers";
import type {
  ChatContextNodeService,
  ProjectNodeRecord,
} from "./chat-send-message-types";

interface BuildSystemPromptWithContextParams {
  buildBaseSystemPrompt(mode: string): Promise<string>;
  nodeService: ChatContextNodeService;
  thread: ChatThread;
  projectId?: string | null;
  contextNodeIds?: string[];
}

export async function buildSystemPromptWithContext({
  buildBaseSystemPrompt,
  nodeService,
  thread,
  projectId,
  contextNodeIds,
}: BuildSystemPromptWithContextParams): Promise<string> {
  let systemPrompt = await buildBaseSystemPrompt(thread.agentMode);

  if (projectId) {
    try {
      const projectNode = await nodeService.getNodeById(projectId);
      if (projectNode) {
        const descendants = await nodeService.getDescendants(projectId);
        const projectOutline = buildProjectOutline(descendants, projectId);
        systemPrompt += `\n\n---\n## Current Project Context\n\nThe user is currently working in the project: **${projectNode.name}** (id: ${projectNode.id})\n\nProject structure:\n${projectOutline || "(empty project)"}\n\nWhen the user refers to "the project", "here", or "this context", they mean this project. Use the node IDs above when calling tools that require a projectId or parentId.`;
      }
    } catch (error) {
      console.warn("⚠️ Failed to load project context:", error);
    }
  }

  if (contextNodeIds && contextNodeIds.length > 0) {
    try {
      const contextSections: string[] = [];

      for (const contextNodeId of contextNodeIds) {
        const node = await nodeService.getNodeById(contextNodeId);
        if (!node) {
          continue;
        }

        let contentText = "";
        if (typeof node.content === "string") {
          contentText = node.content;
        } else if (isRecord(node.content)) {
          contentText = extractTextFromTipTap(node.content);
        }

        const contextSection = contentText
          ? `### ${node.name} (${node.type})\n${contentText}`
          : `### ${node.name} (${node.type})\n(no content)`;
        contextSections.push(contextSection);
      }

      if (contextSections.length > 0) {
        systemPrompt += `\n\n---\n## Additional Context\n\nThe user has pinned the following nodes as context for this conversation:\n\n${contextSections.join("\n\n")}`;
      }
    } catch (error) {
      console.warn("⚠️ Failed to load context nodes:", error);
    }
  }

  return systemPrompt;
}

export function buildProjectOutline(
  descendants: ProjectNodeRecord[],
  projectId: string,
): string {
  const depthByNodeId = new Map<string, number>([[projectId, 0]]);

  for (const descendant of descendants) {
    const parentDepth =
      depthByNodeId.get(descendant.parentId ?? projectId) ?? 0;
    depthByNodeId.set(descendant.id, parentDepth + 1);
  }

  return descendants
    .map((descendant) => {
      const depth = depthByNodeId.get(descendant.id) ?? 1;
      const indentation = "  ".repeat(depth - 1);
      return `${indentation}- [${descendant.type}] ${descendant.name} (id: ${descendant.id})`;
    })
    .join("\n");
}
