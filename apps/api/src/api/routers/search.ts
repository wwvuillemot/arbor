import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { SearchService } from "../../services/search-service";
import type { SearchResult } from "../../services/search-service";
import { LocalEmbeddingProvider } from "../../services/embedding-service";
import { db } from "../../db/index";
import { nodeTags, tags } from "../../db/schema";
import { inArray, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Use LocalEmbeddingProvider by default; swap to OpenAI when API key is configured
const searchService = new SearchService(new LocalEmbeddingProvider());

interface TagInfo {
  id: string;
  name: string;
  color: string | null;
}
interface AugmentedSearchResult extends SearchResult {
  tags: TagInfo[];
  projectId: string | null;
  projectName: string | null;
}

async function augmentResults(
  results: SearchResult[],
): Promise<AugmentedSearchResult[]> {
  if (results.length === 0) return [];

  const nodeIds = results.map((r) => r.node.id);

  // Batch fetch tags for all nodes
  const tagRows = await db
    .select({
      nodeId: nodeTags.nodeId,
      tagId: tags.id,
      tagName: tags.name,
      tagColor: tags.color,
    })
    .from(nodeTags)
    .innerJoin(tags, eq(tags.id, nodeTags.tagId))
    .where(inArray(nodeTags.nodeId, nodeIds));

  const tagsMap = new Map<string, TagInfo[]>();
  for (const row of tagRows) {
    if (!tagsMap.has(row.nodeId)) tagsMap.set(row.nodeId, []);
    tagsMap
      .get(row.nodeId)!
      .push({ id: row.tagId, name: row.tagName, color: row.tagColor });
  }

  // Resolve project ancestry via up-to-3-level join
  const ancestryRows = await db.execute(sql`
    SELECT
      n.id,
      COALESCE(
        CASE WHEN n.type = 'project' THEN n.id END,
        CASE WHEN p1.type = 'project' THEN p1.id END,
        CASE WHEN p2.type = 'project' THEN p2.id END,
        CASE WHEN p3.type = 'project' THEN p3.id END
      ) AS project_id,
      COALESCE(
        CASE WHEN n.type = 'project' THEN n.name END,
        CASE WHEN p1.type = 'project' THEN p1.name END,
        CASE WHEN p2.type = 'project' THEN p2.name END,
        CASE WHEN p3.type = 'project' THEN p3.name END
      ) AS project_name
    FROM nodes n
    LEFT JOIN nodes p1 ON p1.id = n.parent_id
    LEFT JOIN nodes p2 ON p2.id = p1.parent_id
    LEFT JOIN nodes p3 ON p3.id = p2.parent_id
    WHERE n.id = ANY(ARRAY[${sql.join(
      nodeIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )}])
  `);

  const ancestryMap = new Map<
    string,
    { projectId: string | null; projectName: string | null }
  >();
  for (const row of ancestryRows) {
    ancestryMap.set(row.id as string, {
      projectId: (row.project_id as string) ?? null,
      projectName: (row.project_name as string) ?? null,
    });
  }

  return results.map((r) => ({
    ...r,
    tags: tagsMap.get(r.node.id) ?? [],
    projectId: ancestryMap.get(r.node.id)?.projectId ?? null,
    projectName: ancestryMap.get(r.node.id)?.projectName ?? null,
  }));
}

const filtersSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    parentId: z.string().uuid().optional(),
    nodeTypes: z.array(z.string()).optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    excludeDeleted: z.boolean().optional(),
  })
  .optional();

const optionsSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
    minScore: z.number().min(0).max(1).optional(),
  })
  .optional();

/**
 * Search Router
 *
 * tRPC endpoints for vector, keyword, and hybrid search.
 */
export const searchRouter = router({
  /**
   * Vector (semantic) search using cosine similarity
   */
  vectorSearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        filters: filtersSchema,
        options: optionsSchema,
      }),
    )
    .query(async ({ input }) => {
      const results = await searchService.vectorSearch(
        input.query,
        input.filters ?? {},
        input.options ?? {},
      );
      return augmentResults(results);
    }),

  /**
   * Keyword search using PostgreSQL ILIKE
   */
  keywordSearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        filters: filtersSchema,
        options: optionsSchema,
      }),
    )
    .query(async ({ input }) => {
      const results = await searchService.keywordSearch(
        input.query,
        input.filters ?? {},
        input.options ?? {},
      );
      return augmentResults(results);
    }),

  /**
   * Hybrid search combining vector and keyword
   */
  hybridSearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        filters: filtersSchema,
        options: optionsSchema
          .unwrap()
          .extend({
            vectorWeight: z.number().min(0).max(1).optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const results = await searchService.hybridSearch(
        input.query,
        input.filters ?? {},
        input.options ?? {},
      );
      return augmentResults(results);
    }),
});
