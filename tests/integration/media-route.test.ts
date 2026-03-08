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

describe("Media route integration", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    const result = await createServer();
    server = result.server;
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it("serves attachment bytes from /media/:id without redirecting", async () => {
    const minioService = createTestMinioService();
    await minioService.ensureBucket("arbor-test");

    const mediaService = new MediaAttachmentService(minioService);
    const project = await createTestProject("Integration Media Project");
    const note = await createTestNote("Integration Media Note", project.id);
    const content = "integration media payload";

    const attachment = await mediaService.createAttachment({
      nodeId: note.id,
      projectId: project.id,
      buffer: Buffer.from(content),
      filename: "payload.txt",
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
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.body).toBe(content);

    await mediaService.deleteAttachment(attachment.id);
  });
});
