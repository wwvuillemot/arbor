import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { SearchService } from "../../services/search-service";
import { LocalEmbeddingProvider } from "../../services/embedding-service";

// Use LocalEmbeddingProvider by default; swap to OpenAI when API key is configured
const searchService = new SearchService(new LocalEmbeddingProvider());

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
      return await searchService.vectorSearch(
        input.query,
        input.filters ?? {},
        input.options ?? {},
      );
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
      return await searchService.keywordSearch(
        input.query,
        input.filters ?? {},
        input.options ?? {},
      );
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
      return await searchService.hybridSearch(
        input.query,
        input.filters ?? {},
        input.options ?? {},
      );
    }),
});
