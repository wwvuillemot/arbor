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
