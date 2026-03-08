import { router, publicProcedure } from "../trpc";
import { SearchService } from "../../services/search-service";
import { LocalEmbeddingProvider } from "../../services/embedding-service";
import {
  augmentSearchResults,
  hybridSearchInputSchema,
  searchInputSchema,
} from "./search-router-helpers";

// Use LocalEmbeddingProvider by default; swap to OpenAI when API key is configured
const searchService = new SearchService(new LocalEmbeddingProvider());

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
    .input(searchInputSchema)
    .query(async ({ input }) => {
      const results = await searchService.vectorSearch(
        input.query,
        input.filters ?? {},
        input.options ?? {},
      );
      return augmentSearchResults(results);
    }),

  /**
   * Keyword search using PostgreSQL ILIKE
   */
  keywordSearch: publicProcedure
    .input(searchInputSchema)
    .query(async ({ input }) => {
      const results = await searchService.keywordSearch(
        input.query,
        input.filters ?? {},
        input.options ?? {},
      );
      return augmentSearchResults(results);
    }),

  /**
   * Hybrid search combining vector and keyword
   */
  hybridSearch: publicProcedure
    .input(hybridSearchInputSchema)
    .query(async ({ input }) => {
      const results = await searchService.hybridSearch(
        input.query,
        input.filters ?? {},
        input.options ?? {},
      );
      return augmentSearchResults(results);
    }),
});
