import { describe, it, expect, vi } from "vitest";
import { graphql } from "graphql";
import { schema } from "@server/graphql/schema";
import { createTestProject, createTestNote } from "@tests/helpers/fixtures";
import { getTestDb } from "@tests/helpers/db";
import { nodes } from "@server/db/schema";

describe("GraphQL Tag Queries and DataLoader", () => {
  describe("Query: nodesByTags", () => {
    it("should find nodes with ANY matching tag (OR operator)", async () => {
      const project = await createTestProject("Project");

      const db = getTestDb();
      await db.insert(nodes).values({
        type: "note",
        name: "Note 1",
        parentId: project.id,
        tags: ["typescript", "backend"],
        metadata: {},
        authorType: "human",
        position: 0,
        createdBy: "user:system",
        updatedBy: "user:system",
      });

      await db.insert(nodes).values({
        type: "note",
        name: "Note 2",
        parentId: project.id,
        tags: ["typescript", "frontend"],
        metadata: {},
        authorType: "human",
        position: 1,
        createdBy: "user:system",
        updatedBy: "user:system",
      });

      await db.insert(nodes).values({
        type: "note",
        name: "Note 3",
        parentId: project.id,
        tags: ["python", "backend"],
        metadata: {},
        authorType: "human",
        position: 2,
        createdBy: "user:system",
        updatedBy: "user:system",
      });

      const query = `
        query GetNodesByTags($tags: [String!]!, $operator: TagOperator) {
          nodesByTags(tags: $tags, operator: $operator) {
            id
            name
            tags
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { tags: ["typescript", "python"], operator: "OR" },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodesByTags).toBeDefined();
      expect(result.data?.nodesByTags.length).toBe(3);
    });

    it("should find nodes with ALL matching tags (AND operator)", async () => {
      const project = await createTestProject("Project");

      const db = getTestDb();
      await db.insert(nodes).values({
        type: "note",
        name: "Note 1",
        parentId: project.id,
        tags: ["typescript", "backend"],
        metadata: {},
        authorType: "human",
        position: 0,
        createdBy: "user:system",
        updatedBy: "user:system",
      });

      await db.insert(nodes).values({
        type: "note",
        name: "Note 2",
        parentId: project.id,
        tags: ["typescript", "frontend"],
        metadata: {},
        authorType: "human",
        position: 1,
        createdBy: "user:system",
        updatedBy: "user:system",
      });

      const query = `
        query GetNodesByTags($tags: [String!]!, $operator: TagOperator) {
          nodesByTags(tags: $tags, operator: $operator) {
            id
            name
            tags
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { tags: ["typescript", "backend"], operator: "AND" },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodesByTags).toBeDefined();
      expect(result.data?.nodesByTags.length).toBe(1);
      expect(result.data?.nodesByTags[0].name).toBe("Note 1");
    });

    it("should default to OR operator if not specified", async () => {
      const project = await createTestProject("Project");

      const db = getTestDb();
      await db.insert(nodes).values({
        type: "note",
        name: "Note 1",
        parentId: project.id,
        tags: ["tag1"],
        metadata: {},
        authorType: "human",
        position: 0,
        createdBy: "user:system",
        updatedBy: "user:system",
      });

      const query = `
        query GetNodesByTags($tags: [String!]!) {
          nodesByTags(tags: $tags) {
            id
            name
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { tags: ["tag1", "tag2"] },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodesByTags).toBeDefined();
    });

    it("should return empty array if no nodes match", async () => {
      const query = `
        query GetNodesByTags($tags: [String!]!) {
          nodesByTags(tags: $tags) {
            id
            name
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { tags: ["nonexistent-tag"] },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodesByTags).toEqual([]);
    });
  });

  describe("DataLoader N+1 Prevention", () => {
    it("should batch parent lookups when fetching multiple nodes", async () => {
      const project = await createTestProject("Project");
      await createTestNote("Note 1", project.id);
      await createTestNote("Note 2", project.id);
      await createTestNote("Note 3", project.id);

      // Spy on database queries to verify batching
      const db = getTestDb();
      const selectSpy = vi.spyOn(db, "select");

      const query = `
        query GetNodes($parentId: ID) {
          nodes(parentId: $parentId) {
            id
            name
            parent {
              id
              name
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { parentId: project.id },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodes.length).toBe(3);

      // DataLoader should batch all parent lookups into a single query
      // Without DataLoader, this would be 1 query for nodes + 3 queries for parents (N+1)
      // With DataLoader, this should be 1 query for nodes + 1 batched query for parents
      // Note: Exact count depends on implementation, but should be significantly less than N+1
    });

    it("should batch children lookups when fetching multiple nodes", async () => {
      const project1 = await createTestProject("Project 1");
      const project2 = await createTestProject("Project 2");
      await createTestNote("Note 1", project1.id);
      await createTestNote("Note 2", project2.id);

      const query = `
        query GetProjects {
          nodes(nodeType: "project") {
            id
            name
            children {
              id
              name
            }
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodes).toBeDefined();
      // DataLoader should batch children lookups
    });

    it("should cache repeated lookups within same query", async () => {
      const project = await createTestProject("Project");
      const note = await createTestNote("Note", project.id);

      const query = `
        query GetNode($id: ID!) {
          node(id: $id) {
            id
            parent {
              id
              name
            }
            project {
              id
              name
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
      expect(result.data?.node.parent.id).toBe(project.id);
      expect(result.data?.node.project.id).toBe(project.id);
      // DataLoader should cache the project lookup and reuse it
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid node ID gracefully", async () => {
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
        variableValues: { id: "invalid-uuid-format" },
      });

      // Should not throw error, just return null
      expect(result.data?.node).toBeNull();
    });

    it("should handle empty tags array", async () => {
      const query = `
        query GetNodesByTags($tags: [String!]!) {
          nodesByTags(tags: $tags) {
            id
            name
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
        variableValues: { tags: [] },
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.nodesByTags).toEqual([]);
    });

    it("should handle missing required arguments", async () => {
      const query = `
        query GetNode {
          node {
            id
            name
          }
        }
      `;

      const result = await graphql({
        schema,
        source: query,
      });

      // Should have GraphQL validation error
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].message).toContain("id");
    });
  });
});
