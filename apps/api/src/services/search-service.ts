import { db } from "../db/index";
import { nodes, nodeTags, tags, EMBEDDING_DIMENSIONS } from "../db/schema";
import type { Node } from "../db/schema";
import { eq, and, or, isNull, sql, ilike, inArray } from "drizzle-orm";
import { EmbeddingService, EmbeddingProvider } from "./embedding-service";

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
  nodeTypes?: string[];
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
    const conditions = this.buildFilterConditions(filters);

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
    const pattern = `%${query}%`;

    const conditions = this.buildFilterConditions(filters);

    // Match on name or content text
    conditions.push(
      or(
        ilike(nodes.name, pattern),
        sql`${nodes.content}::text ILIKE ${pattern}`,
      )!,
    );

    const results = await db
      .select()
      .from(nodes)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    // Score keyword results based on name match quality
    return results.map((node) => {
      const nameLower = node.name.toLowerCase();
      const queryLower = query.toLowerCase();
      let score = 0.3; // base score for content match
      if (nameLower === queryLower) {
        score = 1.0; // exact name match
      } else if (nameLower.startsWith(queryLower)) {
        score = 0.8; // prefix match
      } else if (nameLower.includes(queryLower)) {
        score = 0.6; // partial name match
      }
      return { node, score, matchType: "keyword" as const };
    });
  }

  /**
   * Hybrid search combining vector similarity and keyword matching.
   * Uses weighted scoring: vectorWeight * vectorScore + (1 - vectorWeight) * keywordScore
   */
  async hybridSearch(
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions & { vectorWeight?: number } = {},
  ): Promise<SearchResult[]> {
    const { limit = 20, vectorWeight = 0.7, minScore = 0.0 } = options;

    // Run both searches in parallel
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearch(query, filters, { limit: limit * 2 }),
      this.keywordSearch(query, filters, { limit: limit * 2 }),
    ]);

    // Merge results by node ID with weighted scores
    const mergedMap = new Map<
      string,
      { node: Node; vectorScore: number; keywordScore: number }
    >();

    for (const result of vectorResults) {
      mergedMap.set(result.node.id, {
        node: result.node,
        vectorScore: result.score,
        keywordScore: 0,
      });
    }

    for (const result of keywordResults) {
      const existing = mergedMap.get(result.node.id);
      if (existing) {
        existing.keywordScore = result.score;
      } else {
        mergedMap.set(result.node.id, {
          node: result.node,
          vectorScore: 0,
          keywordScore: result.score,
        });
      }
    }

    // Calculate hybrid scores and sort
    const hybridResults: SearchResult[] = Array.from(mergedMap.values())
      .map(({ node, vectorScore, keywordScore }) => ({
        node,
        score: vectorWeight * vectorScore + (1 - vectorWeight) * keywordScore,
        matchType: "hybrid" as const,
      }))
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return hybridResults;
  }

  /**
   * Build SQL filter conditions from SearchFilters
   */
  private buildFilterConditions(filters: SearchFilters) {
    const conditions: ReturnType<typeof sql>[] = [];

    // Exclude soft-deleted by default
    if (filters.excludeDeleted !== false) {
      conditions.push(isNull(nodes.deletedAt));
    }

    // Filter by project: find nodes under the project
    if (filters.projectId) {
      conditions.push(
        or(
          eq(nodes.id, filters.projectId),
          eq(nodes.parentId, filters.projectId),
          // For deeper nesting we'd need a recursive CTE, but for now
          // we support direct children. The vector search still finds relevant
          // nodes anywhere in the tree.
          sql`${nodes.id} IN (
            SELECT n2.id FROM nodes n2
            WHERE n2.parent_id IN (
              SELECT n3.id FROM nodes n3 WHERE n3.parent_id = ${filters.projectId}
            )
          )`,
        )!,
      );
    }

    // Filter by parent
    if (filters.parentId) {
      conditions.push(eq(nodes.parentId, filters.parentId));
    }

    // Filter by node types
    if (filters.nodeTypes && filters.nodeTypes.length > 0) {
      conditions.push(inArray(nodes.type, filters.nodeTypes));
    }

    // Filter by tags (nodes that have ANY of the specified tags)
    if (filters.tagIds && filters.tagIds.length > 0) {
      conditions.push(
        sql`${nodes.id} IN (
          SELECT nt.node_id FROM node_tags nt
          WHERE nt.tag_id IN (${sql.join(
            filters.tagIds.map((id) => sql`${id}`),
            sql`, `,
          )})
        )`,
      );
    }

    return conditions;
  }
}
