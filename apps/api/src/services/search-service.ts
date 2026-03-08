import { db } from "../db/index";
import { nodes } from "../db/schema";
import { and, sql } from "drizzle-orm";
import { EmbeddingService } from "./embedding-service";
import type { EmbeddingProvider } from "./embedding-service";
import {
  buildKeywordMatchCondition,
  buildSearchFilterConditions,
} from "./search-filters";
import {
  buildKeywordSearchResults,
  mergeHybridSearchResults,
} from "./search-ranking";
import type {
  HybridSearchOptions,
  SearchFilters,
  SearchOptions,
  SearchResult,
} from "./search-types";
export type {
  HybridSearchOptions,
  SearchFilters,
  SearchOptions,
  SearchResult,
} from "./search-types";

/**
 * SearchService
 *
 * Provides vector search, keyword search, and hybrid search capabilities
 * using pgvector for semantic similarity and PostgreSQL ILIKE for keywords.
 */
export class SearchService {
  private embeddingService: EmbeddingService;

  constructor(provider: EmbeddingProvider) {
    this.embeddingService = new EmbeddingService(provider);
  }

  getEmbeddingService(): EmbeddingService {
    return this.embeddingService;
  }

  /**
   * Vector (semantic) search using cosine similarity
   */
  async vectorSearch(
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const { limit = 20, offset = 0, minScore = 0.0 } = options;

    // Generate embedding for the search query
    const queryEmbedding = await this.embeddingService.embedText(query);
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    // Build the base query with cosine similarity score
    // pgvector: 1 - (embedding <=> query) gives cosine similarity (0 to 1)
    const conditions = buildSearchFilterConditions(filters);

    // Must have an embedding to do vector search
    conditions.push(sql`${nodes.embedding} IS NOT NULL`);

    const results = await db
      .select({
        node: nodes,
        score:
          sql<number>`1 - (${nodes.embedding} <=> ${embeddingStr}::vector)`.as(
            "score",
          ),
      })
      .from(nodes)
      .where(and(...conditions))
      .orderBy(sql`${nodes.embedding} <=> ${embeddingStr}::vector`)
      .limit(limit)
      .offset(offset);

    return results
      .filter((r) => r.score >= minScore)
      .map((r) => ({
        node: r.node,
        score: r.score,
        matchType: "vector" as const,
      }));
  }

  /**
   * Keyword search using PostgreSQL ILIKE on name and content
   */
  async keywordSearch(
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const { limit = 20, offset = 0 } = options;

    const conditions = buildSearchFilterConditions(filters);

    // Match on name or content text
    conditions.push(buildKeywordMatchCondition(query));

    const results = await db
      .select()
      .from(nodes)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    return buildKeywordSearchResults(results, query);
  }

  /**
   * Hybrid search combining vector similarity and keyword matching.
   * Uses weighted scoring: vectorWeight * vectorScore + (1 - vectorWeight) * keywordScore
   */
  async hybridSearch(
    query: string,
    filters: SearchFilters = {},
    options: HybridSearchOptions = {},
  ): Promise<SearchResult[]> {
    const { limit = 20, vectorWeight = 0.7, minScore = 0.0 } = options;

    // Run both searches in parallel
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearch(query, filters, { limit: limit * 2 }),
      this.keywordSearch(query, filters, { limit: limit * 2 }),
    ]);

    return mergeHybridSearchResults(
      vectorResults,
      keywordResults,
      vectorWeight,
      limit,
      minScore,
    );
  }
}
