import { describe, it, expect, beforeEach } from "vitest";
import { RAGService } from "@/services/rag-service";
import { LocalEmbeddingProvider } from "@/services/embedding-service";
import {
  createTestProject,
  createTestNote,
  createTestFolder,
} from "@tests/helpers/fixtures";
import { getTestDb } from "@tests/helpers/db";
import { tags, nodeTags } from "@server/db/schema";

let ragService: RAGService;
let provider: LocalEmbeddingProvider;

beforeEach(() => {
  provider = new LocalEmbeddingProvider();
  ragService = new RAGService(provider);
});

describe("RAGService constructor", () => {
  it("should create a RAGService with a provider", () => {
    expect(ragService).toBeDefined();
    expect(ragService.getSearchService()).toBeDefined();
  });

  it("should expose the search service", () => {
    const searchService = ragService.getSearchService();
    expect(searchService.getEmbeddingService().getProviderName()).toBe("local");
  });
});

describe("RAGService.estimateTokens", () => {
  it("should estimate ~4 chars per token", () => {
    expect(ragService.estimateTokens("")).toBe(0);
    expect(ragService.estimateTokens("abcd")).toBe(1);
    expect(ragService.estimateTokens("abcde")).toBe(2);
    expect(ragService.estimateTokens("a".repeat(100))).toBe(25);
  });
});

describe("RAGService.formatDocument", () => {
  it("should format a document with tags", () => {
    const doc = {
      nodeId: "abc",
      name: "Magic System",
      path: "Fantasy Novel > World Building > Magic System",
      tags: ["worldbuilding", "magic"],
      content: "The rules of magic in this world.",
      score: 0.85,
      updatedAt: new Date("2025-06-01"),
    };
    const formatted = ragService.formatDocument(doc, 1);
    expect(formatted).toContain("## Document 1: Magic System");
    expect(formatted).toContain(
      "Path: Fantasy Novel > World Building > Magic System",
    );
    expect(formatted).toContain("Tags: worldbuilding, magic");
    expect(formatted).toContain("Content:");
    expect(formatted).toContain("The rules of magic in this world.");
    expect(formatted).toContain("---");
  });

  it("should format a document without tags", () => {
    const doc = {
      nodeId: "def",
      name: "Chapter 1",
      path: "Novel > Chapter 1",
      tags: [],
      content: "It was a dark and stormy night.",
      score: 0.7,
      updatedAt: new Date("2025-05-15"),
    };
    const formatted = ragService.formatDocument(doc, 2);
    expect(formatted).toContain("## Document 2: Chapter 1");
    expect(formatted).not.toContain("Tags:");
  });

  it("should show (empty) for empty content", () => {
    const doc = {
      nodeId: "ghi",
      name: "Empty Note",
      path: "Project > Empty Note",
      tags: [],
      content: "",
      score: 0.5,
      updatedAt: new Date("2025-05-10"),
    };
    const formatted = ragService.formatDocument(doc, 3);
    expect(formatted).toContain("(empty)");
  });
});

describe("RAGService.formatWithTokenLimit", () => {
  const makeDocs = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      nodeId: `id-${i}`,
      name: `Doc ${i}`,
      path: `Project > Doc ${i}`,
      tags: ["tag"],
      content: "Some content here for the document.",
      score: 1 - i * 0.1,
      updatedAt: new Date("2025-06-01"),
    }));

  it("should include all documents when under token limit", () => {
    const docs = makeDocs(3);
    const { contextString, includedDocuments } =
      ragService.formatWithTokenLimit(docs, 10000);
    expect(includedDocuments).toHaveLength(3);
    expect(contextString).toContain("# Relevant Context");
    expect(contextString).toContain("## Document 1: Doc 0");
    expect(contextString).toContain("## Document 2: Doc 1");
    expect(contextString).toContain("## Document 3: Doc 2");
  });

  it("should truncate documents when exceeding token limit", () => {
    const docs = makeDocs(10);
    // Very small token budget — only room for header + maybe 1-2 docs
    const { includedDocuments } = ragService.formatWithTokenLimit(docs, 80);
    expect(includedDocuments.length).toBeLessThan(10);
    expect(includedDocuments.length).toBeGreaterThanOrEqual(1);
  });

  it("should return empty documents array if budget is too small for any doc", () => {
    const docs = makeDocs(5);
    const { includedDocuments } = ragService.formatWithTokenLimit(docs, 5);
    // header alone costs > 5 tokens, so nothing fits
    expect(includedDocuments).toHaveLength(0);
  });
});

describe("RAGService.rerank", () => {
  it("should rerank by combining relevance and recency", () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const mockResults = [
      {
        node: { id: "old-high", name: "Old High", updatedAt: oldDate } as any,
        score: 0.9,
        matchType: "hybrid" as const,
      },
      {
        node: { id: "new-low", name: "New Low", updatedAt: now } as any,
        score: 0.5,
        matchType: "hybrid" as const,
      },
    ];

    // With high recency weight, the newer doc should rank higher
    const reranked = ragService.rerank(mockResults, 0.8);
    expect(reranked[0].node.id).toBe("new-low");
  });

  it("should preserve order with zero recency weight", () => {
    const results = [
      {
        node: { id: "a", name: "A", updatedAt: new Date("2024-01-01") } as any,
        score: 0.9,
        matchType: "hybrid" as const,
      },
      {
        node: { id: "b", name: "B", updatedAt: new Date("2025-12-31") } as any,
        score: 0.6,
        matchType: "hybrid" as const,
      },
    ];
    const reranked = ragService.rerank(results, 0);
    expect(reranked[0].node.id).toBe("a");
  });

  it("should handle empty results", () => {
    const reranked = ragService.rerank([], 0.5);
    expect(reranked).toHaveLength(0);
  });

  it("should handle single result", () => {
    const results = [
      {
        node: { id: "only", name: "Only", updatedAt: new Date() } as any,
        score: 0.7,
        matchType: "hybrid" as const,
      },
    ];
    const reranked = ragService.rerank(results, 0.5);
    expect(reranked).toHaveLength(1);
    // With single result, recency score normalizes to 0/0 → 0, so score = 0.5*0.7 + 0.5*0 = 0.35
    // Actually timeRange = 0 → falls to 1, so recencyScore = 0/1 = 0
    expect(reranked[0].score).toBeCloseTo(0.35, 1);
  });
});

describe("RAGService.buildAncestorPath", () => {
  it("should build path for a note inside a folder", async () => {
    const project = await createTestProject("My Novel");
    const folder = await createTestFolder("Characters", project.id);
    const note = await createTestNote("Protagonist", folder.id, "The hero");

    const path = await ragService.buildAncestorPath(note.id);
    expect(path).toBe("My Novel > Characters > Protagonist");
  });

  it("should return just the name for a top-level project", async () => {
    const project = await createTestProject("Solo Project");
    const path = await ragService.buildAncestorPath(project.id);
    expect(path).toBe("Solo Project");
  });

  it("should handle deeply nested nodes", async () => {
    const project = await createTestProject("Deep Project");
    const f1 = await createTestFolder("Level 1", project.id);
    const f2 = await createTestFolder("Level 2", f1.id);
    const note = await createTestNote("Deep Note", f2.id);

    const path = await ragService.buildAncestorPath(note.id);
    expect(path).toBe("Deep Project > Level 1 > Level 2 > Deep Note");
  });
});

describe("RAGService.getNodeTagNames", () => {
  it("should return tag names for a node", async () => {
    const db = getTestDb();
    const project = await createTestProject("Tagged Project");
    const note = await createTestNote("Tagged Note", project.id, "content");

    // Create tags
    const [tag1] = await db
      .insert(tags)
      .values({ name: "fantasy", color: "#ff0000", type: "general" })
      .returning();
    const [tag2] = await db
      .insert(tags)
      .values({ name: "magic", color: "#00ff00", type: "general" })
      .returning();

    // Assign tags to node
    await db.insert(nodeTags).values([
      { nodeId: note.id, tagId: tag1.id },
      { nodeId: note.id, tagId: tag2.id },
    ]);

    const tagNames = await ragService.getNodeTagNames(note.id);
    expect(tagNames).toHaveLength(2);
    expect(tagNames).toContain("fantasy");
    expect(tagNames).toContain("magic");
  });

  it("should return empty array for untagged node", async () => {
    const project = await createTestProject("Untagged Project");
    const note = await createTestNote("No Tags", project.id);

    const tagNames = await ragService.getNodeTagNames(note.id);
    expect(tagNames).toHaveLength(0);
  });
});

describe("RAGService.buildContext", () => {
  it("should build context from a query", async () => {
    const project = await createTestProject("Fantasy Novel");
    const note1 = await createTestNote(
      "Magic System",
      project.id,
      "Magic comes from the elements",
    );
    const note2 = await createTestNote(
      "Character Guide",
      project.id,
      "The hero wields fire magic",
    );

    // Embed nodes so vector search can find them
    const embeddingService = ragService
      .getSearchService()
      .getEmbeddingService();
    await embeddingService.embedNode(note1.id);
    await embeddingService.embedNode(note2.id);

    const context = await ragService.buildContext("magic system");
    expect(context.contextString).toContain("# Relevant Context");
    expect(context.documents.length).toBeGreaterThanOrEqual(1);
    expect(context.tokenCount).toBeGreaterThan(0);
    expect(context.totalRetrieved).toBeGreaterThanOrEqual(1);
  });

  it("should respect topK option", async () => {
    const project = await createTestProject("Novel");
    const embeddingService = ragService
      .getSearchService()
      .getEmbeddingService();

    for (let i = 0; i < 5; i++) {
      const note = await createTestNote(
        `Chapter ${i}`,
        project.id,
        `Content for chapter ${i}`,
      );
      await embeddingService.embedNode(note.id);
    }

    const context = await ragService.buildContext("chapter", { topK: 2 });
    expect(context.documents.length).toBeLessThanOrEqual(2);
  });

  it("should respect maxTokens option", async () => {
    const project = await createTestProject("Big Novel");
    const embeddingService = ragService
      .getSearchService()
      .getEmbeddingService();

    for (let i = 0; i < 5; i++) {
      const note = await createTestNote(
        `Long Chapter ${i}`,
        project.id,
        "A".repeat(500), // long content
      );
      await embeddingService.embedNode(note.id);
    }

    const context = await ragService.buildContext("chapter", {
      maxTokens: 200,
    });
    expect(context.tokenCount).toBeLessThanOrEqual(200);
  });

  it("should include path in document output", async () => {
    const project = await createTestProject("Path Test Novel");
    const folder = await createTestFolder("World Building", project.id);
    const note = await createTestNote(
      "Geography",
      folder.id,
      "Mountains and rivers",
    );

    const embeddingService = ragService
      .getSearchService()
      .getEmbeddingService();
    await embeddingService.embedNode(note.id);

    const context = await ragService.buildContext("geography");
    const geoDoc = context.documents.find((d) => d.name === "Geography");
    if (geoDoc) {
      expect(geoDoc.path).toBe("Path Test Novel > World Building > Geography");
    }
  });

  it("should include tags in document output", async () => {
    const db = getTestDb();
    const project = await createTestProject("Tag Context Novel");
    const note = await createTestNote(
      "Tagged Chapter",
      project.id,
      "A chapter with tags",
    );

    const [tag] = await db
      .insert(tags)
      .values({ name: "important", color: "#ff0000", type: "general" })
      .returning();
    await db.insert(nodeTags).values({ nodeId: note.id, tagId: tag.id });

    const embeddingService = ragService
      .getSearchService()
      .getEmbeddingService();
    await embeddingService.embedNode(note.id);

    const context = await ragService.buildContext("chapter");
    const taggedDoc = context.documents.find(
      (d) => d.name === "Tagged Chapter",
    );
    if (taggedDoc) {
      expect(taggedDoc.tags).toContain("important");
    }
  });

  it("should return empty context for no matches", async () => {
    // No data in the database at all
    const context = await ragService.buildContext("nonexistent query xyz");
    expect(context.documents).toHaveLength(0);
    expect(context.totalRetrieved).toBe(0);
    expect(context.contextString).toContain("# Relevant Context");
  });
});
