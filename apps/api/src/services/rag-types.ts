import type { SearchFilters } from "./search-service";

/**
 * RAG pipeline options
 */
export interface RAGOptions {
  /** Maximum number of documents to retrieve (default: 10) */
  topK?: number;
  /** Maximum token budget for the context (default: 4000) */
  maxTokens?: number;
  /** Weight for recency in reranking (0-1, default: 0.2) */
  recencyWeight?: number;
  /** Search filters (project, tags, node types, etc.) */
  filters?: SearchFilters;
  /** Minimum relevance score threshold (0-1, default: 0.1) */
  minScore?: number;
}

/**
 * A single document in the RAG context
 */
export interface RAGDocument {
  nodeId: string;
  name: string;
  path: string;
  tags: string[];
  content: string;
  score: number;
  updatedAt: Date;
}

/**
 * Output of the RAG context builder
 */
export interface RAGContext {
  /** Formatted context string for the LLM */
  contextString: string;
  /** Individual documents included in the context */
  documents: RAGDocument[];
  /** Estimated token count of the context string */
  tokenCount: number;
  /** Total documents retrieved before truncation */
  totalRetrieved: number;
}
