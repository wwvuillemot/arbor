import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, resetTestDb } from "../../helpers/db";
import { nodes } from "@server/db/schema";
import { ProvenanceService } from "@server/services/provenance-service";
import { NodeService } from "@server/services/node-service";
import { eq } from "drizzle-orm";

const testDb = getTestDb();
const provenanceService = new ProvenanceService();
const nodeService = new NodeService();

async function createTestProject(name = "Test Project"): Promise<string> {
  const [project] = await testDb
    .insert(nodes)
    .values({
      type: "project",
      name,
      parentId: null,
      createdBy: "user:test",
      updatedBy: "user:test",
    })
    .returning();
  return project.id;
}

async function createTestNoteWithParent(
  parentId: string,
  name = "Test Note",
  content: unknown = { text: "Hello world" },
): Promise<string> {
  const [note] = await testDb
    .insert(nodes)
    .values({
      type: "note",
      name,
      parentId,
      content,
      createdBy: "user:test",
      updatedBy: "user:test",
    })
    .returning();
  return note.id;
}

// ═══════════════════════════════════════════════════════════════════════
// ProvenanceService Tests
// ═══════════════════════════════════════════════════════════════════════

describe("ProvenanceService", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  // ─── Record Change ──────────────────────────────────────────────────

  describe("recordChange", () => {
    it("should record a create action with version 1", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      const entry = await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        actorId: "user:alice",
        action: "create",
        contentBefore: null,
        contentAfter: { text: "Hello world" },
        metadata: { session_id: "sess-123" },
      });

      expect(entry).toBeDefined();
      expect(entry.nodeId).toBe(noteId);
      expect(entry.version).toBe(1);
      expect(entry.actorType).toBe("user");
      expect(entry.actorId).toBe("user:alice");
      expect(entry.action).toBe("create");
      expect(entry.contentBefore).toBeNull();
      expect(entry.contentAfter).toEqual({ text: "Hello world" });
      expect(entry.metadata).toEqual({ session_id: "sess-123" });
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    it("should auto-increment version numbers", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      const v1 = await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        actorId: "user:alice",
        action: "create",
        contentAfter: { text: "v1" },
      });

      const v2 = await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        actorId: "gpt-4o",
        action: "update",
        contentBefore: { text: "v1" },
        contentAfter: { text: "v2" },
      });

      const v3 = await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        actorId: "user:alice",
        action: "update",
        contentBefore: { text: "v2" },
        contentAfter: { text: "v3" },
      });

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v3.version).toBe(3);
    });

    it("should maintain separate version counters per node", async () => {
      const projectId = await createTestProject();
      const noteA = await createTestNoteWithParent(projectId, "Note A");
      const noteB = await createTestNoteWithParent(projectId, "Note B");

      const a1 = await provenanceService.recordChange({
        nodeId: noteA,
        actorType: "user",
        action: "create",
        contentAfter: { text: "A" },
      });

      const b1 = await provenanceService.recordChange({
        nodeId: noteB,
        actorType: "user",
        action: "create",
        contentAfter: { text: "B" },
      });

      const a2 = await provenanceService.recordChange({
        nodeId: noteA,
        actorType: "user",
        action: "update",
        contentBefore: { text: "A" },
        contentAfter: { text: "A v2" },
      });

      expect(a1.version).toBe(1);
      expect(b1.version).toBe(1);
      expect(a2.version).toBe(2);
    });

    it("should compute diff when recording a change", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      const entry = await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "update",
        contentBefore: { text: "Hello" },
        contentAfter: { text: "Hello world" },
      });

      expect(entry.diff).toBeDefined();
      const diff = entry.diff as Record<string, unknown>;
      expect(diff.type).toBe("diff-match-patch");
      expect(diff.patches).toBeDefined();
      expect(diff.summary).toBeDefined();
      const summary = diff.summary as Record<string, number>;
      expect(summary.additions).toBeGreaterThan(0);
    });

    it("should record LLM actor metadata", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      const entry = await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        actorId: "gpt-4o",
        action: "update",
        contentBefore: { text: "draft" },
        contentAfter: { text: "polished draft" },
        metadata: {
          model: "gpt-4o",
          mode: "editor",
          thread_id: "thread-abc",
          message_id: "msg-123",
          tool_call_id: "tc-1",
        },
      });

      expect(entry.actorType).toBe("llm");
      expect(entry.actorId).toBe("gpt-4o");
      const meta = entry.metadata as Record<string, unknown>;
      expect(meta.model).toBe("gpt-4o");
      expect(meta.mode).toBe("editor");
      expect(meta.thread_id).toBe("thread-abc");
    });
  });

  // ─── Version Queries ────────────────────────────────────────────────

  describe("getHistory", () => {
    it("should return history newest first", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "create",
        contentAfter: { text: "v1" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "update",
        contentBefore: { text: "v1" },
        contentAfter: { text: "v2" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        actorId: "gpt-4o",
        action: "update",
        contentBefore: { text: "v2" },
        contentAfter: { text: "v3" },
      });

      const history = await provenanceService.getHistory({ nodeId: noteId });
      expect(history).toHaveLength(3);
      expect(history[0].version).toBe(3);
      expect(history[1].version).toBe(2);
      expect(history[2].version).toBe(1);
    });

    it("should support limit and offset for pagination", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      for (let i = 0; i < 5; i++) {
        await provenanceService.recordChange({
          nodeId: noteId,
          actorType: "user",
          action: i === 0 ? "create" : "update",
          contentAfter: { text: `v${i + 1}` },
        });
      }

      const page1 = await provenanceService.getHistory({
        nodeId: noteId,
        limit: 2,
        offset: 0,
      });
      expect(page1).toHaveLength(2);
      expect(page1[0].version).toBe(5);
      expect(page1[1].version).toBe(4);

      const page2 = await provenanceService.getHistory({
        nodeId: noteId,
        limit: 2,
        offset: 2,
      });
      expect(page2).toHaveLength(2);
      expect(page2[0].version).toBe(3);
    });

    it("should return empty array for node with no history", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      const history = await provenanceService.getHistory({ nodeId: noteId });
      expect(history).toHaveLength(0);
    });
  });

  describe("getVersion", () => {
    it("should return a specific version", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "create",
        contentAfter: { text: "v1" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        actorId: "gpt-4o",
        action: "update",
        contentBefore: { text: "v1" },
        contentAfter: { text: "v2" },
      });

      const version2 = await provenanceService.getVersion(noteId, 2);
      expect(version2).toBeDefined();
      expect(version2!.version).toBe(2);
      expect(version2!.actorType).toBe("llm");
      expect(version2!.contentAfter).toEqual({ text: "v2" });
    });

    it("should return null for non-existent version", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      const result = await provenanceService.getVersion(noteId, 99);
      expect(result).toBeNull();
    });
  });

  describe("getLatestVersion", () => {
    it("should return the most recent version", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "create",
        contentAfter: { text: "v1" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "update",
        contentBefore: { text: "v1" },
        contentAfter: { text: "v2" },
      });

      const latest = await provenanceService.getLatestVersion(noteId);
      expect(latest).toBeDefined();
      expect(latest!.version).toBe(2);
      expect(latest!.contentAfter).toEqual({ text: "v2" });
    });

    it("should return null when no history exists", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      const latest = await provenanceService.getLatestVersion(noteId);
      expect(latest).toBeNull();
    });
  });

  describe("getVersionCount", () => {
    it("should return the total number of versions", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "create",
        contentAfter: { text: "v1" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "update",
        contentAfter: { text: "v2" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        action: "update",
        contentAfter: { text: "v3" },
      });

      const versionCount = await provenanceService.getVersionCount(noteId);
      expect(versionCount).toBe(3);
    });

    it("should return 0 when no history exists", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      const versionCount = await provenanceService.getVersionCount(noteId);
      expect(versionCount).toBe(0);
    });
  });

  describe("deleteVersion", () => {
    it("should delete an existing version and return the deleted entry", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "create",
        contentAfter: { text: "v1" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "update",
        contentBefore: { text: "v1" },
        contentAfter: { text: "v2" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "update",
        contentBefore: { text: "v2" },
        contentAfter: { text: "v3" },
      });

      const deletedEntry = await provenanceService.deleteVersion(noteId, 2);

      expect(deletedEntry.version).toBe(2);

      const remainingHistory = await provenanceService.getHistory({
        nodeId: noteId,
      });
      expect(remainingHistory.map((entry) => entry.version)).toEqual([3, 1]);
      expect(await provenanceService.getVersionCount(noteId)).toBe(2);
      expect(await provenanceService.getVersion(noteId, 2)).toBeNull();
    });

    it("should throw when deleting a missing version", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      await expect(provenanceService.deleteVersion(noteId, 99)).rejects.toThrow(
        `Version 99 not found for node ${noteId}`,
      );
    });
  });

  // ─── Filtering ──────────────────────────────────────────────────────

  describe("getHistoryByActor", () => {
    it("should filter history by actor type", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        actorId: "user:alice",
        action: "create",
        contentAfter: { text: "v1" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        actorId: "gpt-4o",
        action: "update",
        contentAfter: { text: "v2" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        actorId: "user:alice",
        action: "update",
        contentAfter: { text: "v3" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        actorId: "claude-3.5-sonnet",
        action: "update",
        contentAfter: { text: "v4" },
      });

      const userEntries = await provenanceService.getHistoryByActor({
        nodeId: noteId,
        actorType: "user",
      });
      expect(userEntries).toHaveLength(2);
      expect(userEntries.every((e) => e.actorType === "user")).toBe(true);

      const llmEntries = await provenanceService.getHistoryByActor({
        nodeId: noteId,
        actorType: "llm",
      });
      expect(llmEntries).toHaveLength(2);
      expect(llmEntries.every((e) => e.actorType === "llm")).toBe(true);
    });
  });

  describe("getHistoryInRange", () => {
    it("should filter history by date range", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      // Record changes - they all happen now, so all should be within range
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "create",
        contentAfter: { text: "v1" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "update",
        contentAfter: { text: "v2" },
      });

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 3600 * 1000);

      const entries = await provenanceService.getHistoryInRange({
        nodeId: noteId,
        startDate: oneHourAgo,
        endDate: oneHourFromNow,
      });
      expect(entries).toHaveLength(2);

      // Range that excludes all entries
      const farFuture = new Date(now.getTime() + 86400 * 1000);
      const farFuture2 = new Date(now.getTime() + 86400 * 2000);
      const noEntries = await provenanceService.getHistoryInRange({
        nodeId: noteId,
        startDate: farFuture,
        endDate: farFuture2,
      });
      expect(noEntries).toHaveLength(0);
    });
  });

  // ─── Rollback ───────────────────────────────────────────────────────

  describe("rollbackToVersion", () => {
    it("should rollback a node to a previous version", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(
        projectId,
        "Rollback Note",
        { text: "original" },
      );

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "create",
        contentAfter: { text: "original" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        actorId: "gpt-4o",
        action: "update",
        contentBefore: { text: "original" },
        contentAfter: { text: "llm edit" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "update",
        contentBefore: { text: "llm edit" },
        contentAfter: { text: "user edit on top" },
      });

      const rollbackEntry = await provenanceService.rollbackToVersion(
        noteId,
        1,
        "user",
        "user:alice",
      );

      expect(rollbackEntry.action).toBe("restore");
      expect(rollbackEntry.version).toBe(4);
      expect(rollbackEntry.contentAfter).toEqual({ text: "original" });
      const meta = rollbackEntry.metadata as Record<string, unknown>;
      expect(meta.rolledBackToVersion).toBe(1);

      const [updatedNode] = await testDb
        .select()
        .from(nodes)
        .where(eq(nodes.id, noteId))
        .limit(1);
      expect(updatedNode.content).toEqual({ text: "original" });
    });

    it("should throw error for non-existent version", async () => {
      const projectId = await createTestProject();
      const noteId = await createTestNoteWithParent(projectId);

      await expect(
        provenanceService.rollbackToVersion(noteId, 99),
      ).rejects.toThrow("Version 99 not found");
    });

    it("should throw error for non-existent node", async () => {
      const fakeNodeId = "00000000-0000-0000-0000-000000000000";
      await expect(
        provenanceService.rollbackToVersion(fakeNodeId, 1),
      ).rejects.toThrow("Version 1 not found");
    });
  });

  // ─── Diff Computation ─────────────────────────────────────────────

  describe("computeDiff", () => {
    it("should compute diff between two text strings", () => {
      const diff = provenanceService.computeDiff(
        "Hello world",
        "Hello beautiful world",
      ) as Record<string, unknown>;

      expect(diff.type).toBe("diff-match-patch");
      expect(diff.patches).toBeDefined();
      expect(typeof diff.patches).toBe("string");
      const summary = diff.summary as Record<string, number>;
      expect(summary.additions).toBeGreaterThan(0);
    });

    it("should compute diff between JSON objects", () => {
      const before = { type: "doc", content: [{ text: "Hello" }] };
      const after = { type: "doc", content: [{ text: "Hello World" }] };

      const diff = provenanceService.computeDiff(before, after) as Record<
        string,
        unknown
      >;

      expect(diff.type).toBe("diff-match-patch");
      expect(diff.summary).toBeDefined();
    });

    it("should handle null before (create action)", () => {
      const diff = provenanceService.computeDiff(null, {
        text: "new content",
      }) as Record<string, unknown>;

      expect(diff.type).toBe("diff-match-patch");
      const summary = diff.summary as Record<string, number>;
      expect(summary.additions).toBeGreaterThan(0);
      expect(summary.deletions).toBe(0);
    });

    it("should handle null after (delete action)", () => {
      const diff = provenanceService.computeDiff(
        { text: "deleted content" },
        null,
      ) as Record<string, unknown>;

      expect(diff.type).toBe("diff-match-patch");
      const summary = diff.summary as Record<string, number>;
      expect(summary.deletions).toBeGreaterThan(0);
      expect(summary.additions).toBe(0);
    });

    it("should return null diff for both null", () => {
      const diff = provenanceService.computeDiff(null, null);
      expect(diff).toBeNull();
    });
  });

  describe("applyDiff", () => {
    it("should apply a diff to reconstruct content", () => {
      const before = "Hello world";
      const after = "Hello beautiful world";

      const diff = provenanceService.computeDiff(before, after);
      const reconstructed = provenanceService.applyDiff(before, diff);
      expect(reconstructed).toBe(after);
    });

    it("should return original text when diff is invalid", () => {
      const result = provenanceService.applyDiff("Hello", null);
      expect(result).toBe("Hello");
    });

    it("should return original text when diff type is unknown", () => {
      const result = provenanceService.applyDiff("Hello", {
        type: "unknown",
      });
      expect(result).toBe("Hello");
    });
  });

  // ─── Content to Text ──────────────────────────────────────────────

  describe("contentToText", () => {
    it("should convert null to empty string", () => {
      expect(provenanceService.contentToText(null)).toBe("");
    });

    it("should pass through strings", () => {
      expect(provenanceService.contentToText("hello")).toBe("hello");
    });

    it("should JSON-stringify objects", () => {
      const obj = { type: "doc", text: "hello" };
      const result = provenanceService.contentToText(obj);
      expect(result).toBe(JSON.stringify(obj, null, 2));
    });
  });

  // ─── Checkout (Read-Only) ────────────────────────────────────────

  describe("checkout", () => {
    it("should return content at a specific version without modifying node", async () => {
      // Use NodeService so provenance is auto-recorded
      const project = await nodeService.createNode({
        type: "project",
        name: "Checkout Project",
        createdBy: "user:test",
        updatedBy: "user:test",
      });
      const node = await nodeService.createNode({
        type: "note",
        name: "Checkout Test",
        parentId: project.id,
        content: { text: "original" },
        createdBy: "user:test",
        updatedBy: "user:test",
      });

      // Make an update (creates version 2)
      await nodeService.updateNode(node.id, {
        content: { text: "version 2 content" },
        updatedBy: "user:test",
      });

      // Checkout version 1 (read-only)
      const v1 = await provenanceService.checkout(node.id, 1);
      expect(v1.version).toBe(1);
      expect(v1.content).toEqual({ text: "original" });
      expect(v1.action).toBe("create");
      expect(v1.actorType).toBe("user");

      // Verify node was NOT modified
      const currentNode = await nodeService.getNodeById(node.id);
      expect(currentNode!.content).toEqual({ text: "version 2 content" });
    });

    it("should throw for non-existent version", async () => {
      const project = await nodeService.createNode({
        type: "project",
        name: "Err Project",
        createdBy: "user:test",
        updatedBy: "user:test",
      });
      await expect(provenanceService.checkout(project.id, 999)).rejects.toThrow(
        "Version 999 not found",
      );
    });

    it("should checkout version 2 after multiple updates", async () => {
      const project = await nodeService.createNode({
        type: "project",
        name: "Multi Project",
        createdBy: "user:test",
        updatedBy: "user:test",
      });
      const node = await nodeService.createNode({
        type: "note",
        name: "Multi Update",
        parentId: project.id,
        content: { text: "v1" },
        createdBy: "user:test",
        updatedBy: "user:test",
      });
      await nodeService.updateNode(node.id, {
        content: { text: "v2" },
        updatedBy: "user:test",
      });
      await nodeService.updateNode(node.id, {
        content: { text: "v3" },
        updatedBy: "user:test",
      });

      const v2 = await provenanceService.checkout(node.id, 2);
      expect(v2.version).toBe(2);
      expect(v2.content).toEqual({ text: "v2" });
    });
  });

  // ─── Audit Log (Cross-Node) ──────────────────────────────────────

  describe("getAuditLog", () => {
    it("should return all entries across nodes without filters", async () => {
      const projectId = await createTestProject("Audit Project");
      // Create two separate notes (different nodes)
      const noteA = await testDb
        .insert(nodes)
        .values({
          type: "note",
          name: "Note A",
          parentId: projectId,
          content: { text: "A" },
          createdBy: "user:test",
          updatedBy: "user:test",
        })
        .returning();
      const noteB = await testDb
        .insert(nodes)
        .values({
          type: "note",
          name: "Note B",
          parentId: projectId,
          content: { text: "B" },
          createdBy: "user:test",
          updatedBy: "user:test",
        })
        .returning();

      await provenanceService.recordChange({
        nodeId: noteA[0].id,
        actorType: "user",
        actorId: "user:alice",
        action: "create",
        contentAfter: { text: "A" },
      });
      await provenanceService.recordChange({
        nodeId: noteB[0].id,
        actorType: "llm",
        actorId: "llm:gpt-4o",
        action: "update",
        contentBefore: { text: "B" },
        contentAfter: { text: "B updated" },
      });

      const allEntries = await provenanceService.getAuditLog({});
      expect(allEntries.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter by actorType", async () => {
      const projectId = await createTestProject("Filter Project");
      const noteId = (
        await testDb
          .insert(nodes)
          .values({
            type: "note",
            name: "FN",
            parentId: projectId,
            createdBy: "user:test",
            updatedBy: "user:test",
          })
          .returning()
      )[0].id;

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "create",
        contentAfter: { text: "hi" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        action: "update",
        contentAfter: { text: "hello" },
      });

      const userEntries = await provenanceService.getAuditLog({
        actorType: "user",
      });
      for (const entry of userEntries) {
        expect(entry.actorType).toBe("user");
      }
    });

    it("should filter by action", async () => {
      const projectId = await createTestProject("Action Filter");
      const noteId = (
        await testDb
          .insert(nodes)
          .values({
            type: "note",
            name: "AN",
            parentId: projectId,
            createdBy: "user:test",
            updatedBy: "user:test",
          })
          .returning()
      )[0].id;

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "create",
        contentAfter: { text: "x" },
      });
      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "update",
        contentAfter: { text: "y" },
      });

      const createEntries = await provenanceService.getAuditLog({
        action: "create",
      });
      for (const entry of createEntries) {
        expect(entry.action).toBe("create");
      }
    });
  });

  describe("getAuditLogCount", () => {
    it("should return total count matching filters", async () => {
      const projectId = await createTestProject("Count Project");
      const noteId = (
        await testDb
          .insert(nodes)
          .values({
            type: "note",
            name: "CN",
            parentId: projectId,
            createdBy: "user:test",
            updatedBy: "user:test",
          })
          .returning()
      )[0].id;

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        action: "create",
        contentAfter: { text: "x" },
      });

      const totalCount = await provenanceService.getAuditLogCount({});
      expect(totalCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("searchHistory", () => {
    it("should find entries matching content text", async () => {
      const projectId = await createTestProject("Search Project");
      const noteId = (
        await testDb
          .insert(nodes)
          .values({
            type: "note",
            name: "SN",
            parentId: projectId,
            createdBy: "user:test",
            updatedBy: "user:test",
          })
          .returning()
      )[0].id;

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        actorId: "user:searchtest",
        action: "create",
        contentAfter: { text: "unique_search_term_xyz" },
      });

      const results = await provenanceService.searchHistory({
        query: "unique_search_term_xyz",
      });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(
        results.some((r) =>
          JSON.stringify(r.contentAfter).includes("unique_search_term_xyz"),
        ),
      ).toBe(true);
    });

    it("should find entries matching actorId", async () => {
      const projectId = await createTestProject("Search Actor");
      const noteId = (
        await testDb
          .insert(nodes)
          .values({
            type: "note",
            name: "SA",
            parentId: projectId,
            createdBy: "user:test",
            updatedBy: "user:test",
          })
          .returning()
      )[0].id;

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        actorId: "llm:unique_model_abc",
        action: "update",
        contentAfter: { text: "something" },
      });

      const results = await provenanceService.searchHistory({
        query: "unique_model_abc",
      });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("exportAuditCsv", () => {
    it("should return CSV string with header and data rows", async () => {
      const projectId = await createTestProject("CSV Project");
      const noteId = (
        await testDb
          .insert(nodes)
          .values({
            type: "note",
            name: "CSVN",
            parentId: projectId,
            createdBy: "user:test",
            updatedBy: "user:test",
          })
          .returning()
      )[0].id;

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "user",
        actorId: "user:csvtest",
        action: "create",
        contentAfter: { text: "csv data" },
      });

      const csv = await provenanceService.exportAuditCsv({});
      expect(csv).toContain(
        "id,nodeId,version,actorType,actorId,action,createdAt",
      );
      expect(csv).toContain("user:csvtest");
      expect(csv).toContain("create");
    });
  });

  describe("exportAuditHtml", () => {
    it("should return HTML document with table", async () => {
      const projectId = await createTestProject("HTML Project");
      const noteId = (
        await testDb
          .insert(nodes)
          .values({
            type: "note",
            name: "HTMLN",
            parentId: projectId,
            createdBy: "user:test",
            updatedBy: "user:test",
          })
          .returning()
      )[0].id;

      await provenanceService.recordChange({
        nodeId: noteId,
        actorType: "llm",
        actorId: "llm:htmltest",
        action: "update",
        contentAfter: { text: "html data" },
      });

      const html = await provenanceService.exportAuditHtml({});
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Audit Report");
      expect(html).toContain("<table>");
      expect(html).toContain("llm:htmltest");
    });
  });
});
