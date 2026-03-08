import type { Node, NodeType } from "../db/schema";

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  node: Node;
  score: number;
  matchType: "vector" | "keyword" | "hybrid";
}

/**
 * Search filters
 */
export interface SearchFilters {
  projectId?: string;
  parentId?: string;
  nodeTypes?: NodeType[];
  tagIds?: string[];
  excludeDeleted?: boolean;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
}

export interface HybridSearchOptions extends SearchOptions {
  vectorWeight?: number;
}
