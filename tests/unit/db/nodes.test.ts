import { describe, it, expect } from "vitest";
import { getTestDb } from "@tests/helpers/db";
import {
  createTestProject,
  createTestFolder,
  createTestNote,
} from "@tests/helpers/fixtures";
import { nodes } from "@server/db/schema";
import { eq, isNull } from "drizzle-orm";

describe("Database - Nodes Table", () => {
  describe("Project Creation", () => {
    it("should create a project with null parent_id", async () => {
      const project = await createTestProject("My Novel");

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.type).toBe("project");
      expect(project.name).toBe("My Novel");
      expect(project.parentId).toBeNull();
      expect(project.createdAt).toBeDefined();
      expect(project.updatedAt).toBeDefined();
    });

    it("should create multiple independent projects", async () => {
      const project1 = await createTestProject("Novel 1");
      const project2 = await createTestProject("Novel 2");

      expect(project1.id).not.toBe(project2.id);
      expect(project1.parentId).toBeNull();
      expect(project2.parentId).toBeNull();
    });

    it("should generate a slug from the project name", async () => {
      const project = await createTestProject("My Fantasy Novel");

      expect(project.slug).toBe("my-fantasy-novel");
    });
  });

  describe("Folder Creation", () => {
    it("should create a folder under a project", async () => {
      const project = await createTestProject("My Novel");
      const folder = await createTestFolder("Characters", project.id);

      expect(folder).toBeDefined();
      expect(folder.type).toBe("folder");
      expect(folder.name).toBe("Characters");
      expect(folder.parentId).toBe(project.id);
    });

    it("should create nested folders", async () => {
      const project = await createTestProject("My Novel");
      const folder1 = await createTestFolder("Characters", project.id);
      const folder2 = await createTestFolder("Protagonists", folder1.id);

      expect(folder2.parentId).toBe(folder1.id);
    });
  });

  describe("Note Creation", () => {
    it("should create a note under a folder", async () => {
      const project = await createTestProject("My Novel");
      const folder = await createTestFolder("Characters", project.id);
      const note = await createTestNote("Aria", folder.id, "A young mage.");

      expect(note).toBeDefined();
      expect(note.type).toBe("note");
      expect(note.name).toBe("Aria");
      expect(note.content).toBe("A young mage.");
      expect(note.parentId).toBe(folder.id);
    });

    it("should allow empty content", async () => {
      const project = await createTestProject("My Novel");
      const note = await createTestNote("Draft", project.id);

      expect(note.content).toBe("");
    });
  });

  describe("Node Retrieval", () => {
    it("should retrieve a node by id", async () => {
      const project = await createTestProject("My Novel");
      const db = getTestDb();

      const [retrieved] = await db
        .select()
        .from(nodes)
        .where(eq(nodes.id, project.id));

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(project.id);
      expect(retrieved.name).toBe("My Novel");
    });

    it("should retrieve all top-level projects", async () => {
      await createTestProject("Novel 1");
      await createTestProject("Novel 2");
      await createTestProject("Novel 3");

      const db = getTestDb();
      const projects = await db
        .select()
        .from(nodes)
        .where(isNull(nodes.parentId));

      expect(projects).toHaveLength(3);
      projects.forEach((p) => {
        expect(p.type).toBe("project");
        expect(p.parentId).toBeNull();
      });
    });

    it("should retrieve children of a node", async () => {
      const project = await createTestProject("My Novel");
      await createTestFolder("Characters", project.id);
      await createTestFolder("Locations", project.id);
      await createTestFolder("Plot", project.id);

      const db = getTestDb();
      const children = await db
        .select()
        .from(nodes)
        .where(eq(nodes.parentId, project.id));

      expect(children).toHaveLength(3);
      children.forEach((child) => {
        expect(child.parentId).toBe(project.id);
        expect(child.type).toBe("folder");
      });
    });
  });

  describe("Node Update", () => {
    it("should update node name", async () => {
      const project = await createTestProject("My Novel");
      const db = getTestDb();

      const [updated] = await db
        .update(nodes)
        .set({ name: "My Fantasy Novel" })
        .where(eq(nodes.id, project.id))
        .returning();

      expect(updated.name).toBe("My Fantasy Novel");
      expect(updated.id).toBe(project.id);
    });

    it("should update node content", async () => {
      const project = await createTestProject("My Novel");
      const note = await createTestNote(
        "Character",
        project.id,
        "Initial content",
      );
      const db = getTestDb();

      const [updated] = await db
        .update(nodes)
        .set({ content: "Updated content" })
        .where(eq(nodes.id, note.id))
        .returning();

      expect(updated.content).toBe("Updated content");
    });
  });

  describe("Node Deletion", () => {
    it("should delete a node", async () => {
      const project = await createTestProject("My Novel");
      const db = getTestDb();

      await db.delete(nodes).where(eq(nodes.id, project.id));

      const [retrieved] = await db
        .select()
        .from(nodes)
        .where(eq(nodes.id, project.id));

      expect(retrieved).toBeUndefined();
    });
  });
});
