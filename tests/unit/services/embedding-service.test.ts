import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EmbeddingService,
  OpenAIEmbeddingProvider,
  LocalEmbeddingProvider,
} from "@/services/embedding-service";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";
import { createTestProject, createTestNote } from "@tests/helpers/fixtures";
import { getTestDb } from "@tests/helpers/db";
import { nodes } from "@server/db/schema";
import { eq } from "drizzle-orm";

// ─── LocalEmbeddingProvider ──────────────────────────────────────────────────

describe("LocalEmbeddingProvider", () => {
  it("should have correct name and dimensions", () => {
    const provider = new LocalEmbeddingProvider();
    expect(provider.name).toBe("local");
    expect(provider.dimensions).toBe(EMBEDDING_DIMENSIONS);
  });

  it("should support custom dimensions", () => {
    const provider = new LocalEmbeddingProvider(384);
    expect(provider.dimensions).toBe(384);
  });

  it("should generate a vector of correct dimensions", async () => {
    const provider = new LocalEmbeddingProvider();
    const vector = await provider.embed("test text");
    expect(vector).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("should generate deterministic vectors for same input", async () => {
    const provider = new LocalEmbeddingProvider();
    const vector1 = await provider.embed("hello world");
    const vector2 = await provider.embed("hello world");
    expect(vector1).toEqual(vector2);
  });

  it("should generate different vectors for different inputs", async () => {
    const provider = new LocalEmbeddingProvider();
    const vector1 = await provider.embed("hello world");
    const vector2 = await provider.embed("goodbye world");
    expect(vector1).not.toEqual(vector2);
  });

  it("should generate normalized unit vectors", async () => {
    const provider = new LocalEmbeddingProvider();
    const vector = await provider.embed("test normalization");
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0),
    );
    expect(magnitude).toBeCloseTo(1.0, 5);
  });

  it("should handle batch embedding", async () => {
    const provider = new LocalEmbeddingProvider();
    const vectors = await provider.embedBatch([
      "text one",
      "text two",
      "text three",
    ]);
    expect(vectors).toHaveLength(3);
    expect(vectors[0]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(vectors[1]).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(vectors[2]).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("should handle empty batch", async () => {
    const provider = new LocalEmbeddingProvider();
    const vectors = await provider.embedBatch([]);
    expect(vectors).toHaveLength(0);
  });
});

// ─── OpenAIEmbeddingProvider ─────────────────────────────────────────────────

describe("OpenAIEmbeddingProvider", () => {
  it("should have correct name and dimensions", () => {
    const provider = new OpenAIEmbeddingProvider("sk-test-key");
    expect(provider.name).toBe("openai");
    expect(provider.dimensions).toBe(1536);
  });

  it("should throw if API key is empty", () => {
    expect(() => new OpenAIEmbeddingProvider("")).toThrow(
      "OpenAI API key is required",
    );
  });

  it("should throw if API key is whitespace", () => {
    expect(() => new OpenAIEmbeddingProvider("   ")).toThrow(
      "OpenAI API key is required",
    );
  });

  it("should call OpenAI API correctly", async () => {
    const mockEmbedding = Array(1536).fill(0.01);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ embedding: mockEmbedding, index: 0 }],
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAIEmbeddingProvider("sk-test-key");
    const result = await provider.embed("test text");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test-key",
        },
        body: JSON.stringify({
          input: ["test text"],
          model: "text-embedding-3-small",
          dimensions: 1536,
        }),
      },
    );

    expect(result).toEqual(mockEmbedding);
    fetchSpy.mockRestore();
  });

  it("should handle batch embedding with correct ordering", async () => {
    const mockEmbedding1 = Array(1536).fill(0.01);
    const mockEmbedding2 = Array(1536).fill(0.02);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { embedding: mockEmbedding2, index: 1 },
            { embedding: mockEmbedding1, index: 0 },
          ],
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAIEmbeddingProvider("sk-test-key");
    const results = await provider.embedBatch(["text one", "text two"]);

    expect(results[0]).toEqual(mockEmbedding1);
    expect(results[1]).toEqual(mockEmbedding2);
    fetchSpy.mockRestore();
  });

  it("should throw on API error", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

    const provider = new OpenAIEmbeddingProvider("sk-bad-key");
    await expect(provider.embed("test")).rejects.toThrow(
      "OpenAI embedding API error (401)",
    );
    fetchSpy.mockRestore();
  });

  it("should handle empty batch without API call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const provider = new OpenAIEmbeddingProvider("sk-test-key");
    const results = await provider.embedBatch([]);
    expect(results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ─── EmbeddingService ────────────────────────────────────────────────────────

describe("EmbeddingService", () => {
  const localProvider = new LocalEmbeddingProvider();
  let embeddingService: EmbeddingService;
  const db = getTestDb();

  beforeEach(() => {
    embeddingService = new EmbeddingService(localProvider);
  });

  describe("constructor & getters", () => {
    it("should return provider name", () => {
      expect(embeddingService.getProviderName()).toBe("local");
    });

    it("should return provider dimensions", () => {
      expect(embeddingService.getDimensions()).toBe(EMBEDDING_DIMENSIONS);
    });
  });

  // ─── extractTextFromContent ────────────────────────────────────────────────

  describe("extractTextFromContent", () => {
    it("should return empty string for null content", () => {
      expect(embeddingService.extractTextFromContent(null)).toBe("");
    });

    it("should return empty string for undefined content", () => {
      expect(embeddingService.extractTextFromContent(undefined)).toBe("");
    });

    it("should return string content directly", () => {
      expect(embeddingService.extractTextFromContent("plain text")).toBe(
        "plain text",
      );
    });

    it("should extract text from ProseMirror paragraph", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      };
      expect(embeddingService.extractTextFromContent(doc)).toBe("Hello world");
    });

    it("should extract text from multiple paragraphs", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "First paragraph" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Second paragraph" }],
          },
        ],
      };
      const result = embeddingService.extractTextFromContent(doc);
      expect(result).toContain("First paragraph");
      expect(result).toContain("Second paragraph");
    });

    it("should extract text from headings", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Title" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Body text" }],
          },
        ],
      };
      const result = embeddingService.extractTextFromContent(doc);
      expect(result).toContain("Title");
      expect(result).toContain("Body text");
    });

    it("should handle hardBreak nodes", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Line one" },
              { type: "hardBreak" },
              { type: "text", text: "Line two" },
            ],
          },
        ],
      };
      const result = embeddingService.extractTextFromContent(doc);
      expect(result).toContain("Line one");
      expect(result).toContain("Line two");
    });

    it("should extract text from nested lists", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item one" }],
                  },
                ],
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Item two" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = embeddingService.extractTextFromContent(doc);
      expect(result).toContain("Item one");
      expect(result).toContain("Item two");
    });

    it("should handle empty document", () => {
      const doc = { type: "doc", content: [] };
      expect(embeddingService.extractTextFromContent(doc)).toBe("");
    });
  });

  // ─── embedNode ───────────────────────────────────────────────────────────

  describe("embedNode", () => {
    it("should embed a node with content", async () => {
      const project = await createTestProject();
      const note = await createTestNote(
        "Test Note",
        project.id,
        "Some content for embedding",
      );

      const embedding = await embeddingService.embedNode(note.id);

      expect(embedding).not.toBeNull();
      expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);

      // Verify stored in database
      const [updatedNode] = await db
        .select()
        .from(nodes)
        .where(eq(nodes.id, note.id));
      expect(updatedNode.embedding).not.toBeNull();
    });

    it("should embed a node with ProseMirror JSON content", async () => {
      const project = await createTestProject();
      const prosemirrorContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "ProseMirror content" }],
          },
        ],
      };
      const note = await createTestNote(
        "PM Note",
        project.id,
        prosemirrorContent as any,
      );

      const embedding = await embeddingService.embedNode(note.id);

      expect(embedding).not.toBeNull();
      expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    });

    it("should throw for non-existent node", async () => {
      await expect(
        embeddingService.embedNode("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow("Node not found");
    });

    it("should include node name in embedded text", async () => {
      const project = await createTestProject();
      const note1 = await createTestNote(
        "Note Alpha",
        project.id,
        "Same content",
      );
      const note2 = await createTestNote(
        "Note Beta",
        project.id,
        "Same content",
      );

      const embedding1 = await embeddingService.embedNode(note1.id);
      const embedding2 = await embeddingService.embedNode(note2.id);

      // Different names should produce different embeddings
      expect(embedding1).not.toEqual(embedding2);
    });
  });

  // ─── embedNodes ──────────────────────────────────────────────────────────

  describe("embedNodes", () => {
    it("should embed multiple nodes in batch", async () => {
      const project = await createTestProject();
      const note1 = await createTestNote("Note 1", project.id, "Content 1");
      const note2 = await createTestNote("Note 2", project.id, "Content 2");

      const results = await embeddingService.embedNodes([note1.id, note2.id]);

      expect(results.size).toBe(2);
      expect(results.get(note1.id)).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(results.get(note2.id)).toHaveLength(EMBEDDING_DIMENSIONS);
    });

    it("should handle empty array", async () => {
      const results = await embeddingService.embedNodes([]);
      expect(results.size).toBe(0);
    });

    it("should store embeddings in database", async () => {
      const project = await createTestProject();
      const note = await createTestNote(
        "Batch Note",
        project.id,
        "Batch content",
      );

      await embeddingService.embedNodes([note.id]);

      const [updatedNode] = await db
        .select()
        .from(nodes)
        .where(eq(nodes.id, note.id));
      expect(updatedNode.embedding).not.toBeNull();
    });
  });

  // ─── embedAllMissing ─────────────────────────────────────────────────────

  describe("embedAllMissing", () => {
    it("should embed all nodes without embeddings", async () => {
      const project = await createTestProject();
      const note1 = await createTestNote("Note 1", project.id, "Content 1");
      const note2 = await createTestNote("Note 2", project.id, "Content 2");

      const count = await embeddingService.embedAllMissing();

      // project + note1 + note2 = at least 3 nodes
      expect(count).toBeGreaterThan(0);

      // Verify both notes now have embeddings
      const [node1] = await db
        .select()
        .from(nodes)
        .where(eq(nodes.id, note1.id));
      const [node2] = await db
        .select()
        .from(nodes)
        .where(eq(nodes.id, note2.id));
      expect(node1.embedding).not.toBeNull();
      expect(node2.embedding).not.toBeNull();
    });

    it("should return 0 when all nodes have embeddings", async () => {
      const project = await createTestProject();
      await createTestNote("Note", project.id, "Content");

      // Embed all first
      await embeddingService.embedAllMissing();

      // Call again - should return 0
      const count = await embeddingService.embedAllMissing();
      expect(count).toBe(0);
    });
  });

  // ─── clearEmbedding ──────────────────────────────────────────────────────

  describe("clearEmbedding", () => {
    it("should remove embedding from node", async () => {
      const project = await createTestProject();
      const note = await createTestNote("Note", project.id, "Content");
      await embeddingService.embedNode(note.id);

      // Verify it's set
      const [before] = await db
        .select()
        .from(nodes)
        .where(eq(nodes.id, note.id));
      expect(before.embedding).not.toBeNull();

      await embeddingService.clearEmbedding(note.id);

      const [after] = await db
        .select()
        .from(nodes)
        .where(eq(nodes.id, note.id));
      expect(after.embedding).toBeNull();
    });
  });

  // ─── embedText ───────────────────────────────────────────────────────────

  describe("embedText", () => {
    it("should generate embedding for arbitrary text", async () => {
      const embedding = await embeddingService.embedText("search query text");

      expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    });

    it("should generate deterministic embedding for same text", async () => {
      const embedding1 = await embeddingService.embedText("same query");
      const embedding2 = await embeddingService.embedText("same query");

      expect(embedding1).toEqual(embedding2);
    });
  });
});
