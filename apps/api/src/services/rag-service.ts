import { db } from "../db/index";
import { nodes, nodeTags, tags } from "../db/schema";
import type { Node, Tag } from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { SearchService, SearchFilters, SearchResult } from "./search-service";
import { EmbeddingProvider } from "./embedding-service";

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
    const documents = await this.buildDocuments(topResults);

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
    if (results.length === 0) return [];

    // Find the time range for normalization
    const timestamps = results.map((r) => r.node.updatedAt.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1; // avoid division by zero

    return results
      .map((result) => {
        const recencyScore =
          (result.node.updatedAt.getTime() - minTime) / timeRange;
        const finalScore =
          (1 - recencyWeight) * result.score + recencyWeight * recencyScore;
        return { ...result, score: finalScore };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Build the ancestor path string for a node (e.g., "Project > Folder > Note").
   */
  async buildAncestorPath(nodeId: string): Promise<string> {
    const pathParts: string[] = [];
    let currentId: string | null = nodeId;

    // Walk up the parent chain (max 20 levels to prevent infinite loops)
    for (let depth = 0; depth < 20 && currentId; depth++) {
      const [node] = await db
        .select({ id: nodes.id, name: nodes.name, parentId: nodes.parentId })
        .from(nodes)
        .where(eq(nodes.id, currentId));

      if (!node) break;
      pathParts.unshift(node.name);
      currentId = node.parentId;
    }

    return pathParts.join(" > ");
  }

  /**
   * Get tag names for a node.
   */
  async getNodeTagNames(nodeId: string): Promise<string[]> {
    const results = await db
      .select({ name: tags.name })
      .from(nodeTags)
      .innerJoin(tags, eq(nodeTags.tagId, tags.id))
      .where(eq(nodeTags.nodeId, nodeId));

    return results.map((r) => r.name);
  }

  /**
   * Build RAGDocuments from search results by enriching with path and tags.
   */
  private async buildDocuments(
    results: SearchResult[],
  ): Promise<RAGDocument[]> {
    const documents: RAGDocument[] = [];

    for (const result of results) {
      const [path, tagNames] = await Promise.all([
        this.buildAncestorPath(result.node.id),
        this.getNodeTagNames(result.node.id),
      ]);

      const embeddingService = this.searchService.getEmbeddingService();
      const contentText = embeddingService.extractTextFromContent(
        result.node.content,
      );

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

  /**
   * Format documents into context string, respecting token limit.
   * Returns the formatted string and the documents that fit within the limit.
   */
  formatWithTokenLimit(
    documents: RAGDocument[],
    maxTokens: number,
  ): { contextString: string; includedDocuments: RAGDocument[] } {
    const header = "# Relevant Context\n\n";
    let currentTokens = this.estimateTokens(header);
    const includedDocuments: RAGDocument[] = [];
    const sections: string[] = [header];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const section = this.formatDocument(doc, i + 1);
      const sectionTokens = this.estimateTokens(section);

      if (currentTokens + sectionTokens > maxTokens) break;

      sections.push(section);
      includedDocuments.push(doc);
      currentTokens += sectionTokens;
    }

    return {
      contextString: sections.join("").trimEnd(),
      includedDocuments,
    };
  }

  /**
   * Format a single document as a context section.
   */
  formatDocument(doc: RAGDocument, index: number): string {
    const lines: string[] = [];
    lines.push(`## Document ${index}: ${doc.name}`);
    lines.push(`Path: ${doc.path}`);

    if (doc.tags.length > 0) {
      lines.push(`Tags: ${doc.tags.join(", ")}`);
    }

    lines.push(`Content:`);
    lines.push(doc.content || "(empty)");
    lines.push("");
    lines.push("---");
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Estimate token count for a string.
   * Approximation: ~4 characters per token (common for English text with GPT models).
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
