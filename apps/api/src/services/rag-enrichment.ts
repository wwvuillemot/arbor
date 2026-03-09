import { eq } from "drizzle-orm";
import { db } from "../db/index";
import { nodeTags, nodes, tags } from "../db/schema";
import { extractTextFromContent } from "./embedding-content";
import type { SearchResult } from "./search-service";
import type { RAGDocument } from "./rag-types";

const MAX_ANCESTOR_DEPTH = 20;

export async function buildAncestorPath(nodeId: string): Promise<string> {
  const pathParts: string[] = [];
  let currentId: string | null = nodeId;

  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && currentId; depth++) {
    const [node] = await db
      .select({ id: nodes.id, name: nodes.name, parentId: nodes.parentId })
      .from(nodes)
      .where(eq(nodes.id, currentId));

    if (!node) {
      break;
    }

    pathParts.unshift(node.name);
    currentId = node.parentId;
  }

  return pathParts.join(" > ");
}

export async function getNodeTagNames(nodeId: string): Promise<string[]> {
  const results = await db
    .select({ name: tags.name })
    .from(nodeTags)
    .innerJoin(tags, eq(nodeTags.tagId, tags.id))
    .where(eq(nodeTags.nodeId, nodeId));

  return results.map((result) => result.name);
}

export async function buildRagDocuments(
  results: SearchResult[],
): Promise<RAGDocument[]> {
  const documents: RAGDocument[] = [];

  for (const result of results) {
    const [path, tagNames] = await Promise.all([
      buildAncestorPath(result.node.id),
      getNodeTagNames(result.node.id),
    ]);

    const contentText = extractTextFromContent(result.node.content);

    documents.push({
      nodeId: result.node.id,
      name: result.node.name,
      path,
      tags: tagNames,
      content: contentText,
      score: result.score,
      updatedAt: result.node.updatedAt,
    });
  }

  return documents;
}
