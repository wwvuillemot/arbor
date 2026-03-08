import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "@server/api/index";
import { MediaAttachmentService } from "@/services/media-attachment-service";
import { MinioService } from "@/services/minio";
import { createTestNote, createTestProject } from "@tests/helpers/fixtures";

function createTestMinioService(): MinioService {
  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const endPoint = endpoint.includes(":") ? endpoint.split(":")[0] : endpoint;

  return new MinioService({
    endPoint,
    port: 9000,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || "arbor",
    secretKey: process.env.MINIO_SECRET_KEY || "local_dev_only",
  });
}

describe("API server bootstrap", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    const apiServer = await createServer();
    server = apiServer.server;
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it("serves the health endpoint", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok" });
  });

  it("serves GraphQL GET requests via query parameters", async () => {
    const encodedQuery = encodeURIComponent("{ __typename }");
    const response = await server.inject({
      method: "GET",
      url: `/graphql?query=${encodedQuery}`,
      headers: {
        "apollo-require-preflight": "true",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: { __typename: "Query" },
    });
  });

  it("returns 404 for a missing media attachment route", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/media/00000000-0000-0000-0000-000000000000",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "Media not found" });
  });

  it("serves media attachments directly without redirecting to MinIO", async () => {
    const minioService = createTestMinioService();
    await minioService.ensureBucket("arbor-test");

    const mediaService = new MediaAttachmentService(minioService);
    const project = await createTestProject("Direct Media Project");
    const note = await createTestNote("Direct Media Note", project.id);
    const content = "direct media response";

    const attachment = await mediaService.createAttachment({
      nodeId: note.id,
      projectId: project.id,
      buffer: Buffer.from(content),
      filename: "direct.txt",
      mimeType: "text/plain",
      bucket: "arbor-test",
    });

    const response = await server.inject({
      method: "GET",
      url: `/media/${attachment.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.location).toBeUndefined();
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.headers["content-disposition"]).toContain("inline");
    expect(response.headers["content-disposition"]).toContain("direct.txt");
    expect(response.body).toBe(content);

    await mediaService.deleteAttachment(attachment.id);
  });
});
