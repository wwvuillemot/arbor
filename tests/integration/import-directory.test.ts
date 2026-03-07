import { describe, it, expect } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { appRouter } from "@server/api/router";
import { createContext } from "@server/api/trpc";
import { nodes } from "@server/db/schema";
import { getTestDb } from "@tests/helpers/db";

const db = getTestDb();

function createCaller() {
  return appRouter.createCaller(
    createContext({ req: {} as any, res: {} as any, info: {} as any }),
  );
}

describe("importDirectory integration", () => {
  it("persists supported note extensions and returns nodeMap entries", async () => {
    const caller = createCaller();

    const importResult = await caller.nodes.importDirectory({
      projectName: "docs",
      files: [
        { path: "docs/notes/draft.txt", content: { type: "doc", content: [] } },
        {
          path: "docs/guides/intro.markdown",
          content: { type: "doc", content: [] },
        },
        {
          path: "docs/specs/component.mdx",
          content: { type: "doc", content: [] },
        },
      ],
    });

    expect(importResult.imported).toBe(3);
    expect(importResult.folders).toBe(3);
    expect(importResult.nodeMap["docs/notes/draft.txt"]).toBeTruthy();
    expect(importResult.nodeMap["docs/guides/intro.markdown"]).toBeTruthy();
    expect(importResult.nodeMap["docs/specs/component.mdx"]).toBeTruthy();

    const importedNodeIds = Object.values(importResult.nodeMap);
    const importedNotes = await db
      .select({
        id: nodes.id,
        name: nodes.name,
        parentId: nodes.parentId,
        type: nodes.type,
      })
      .from(nodes)
      .where(inArray(nodes.id, importedNodeIds));

    expect(importedNotes).toHaveLength(3);
    importedNotes.forEach((importedNote) => {
      expect(importedNote.type).toBe("note");
      expect(importedNote.parentId).toBeTruthy();
    });

    expect(
      new Set(importedNotes.map((importedNote) => importedNote.name)),
    ).toEqual(new Set(["Draft", "Intro", "Component"]));

    const [projectNode] = await db
      .select({ id: nodes.id, name: nodes.name, type: nodes.type })
      .from(nodes)
      .where(eq(nodes.id, importResult.projectId));

    expect(projectNode.type).toBe("project");
    expect(projectNode.name).toBe("docs");

    const projectChildFolders = await db
      .select({ name: nodes.name, type: nodes.type })
      .from(nodes)
      .where(eq(nodes.parentId, importResult.projectId));

    expect(projectChildFolders).toHaveLength(3);
    projectChildFolders.forEach((projectChildFolder) => {
      expect(projectChildFolder.type).toBe("folder");
    });
    expect(
      new Set(
        projectChildFolders.map(
          (projectChildFolder) => projectChildFolder.name,
        ),
      ),
    ).toEqual(new Set(["Notes", "Guides", "Specs"]));
  });

  it("skips hidden and unsupported files during import", async () => {
    const caller = createCaller();

    const importResult = await caller.nodes.importDirectory({
      projectName: "mixed-files",
      files: [
        {
          path: "mixed-files/visible-note.mdown",
          content: { type: "doc", content: [] },
        },
        {
          path: "mixed-files/.hidden-note.md",
          content: { type: "doc", content: [] },
        },
        { path: "mixed-files/image.png", content: "binary" },
      ],
    });

    expect(importResult.imported).toBe(1);
    expect(importResult.nodeMap["mixed-files/visible-note.mdown"]).toBeTruthy();
    expect(importResult.nodeMap["mixed-files/.hidden-note.md"]).toBeUndefined();
    expect(importResult.nodeMap["mixed-files/image.png"]).toBeUndefined();
  });

  it("returns the real projectId when importing into an existing folder", async () => {
    const caller = createCaller();

    const project = await caller.nodes.create({
      type: "project",
      name: "Existing Project",
      parentId: null,
    });
    const folder = await caller.nodes.create({
      type: "folder",
      name: "Imported Notes",
      parentId: project.id,
    });

    const importResult = await caller.nodes.importDirectory({
      projectName: "ignored-for-existing-folder-imports",
      parentNodeId: folder.id,
      files: [
        {
          path: "incoming/scene.md",
          content: { type: "doc", content: [] },
        },
      ],
    });

    expect(importResult.projectId).toBe(project.id);
    expect(importResult.importTargetNodeId).toBe(folder.id);

    const [importedNote] = await db
      .select({
        id: nodes.id,
        parentId: nodes.parentId,
        type: nodes.type,
      })
      .from(nodes)
      .where(eq(nodes.id, importResult.nodeMap["incoming/scene.md"]));

    expect(importedNote.type).toBe("note");
    expect(importedNote.parentId).toBe(folder.id);
  });

  it("persists import source path metadata for imported folders and notes", async () => {
    const caller = createCaller();

    const importResult = await caller.nodes.importDirectory({
      projectName: "pathfinders",
      files: [
        {
          path: "pathfinders/places/bedlam.md",
          content: { type: "doc", content: [] },
        },
      ],
    });

    const [importedFolder] = await db
      .select({
        id: nodes.id,
        name: nodes.name,
        metadata: nodes.metadata,
      })
      .from(nodes)
      .where(eq(nodes.parentId, importResult.projectId));

    expect(importedFolder.name).toBe("Places");
    expect(importedFolder.metadata).toMatchObject({
      importSourcePath: "pathfinders/places",
    });

    const [importedNote] = await db
      .select({
        id: nodes.id,
        metadata: nodes.metadata,
      })
      .from(nodes)
      .where(
        eq(nodes.id, importResult.nodeMap["pathfinders/places/bedlam.md"]),
      );

    expect(importedNote.metadata).toMatchObject({
      importSourcePath: "pathfinders/places/bedlam.md",
    });
  });
});
