import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "@server/api/index";
import type { FastifyInstance } from "fastify";
import type { ApolloServer } from "@apollo/server";
import { createTestProject, createTestNote } from "@tests/helpers/fixtures";

describe("GraphQL Endpoint Integration", () => {
  let server: FastifyInstance;
  let apollo: ApolloServer;

  beforeAll(async () => {
    const result = await createServer();
    server = result.server;
    apollo = result.apollo;
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe("POST /graphql", () => {
    it("should respond to a basic __typename query", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/graphql",
        headers: { "content-type": "application/json" },
        payload: {
          query: "{ __typename }",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.__typename).toBe("Query");
    });

    it("should execute a node query with variables", async () => {
      const project = await createTestProject("GraphQL Endpoint Test");

      const response = await server.inject({
        method: "POST",
        url: "/graphql",
        headers: { "content-type": "application/json" },
        payload: {
          query: `
            query GetNode($id: ID!) {
              node(id: $id) {
                id
                name
                nodeType
              }
            }
          `,
          variables: { id: project.id },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.errors).toBeUndefined();
      expect(body.data.node).toBeDefined();
      expect(body.data.node.id).toBe(project.id);
      expect(body.data.node.name).toBe("GraphQL Endpoint Test");
      expect(body.data.node.nodeType).toBe("project");
    });

    it("should return errors for invalid queries", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/graphql",
        headers: { "content-type": "application/json" },
        payload: {
          query: "{ nonExistentField }",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.errors).toBeDefined();
      expect(body.errors.length).toBeGreaterThan(0);
    });

    it("should handle introspection queries", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/graphql",
        headers: { "content-type": "application/json" },
        payload: {
          query: `
            {
              __schema {
                queryType {
                  name
                }
                types {
                  name
                }
              }
            }
          `,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.errors).toBeUndefined();
      expect(body.data.__schema).toBeDefined();
      expect(body.data.__schema.queryType.name).toBe("Query");
    });
  });

  describe("GET /graphql", () => {
    it("should handle GET requests with query parameter", async () => {
      const query = encodeURIComponent("{ __typename }");
      const response = await server.inject({
        method: "GET",
        url: `/graphql?query=${query}`,
        headers: {
          // Apollo Server 4 CSRF protection requires one of these headers for GET requests
          "apollo-require-preflight": "true",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data).toBeDefined();
      expect(body.data.__typename).toBe("Query");
    });
  });

  describe("Root endpoint", () => {
    it("should list /graphql in available endpoints", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.endpoints.graphql).toBe("/graphql");
    });
  });

  describe("Relational queries via HTTP", () => {
    it("should resolve nested relationships through the endpoint", async () => {
      const project = await createTestProject("Parent Project");
      const note = await createTestNote("Child Note", project.id, "content");

      const response = await server.inject({
        method: "POST",
        url: "/graphql",
        headers: { "content-type": "application/json" },
        payload: {
          query: `
            query GetNodeWithChildren($id: ID!) {
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
          `,
          variables: { id: project.id },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.errors).toBeUndefined();
      expect(body.data.node.children).toHaveLength(1);
      expect(body.data.node.children[0].id).toBe(note.id);
      expect(body.data.node.children[0].name).toBe("Child Note");
    });
  });
});
