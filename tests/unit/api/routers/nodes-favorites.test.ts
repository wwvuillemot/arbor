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

describe("Nodes Favorites", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("toggleFavorite", () => {
    it("should mark a node as favorite", async () => {
      const caller = createCaller();
      const project = await createTestProject("FavProject");
      const note = await createTestNote(project.id, "FavNote");

      const updated = await caller.nodes.toggleFavorite({ nodeId: note.id });

      expect((updated.metadata as Record<string, unknown>)?.isFavorite).toBe(
        true,
      );
    });

    it("should unfavorite a node on second call", async () => {
      const caller = createCaller();
      const project = await createTestProject("UnfavProject");
      const note = await createTestNote(project.id, "UnfavNote");

      await caller.nodes.toggleFavorite({ nodeId: note.id });
      const updated = await caller.nodes.toggleFavorite({ nodeId: note.id });

      expect((updated.metadata as Record<string, unknown>)?.isFavorite).toBe(
        false,
      );
    });

    it("should throw when node does not exist", async () => {
      const caller = createCaller();
      await expect(
        caller.nodes.toggleFavorite({
          nodeId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow("Node not found");
    });

    it("should preserve existing metadata when toggling", async () => {
      const project = await createTestProject("MetaProject");
      const note = await nodeService.createNode({
        type: "note",
        name: "MetaNote",
        parentId: project.id,
        metadata: { customField: "value", count: 42 },
        createdBy: "user:test",
        updatedBy: "user:test",
      });
      const caller = createCaller();

      const updated = await caller.nodes.toggleFavorite({ nodeId: note.id });

      const meta = updated.metadata as Record<string, unknown>;
      expect(meta.isFavorite).toBe(true);
      expect(meta.customField).toBe("value");
      expect(meta.count).toBe(42);
    });
  });

  describe("getFavorites", () => {
    it("should return favorited nodes for a project", async () => {
      const caller = createCaller();
      const project = await createTestProject("GetFavProject");
      const note1 = await createTestNote(project.id, "FavNote1");
      const note2 = await createTestNote(project.id, "FavNote2");
      await createTestNote(project.id, "NotFavNote");

      await caller.nodes.toggleFavorite({ nodeId: note1.id });
      await caller.nodes.toggleFavorite({ nodeId: note2.id });

      const favorites = await caller.nodes.getFavorites({
        projectId: project.id,
      });

      const ids = favorites.map((n) => n.id);
      expect(ids).toContain(note1.id);
      expect(ids).toContain(note2.id);
      expect(ids).not.toContain(project.id);
    });

    it("should exclude unfavorited nodes", async () => {
      const caller = createCaller();
      const project = await createTestProject("ExcludeProject");
      const note = await createTestNote(project.id, "ToggleNote");

      await caller.nodes.toggleFavorite({ nodeId: note.id });
      await caller.nodes.toggleFavorite({ nodeId: note.id });

      const favorites = await caller.nodes.getFavorites({
        projectId: project.id,
      });

      expect(favorites.map((n) => n.id)).not.toContain(note.id);
    });

    it("should return empty array when no favorites exist", async () => {
      const caller = createCaller();
      const project = await createTestProject("EmptyFavProject");
      await createTestNote(project.id, "RegularNote");

      const favorites = await caller.nodes.getFavorites({
        projectId: project.id,
      });

      expect(favorites).toHaveLength(0);
    });

    it("should only return favorites for the specified project", async () => {
      const caller = createCaller();
      const project1 = await createTestProject("P1");
      const project2 = await createTestProject("P2");
      const note1 = await createTestNote(project1.id, "N1");
      const note2 = await createTestNote(project2.id, "N2");

      await caller.nodes.toggleFavorite({ nodeId: note1.id });
      await caller.nodes.toggleFavorite({ nodeId: note2.id });

      const favs1 = await caller.nodes.getFavorites({ projectId: project1.id });
      const favs2 = await caller.nodes.getFavorites({ projectId: project2.id });

      expect(favs1.map((n) => n.id)).toContain(note1.id);
      expect(favs1.map((n) => n.id)).not.toContain(note2.id);
      expect(favs2.map((n) => n.id)).toContain(note2.id);
      expect(favs2.map((n) => n.id)).not.toContain(note1.id);
    });
  });
});
