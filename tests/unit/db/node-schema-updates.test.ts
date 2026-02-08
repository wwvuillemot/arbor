/**
 * Phase 0.2: Node Schema Updates Tests (TDD - RED Phase)
 *
 * Tests for new schema fields:
 * - content: TEXT → JSONB
 * - position: INTEGER (for sibling ordering)
 * - created_by: VARCHAR(255) (provenance tracking)
 * - updated_by: VARCHAR(255) (provenance tracking)
 * - metadata: JSONB (already exists, verify it works)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "@tests/helpers/db";
import { nodes } from "@server/db/schema";
import { eq } from "drizzle-orm";

describe("Phase 0.2: Node Schema Updates", () => {
  let testProjectId: string;
  const db = getTestDb();

  beforeEach(async () => {
    // Create a test project for each test (resetTestDb() clears data before each test)
    const [project] = await db
      .insert(nodes)
      .values({
        type: "project",
        name: "Test Project for Schema Updates",
        content: { text: "Initial content" }, // JSONB content (pass object directly)
        position: 0,
        createdBy: "user:test-user",
        updatedBy: "user:test-user",
        metadata: { test: true },
      })
      .returning();

    testProjectId = project.id;
  });

  describe("JSONB Content Field", () => {
    it("should store structured content as JSONB", async () => {
      const content = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      };

      const [node] = await db
        .insert(nodes)
        .values({
          type: "note",
          name: "JSONB Test Note",
          parentId: testProjectId,
          content, // Pass object directly, not stringified
          position: 0,
          createdBy: "user:test-user",
          updatedBy: "user:test-user",
        })
        .returning();

      expect(node.content).toBeDefined();
      expect(node.content.type).toBe("doc");
      expect(node.content.content[0].type).toBe("paragraph");

      // Cleanup
      await db.delete(nodes).where(eq(nodes.id, node.id));
    });

    it("should handle null content", async () => {
      const [node] = await db
        .insert(nodes)
        .values({
          type: "folder",
          name: "Empty Folder",
          parentId: testProjectId,
          content: null,
          position: 1,
          createdBy: "user:test-user",
          updatedBy: "user:test-user",
        })
        .returning();

      expect(node.content).toBeNull();

      // Cleanup
      await db.delete(nodes).where(eq(nodes.id, node.id));
    });
  });

  describe("Position Field", () => {
    it("should store position for sibling ordering", async () => {
      const [node1] = await db
        .insert(nodes)
        .values({
          type: "note",
          name: "First Note",
          parentId: testProjectId,
          position: 0,
          createdBy: "user:test-user",
          updatedBy: "user:test-user",
        })
        .returning();

      const [node2] = await db
        .insert(nodes)
        .values({
          type: "note",
          name: "Second Note",
          parentId: testProjectId,
          position: 1,
          createdBy: "user:test-user",
          updatedBy: "user:test-user",
        })
        .returning();

      expect(node1.position).toBe(0);
      expect(node2.position).toBe(1);

      // Cleanup
      await db.delete(nodes).where(eq(nodes.id, node1.id));
      await db.delete(nodes).where(eq(nodes.id, node2.id));
    });

    it("should allow reordering by updating position", async () => {
      const [node] = await db
        .insert(nodes)
        .values({
          type: "note",
          name: "Reorder Test",
          parentId: testProjectId,
          position: 5,
          createdBy: "user:test-user",
          updatedBy: "user:test-user",
        })
        .returning();




      // Update position
      const [updated] = await db
        .update(nodes)
        .set({ position: 10 })
        .where(eq(nodes.id, node.id))
        .returning();

      expect(updated.position).toBe(10);

      // Cleanup
      await db.delete(nodes).where(eq(nodes.id, node.id));
    });
  });

  describe("Provenance Tracking Fields", () => {
    it("should track created_by as user", async () => {
      const [node] = await db
        .insert(nodes)
        .values({
          type: "note",
          name: "User Created Note",
          parentId: testProjectId,
          position: 0,
          createdBy: "user:alice",
          updatedBy: "user:alice",
        })
        .returning();

      expect(node.createdBy).toBe("user:alice");
      expect(node.updatedBy).toBe("user:alice");

      // Cleanup
      await db.delete(nodes).where(eq(nodes.id, node.id));
    });

    it("should track created_by as LLM", async () => {
      const [node] = await db
        .insert(nodes)
        .values({
          type: "note",
          name: "AI Generated Note",
          parentId: testProjectId,
          position: 0,
          createdBy: "llm:gpt-4o",
          updatedBy: "llm:gpt-4o",
        })
        .returning();

      expect(node.createdBy).toBe("llm:gpt-4o");
      expect(node.updatedBy).toBe("llm:gpt-4o");

      // Cleanup
      await db.delete(nodes).where(eq(nodes.id, node.id));
    });

    it("should track updated_by separately from created_by", async () => {
      const [node] = await db
        .insert(nodes)
        .values({
          type: "note",
          name: "Collaborative Note",
          parentId: testProjectId,
          position: 0,
          createdBy: "user:alice",
          updatedBy: "user:alice",
        })
        .returning();

      // Update by different actor
      const [updated] = await db
        .update(nodes)
        .set({
          content: { text: "Updated by AI" }, // Pass object directly
          updatedBy: "llm:claude-3.5-sonnet",
        })
        .where(eq(nodes.id, node.id))
        .returning();

      expect(updated.createdBy).toBe("user:alice");
      expect(updated.updatedBy).toBe("llm:claude-3.5-sonnet");

      // Cleanup
      await db.delete(nodes).where(eq(nodes.id, node.id));
    });
  });

  describe("Metadata Field", () => {
    it("should store and retrieve metadata JSONB", async () => {
      const metadata = {
        tags: ["important", "draft"],
        wordCount: 1500,
        readingTime: 6,
        customField: "test",
      };

      const [node] = await db
        .insert(nodes)
        .values({
          type: "note",
          name: "Metadata Test",
          parentId: testProjectId,
          position: 0,
          createdBy: "user:test-user",
          updatedBy: "user:test-user",
          metadata,
        })
        .returning();

      expect(node.metadata).toEqual(metadata);
      expect(node.metadata.tags).toContain("important");
      expect(node.metadata.wordCount).toBe(1500);

      // Cleanup
      await db.delete(nodes).where(eq(nodes.id, node.id));
    });
  });
});
