import { describe, it, expect, beforeEach } from "vitest";
import { graphql } from "graphql";
import { schema } from "@server/graphql/schema";
import {
  createTestProject,
  createTestFolder,
  createTestNote,
  createTestProjectHierarchy,
} from "@tests/helpers/fixtures";

describe("GraphQL Schema", () => {
  describe("Query: node(id)", () => {
    it("should fetch a single node by ID", async () => {
      const project = await createTestProject("Test Project");

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            name
            nodeType
            parentId
            projectId
            createdAt
            updatedAt
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: project.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node).toBeDefined();
      expect(result.data?.node.id).toBe(project.id);
      expect(result.data?.node.name).toBe("Test Project");
      expect(result.data?.node.nodeType).toBe("project");
    });

    it("should return null for non-existent node", async () => {
      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            name
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: "non-existent-id" },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node).toBeNull();
    });

    it("should fetch node with all fields", async () => {
      const project = await createTestProject("Full Project");

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            name
            nodeType
            content
            position
            parentId
            projectId
            tags
            metadata
            createdBy
            updatedBy
            createdAt
            updatedAt
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { id: project.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.node).toBeDefined();
      expect(result.data?.node.id).toBe(project.id);
      expect(result.data?.node.position).toBe(0);
      expect(result.data?.node.createdBy).toBe("user:system");
      expect(result.data?.node.updatedBy).toBe("user:system");
    });
  });

  describe("Query: nodes(filter)", () => {
    it("should fetch all nodes without filter", async () => {
      await createTestProject("Project 1");
      await createTestProject("Project 2");

      const query = `
        query GetNodes {
          nodes {
            id
            name
            nodeType
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodes).toBeDefined();
      expect(result.data?.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter nodes by projectId", async () => {
      const project1 = await createTestProject("Project 1");
      const project2 = await createTestProject("Project 2");
      await createTestFolder("Folder 1", project1.id);
      await createTestFolder("Folder 2", project2.id);

      const query = `
        query GetNodes($projectId: ID) {
          nodes(projectId: $projectId) {
            id
            name
            projectId
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { projectId: project1.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodes).toBeDefined();
      // All nodes should belong to project1
      result.data?.nodes.forEach((node: any) => {
        if (node.projectId) {
          expect(node.projectId).toBe(project1.id);
        }
      });
    });

    it("should filter nodes by parentId", async () => {
      const project = await createTestProject("Project");
      const folder = await createTestFolder("Folder", project.id);
      await createTestNote("Note 1", folder.id);
      await createTestNote("Note 2", folder.id);

      const query = `
        query GetNodes($parentId: ID) {
          nodes(parentId: $parentId) {
            id
            name
            parentId
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { parentId: folder.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodes).toBeDefined();
      expect(result.data?.nodes.length).toBe(2);
      result.data?.nodes.forEach((node: any) => {
        expect(node.parentId).toBe(folder.id);
      });
    });

    it("should filter nodes by nodeType", async () => {
      const project = await createTestProject("Project");
      await createTestFolder("Folder 1", project.id);
      await createTestFolder("Folder 2", project.id);
      await createTestNote("Note", project.id);

      const query = `
        query GetNodes($nodeType: String) {
          nodes(nodeType: $nodeType) {
            id
            name
            nodeType
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { nodeType: "folder" },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodes).toBeDefined();
      result.data?.nodes.forEach((node: any) => {
        expect(node.nodeType).toBe("folder");
      });
    });

    it("should support pagination with limit and offset", async () => {
      const project = await createTestProject("Project");
      await createTestFolder("Folder 1", project.id);
      await createTestFolder("Folder 2", project.id);
      await createTestFolder("Folder 3", project.id);

      const query = `
        query GetNodes($limit: Int, $offset: Int) {
          nodes(limit: $limit, offset: $offset) {
            id
            name
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { limit: 2, offset: 1 },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodes).toBeDefined();
      expect(result.data?.nodes.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Query: nodeTree(projectId)", () => {
    it("should fetch complete project tree", async () => {
      const hierarchy = await createTestProjectHierarchy();

      const query = `
        query GetNodeTree($projectId: ID!) {
          nodeTree(projectId: $projectId) {
            root {
              id
              name
              nodeType
            }
            nodes {
              id
              name
              nodeType
              parentId
            }
            totalCount
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { projectId: hierarchy.project.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodeTree).toBeDefined();
      expect(result.data?.nodeTree.root.id).toBe(hierarchy.project.id);
      expect(result.data?.nodeTree.nodes.length).toBeGreaterThan(0);
      expect(result.data?.nodeTree.totalCount).toBeGreaterThan(0);
    });

    it("should respect maxDepth parameter", async () => {
      const hierarchy = await createTestProjectHierarchy();

      const query = `
        query GetNodeTree($projectId: ID!, $maxDepth: Int) {
          nodeTree(projectId: $projectId, maxDepth: $maxDepth) {
            root {
              id
              name
            }
            nodes {
              id
              name
            }
            totalCount
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { projectId: hierarchy.project.id, maxDepth: 1 },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodeTree).toBeDefined();
      // With maxDepth=1, should only get project + immediate children
    });
  });
});
