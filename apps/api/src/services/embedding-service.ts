import { db } from "../db/index";
import { nodes } from "../db/schema";
import { eq, isNull, and, sql, asc } from "drizzle-orm";
import {
  buildEmbeddingText,
  extractTextFromContent as extractEmbeddingTextFromContent,
} from "./embedding-content";
export {
  LocalEmbeddingProvider,
  OpenAIEmbeddingProvider,
} from "./embedding-providers";
import type { EmbeddingProvider } from "./embedding-types";
export type { EmbeddingProvider } from "./embedding-types";

export type EmbeddingBackfillMode = "missing" | "all";

export interface EmbeddingBackfillBatchProgress {
  mode: EmbeddingBackfillMode;
  batchNumber: number;
  totalBatches: number;
  batchSize: number;
  batchEmbeddedCount: number;
  batchStartIndex: number;
  processedCount: number;
  totalCandidates: number;
}

export interface EmbeddingBackfillOptions {
  mode?: EmbeddingBackfillMode;
  batchSize?: number;
  onBatchComplete?: (progress: EmbeddingBackfillBatchProgress) => void;
}

export interface EmbeddingBackfillResult {
  mode: EmbeddingBackfillMode;
  batchSize: number;
  totalCandidates: number;
  processedCount: number;
  embeddedCount: number;
  batches: number;
}

/**
 * EmbeddingService
 *
 * Manages embedding generation and storage for nodes.
 * Extracts text from ProseMirror JSON content, generates embeddings
 * via a configurable provider, and stores them in the nodes table.
 */
export class EmbeddingService {
  private provider: EmbeddingProvider;

  constructor(provider: EmbeddingProvider) {
    this.provider = provider;
  }

  getProviderName(): string {
    return this.provider.name;
  }

  getDimensions(): number {
    return this.provider.dimensions;
  }

  /**
   * Extract plain text from ProseMirror JSON content
   */
  extractTextFromContent(content: unknown): string {
    return extractEmbeddingTextFromContent(content);
  }

  private getBackfillWhereCondition(mode: EmbeddingBackfillMode) {
    if (mode === "missing") {
      return and(isNull(nodes.embedding), isNull(nodes.deletedAt));
    }

    return isNull(nodes.deletedAt);
  }

  private async getBackfillCandidateNodeIds(
    mode: EmbeddingBackfillMode,
  ): Promise<string[]> {
    const candidateNodes = await db
      .select({ id: nodes.id })
      .from(nodes)
      .where(this.getBackfillWhereCondition(mode))
      .orderBy(asc(nodes.id));

    return candidateNodes.map((node) => node.id);
  }

  async countBackfillCandidates(
    mode: EmbeddingBackfillMode = "missing",
  ): Promise<number> {
    const candidateNodeIds = await this.getBackfillCandidateNodeIds(mode);
    return candidateNodeIds.length;
  }

  /**
   * Generate and store embedding for a single node
   */
  async embedNode(nodeId: string): Promise<number[] | null> {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, nodeId));
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    const fullText = buildEmbeddingText(node.name, node.content);
    if (!fullText) return null;

    const embedding = await this.provider.embed(fullText);
    await db
      .update(nodes)
      .set({ embedding, updatedAt: new Date() })
      .where(eq(nodes.id, nodeId));

    return embedding;
  }

  /**
   * Generate and store embeddings for multiple nodes (batch)
   */
  async embedNodes(nodeIds: string[]): Promise<Map<string, number[] | null>> {
    if (nodeIds.length === 0) return new Map();

    const nodeList = await db
      .select()
      .from(nodes)
      .where(
        sql`${nodes.id} IN (${sql.join(
          nodeIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

    const textsToEmbed: string[] = [];
    const nodeIndexMap: Map<string, number> = new Map();
    const results: Map<string, number[] | null> = new Map();

    for (const node of nodeList) {
      const fullText = buildEmbeddingText(node.name, node.content);
      if (fullText) {
        nodeIndexMap.set(node.id, textsToEmbed.length);
        textsToEmbed.push(fullText);
      } else {
        results.set(node.id, null);
      }
    }

    if (textsToEmbed.length > 0) {
      const embeddings = await this.provider.embedBatch(textsToEmbed);
      for (const node of nodeList) {
        const idx = nodeIndexMap.get(node.id);
        if (idx !== undefined) {
          const embedding = embeddings[idx];
          results.set(node.id, embedding);
          await db
            .update(nodes)
            .set({ embedding, updatedAt: new Date() })
            .where(eq(nodes.id, node.id));
        }
      }
    }

    return results;
  }

  /**
   * Embed all nodes that don't have embeddings yet
   */
  async embedAllMissing(): Promise<number> {
    const unembeddedNodes = await db
      .select({ id: nodes.id })
      .from(nodes)
      .where(and(isNull(nodes.embedding), isNull(nodes.deletedAt)));

    if (unembeddedNodes.length === 0) return 0;
    const nodeIds = unembeddedNodes.map((n) => n.id);
    await this.embedNodes(nodeIds);
    return nodeIds.length;
  }

  async backfillEmbeddings(
    options: EmbeddingBackfillOptions = {},
  ): Promise<EmbeddingBackfillResult> {
    const mode = options.mode ?? "missing";
    const batchSize = options.batchSize ?? 100;

    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new Error("batchSize must be a positive integer");
    }

    const candidateNodeIds = await this.getBackfillCandidateNodeIds(mode);
    const totalCandidates = candidateNodeIds.length;

    if (totalCandidates === 0) {
      return {
        mode,
        batchSize,
        totalCandidates,
        processedCount: 0,
        embeddedCount: 0,
        batches: 0,
      };
    }

    const totalBatches = Math.ceil(totalCandidates / batchSize);
    let processedCount = 0;
    let embeddedCount = 0;

    for (let batchNumber = 1; batchNumber <= totalBatches; batchNumber++) {
      const batchStartIndex = (batchNumber - 1) * batchSize;
      const batchNodeIds = candidateNodeIds.slice(
        batchStartIndex,
        batchStartIndex + batchSize,
      );
      const batchResults = await this.embedNodes(batchNodeIds);
      const batchEmbeddedCount = Array.from(batchResults.values()).filter(
        (embedding): embedding is number[] => embedding !== null,
      ).length;

      processedCount += batchNodeIds.length;
      embeddedCount += batchEmbeddedCount;

      options.onBatchComplete?.({
        mode,
        batchNumber,
        totalBatches,
        batchSize: batchNodeIds.length,
        batchEmbeddedCount,
        batchStartIndex,
        processedCount,
        totalCandidates,
      });
    }

    return {
      mode,
      batchSize,
      totalCandidates,
      processedCount,
      embeddedCount,
      batches: totalBatches,
    };
  }

  /**
   * Remove embedding from a node
   */
  async clearEmbedding(nodeId: string): Promise<void> {
    await db
      .update(nodes)
      .set({ embedding: null, updatedAt: new Date() })
      .where(eq(nodes.id, nodeId));
  }

  /**
   * Generate embedding for arbitrary text (for search queries)
   */
  async embedText(text: string): Promise<number[]> {
    return this.provider.embed(text);
  }
}
