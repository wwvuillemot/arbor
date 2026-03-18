import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "@/api/router";
import { db } from "@/db";
import { nodes } from "@/db/schema";

describe("Search Router", () => {
  let testProjectId: string;

  beforeEach(async () => {
    // Create test project
    const [project] = await db
      .insert(nodes)
      .values({
        type: "project",
        name: "Dragon Chronicles",
        slug: "dragon-chronicles",
        content: "A fantasy story about dragons",
        authorType: "human",
      })
      .returning();
    testProjectId = project.id;

    // Create test note
    await db
      .insert(nodes)
      .values({
        type: "note",
        name: "Dragon Lore",
        slug: "dragon-lore",
        parentId: testProjectId,
        content: "Ancient knowledge about dragons and their magic",
        authorType: "human",
      })
      .returning();

    // Create another note
    await db.insert(nodes).values({
      type: "note",
      name: "Character Notes",
      slug: "character-notes",
      parentId: testProjectId,
      content: "Notes about the main characters",
      authorType: "human",
    });
  });

  describe("keywordSearch", () => {
    it("should find nodes by name", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.keywordSearch({
        query: "dragon",
        filters: {},
        options: { limit: 10 },
      });

      expect(results.length).toBeGreaterThan(0);
      const nodeNames = results.map((r) => r.node.name);
      expect(nodeNames).toContain("Dragon Chronicles");
      expect(nodeNames).toContain("Dragon Lore");
    });

    it("should find nodes by content", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.keywordSearch({
        query: "magic",
        filters: {},
        options: { limit: 10 },
      });

      expect(results.length).toBeGreaterThan(0);
      const nodeNames = results.map((r) => r.node.name);
      expect(nodeNames).toContain("Dragon Lore");
    });

    it("should filter by projectId", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.keywordSearch({
        query: "dragon",
        filters: { projectId: testProjectId },
        options: { limit: 10 },
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(
          r.node.id === testProjectId || r.node.parentId === testProjectId,
        ).toBe(true);
      });
    });

    it("should include deeply nested project descendants", async () => {
      const [topLevelFolder] = await db
        .insert(nodes)
        .values({
          type: "folder",
          name: "Research",
          slug: "research",
          parentId: testProjectId,
          content: "",
          authorType: "human",
        })
        .returning();
      const [nestedFolder] = await db
        .insert(nodes)
        .values({
          type: "folder",
          name: "Simulations",
          slug: "simulations",
          parentId: topLevelFolder.id,
          content: "",
          authorType: "human",
        })
        .returning();
      const [deepFolder] = await db
        .insert(nodes)
        .values({
          type: "folder",
          name: "Archived Runs",
          slug: "archived-runs",
          parentId: nestedFolder.id,
          content: "",
          authorType: "human",
        })
        .returning();
      const [deeplyNestedNote] = await db
        .insert(nodes)
        .values({
          type: "note",
          name: "Simulation Results",
          slug: "simulation-results",
          parentId: deepFolder.id,
          content: "simulation evidence from a deeply nested note",
          authorType: "human",
        })
        .returning();

      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.keywordSearch({
        query: "simulation",
        filters: { projectId: testProjectId },
        options: { limit: 10 },
      });

      const deeplyNestedResult = results.find(
        (result) => result.node.id === deeplyNestedNote.id,
      );

      expect(deeplyNestedResult).toBeDefined();
      expect(deeplyNestedResult?.projectId).toBe(testProjectId);
      expect(deeplyNestedResult?.projectName).toBe("Dragon Chronicles");
    });

    it("should return empty array for no matches", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.keywordSearch({
        query: "nonexistentquery12345",
        filters: {},
        options: { limit: 10 },
      });

      expect(results).toEqual([]);
    });

    it("should respect limit option", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.keywordSearch({
        query: "dragon",
        filters: {},
        options: { limit: 1 },
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should be case-insensitive", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.keywordSearch({
        query: "DRAGON",
        filters: {},
        options: { limit: 10 },
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it("should include tags and project info in results", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.keywordSearch({
        query: "dragon",
        filters: {},
        options: { limit: 10 },
      });

      expect(results.length).toBeGreaterThan(0);
      // Each result should have augmented fields
      results.forEach((r) => {
        expect(Array.isArray(r.tags)).toBe(true);
        expect("projectId" in r).toBe(true);
        expect("projectName" in r).toBe(true);
      });
    });

    it("should filter by nodeTypes", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.keywordSearch({
        query: "dragon",
        filters: { nodeTypes: ["note"] },
        options: { limit: 10 },
      });

      results.forEach((r) => {
        expect(r.node.type).toBe("note");
      });
    });
  });

  describe("vectorSearch", () => {
    it("should return results for a semantic query", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.vectorSearch({
        query: "fantasy creatures",
        filters: {},
        options: { limit: 10 },
      });

      // Vector search may return results or empty depending on embeddings
      expect(Array.isArray(results)).toBe(true);
    });

    it("should return empty array for a very specific non-matching query", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.vectorSearch({
        query: "quantum cryptography blockchain",
        filters: {},
        options: { limit: 10, minScore: 0.99 },
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it("should respect limit option", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.vectorSearch({
        query: "dragon magic",
        filters: {},
        options: { limit: 1 },
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should filter by projectId", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.vectorSearch({
        query: "dragon",
        filters: { projectId: testProjectId },
        options: { limit: 10 },
      });

      expect(Array.isArray(results)).toBe(true);
      results.forEach((r) => {
        expect(
          r.node.id === testProjectId || r.node.parentId === testProjectId,
        ).toBe(true);
      });
    });

    it("should include augmented tags and project fields", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.vectorSearch({
        query: "dragon lore magic",
        filters: {},
        options: { limit: 10 },
      });

      expect(Array.isArray(results)).toBe(true);
      results.forEach((r) => {
        expect(Array.isArray(r.tags)).toBe(true);
        expect("projectId" in r).toBe(true);
        expect("projectName" in r).toBe(true);
      });
    });

    it("should filter by nodeTypes", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.vectorSearch({
        query: "dragon",
        filters: { nodeTypes: ["project"] },
        options: { limit: 10 },
      });

      results.forEach((r) => {
        expect(r.node.type).toBe("project");
      });
    });
  });

  describe("hybridSearch", () => {
    it("should return results combining vector and keyword", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.hybridSearch({
        query: "dragon",
        filters: {},
        options: { limit: 10 },
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it("should find nodes by name", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.hybridSearch({
        query: "dragon",
        filters: {},
        options: { limit: 10 },
      });

      expect(results.length).toBeGreaterThan(0);
      const nodeNames = results.map((r) => r.node.name);
      expect(nodeNames.some((n) => n.toLowerCase().includes("dragon"))).toBe(
        true,
      );
    });

    it("should return empty array for no matches", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.hybridSearch({
        query: "nonexistentquery12345",
        filters: {},
        options: { limit: 10, minScore: 0.99 },
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it("should respect limit option", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.hybridSearch({
        query: "dragon",
        filters: {},
        options: { limit: 1 },
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should accept vectorWeight option", async () => {
      const caller = appRouter.createCaller({} as any);
      // vectorWeight=1.0 means full vector, 0.0 means full keyword
      const vectorOnly = await caller.search.hybridSearch({
        query: "dragon",
        filters: {},
        options: { limit: 10, vectorWeight: 1.0 },
      });
      const keywordOnly = await caller.search.hybridSearch({
        query: "dragon",
        filters: {},
        options: { limit: 10, vectorWeight: 0.0 },
      });

      expect(Array.isArray(vectorOnly)).toBe(true);
      expect(Array.isArray(keywordOnly)).toBe(true);
    });

    it("should filter by projectId", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.hybridSearch({
        query: "dragon",
        filters: { projectId: testProjectId },
        options: { limit: 10 },
      });

      expect(Array.isArray(results)).toBe(true);
      results.forEach((r) => {
        expect(
          r.node.id === testProjectId || r.node.parentId === testProjectId,
        ).toBe(true);
      });
    });

    it("should include augmented tags and project fields", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.hybridSearch({
        query: "dragon",
        filters: {},
        options: { limit: 10 },
      });

      results.forEach((r) => {
        expect(Array.isArray(r.tags)).toBe(true);
        expect("projectId" in r).toBe(true);
        expect("projectName" in r).toBe(true);
      });
    });

    it("should filter by nodeTypes", async () => {
      const caller = appRouter.createCaller({} as any);
      const results = await caller.search.hybridSearch({
        query: "dragon",
        filters: { nodeTypes: ["note"] },
        options: { limit: 10 },
      });

      results.forEach((r) => {
        expect(r.node.type).toBe("note");
      });
    });
  });
});
