import { describe, it, expect } from "vitest";
import { graphql } from "graphql";
import { schema } from "@server/graphql/schema";
import {
  createTestProject,
  createTestFolder,
  createTestNote,
  createTestProjectHierarchy,
} from "@tests/helpers/fixtures";

describe("GraphQL Relationship Resolvers", () => {
  describe("Node.parent resolver", () => {
    it("should resolve parent node", async () => {
      const project = await createTestProject("Project");
      const folder = await createTestFolder("Folder", project.id);

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            name
            parent {
              id
              name
              nodeType
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: folder.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.parent).toBeDefined();
      expect(result.data?.node.parent.id).toBe(project.id);
      expect(result.data?.node.parent.name).toBe("Project");
    });

    it("should return null for node without parent", async () => {
      const project = await createTestProject("Project");

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            name
            parent {
              id
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: project.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.parent).toBeNull();
    });
  });

  describe("Node.children resolver", () => {
    it("should resolve children nodes", async () => {
      const project = await createTestProject("Project");
      await createTestFolder("Folder 1", project.id);
      await createTestFolder("Folder 2", project.id);
      await createTestNote("Note", project.id);

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            name
            children {
              id
              name
              nodeType
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: project.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.children).toBeDefined();
      expect(result.data?.node.children.length).toBe(3);
    });

    it("should return empty array for node without children", async () => {
      const project = await createTestProject("Project");
      const note = await createTestNote("Note", project.id);

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            name
            children {
              id
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: note.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.children).toEqual([]);
    });
  });

  describe("Node.project resolver", () => {
    it("should resolve project for nested node", async () => {
      const project = await createTestProject("My Project");
      const folder = await createTestFolder("Folder", project.id);
      const note = await createTestNote("Note", folder.id);

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            name
            project {
              id
              name
              nodeType
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: note.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.project).toBeDefined();
      expect(result.data?.node.project.id).toBe(project.id);
      expect(result.data?.node.project.name).toBe("My Project");
      expect(result.data?.node.project.nodeType).toBe("project");
    });

    it("should return self for project node", async () => {
      const project = await createTestProject("My Project");

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            project {
              id
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: project.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.project.id).toBe(project.id);
    });
  });

  describe("Node.ancestors resolver", () => {
    it("should resolve all ancestors in order", async () => {
      const project = await createTestProject("Project");
      const folder = await createTestFolder("Folder", project.id);
      const subfolder = await createTestFolder("Subfolder", folder.id);
      const note = await createTestNote("Note", subfolder.id);

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            name
            ancestors {
              id
              name
              nodeType
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: note.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.ancestors).toBeDefined();
      expect(result.data?.node.ancestors.length).toBe(3);
      // Should be ordered from closest to root: subfolder -> folder -> project
      expect(result.data?.node.ancestors[0].id).toBe(subfolder.id);
      expect(result.data?.node.ancestors[1].id).toBe(folder.id);
      expect(result.data?.node.ancestors[2].id).toBe(project.id);
    });

    it("should return empty array for project node", async () => {
      const project = await createTestProject("Project");

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            ancestors {
              id
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: project.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.ancestors).toEqual([]);
    });
  });

  describe("Node.descendants resolver", () => {
    it("should resolve all descendants", async () => {
      const hierarchy = await createTestProjectHierarchy();

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            name
            descendants {
              id
              name
              nodeType
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: hierarchy.project.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.descendants).toBeDefined();
      expect(result.data?.node.descendants.length).toBeGreaterThan(0);
    });

    it("should respect maxDepth parameter", async () => {
      const project = await createTestProject("Project");
      const folder = await createTestFolder("Folder", project.id);
      const subfolder = await createTestFolder("Subfolder", folder.id);
      await createTestNote("Deep Note", subfolder.id);

      const query = `
        query GetNode($id: ID!, $maxDepth: Int) {
          node(id: $id) {
            id
            descendants(maxDepth: $maxDepth) {
              id
              name
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: project.id, maxDepth: 1 },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.descendants).toBeDefined();
      // With maxDepth=1, should only get immediate children (folder)
      expect(result.data?.node.descendants.length).toBe(1);
      expect(result.data?.node.descendants[0].id).toBe(folder.id);
    });

    it("should return empty array for leaf node", async () => {
      const project = await createTestProject("Project");
      const note = await createTestNote("Note", project.id);

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            descendants {
              id
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: note.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node.descendants).toEqual([]);
    });
  });
});
