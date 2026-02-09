import { describe, it, expect } from "vitest";
import { TagService } from "@/services/tag-service";
import { createTestProject, createTestNote } from "@tests/helpers/fixtures";

describe("TagService", () => {
  const tagService = new TagService();

  // ─── createTag ────────────────────────────────────────────────────────

  describe("createTag", () => {
    it("should create a tag with only a name", async () => {
      const tag = await tagService.createTag({ name: "protagonist" });

      expect(tag).toBeDefined();
      expect(tag.id).toBeDefined();
      expect(tag.name).toBe("protagonist");
      expect(tag.type).toBe("general");
      expect(tag.color).toBeNull();
      expect(tag.icon).toBeNull();
      expect(tag.createdAt).toBeDefined();
      expect(tag.updatedAt).toBeDefined();
    });

    it("should create a tag with all fields", async () => {
      const tag = await tagService.createTag({
        name: "Aria",
        color: "#3b82f6",
        icon: "user",
        type: "character",
      });

      expect(tag.name).toBe("Aria");
      expect(tag.color).toBe("#3b82f6");
      expect(tag.icon).toBe("user");
      expect(tag.type).toBe("character");
    });

    it("should create tags with different types", async () => {
      const characterTag = await tagService.createTag({
        name: "Hero",
        type: "character",
      });
      const locationTag = await tagService.createTag({
        name: "Castle",
        type: "location",
      });
      const eventTag = await tagService.createTag({
        name: "Battle",
        type: "event",
      });
      const conceptTag = await tagService.createTag({
        name: "Honor",
        type: "concept",
      });

      expect(characterTag.type).toBe("character");
      expect(locationTag.type).toBe("location");
      expect(eventTag.type).toBe("event");
      expect(conceptTag.type).toBe("concept");
    });

    it("should allow duplicate tag names", async () => {
      const tag1 = await tagService.createTag({ name: "magic" });
      const tag2 = await tagService.createTag({ name: "magic" });

      expect(tag1.id).not.toBe(tag2.id);
      expect(tag1.name).toBe(tag2.name);
    });
  });

  // ─── getTagById ───────────────────────────────────────────────────────

  describe("getTagById", () => {
    it("should return a tag by ID", async () => {
      const created = await tagService.createTag({ name: "test-tag" });
      const found = await tagService.getTagById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe("test-tag");
    });

    it("should return null for non-existent tag", async () => {
      const result = await tagService.getTagById(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(result).toBeNull();
    });
  });

  // ─── getAllTags ────────────────────────────────────────────────────────

  describe("getAllTags", () => {
    it("should return all tags", async () => {
      await tagService.createTag({ name: "tag-a" });
      await tagService.createTag({ name: "tag-b" });
      await tagService.createTag({ name: "tag-c" });

      const allTags = await tagService.getAllTags();
      expect(allTags).toHaveLength(3);
    });

    it("should return empty array when no tags exist", async () => {
      const allTags = await tagService.getAllTags();
      expect(allTags).toHaveLength(0);
    });

    it("should filter tags by type", async () => {
      await tagService.createTag({ name: "Aria", type: "character" });
      await tagService.createTag({ name: "Castle", type: "location" });
      await tagService.createTag({ name: "Hero", type: "character" });

      const characterTags = await tagService.getAllTags("character");
      expect(characterTags).toHaveLength(2);
      expect(characterTags.every((t) => t.type === "character")).toBe(true);

      const locationTags = await tagService.getAllTags("location");
      expect(locationTags).toHaveLength(1);
      expect(locationTags[0].name).toBe("Castle");
    });
  });

  // ─── updateTag ────────────────────────────────────────────────────────

  describe("updateTag", () => {
    it("should update tag name", async () => {
      const tag = await tagService.createTag({ name: "old-name" });
      const updated = await tagService.updateTag(tag.id, {
        name: "new-name",
      });

      expect(updated.name).toBe("new-name");
      expect(updated.id).toBe(tag.id);
    });

    it("should update tag color and icon", async () => {
      const tag = await tagService.createTag({ name: "styled" });
      const updated = await tagService.updateTag(tag.id, {
        color: "#ff0000",
        icon: "star",
      });

      expect(updated.color).toBe("#ff0000");
      expect(updated.icon).toBe("star");
    });

    it("should update tag type", async () => {
      const tag = await tagService.createTag({ name: "person" });
      expect(tag.type).toBe("general");

      const updated = await tagService.updateTag(tag.id, {
        type: "character",
      });
      expect(updated.type).toBe("character");
    });

    it("should update updatedAt timestamp", async () => {
      const tag = await tagService.createTag({ name: "timed" });
      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 50));
      const updated = await tagService.updateTag(tag.id, { name: "timed-v2" });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        tag.updatedAt.getTime(),
      );
    });

    it("should throw for non-existent tag", async () => {
      await expect(
        tagService.updateTag("00000000-0000-0000-0000-000000000000", {
          name: "nope",
        }),
      ).rejects.toThrow("Tag not found");
    });
  });

  // ─── deleteTag ────────────────────────────────────────────────────────

  describe("deleteTag", () => {
    it("should delete a tag", async () => {
      const tag = await tagService.createTag({ name: "to-delete" });
      await tagService.deleteTag(tag.id);

      const found = await tagService.getTagById(tag.id);
      expect(found).toBeNull();
    });

    it("should throw for non-existent tag", async () => {
      await expect(
        tagService.deleteTag("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow("Tag not found");
    });

    it("should cascade delete node_tags when tag is deleted", async () => {
      const project = await createTestProject("Tag Delete Project");
      const note = await createTestNote("Note 1", project.id);
      const tag = await tagService.createTag({ name: "ephemeral" });

      await tagService.addTagToNode(note.id, tag.id);
      const tagsBefore = await tagService.getNodeTags(note.id);
      expect(tagsBefore).toHaveLength(1);

      await tagService.deleteTag(tag.id);
      const tagsAfter = await tagService.getNodeTags(note.id);
      expect(tagsAfter).toHaveLength(0);
    });
  });

  // ─── addTagToNode ─────────────────────────────────────────────────────

  describe("addTagToNode", () => {
    it("should associate a tag with a node", async () => {
      const project = await createTestProject("Tag Project");
      const note = await createTestNote("Tagged Note", project.id);
      const tag = await tagService.createTag({ name: "important" });

      await tagService.addTagToNode(note.id, tag.id);

      const nodeTags = await tagService.getNodeTags(note.id);
      expect(nodeTags).toHaveLength(1);
      expect(nodeTags[0].id).toBe(tag.id);
    });

    it("should allow multiple tags on one node", async () => {
      const project = await createTestProject("Multi-tag Project");
      const note = await createTestNote("Multi-tagged", project.id);
      const tag1 = await tagService.createTag({ name: "alpha" });
      const tag2 = await tagService.createTag({ name: "beta" });
      const tag3 = await tagService.createTag({ name: "gamma" });

      await tagService.addTagToNode(note.id, tag1.id);
      await tagService.addTagToNode(note.id, tag2.id);
      await tagService.addTagToNode(note.id, tag3.id);

      const nodeTags = await tagService.getNodeTags(note.id);
      expect(nodeTags).toHaveLength(3);
    });

    it("should not duplicate when adding same tag twice", async () => {
      const project = await createTestProject("Dedup Project");
      const note = await createTestNote("Dedup Note", project.id);
      const tag = await tagService.createTag({ name: "unique" });

      await tagService.addTagToNode(note.id, tag.id);
      await tagService.addTagToNode(note.id, tag.id); // duplicate

      const nodeTags = await tagService.getNodeTags(note.id);
      expect(nodeTags).toHaveLength(1);
    });

    it("should throw for non-existent node", async () => {
      const tag = await tagService.createTag({ name: "orphan-tag" });
      await expect(
        tagService.addTagToNode("00000000-0000-0000-0000-000000000000", tag.id),
      ).rejects.toThrow("Node not found");
    });

    it("should throw for non-existent tag", async () => {
      const project = await createTestProject("No Tag Project");
      const note = await createTestNote("No Tag Note", project.id);
      await expect(
        tagService.addTagToNode(
          note.id,
          "00000000-0000-0000-0000-000000000000",
        ),
      ).rejects.toThrow("Tag not found");
    });
  });

  // ─── removeTagFromNode ─────────────────────────────────────────────

  describe("removeTagFromNode", () => {
    it("should remove a tag from a node", async () => {
      const project = await createTestProject("Remove Tag Project");
      const note = await createTestNote("Remove Tag Note", project.id);
      const tag = await tagService.createTag({ name: "removable" });

      await tagService.addTagToNode(note.id, tag.id);
      expect(await tagService.getNodeTags(note.id)).toHaveLength(1);

      await tagService.removeTagFromNode(note.id, tag.id);
      expect(await tagService.getNodeTags(note.id)).toHaveLength(0);
    });

    it("should not error when removing non-existent association", async () => {
      const project = await createTestProject("Phantom Project");
      const note = await createTestNote("Phantom Note", project.id);
      const tag = await tagService.createTag({ name: "phantom" });

      await expect(
        tagService.removeTagFromNode(note.id, tag.id),
      ).resolves.not.toThrow();
    });

    it("should only remove the specified tag, leaving others", async () => {
      const project = await createTestProject("Selective Project");
      const note = await createTestNote("Selective Note", project.id);
      const tag1 = await tagService.createTag({ name: "keep-me" });
      const tag2 = await tagService.createTag({ name: "remove-me" });

      await tagService.addTagToNode(note.id, tag1.id);
      await tagService.addTagToNode(note.id, tag2.id);
      expect(await tagService.getNodeTags(note.id)).toHaveLength(2);

      await tagService.removeTagFromNode(note.id, tag2.id);
      const remaining = await tagService.getNodeTags(note.id);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(tag1.id);
    });
  });

  // ─── getNodeTags ───────────────────────────────────────────────────

  describe("getNodeTags", () => {
    it("should return empty array for node with no tags", async () => {
      const project = await createTestProject("Untagged Project");
      const note = await createTestNote("Untagged Note", project.id);

      const nodeTags = await tagService.getNodeTags(note.id);
      expect(nodeTags).toEqual([]);
    });

    it("should return all tags for a node", async () => {
      const project = await createTestProject("Multi Project");
      const note = await createTestNote("Multi Note", project.id);
      const tag1 = await tagService.createTag({ name: "first" });
      const tag2 = await tagService.createTag({ name: "second" });
      const tag3 = await tagService.createTag({ name: "third" });

      await tagService.addTagToNode(note.id, tag1.id);
      await tagService.addTagToNode(note.id, tag2.id);
      await tagService.addTagToNode(note.id, tag3.id);

      const nodeTags = await tagService.getNodeTags(note.id);
      expect(nodeTags).toHaveLength(3);
      const names = nodeTags.map((t) => t.name).sort();
      expect(names).toEqual(["first", "second", "third"]);
    });

    it("should return tags with correct fields", async () => {
      const project = await createTestProject("Fields Project");
      const note = await createTestNote("Fields Note", project.id);
      const tag = await tagService.createTag({
        name: "detailed",
        color: "#00ff00",
        icon: "leaf",
        type: "concept",
      });

      await tagService.addTagToNode(note.id, tag.id);

      const nodeTags = await tagService.getNodeTags(note.id);
      expect(nodeTags).toHaveLength(1);
      expect(nodeTags[0].name).toBe("detailed");
      expect(nodeTags[0].color).toBe("#00ff00");
      expect(nodeTags[0].icon).toBe("leaf");
      expect(nodeTags[0].type).toBe("concept");
    });
  });

  // ─── getNodesByTag ─────────────────────────────────────────────────

  describe("getNodesByTag", () => {
    it("should return empty array for tag with no nodes", async () => {
      const tag = await tagService.createTag({ name: "lonely" });

      const taggedNodes = await tagService.getNodesByTag(tag.id);
      expect(taggedNodes).toEqual([]);
    });

    it("should return all nodes with a specific tag", async () => {
      const project = await createTestProject("Shared Tag Project");
      const note1 = await createTestNote("Note A", project.id);
      const note2 = await createTestNote("Note B", project.id);
      const tag = await tagService.createTag({ name: "shared" });

      await tagService.addTagToNode(note1.id, tag.id);
      await tagService.addTagToNode(note2.id, tag.id);

      const taggedNodes = await tagService.getNodesByTag(tag.id);
      expect(taggedNodes).toHaveLength(2);
      const nodeNames = taggedNodes.map((n) => n.name).sort();
      expect(nodeNames).toEqual(["Note A", "Note B"]);
    });

    it("should not return nodes with different tags", async () => {
      const project = await createTestProject("Distinct Project");
      const note1 = await createTestNote("Tagged Node", project.id);
      const note2 = await createTestNote("Other Node", project.id);
      const tag1 = await tagService.createTag({ name: "tag-one" });
      const tag2 = await tagService.createTag({ name: "tag-two" });

      await tagService.addTagToNode(note1.id, tag1.id);
      await tagService.addTagToNode(note2.id, tag2.id);

      const nodesWithTag1 = await tagService.getNodesByTag(tag1.id);
      expect(nodesWithTag1).toHaveLength(1);
      expect(nodesWithTag1[0].name).toBe("Tagged Node");
    });
  });

  // ─── linkEntityNode ──────────────────────────────────────────────────

  describe("linkEntityNode", () => {
    it("should link a character tag to an entity node", async () => {
      const project = await createTestProject("Entity Project");
      const note = await createTestNote("Character Sheet", project.id);
      const tag = await tagService.createTag({
        name: "Aria",
        type: "character",
      });

      const updated = await tagService.linkEntityNode(tag.id, note.id);
      expect(updated.entityNodeId).toBe(note.id);
    });

    it("should link other entity types", async () => {
      const project = await createTestProject("Entity Project");
      const note = await createTestNote("Location Page", project.id);
      const tag = await tagService.createTag({
        name: "Castle",
        type: "location",
      });

      const updated = await tagService.linkEntityNode(tag.id, note.id);
      expect(updated.entityNodeId).toBe(note.id);
    });

    it("should reject linking general tags", async () => {
      const project = await createTestProject("General Project");
      const note = await createTestNote("Some Note", project.id);
      const tag = await tagService.createTag({
        name: "misc",
        type: "general",
      });

      await expect(tagService.linkEntityNode(tag.id, note.id)).rejects.toThrow(
        "Only entity-type tags",
      );
    });

    it("should throw if tag not found", async () => {
      await expect(
        tagService.linkEntityNode(
          "00000000-0000-0000-0000-000000000000",
          "00000000-0000-0000-0000-000000000001",
        ),
      ).rejects.toThrow("Tag not found");
    });

    it("should throw if node not found", async () => {
      const tag = await tagService.createTag({
        name: "Ghost",
        type: "character",
      });

      await expect(
        tagService.linkEntityNode(
          tag.id,
          "00000000-0000-0000-0000-000000000001",
        ),
      ).rejects.toThrow("Node not found");
    });
  });

  // ─── unlinkEntityNode ────────────────────────────────────────────────

  describe("unlinkEntityNode", () => {
    it("should unlink a tag from its entity node", async () => {
      const project = await createTestProject("Unlink Project");
      const note = await createTestNote("Entity Page", project.id);
      const tag = await tagService.createTag({
        name: "Hero",
        type: "character",
      });

      await tagService.linkEntityNode(tag.id, note.id);
      const unlinked = await tagService.unlinkEntityNode(tag.id);
      expect(unlinked.entityNodeId).toBeNull();
    });

    it("should throw if tag not found", async () => {
      await expect(
        tagService.unlinkEntityNode("00000000-0000-0000-0000-000000000000"),
      ).rejects.toThrow("Tag not found");
    });
  });

  // ─── createEntityNode ────────────────────────────────────────────────

  describe("createEntityNode", () => {
    it("should create an entity node and link it to the tag", async () => {
      const project = await createTestProject("Entity Create Project");
      const tag = await tagService.createTag({
        name: "Villain",
        type: "character",
      });

      const result = await tagService.createEntityNode(tag.id, project.id);
      expect(result.tag.entityNodeId).toBe(result.node.id);
      expect(result.node.name).toBe("Villain");
      expect(result.node.type).toBe("note");
      expect(result.node.parentId).toBe(project.id);
      expect(
        (result.node.metadata as Record<string, unknown>).entityTagId,
      ).toBe(tag.id);
      expect((result.node.metadata as Record<string, unknown>).entityType).toBe(
        "character",
      );
    });

    it("should create entity nodes for location type", async () => {
      const project = await createTestProject("Loc Project");
      const tag = await tagService.createTag({
        name: "Dark Forest",
        type: "location",
      });

      const result = await tagService.createEntityNode(tag.id, project.id);
      expect(result.node.name).toBe("Dark Forest");
      expect(result.node.slug).toBe("dark-forest");
    });

    it("should reject creating entity node for general tags", async () => {
      const project = await createTestProject("No Entity");
      const tag = await tagService.createTag({
        name: "misc",
        type: "general",
      });

      await expect(
        tagService.createEntityNode(tag.id, project.id),
      ).rejects.toThrow("Only entity-type tags");
    });

    it("should reject if tag already has an entity node", async () => {
      const project = await createTestProject("Duplicate Entity");
      const tag = await tagService.createTag({
        name: "Duplicate",
        type: "character",
      });

      await tagService.createEntityNode(tag.id, project.id);

      await expect(
        tagService.createEntityNode(tag.id, project.id),
      ).rejects.toThrow("already has an entity node");
    });

    it("should throw if parent not found", async () => {
      const tag = await tagService.createTag({
        name: "Orphan",
        type: "event",
      });

      await expect(
        tagService.createEntityNode(
          tag.id,
          "00000000-0000-0000-0000-000000000001",
        ),
      ).rejects.toThrow("Parent node not found");
    });

    it("should throw if tag not found", async () => {
      await expect(
        tagService.createEntityNode(
          "00000000-0000-0000-0000-000000000000",
          "00000000-0000-0000-0000-000000000001",
        ),
      ).rejects.toThrow("Tag not found");
    });
  });
});
