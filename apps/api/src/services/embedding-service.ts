import { db } from "../db/index";
import { nodes } from "../db/schema";
import { eq, isNull, and, sql } from "drizzle-orm";
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
