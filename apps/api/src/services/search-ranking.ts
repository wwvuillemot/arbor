import type { Node } from "../db/schema";
import type { SearchResult } from "./search-types";

type HybridScoreEntry = {
  node: Node;
  vectorScore: number;
  keywordScore: number;
};

export function scoreKeywordMatch(nodeName: string, query: string): number {
  const normalizedNodeName = nodeName.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  if (normalizedNodeName === normalizedQuery) {
    return 1.0;
  }

  if (normalizedNodeName.startsWith(normalizedQuery)) {
    return 0.8;
  }

  if (normalizedNodeName.includes(normalizedQuery)) {
    return 0.6;
  }

  return 0.3;
}

export function buildKeywordSearchResults(
  matchedNodes: Node[],
  query: string,
): SearchResult[] {
  return matchedNodes.map((node) => ({
    node,
    score: scoreKeywordMatch(node.name, query),
    matchType: "keyword" as const,
  }));
}

export function mergeHybridSearchResults(
  vectorResults: SearchResult[],
  keywordResults: SearchResult[],
  vectorWeight: number,
  limit: number,
  minScore: number,
): SearchResult[] {
  const mergedResultsByNodeId = new Map<string, HybridScoreEntry>();

  for (const result of vectorResults) {
    mergedResultsByNodeId.set(result.node.id, {
      node: result.node,
      vectorScore: result.score,
      keywordScore: 0,
    });
  }

  for (const result of keywordResults) {
    const existingEntry = mergedResultsByNodeId.get(result.node.id);

    if (existingEntry) {
      existingEntry.keywordScore = result.score;
      continue;
    }

    mergedResultsByNodeId.set(result.node.id, {
      node: result.node,
      vectorScore: 0,
      keywordScore: result.score,
    });
  }

  return Array.from(mergedResultsByNodeId.values())
    .map(({ node, vectorScore, keywordScore }) => ({
      node,
      score: vectorWeight * vectorScore + (1 - vectorWeight) * keywordScore,
      matchType: "hybrid" as const,
    }))
    .filter((result) => result.score >= minScore)
    .sort((leftResult, rightResult) => rightResult.score - leftResult.score)
    .slice(0, limit);
}
