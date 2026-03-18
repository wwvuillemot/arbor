import { beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "@server/api/router";
import { createContext } from "@server/api/trpc";
import { resetTestDb } from "@tests/helpers/db";

function createCaller() {
  return appRouter.createCaller(
    createContext({ req: {} as any, res: {} as any, info: {} as any }),
  );
}

describe("node move ordering integration", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it("persists manual sibling order when a node is moved after another sibling", async () => {
    const caller = createCaller();
    const project = await caller.nodes.create({
      type: "project",
      name: "Ordering Project",
      parentId: null,
    });
    const firstChild = await caller.nodes.create({
      type: "note",
      name: "First Child",
      parentId: project.id,
      position: 0,
    });
    const secondChild = await caller.nodes.create({
      type: "note",
      name: "Second Child",
      parentId: project.id,
      position: 1,
    });
    const thirdChild = await caller.nodes.create({
      type: "note",
      name: "Third Child",
      parentId: project.id,
      position: 2,
    });

    await caller.nodes.move({
      id: firstChild.id,
      newParentId: project.id,
      position: 2,
    });

    const reorderedChildren = await caller.nodes.getChildren({
      parentId: project.id,
    });

    expect(reorderedChildren.map((child) => child.id)).toEqual([
      secondChild.id,
      firstChild.id,
      thirdChild.id,
    ]);
    expect(reorderedChildren.map((child) => child.position)).toEqual([0, 1, 2]);
  });
});
