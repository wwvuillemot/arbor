import type { EmbeddingProvider } from "./embedding-service";
import {
  buildAncestorPath as buildNodeAncestorPath,
  buildRagDocuments,
  getNodeTagNames as getNodeTagNameList,
} from "./rag-enrichment";
import {
  estimateTokens as estimateRagTokens,
  formatDocument as formatRagDocument,
  formatWithTokenLimit as formatRagContextWithTokenLimit,
  rerankSearchResults,
} from "./rag-formatting";
import type { RAGContext, RAGDocument, RAGOptions } from "./rag-types";
export type { RAGContext, RAGDocument, RAGOptions } from "./rag-types";
import { SearchService } from "./search-service";
import type { SearchResult } from "./search-service";

/**
 * RAGService
 *
 * Builds context for LLM consumption using a retrieval-augmented generation pipeline:
 * 1. Query → Generate embedding via SearchService
 * 2. Retrieve → Top-k similar nodes via hybrid search
 * 3. Rerank → Score by relevance + recency
 * 4. Format → Build context string with path, tags, content
 * 5. Optimize → Token counting to stay within limits
 */
export class RAGService {
  private searchService: SearchService;

  constructor(provider: EmbeddingProvider) {
    this.searchService = new SearchService(provider);
  }

  getSearchService(): SearchService {
    return this.searchService;
  }

  /**
   * Build context for LLM from a query string.
   * Full pipeline: retrieve → rerank → format → token-limit.
   */
  async buildContext(
    query: string,
    options: RAGOptions = {},
  ): Promise<RAGContext> {
    const {
      topK = 10,
      maxTokens = 4000,
      recencyWeight = 0.2,
      filters = {},
      minScore = 0.1,
    } = options;

    // Step 1 & 2: Retrieve via hybrid search (embedding generated inside)
    const searchResults = await this.searchService.hybridSearch(
      query,
      filters,
      { limit: topK * 2, minScore },
    );

    const totalRetrieved = searchResults.length;

    // Step 3: Rerank by relevance + recency
    const reranked = this.rerank(searchResults, recencyWeight);

    // Take top-k after reranking
    const topResults = reranked.slice(0, topK);

    // Step 4: Build RAG documents (path, tags, content)
    const documents = await buildRagDocuments(topResults);

    // Step 5: Format and enforce token limit
    const { contextString, includedDocuments } = this.formatWithTokenLimit(
      documents,
      maxTokens,
    );

    const tokenCount = this.estimateTokens(contextString);

    return {
      contextString,
      documents: includedDocuments,
      tokenCount,
      totalRetrieved,
    };
  }

  /**
   * Rerank search results by combining relevance score with recency.
   * Formula: finalScore = (1 - recencyWeight) * relevanceScore + recencyWeight * recencyScore
   */
  rerank(results: SearchResult[], recencyWeight: number): SearchResult[] {
    return rerankSearchResults(results, recencyWeight);
  }

  /**
   * Build the ancestor path string for a node (e.g., "Project > Folder > Note").
   */
  async buildAncestorPath(nodeId: string): Promise<string> {
    return buildNodeAncestorPath(nodeId);
  }

  /**
   * Get tag names for a node.
   */
  async getNodeTagNames(nodeId: string): Promise<string[]> {
    return getNodeTagNameList(nodeId);
  }

  /**
   * Format documents into context string, respecting token limit.
   * Returns the formatted string and the documents that fit within the limit.
   */
  formatWithTokenLimit(
    documents: RAGDocument[],
    maxTokens: number,
  ): { contextString: string; includedDocuments: RAGDocument[] } {
    return formatRagContextWithTokenLimit(documents, maxTokens);
  }

  /**
   * Format a single document as a context section.
   */
  formatDocument(doc: RAGDocument, index: number): string {
    return formatRagDocument(doc, index);
  }

  /**
   * Estimate token count for a string.
   * Approximation: ~4 characters per token (common for English text with GPT models).
   */
  estimateTokens(text: string): number {
    return estimateRagTokens(text);
  }
}
