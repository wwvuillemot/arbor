import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "@server/api/router";
import { createContext } from "@server/api/trpc";
import { resetTestDb } from "@tests/helpers/db";

function createCaller() {
  return appRouter.createCaller(
    createContext({ req: {} as any, res: {} as any, info: {} as any }),
  );
}

describe("node lock integration", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("rejects renaming a locked node through the nodes router", async () => {
    const caller = createCaller();
    const project = await caller.nodes.create({
      type: "project",
      name: "Locked Project",
      parentId: null,
    });

    await caller.nodes.toggleLock({ nodeId: project.id });

    await expect(
      caller.nodes.update({
        id: project.id,
        data: { name: "Blocked Rename" },
      }),
    ).rejects.toThrow("Node is locked");
  });

  it("rejects reordering children under a locked parent through the nodes router", async () => {
    const caller = createCaller();
    const project = await caller.nodes.create({
      type: "project",
      name: "Locked Parent",
      parentId: null,
    });
    const firstChild = await caller.nodes.create({
      type: "note",
      name: "First Child",
      parentId: project.id,
    });
    const secondChild = await caller.nodes.create({
      type: "note",
      name: "Second Child",
      parentId: project.id,
    });

    await caller.nodes.toggleLock({ nodeId: project.id });

    await expect(
      caller.nodes.reorder({
        parentId: project.id,
        childIds: [secondChild.id, firstChild.id],
      }),
    ).rejects.toThrow("Parent node is locked");
  });
});
