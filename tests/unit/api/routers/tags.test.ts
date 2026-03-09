import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "@/api/router";
import { resetTestDb } from "@tests/helpers/db";
import { NodeService } from "@server/services/node-service";

const nodeService = new NodeService();

function createCaller() {
  return appRouter.createCaller({} as any);
}

async function createTestProject(name = "Test Project") {
  return nodeService.createNode({
    type: "project",
    name,
    createdBy: "user:test",
    updatedBy: "user:test",
  });
}

async function createTestNote(parentId: string, name = "Test Note") {
  return nodeService.createNode({
    type: "note",
    name,
    parentId,
    createdBy: "user:test",
    updatedBy: "user:test",
  });
}

describe("Tags Router", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("create", () => {
    it("should create a tag with name only", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "Fantasy" });

      expect(tag.id).toBeDefined();
      expect(tag.name).toBe("Fantasy");
      expect(tag.color).toBeNull();
      expect(tag.projectId).toBeNull();
    });

    it("should create a tag with color", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({
        name: "Magic",
        color: "#ff6600",
      });

      expect(tag.name).toBe("Magic");
      expect(tag.color).toBe("#ff6600");
    });

    it("should create a project-scoped tag", async () => {
      const project = await createTestProject("Scoped Project");
      const caller = createCaller();
      const tag = await caller.tags.create({
        name: "Chapter",
        projectId: project.id,
      });

      expect(tag.name).toBe("Chapter");
      expect(tag.projectId).toBe(project.id);
    });

    it("should create a tag with type", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({
        name: "Dragon",
        type: "character",
      });

      expect(tag.name).toBe("Dragon");
      expect(tag.type).toBe("character");
    });
  });

  describe("update", () => {
    it("should update a tag name", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "Old Name" });
      const updated = await caller.tags.update({
        id: tag.id,
        name: "New Name",
      });

      expect(updated.name).toBe("New Name");
      expect(updated.id).toBe(tag.id);
    });

    it("should update a tag color", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "Colorless" });
      const updated = await caller.tags.update({
        id: tag.id,
        color: "#123456",
      });

      expect(updated.color).toBe("#123456");
    });

    it("should clear color by setting null", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({
        name: "Colorful",
        color: "#abcdef",
      });
      const updated = await caller.tags.update({ id: tag.id, color: null });

      expect(updated.color).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete a tag", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "ToDelete" });
      const result = await caller.tags.delete({ id: tag.id });

      expect(result.success).toBe(true);

      // Verify it no longer exists
      await expect(caller.tags.getById({ id: tag.id })).rejects.toThrow(
        "Tag not found",
      );
    });
  });

  describe("getAll", () => {
    it("should return all tags", async () => {
      const caller = createCaller();
      await caller.tags.create({ name: "Alpha" });
      await caller.tags.create({ name: "Beta" });

      const tags = await caller.tags.getAll();
      expect(tags.length).toBeGreaterThanOrEqual(2);
      const names = tags.map((t) => t.name);
      expect(names).toContain("Alpha");
      expect(names).toContain("Beta");
    });

    it("should filter by type", async () => {
      const caller = createCaller();
      await caller.tags.create({ name: "CharTag", type: "character" });
      await caller.tags.create({ name: "LocationTag", type: "location" });

      const charTags = await caller.tags.getAll({ type: "character" });
      charTags.forEach((t) => expect(t.type).toBe("character"));
    });

    it("should include project-scoped tags when projectId provided", async () => {
      const project = await createTestProject("FilterProject");
      const caller = createCaller();
      await caller.tags.create({ name: "GlobalTag" });
      await caller.tags.create({ name: "ProjectTag", projectId: project.id });

      const tags = await caller.tags.getAll({ projectId: project.id });
      const names = tags.map((t) => t.name);
      expect(names).toContain("GlobalTag");
      expect(names).toContain("ProjectTag");
    });
  });

  describe("getById", () => {
    it("should return a tag by id", async () => {
      const caller = createCaller();
      const created = await caller.tags.create({
        name: "FindMe",
        color: "#001122",
      });
      const found = await caller.tags.getById({ id: created.id });

      expect(found.id).toBe(created.id);
      expect(found.name).toBe("FindMe");
      expect(found.color).toBe("#001122");
    });

    it("should throw for non-existent tag", async () => {
      const caller = createCaller();
      await expect(
        caller.tags.getById({ id: "00000000-0000-0000-0000-000000000000" }),
      ).rejects.toThrow("Tag not found");
    });
  });

  describe("addToNode / removeFromNode / getNodeTags", () => {
    it("should add a tag to a node and retrieve it", async () => {
      const project = await createTestProject("TagProject");
      const note = await createTestNote(project.id, "TagNote");
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "Important" });

      const result = await caller.tags.addToNode({
        nodeId: note.id,
        tagId: tag.id,
      });
      expect(result.success).toBe(true);

      const nodeTags = await caller.tags.getNodeTags({ nodeId: note.id });
      expect(nodeTags.map((t) => t.id)).toContain(tag.id);
    });

    it("should remove a tag from a node", async () => {
      const project = await createTestProject("RemoveTagProject");
      const note = await createTestNote(project.id, "RemoveTagNote");
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "Temporary" });

      await caller.tags.addToNode({ nodeId: note.id, tagId: tag.id });
      const removeResult = await caller.tags.removeFromNode({
        nodeId: note.id,
        tagId: tag.id,
      });
      expect(removeResult.success).toBe(true);

      const nodeTags = await caller.tags.getNodeTags({ nodeId: note.id });
      expect(nodeTags.map((t) => t.id)).not.toContain(tag.id);
    });

    it("should return empty array for node with no tags", async () => {
      const project = await createTestProject("EmptyTagsProject");
      const note = await createTestNote(project.id, "UntaggedNote");
      const caller = createCaller();

      const nodeTags = await caller.tags.getNodeTags({ nodeId: note.id });
      expect(nodeTags).toEqual([]);
    });
  });

  describe("getNodesByTag", () => {
    it("should return nodes that have a specific tag", async () => {
      const project = await createTestProject("NodesByTagProject");
      const noteA = await createTestNote(project.id, "NoteA");
      const noteB = await createTestNote(project.id, "NoteB");
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "SharedTag" });

      await caller.tags.addToNode({ nodeId: noteA.id, tagId: tag.id });
      await caller.tags.addToNode({ nodeId: noteB.id, tagId: tag.id });

      const nodes = await caller.tags.getNodesByTag({ tagId: tag.id });
      const nodeIds = nodes.map((n) => n.id);
      expect(nodeIds).toContain(noteA.id);
      expect(nodeIds).toContain(noteB.id);
    });

    it("should return empty array when no nodes have the tag", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "UnusedTag" });

      const nodes = await caller.tags.getNodesByTag({ tagId: tag.id });
      expect(nodes).toEqual([]);
    });
  });

  describe("getNodesByTags", () => {
    it("should return nodes with OR logic (default)", async () => {
      const project = await createTestProject("MultiTagProject");
      const noteA = await createTestNote(project.id, "NoteAOnly");
      const noteB = await createTestNote(project.id, "NoteBOnly");
      const caller = createCaller();
      const tagX = await caller.tags.create({ name: "TagX" });
      const tagY = await caller.tags.create({ name: "TagY" });

      await caller.tags.addToNode({ nodeId: noteA.id, tagId: tagX.id });
      await caller.tags.addToNode({ nodeId: noteB.id, tagId: tagY.id });

      const nodes = await caller.tags.getNodesByTags({
        tagIds: [tagX.id, tagY.id],
        operator: "OR",
      });
      const nodeIds = nodes.map((n) => n.id);
      expect(nodeIds).toContain(noteA.id);
      expect(nodeIds).toContain(noteB.id);
    });

    it("should return only nodes with ALL tags when AND logic", async () => {
      const project = await createTestProject("AndTagProject");
      const noteA = await createTestNote(project.id, "NoteWithBothTags");
      const noteB = await createTestNote(project.id, "NoteWithOneTag");
      const caller = createCaller();
      const tagA = await caller.tags.create({ name: "TagAnd1" });
      const tagB = await caller.tags.create({ name: "TagAnd2" });

      await caller.tags.addToNode({ nodeId: noteA.id, tagId: tagA.id });
      await caller.tags.addToNode({ nodeId: noteA.id, tagId: tagB.id });
      await caller.tags.addToNode({ nodeId: noteB.id, tagId: tagA.id });

      const nodes = await caller.tags.getNodesByTags({
        tagIds: [tagA.id, tagB.id],
        operator: "AND",
      });
      const nodeIds = nodes.map((n) => n.id);
      expect(nodeIds).toContain(noteA.id);
      expect(nodeIds).not.toContain(noteB.id);
    });
  });

  describe("getTagsWithCounts", () => {
    it("should return tags with usage counts", async () => {
      const project = await createTestProject("CountProject");
      const note = await createTestNote(project.id, "CountNote");
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "CountedTag" });

      await caller.tags.addToNode({ nodeId: note.id, tagId: tag.id });

      const tagsWithCounts = await caller.tags.getTagsWithCounts();
      const found = tagsWithCounts.find((t) => t.id === tag.id);
      expect(found).toBeDefined();
      expect(found!.nodeCount).toBeGreaterThanOrEqual(1);
    });

    it("should return count of 0 for unused tags", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "UnusedCountTag" });

      const tagsWithCounts = await caller.tags.getTagsWithCounts();
      const found = tagsWithCounts.find((t) => t.id === tag.id);
      expect(found).toBeDefined();
      expect(found!.nodeCount).toBe(0);
    });
  });

  describe("getRelatedTags", () => {
    it("should return tags that co-occur with a given tag", async () => {
      const project = await createTestProject("RelatedProject");
      const note = await createTestNote(project.id, "RelatedNote");
      const caller = createCaller();
      const tagA = await caller.tags.create({ name: "RelA" });
      const tagB = await caller.tags.create({ name: "RelB" });

      await caller.tags.addToNode({ nodeId: note.id, tagId: tagA.id });
      await caller.tags.addToNode({ nodeId: note.id, tagId: tagB.id });

      const related = await caller.tags.getRelatedTags({ tagId: tagA.id });
      expect(Array.isArray(related)).toBe(true);
      const relatedIds = related.map((t) => t.id);
      expect(relatedIds).toContain(tagB.id);
    });

    it("should return empty array when no co-occurring tags", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "LonelyTag" });

      const related = await caller.tags.getRelatedTags({ tagId: tag.id });
      expect(related).toEqual([]);
    });

    it("should respect limit option", async () => {
      const project = await createTestProject("LimitRelProject");
      const note = await createTestNote(project.id, "LimitRelNote");
      const caller = createCaller();
      const baseTag = await caller.tags.create({ name: "BaseTag" });

      // Add 5 co-occurring tags
      for (let i = 0; i < 5; i++) {
        const t = await caller.tags.create({ name: `CoTag${i}` });
        await caller.tags.addToNode({ nodeId: note.id, tagId: baseTag.id });
        await caller.tags.addToNode({ nodeId: note.id, tagId: t.id });
      }

      const related = await caller.tags.getRelatedTags({
        tagId: baseTag.id,
        limit: 3,
      });
      expect(related.length).toBeLessThanOrEqual(3);
    });
  });

  describe("linkEntityNode / unlinkEntityNode / createEntityNode", () => {
    it("should link an entity node to a tag", async () => {
      const project = await createTestProject("EntityProject");
      const entityNote = await createTestNote(project.id, "DragonEntity");
      const caller = createCaller();
      const tag = await caller.tags.create({
        name: "Dragon",
        type: "character",
      });

      const linked = await caller.tags.linkEntityNode({
        tagId: tag.id,
        entityNodeId: entityNote.id,
      });
      expect(linked.entityNodeId).toBe(entityNote.id);
    });

    it("should unlink an entity node from a tag", async () => {
      const project = await createTestProject("UnlinkProject");
      const entityNote = await createTestNote(project.id, "UnlinkEntity");
      const caller = createCaller();
      const tag = await caller.tags.create({
        name: "UnlinkTag",
        type: "character",
      });

      await caller.tags.linkEntityNode({
        tagId: tag.id,
        entityNodeId: entityNote.id,
      });

      const unlinked = await caller.tags.unlinkEntityNode({ tagId: tag.id });
      expect(unlinked.entityNodeId).toBeNull();
    });

    it("should create an entity node for a tag", async () => {
      const project = await createTestProject("CreateEntityProject");
      const caller = createCaller();
      const tag = await caller.tags.create({
        name: "NewEntity",
        type: "character",
      });

      const result = await caller.tags.createEntityNode({
        tagId: tag.id,
        parentId: project.id,
      });

      expect(result.tag.entityNodeId).toBeDefined();
      expect(result.tag.entityNodeId).not.toBeNull();
      expect(result.node.name).toBe("NewEntity");
    });
  });

  describe("bulkAddToNodes", () => {
    it("should add a tag to all specified nodes", async () => {
      const caller = createCaller();
      const project = await createTestProject("BulkAddProject");
      const note1 = await createTestNote(project.id, "Note1");
      const note2 = await createTestNote(project.id, "Note2");
      const tag = await caller.tags.create({ name: "BulkTag" });

      const result = await caller.tags.bulkAddToNodes({
        nodeIds: [note1.id, note2.id],
        tagId: tag.id,
      });

      expect(result.success).toBe(true);

      const tags1 = await caller.tags.getNodeTags({ nodeId: note1.id });
      const tags2 = await caller.tags.getNodeTags({ nodeId: note2.id });
      expect(tags1.map((t) => t.id)).toContain(tag.id);
      expect(tags2.map((t) => t.id)).toContain(tag.id);
    });

    it("should be idempotent when tag already applied to a node", async () => {
      const caller = createCaller();
      const project = await createTestProject("IdempotentProject");
      const note = await createTestNote(project.id, "Note");
      const tag = await caller.tags.create({ name: "IdempotentTag" });

      await caller.tags.addToNode({ nodeId: note.id, tagId: tag.id });
      await caller.tags.bulkAddToNodes({ nodeIds: [note.id], tagId: tag.id });

      const tags = await caller.tags.getNodeTags({ nodeId: note.id });
      const matching = tags.filter((t) => t.id === tag.id);
      expect(matching).toHaveLength(1);
    });

    it("should handle an empty nodeIds array without error", async () => {
      const caller = createCaller();
      const tag = await caller.tags.create({ name: "EmptyBulkTag" });
      const result = await caller.tags.bulkAddToNodes({
        nodeIds: [],
        tagId: tag.id,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("bulkRemoveFromNodes", () => {
    it("should remove a tag from all specified nodes", async () => {
      const caller = createCaller();
      const project = await createTestProject("BulkRemoveProject");
      const note1 = await createTestNote(project.id, "NoteA");
      const note2 = await createTestNote(project.id, "NoteB");
      const tag = await caller.tags.create({ name: "RemovableTag" });

      await caller.tags.addToNode({ nodeId: note1.id, tagId: tag.id });
      await caller.tags.addToNode({ nodeId: note2.id, tagId: tag.id });

      const result = await caller.tags.bulkRemoveFromNodes({
        nodeIds: [note1.id, note2.id],
        tagId: tag.id,
      });

      expect(result.success).toBe(true);

      const tags1 = await caller.tags.getNodeTags({ nodeId: note1.id });
      const tags2 = await caller.tags.getNodeTags({ nodeId: note2.id });
      expect(tags1.map((t) => t.id)).not.toContain(tag.id);
      expect(tags2.map((t) => t.id)).not.toContain(tag.id);
    });

    it("should handle removing a tag not applied to a node without error", async () => {
      const caller = createCaller();
      const project = await createTestProject("NoTagProject");
      const note = await createTestNote(project.id, "NoteC");
      const tag = await caller.tags.create({ name: "NotAppliedTag" });

      await expect(
        caller.tags.bulkRemoveFromNodes({ nodeIds: [note.id], tagId: tag.id }),
      ).resolves.toEqual({ success: true });
    });
  });
});
