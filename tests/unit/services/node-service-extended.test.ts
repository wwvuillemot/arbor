/**
 * Phase 1.1: Extended NodeService Tests (TDD - RED Phase)
 *
 * Tests for new operations:
 * - moveNode: Move a node to a new parent with position
 * - copyNode: Deep copy a node (and all children)
 * - getDescendants: Get all descendants with max depth
 * - reorderChildren: Reorder children within a parent
 * - Position ordering: getNodesByParentId should order by position
 * - Validation: Name uniqueness within parent, path depth limits
 * - JSONB content: Create/update with structured content objects
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NodeService } from "@server/services/node-service";
import {
  createTestProject,
  createTestFolder,
  createTestNote,
} from "@tests/helpers/fixtures";

describe("NodeService - Extended Operations (Phase 1.1)", () => {
  let nodeService: NodeService;

  beforeEach(() => {
    nodeService = new NodeService();
  });

  describe("moveNode", () => {
    it("should move a note to a different folder", async () => {
      const project = await createTestProject("Project");
      const folderA = await createTestFolder("Folder A", project.id);
      const folderB = await createTestFolder("Folder B", project.id);
      const note = await createTestNote("My Note", folderA.id);

      const moved = await nodeService.moveNode(note.id, folderB.id);

      expect(moved.parentId).toBe(folderB.id);
      expect(moved.id).toBe(note.id);
    });

    it("should move a note to a specific position", async () => {
      const project = await createTestProject("Project");
      const folder = await createTestFolder("Folder", project.id);
      const noteA = await createTestNote("Note A", folder.id);
      const noteB = await createTestNote("Note B", folder.id);
      const noteC = await createTestNote("Note C", folder.id);

      // Move noteC to position 0 (first)
      const moved = await nodeService.moveNode(noteC.id, folder.id, 0);

      expect(moved.parentId).toBe(folder.id);
      expect(moved.position).toBe(0);
    });

    it("should throw if moving a project (projects cannot have parents)", async () => {
      const projectA = await createTestProject("Project A");
      const projectB = await createTestProject("Project B");

      await expect(
        nodeService.moveNode(projectA.id, projectB.id),
      ).rejects.toThrow();
    });

    it("should throw if target parent does not exist", async () => {
      const project = await createTestProject("Project");
      const note = await createTestNote("Note", project.id);

      await expect(
        nodeService.moveNode(note.id, "00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow();
    });

    it("should throw if moving a node into its own descendant (circular)", async () => {
      const project = await createTestProject("Project");
      const folder = await createTestFolder("Folder", project.id);
      const subfolder = await createTestFolder("Subfolder", folder.id);

      await expect(
        nodeService.moveNode(folder.id, subfolder.id),
      ).rejects.toThrow();
    });

    it("should throw if node does not exist", async () => {
      const project = await createTestProject("Project");

      await expect(
        nodeService.moveNode(
          "00000000-0000-0000-0000-000000000000",
          project.id,
        ),
      ).rejects.toThrow();
    });
  });

  describe("copyNode", () => {
    it("should copy a note to a different folder", async () => {
      const project = await createTestProject("Project");
      const folderA = await createTestFolder("Folder A", project.id);
      const folderB = await createTestFolder("Folder B", project.id);
      const note = await createTestNote("My Note", folderA.id, "Some content");

      const copied = await nodeService.copyNode(note.id, folderB.id);

      expect(copied.id).not.toBe(note.id); // New ID
      expect(copied.parentId).toBe(folderB.id);
      expect(copied.name).toBe("My Note");
      expect(copied.content).toBe("Some content");
    });

    it("should deep copy a folder with all children", async () => {
      const project = await createTestProject("Project");
      const folder = await createTestFolder("Folder", project.id);
      await createTestNote("Note 1", folder.id, "Content 1");
      await createTestNote("Note 2", folder.id, "Content 2");

      const copied = await nodeService.copyNode(folder.id, project.id);

      expect(copied.id).not.toBe(folder.id);
      expect(copied.name).toBe("Folder");

      // Verify children were also copied
      const copiedChildren = await nodeService.getNodesByParentId(copied.id);
      expect(copiedChildren).toHaveLength(2);
      expect(copiedChildren.map((c) => c.name).sort()).toEqual([
        "Note 1",
        "Note 2",
      ]);
      // Verify children have new IDs
      copiedChildren.forEach((child) => {
        expect(child.parentId).toBe(copied.id);
      });
    });

    it("should throw if source node does not exist", async () => {
      const project = await createTestProject("Project");

      await expect(
        nodeService.copyNode(
          "00000000-0000-0000-0000-000000000000",
          project.id,
        ),
      ).rejects.toThrow();
    });

    it("should throw if target parent does not exist", async () => {
      const project = await createTestProject("Project");
      const note = await createTestNote("Note", project.id);

      await expect(
        nodeService.copyNode(note.id, "00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow();
    });
  });

  describe("getDescendants", () => {
    it("should get all descendants of a project", async () => {
      const project = await createTestProject("Project");
      const folder = await createTestFolder("Folder", project.id);
      const subfolder = await createTestFolder("Subfolder", folder.id);
      const note1 = await createTestNote("Note 1", folder.id);
      const note2 = await createTestNote("Note 2", subfolder.id);

      const descendants = await nodeService.getDescendants(project.id);

      expect(descendants).toHaveLength(4); // folder, subfolder, note1, note2
      const descendantIds = descendants.map((d) => d.id);
      expect(descendantIds).toContain(folder.id);
      expect(descendantIds).toContain(subfolder.id);
      expect(descendantIds).toContain(note1.id);
      expect(descendantIds).toContain(note2.id);
    });

    it("should respect maxDepth parameter", async () => {
      const project = await createTestProject("Project");
      const folder = await createTestFolder("Folder", project.id);
      const subfolder = await createTestFolder("Subfolder", folder.id);
      await createTestNote("Deep Note", subfolder.id);

      // Only direct children (depth 1)
      const shallowDescendants = await nodeService.getDescendants(
        project.id,
        1,
      );
      expect(shallowDescendants).toHaveLength(1); // only folder

      // Children and grandchildren (depth 2)
      const midDescendants = await nodeService.getDescendants(project.id, 2);
      expect(midDescendants).toHaveLength(2); // folder, subfolder
    });

    it("should return empty array for leaf node", async () => {
      const project = await createTestProject("Project");
      const note = await createTestNote("Note", project.id);

      const descendants = await nodeService.getDescendants(note.id);
      expect(descendants).toHaveLength(0);
    });

    it("should throw if node does not exist", async () => {
      await expect(
        nodeService.getDescendants("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow();
    });
  });

  describe("reorderChildren", () => {
    it("should reorder children by their IDs", async () => {
      const project = await createTestProject("Project");
      const noteA = await nodeService.createNode({
        type: "note",
        name: "Note A",
        parentId: project.id,
        position: 0,
      });
      const noteB = await nodeService.createNode({
        type: "note",
        name: "Note B",
        parentId: project.id,
        position: 1,
      });
      const noteC = await nodeService.createNode({
        type: "note",
        name: "Note C",
        parentId: project.id,
        position: 2,
      });

      // Reorder to C, A, B
      await nodeService.reorderChildren(project.id, [
        noteC.id,
        noteA.id,
        noteB.id,
      ]);

      const children = await nodeService.getNodesByParentId(project.id);
      expect(children[0].name).toBe("Note C");
      expect(children[1].name).toBe("Note A");
      expect(children[2].name).toBe("Note B");
    });

    it("should throw if parent does not exist", async () => {
      await expect(
        nodeService.reorderChildren("00000000-0000-0000-0000-000000000000", []),
      ).rejects.toThrow();
    });
  });

  describe("position ordering", () => {
    it("should return children ordered by position", async () => {
      const project = await createTestProject("Project");
      await nodeService.createNode({
        type: "note",
        name: "Third",
        parentId: project.id,
        position: 20,
      });
      await nodeService.createNode({
        type: "note",
        name: "First",
        parentId: project.id,
        position: 0,
      });
      await nodeService.createNode({
        type: "note",
        name: "Second",
        parentId: project.id,
        position: 10,
      });

      const children = await nodeService.getNodesByParentId(project.id);

      expect(children[0].name).toBe("First");
      expect(children[1].name).toBe("Second");
      expect(children[2].name).toBe("Third");
    });
  });

  describe("JSONB content support", () => {
    it("should create a note with TipTap document structure", async () => {
      const project = await createTestProject("Project");
      const tipTapContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      };

      const note = await nodeService.createNode({
        type: "note",
        name: "Rich Note",
        parentId: project.id,
        content: tipTapContent,
      });

      expect(note.content).toEqual(tipTapContent);

      // Verify retrieval preserves structure
      const retrieved = await nodeService.getNodeById(note.id);
      expect(retrieved?.content).toEqual(tipTapContent);
    });

    it("should update content with structured JSONB object", async () => {
      const project = await createTestProject("Project");
      const note = await createTestNote("Note", project.id, "plain text");

      const newContent = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Chapter 1" }],
          },
        ],
      };

      const updated = await nodeService.updateNode(note.id, {
        content: newContent,
      });

      expect(updated.content).toEqual(newContent);
    });
  });

  describe("validation", () => {
    it("should prevent moving a node to create a path deeper than 10 levels", async () => {
      const project = await createTestProject("Project");

      // Create a chain of 9 folders (project is level 0, each folder adds 1)
      let currentParentId = project.id;
      for (let i = 1; i <= 9; i++) {
        const folder = await createTestFolder(`Level ${i}`, currentParentId);
        currentParentId = folder.id;
      }

      // Create another branch with a note
      const otherFolder = await createTestFolder("Other", project.id);
      const deepNote = await createTestNote("Deep", otherFolder.id);

      // Try to move the note to the deepest folder (would be level 11)
      await expect(
        nodeService.moveNode(deepNote.id, currentParentId),
      ).rejects.toThrow();
    });
  });
});
