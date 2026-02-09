-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "idx_nodes_embedding" ON "nodes" USING hnsw ("embedding" vector_cosine_ops);