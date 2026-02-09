import { describe, it, expect, beforeEach } from "vitest";
import { SearchService } from "@/services/search-service";
import { LocalEmbeddingProvider } from "@/services/embedding-service";
import {
  createTestProject,
  createTestNote,
  createTestFolder,
} from "@tests/helpers/fixtures";
import { getTestDb } from "@tests/helpers/db";
import { nodes, tags, nodeTags } from "@server/db/schema";
import { eq } from "drizzle-orm";

let searchService: SearchService;
let provider: LocalEmbeddingProvider;

beforeEach(() => {
  provider = new LocalEmbeddingProvider();
  searchService = new SearchService(provider);
});

describe("SearchService constructor", () => {
  it("should create a SearchService with a provider", () => {
    expect(searchService).toBeDefined();
    expect(searchService.getEmbeddingService()).toBeDefined();
  });

  it("should expose the embedding service", () => {
    const embeddingService = searchService.getEmbeddingService();
    expect(embeddingService.getProviderName()).toBe("local");
    expect(embeddingService.getDimensions()).toBe(1536);
  });
});

describe("SearchService.keywordSearch", () => {
  it("should find nodes by name", async () => {
    const project = await createTestProject("Fantasy Novel");
    await createTestNote("Magic System", project.id, "The rules of magic");
    await createTestNote("Character Guide", project.id, "Hero descriptions");

    const results = await searchService.keywordSearch("Magic");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.node.name === "Magic System")).toBe(true);
    expect(results.every((r) => r.matchType === "keyword")).toBe(true);
  });

  it("should find nodes by content", async () => {
    const project = await createTestProject("Novel");
    await createTestNote("Chapter 1", project.id, "The dragon breathed fire");
    await createTestNote("Chapter 2", project.id, "A peaceful meadow");

    const results = await searchService.keywordSearch("dragon");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.node.name === "Chapter 1")).toBe(true);
  });

  it("should score exact name matches highest", async () => {
    const project = await createTestProject("Novel");
    await createTestNote("Dragon", project.id, "Main topic");
    await createTestNote("Dragon Lore", project.id, "Extended info");

    const results = await searchService.keywordSearch("Dragon");
    const exactMatch = results.find((r) => r.node.name === "Dragon");
    const partialMatch = results.find((r) => r.node.name === "Dragon Lore");
    expect(exactMatch).toBeDefined();
    expect(partialMatch).toBeDefined();
    expect(exactMatch!.score).toBeGreaterThan(partialMatch!.score);
  });

  it("should score prefix matches higher than partial matches", async () => {
    const project = await createTestProject("Novel");
    await createTestNote("Magic System", project.id, "System of magic");
    await createTestNote("Dark Magic", project.id, "Evil magic");

    const results = await searchService.keywordSearch("Magic");
    const prefixMatch = results.find((r) => r.node.name === "Magic System");
    const partialMatch = results.find((r) => r.node.name === "Dark Magic");
    expect(prefixMatch).toBeDefined();
    expect(partialMatch).toBeDefined();
    expect(prefixMatch!.score).toBeGreaterThan(partialMatch!.score);
  });

  it("should return empty results for non-matching query", async () => {
    const project = await createTestProject("Novel");
    await createTestNote("Chapter 1", project.id, "Story content");

    const results = await searchService.keywordSearch("zzzznonexistent");
    expect(results).toHaveLength(0);
  });

  it("should respect limit option", async () => {
    const project = await createTestProject("Novel");
    for (let i = 0; i < 5; i++) {
      await createTestNote(`Note ${i}`, project.id, "Similar content");
    }

    const results = await searchService.keywordSearch("Note", {}, { limit: 2 });
    expect(results).toHaveLength(2);
  });

  it("should exclude soft-deleted nodes by default", async () => {
    const project = await createTestProject("Novel");
    const note = await createTestNote("Deleted Note", project.id, "Gone");
    const db = getTestDb();
    await db
      .update(nodes)
      .set({ deletedAt: new Date() })
      .where(eq(nodes.id, note.id));

    const results = await searchService.keywordSearch("Deleted Note");
    expect(results.every((r) => r.node.name !== "Deleted Note")).toBe(true);
  });

  it("should include soft-deleted when excludeDeleted is false", async () => {
    const project = await createTestProject("Novel");
    const note = await createTestNote("Deleted Note", project.id, "Gone");
    const db = getTestDb();
    await db
      .update(nodes)
      .set({ deletedAt: new Date() })
      .where(eq(nodes.id, note.id));

    const results = await searchService.keywordSearch("Deleted Note", {
      excludeDeleted: false,
    });
    expect(results.some((r) => r.node.name === "Deleted Note")).toBe(true);
  });

  it("should filter by nodeTypes", async () => {
    const project = await createTestProject("Novel");
    await createTestFolder("Magic Folder", project.id);
    await createTestNote("Magic Note", project.id, "Note content");

    const results = await searchService.keywordSearch("Magic", {
      nodeTypes: ["folder"],
    });
    expect(results.every((r) => r.node.type === "folder")).toBe(true);
    expect(results.some((r) => r.node.name === "Magic Folder")).toBe(true);
  });

  it("should filter by parentId", async () => {
    const project = await createTestProject("Novel");
    const folder1 = await createTestFolder("Folder A", project.id);
    const folder2 = await createTestFolder("Folder B", project.id);
    await createTestNote("Note in A", folder1.id, "Content");
    await createTestNote("Note in B", folder2.id, "Content");

    const results = await searchService.keywordSearch("Note", {
      parentId: folder1.id,
    });
    expect(results).toHaveLength(1);
    expect(results[0].node.name).toBe("Note in A");
  });

  it("should filter by tagIds", async () => {
    const project = await createTestProject("Novel");
    const note1 = await createTestNote("Tagged Note", project.id, "Content");
    await createTestNote("Untagged Note", project.id, "Content");

    const db = getTestDb();
    const [tag] = await db
      .insert(tags)
      .values({ name: "important", type: "general" })
      .returning();
    await db.insert(nodeTags).values({ nodeId: note1.id, tagId: tag.id });

    const results = await searchService.keywordSearch("Note", {
      tagIds: [tag.id],
    });
    expect(results).toHaveLength(1);
    expect(results[0].node.name).toBe("Tagged Note");
  });
});

describe("SearchService.vectorSearch", () => {
  it("should find nodes by semantic similarity", async () => {
    const project = await createTestProject("Novel");
    const note = await createTestNote(
      "Magic System",
      project.id,
      "The rules governing arcane power in this world",
    );

    const embeddingService = searchService.getEmbeddingService();
    await embeddingService.embedNode(note.id);

    const results = await searchService.vectorSearch("arcane magic rules");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].matchType).toBe("vector");
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].node.id).toBe(note.id);
  });

  it("should return empty results when no nodes have embeddings", async () => {
    const project = await createTestProject("Novel");
    await createTestNote("Chapter 1", project.id, "Story content");

    const results = await searchService.vectorSearch("story");
    expect(results).toHaveLength(0);
  });

  it("should respect limit option", async () => {
    const project = await createTestProject("Novel");
    const embeddingService = searchService.getEmbeddingService();

    for (let i = 0; i < 5; i++) {
      const note = await createTestNote(
        `Note ${i}`,
        project.id,
        `Content about topic ${i}`,
      );
      await embeddingService.embedNode(note.id);
    }

    const results = await searchService.vectorSearch("topic", {}, { limit: 2 });
    expect(results).toHaveLength(2);
  });

  it("should exclude soft-deleted nodes", async () => {
    const project = await createTestProject("Novel");
    const note = await createTestNote(
      "Deleted Topic",
      project.id,
      "Some content",
    );
    const embeddingService = searchService.getEmbeddingService();
    await embeddingService.embedNode(note.id);

    const db = getTestDb();
    await db
      .update(nodes)
      .set({ deletedAt: new Date() })
      .where(eq(nodes.id, note.id));

    const results = await searchService.vectorSearch("Deleted Topic");
    expect(results.every((r) => r.node.id !== note.id)).toBe(true);
  });

  it("should filter by nodeTypes", async () => {
    const project = await createTestProject("Novel");
    const folder = await createTestFolder("Magic Folder", project.id);
    const note = await createTestNote(
      "Magic Note",
      project.id,
      "Magic content",
    );

    const embeddingService = searchService.getEmbeddingService();
    const db = getTestDb();
    const folderEmbedding = await provider.embed("Magic Folder");
    await db
      .update(nodes)
      .set({ embedding: folderEmbedding })
      .where(eq(nodes.id, folder.id));
    await embeddingService.embedNode(note.id);

    const results = await searchService.vectorSearch("Magic", {
      nodeTypes: ["note"],
    });
    expect(results.every((r) => r.node.type === "note")).toBe(true);
  });
});

describe("SearchService.hybridSearch", () => {
  it("should combine vector and keyword results", async () => {
    const project = await createTestProject("Novel");
    const noteWithEmbed = await createTestNote(
      "Arcane Power",
      project.id,
      "The mysteries of magic",
    );
    await createTestNote(
      "Magic Rules",
      project.id,
      "How magic works in the world",
    );

    const embeddingService = searchService.getEmbeddingService();
    await embeddingService.embedNode(noteWithEmbed.id);

    const results = await searchService.hybridSearch("magic");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every((r) => r.matchType === "hybrid")).toBe(true);
  });

  it("should return results sorted by hybrid score descending", async () => {
    const project = await createTestProject("Novel");
    const embeddingService = searchService.getEmbeddingService();

    const note1 = await createTestNote(
      "Dragon Lore",
      project.id,
      "All about dragons",
    );
    const note2 = await createTestNote(
      "Dragon",
      project.id,
      "The main dragon character",
    );
    await embeddingService.embedNode(note1.id);
    await embeddingService.embedNode(note2.id);

    const results = await searchService.hybridSearch("Dragon");
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("should respect vectorWeight option", async () => {
    const project = await createTestProject("Novel");
    const note = await createTestNote(
      "Magic System",
      project.id,
      "The rules of magic",
    );
    const embeddingService = searchService.getEmbeddingService();
    await embeddingService.embedNode(note.id);

    const highVectorResults = await searchService.hybridSearch(
      "Magic",
      {},
      { vectorWeight: 0.9 },
    );
    const highKeywordResults = await searchService.hybridSearch(
      "Magic",
      {},
      { vectorWeight: 0.1 },
    );

    expect(highVectorResults.length).toBeGreaterThanOrEqual(1);
    expect(highKeywordResults.length).toBeGreaterThanOrEqual(1);
  });

  it("should respect limit option", async () => {
    const project = await createTestProject("Novel");
    const embeddingService = searchService.getEmbeddingService();

    for (let i = 0; i < 5; i++) {
      const note = await createTestNote(
        `Magic ${i}`,
        project.id,
        `Magic content ${i}`,
      );
      await embeddingService.embedNode(note.id);
    }

    const results = await searchService.hybridSearch("Magic", {}, { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("should filter by minScore", async () => {
    const project = await createTestProject("Novel");
    const note = await createTestNote(
      "Magic System",
      project.id,
      "The rules of magic",
    );
    const embeddingService = searchService.getEmbeddingService();
    await embeddingService.embedNode(note.id);

    const results = await searchService.hybridSearch(
      "Magic",
      {},
      { minScore: 0.99 },
    );
    expect(results.every((r) => r.score >= 0.99)).toBe(true);
  });
});
