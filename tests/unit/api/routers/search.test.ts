import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { appRouter } from "@/api/router";
import { db } from "@/db";
import { nodes } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Search Router", () => {
  let testProjectId: string;
  let testNoteId: string;

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
    const [note] = await db
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
    testNoteId = note.id;

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
      const caller = appRouter.createCaller({});
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
      const caller = appRouter.createCaller({});
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
      const caller = appRouter.createCaller({});
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

    it("should return empty array for no matches", async () => {
      const caller = appRouter.createCaller({});
      const results = await caller.search.keywordSearch({
        query: "nonexistentquery12345",
        filters: {},
        options: { limit: 10 },
      });

      expect(results).toEqual([]);
    });

    it("should respect limit option", async () => {
      const caller = appRouter.createCaller({});
      const results = await caller.search.keywordSearch({
        query: "dragon",
        filters: {},
        options: { limit: 1 },
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should be case-insensitive", async () => {
      const caller = appRouter.createCaller({});
      const results = await caller.search.keywordSearch({
        query: "DRAGON",
        filters: {},
        options: { limit: 10 },
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });
});

