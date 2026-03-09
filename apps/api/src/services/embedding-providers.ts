import { EMBEDDING_DIMENSIONS } from "../db/schema";
import type { EmbeddingProvider } from "./embedding-types";

type OpenAIEmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

/**
 * OpenAI Embedding Provider
 * Uses text-embedding-3-small (1536 dimensions, $0.02/1M tokens)
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimensions = 1536;

  constructor(
    private readonly apiKey: string,
    private readonly model = "text-embedding-3-small",
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("OpenAI API key is required");
    }
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

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

    const data = (await response.json()) as OpenAIEmbeddingsResponse;

    return data.data
      .sort((leftItem, rightItem) => leftItem.index - rightItem.index)
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

  constructor(readonly dimensions = EMBEDDING_DIMENSIONS) {}

  async embed(text: string): Promise<number[]> {
    return this.generateStubVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  private generateStubVector(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0);

    for (
      let characterIndex = 0;
      characterIndex < text.length;
      characterIndex++
    ) {
      const characterCode = text.charCodeAt(characterIndex);
      vector[characterIndex % this.dimensions] += characterCode / 1000;
    }

    const magnitude = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0),
    );

    if (magnitude > 0) {
      for (let vectorIndex = 0; vectorIndex < vector.length; vectorIndex++) {
        vector[vectorIndex] /= magnitude;
      }
    }

    return vector;
  }
}
