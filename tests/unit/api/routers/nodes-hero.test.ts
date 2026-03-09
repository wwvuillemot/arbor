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

describe("Nodes Hero Image and Summary", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  describe("summary field", () => {
    it("should save summary when creating a node", async () => {
      const caller = createCaller();
      const project = await caller.nodes.create({
        type: "project",
        name: "Epic Fantasy",
        summary: "A sweeping epic about dragons and destiny",
      });

      expect(project.summary).toBe("A sweeping epic about dragons and destiny");
    });

    it("should update summary on an existing node", async () => {
      const caller = createCaller();
      const project = await createTestProject("Update Summary Project");

      const updated = await caller.nodes.update({
        id: project.id,
        data: { summary: "Revised logline about the dark forest" },
      });

      expect(updated.summary).toBe("Revised logline about the dark forest");
    });

    it("should return null summary when not set", async () => {
      const caller = createCaller();
      const project = await createTestProject("No Summary Project");

      expect(project.summary).toBeNull();
    });

    it("should allow clearing summary by setting to null", async () => {
      const caller = createCaller();
      const project = await createTestProject("Clear Summary Project");

      await caller.nodes.update({
        id: project.id,
        data: { summary: "Some summary" },
      });

      const cleared = await caller.nodes.update({
        id: project.id,
        data: { summary: null },
      });

      expect(cleared.summary).toBeNull();
    });
  });

  describe("setHeroImage", () => {
    it("should store heroAttachmentId in metadata", async () => {
      const caller = createCaller();
      const project = await createTestProject("Hero Image Project");

      const updated = await caller.nodes.setHeroImage({
        nodeId: project.id,
        attachmentId: "11111111-1111-1111-1111-111111111111",
      });

      const meta = updated.metadata as Record<string, unknown>;
      expect(meta.heroAttachmentId).toBe(
        "11111111-1111-1111-1111-111111111111",
      );
    });

    it("should preserve other metadata when setting hero image", async () => {
      const project = await nodeService.createNode({
        type: "project",
        name: "Meta Preserve Project",
        metadata: {
          styleProfile: { artStyle: "watercolor" },
          isFavorite: true,
        },
        createdBy: "user:test",
        updatedBy: "user:test",
      });
      const caller = createCaller();

      const updated = await caller.nodes.setHeroImage({
        nodeId: project.id,
        attachmentId: "22222222-2222-2222-2222-222222222222",
      });

      const meta = updated.metadata as Record<string, unknown>;
      expect(meta.heroAttachmentId).toBe(
        "22222222-2222-2222-2222-222222222222",
      );
      expect((meta.styleProfile as Record<string, unknown>).artStyle).toBe(
        "watercolor",
      );
      expect(meta.isFavorite).toBe(true);
    });

    it("should allow clearing the hero image by passing null", async () => {
      const caller = createCaller();
      const project = await createTestProject("Clear Hero Project");

      await caller.nodes.setHeroImage({
        nodeId: project.id,
        attachmentId: "33333333-3333-3333-3333-333333333333",
      });

      const cleared = await caller.nodes.setHeroImage({
        nodeId: project.id,
        attachmentId: null,
      });

      const meta = cleared.metadata as Record<string, unknown>;
      expect(meta.heroAttachmentId).toBeNull();
    });

    it("should throw when node does not exist", async () => {
      const caller = createCaller();
      await expect(
        caller.nodes.setHeroImage({
          nodeId: "00000000-0000-0000-0000-000000000000",
          attachmentId: "11111111-1111-1111-1111-111111111111",
        }),
      ).rejects.toThrow("Node not found");
    });
  });
});
