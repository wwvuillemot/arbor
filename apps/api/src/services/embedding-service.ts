import { db } from "../db/index";
import { nodes, EMBEDDING_DIMENSIONS } from "../db/schema";
import { eq, isNull, and, sql } from "drizzle-orm";

/**
 * ProseMirror JSON node types (from TipTap)
 */
interface PMNode {
  type: string;
  content?: PMNode[];
  text?: string;
  attrs?: Record<string, any>;
}

/**
 * Embedding provider interface for extensibility
 */
export interface EmbeddingProvider {
  /** Provider name for identification */
  readonly name: string;
  /** Vector dimensions this provider produces */
  readonly dimensions: number;
  /** Generate embedding vector for a single text */
  embed(text: string): Promise<number[]>;
  /** Generate embeddings for multiple texts (batch) */
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * OpenAI Embedding Provider
 * Uses text-embedding-3-small (1536 dimensions, $0.02/1M tokens)
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimensions = 1536;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(
    apiKey: string,
    model = "text-embedding-3-small",
    baseUrl = "https://api.openai.com/v1",
  ) {
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("OpenAI API key is required");
    }
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenAI embedding API error (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    // Sort by index to maintain input order
    return data.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}

/**
 * Local (stub) Embedding Provider
 * Placeholder for future local embedding model (e.g., all-MiniLM-L6-v2 via Transformers.js)
 * Currently generates zero vectors for testing purposes
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly dimensions: number;

  constructor(dimensions = EMBEDDING_DIMENSIONS) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    // Stub: generate a deterministic vector based on text hash for testing
    return this.generateStubVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  private generateStubVector(text: string): number[] {
    // Generate a simple deterministic vector from text for testing
    // Uses a basic hash function to produce consistent results
    const vector = new Array(this.dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      vector[i % this.dimensions] += charCode / 1000;
    }
    // Normalize to unit vector
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0),
    );
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
    return vector;
  }
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
    if (!content) return "";
    if (typeof content === "string") return content;
    const doc = content as PMNode;
    if (!doc.content) return doc.text || "";
    return this.extractTextFromNodes(doc.content);
  }

  private extractTextFromNodes(pmNodes: PMNode[]): string {
    const parts: string[] = [];
    for (const node of pmNodes) {
      if (node.text) {
        parts.push(node.text);
      } else if (node.type === "hardBreak") {
        parts.push("\n");
      } else if (node.content) {
        parts.push(this.extractTextFromNodes(node.content));
      }
      if (
        [
          "paragraph",
          "heading",
          "bulletList",
          "orderedList",
          "blockquote",
          "codeBlock",
        ].includes(node.type)
      ) {
        parts.push("\n");
      }
    }
    return parts.join("").trim();
  }

  /**
   * Generate and store embedding for a single node
   */
  async embedNode(nodeId: string): Promise<number[] | null> {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, nodeId));
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    const contentText = this.extractTextFromContent(node.content);
    const fullText = `${node.name}\n${contentText}`.trim();
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
      const contentText = this.extractTextFromContent(node.content);
      const fullText = `${node.name}\n${contentText}`.trim();
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
