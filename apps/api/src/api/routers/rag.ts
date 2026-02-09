import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { RAGService } from "../../services/rag-service";
import { LocalEmbeddingProvider } from "../../services/embedding-service";

// Use LocalEmbeddingProvider by default; swap to OpenAI when API key is configured
const ragService = new RAGService(new LocalEmbeddingProvider());

const filtersSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    parentId: z.string().uuid().optional(),
    nodeTypes: z.array(z.string()).optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    excludeDeleted: z.boolean().optional(),
  })
  .optional();

/**
 * RAG Router
 *
 * tRPC endpoints for RAG context building.
 */
export const ragRouter = router({
  /**
   * Build LLM context from a query via the RAG pipeline:
   * retrieve → rerank → format → token-limit
   */
  buildContext: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        options: z
          .object({
            topK: z.number().int().min(1).max(50).optional(),
            maxTokens: z.number().int().min(100).max(128000).optional(),
            recencyWeight: z.number().min(0).max(1).optional(),
            filters: filtersSchema,
            minScore: z.number().min(0).max(1).optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      return await ragService.buildContext(input.query, input.options ?? {});
    }),
});
